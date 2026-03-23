import express from 'express'
import cors from 'cors'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'

// Initialize OpenAI Agents SDK (must be imported before agents)
import './agents/config.js'
import { run, extractAllTextOutput } from '@openai/agents'
import { characterCreatorAgent } from './agents/character-creator.js'
import { inventoryCreatorAgent } from './agents/inventory-creator.js'
import { campaignGeneratorAgent } from './agents/campaign-generator.js'
import { createCampaign, loadSession, CAMPAIGNS_DIR, CHARACTERS_DIR } from './agents/tools/state.js'
import { generateImage } from './agents/tools/image.js'
import { validateCharacter, validateInventory } from './agents/tools/validation.js'
import { generateSessionPipeline, generateSceneImage } from './pipeline/session.js'
import { resolveChoicePipeline } from './pipeline/choice.js'
import { generateWorldPipeline } from './pipeline/world.js'
import { updateWorldSectionPipeline } from './pipeline/world-section.js'
import { WORLDS_DIR, listWorlds, resolveWorld, saveWorld } from './agents/tools/world-state.js'
import { validateWorldStructure } from './agents/tools/world-validation.js'
import { worldCoherenceAgent } from './agents/world-coherence.js'
import { log, initLog, validateEnv, extractJSON, resolveCampaign, resolveCharacter, resolveGameContext } from './utils.js'
import { HttpError } from './types.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// ─── Server Setup ───

initLog()
validateEnv()

const app = express()
const PORT = process.env.PORT || 3001

app.use(cors())
app.use(express.json())

// Serve generated images
app.use('/images', express.static(path.join(__dirname, '../../characters')))
app.use('/scene-images', express.static(path.join(__dirname, '../../campaigns')))
app.use('/world-images', express.static(WORLDS_DIR))

// ─── Portrait art style prompts ───

const ART_STYLE_PROMPTS: Record<string, string> = {
  'classic_fantasy': 'classic fantasy art style, Larry Elmore, TSR, 1980s D&D, detailed oil painting',
  'anime': 'anime art style, JRPG character portrait, vibrant colors, cel shaded',
  'dark_souls': 'dark fantasy art style, FromSoftware aesthetic, moody lighting, grim atmosphere',
  'watercolor': 'watercolor illustration, soft edges, artistic brush strokes, delicate colors',
  'oil_painting': 'renaissance oil painting style, dramatic chiaroscuro, classical portrait',
  'comic_book': 'comic book art style, bold lines, dynamic shading, superhero aesthetic',
  'realistic': 'photorealistic digital art, highly detailed, cinematic lighting, 8k',
  'pixel_art': '16-bit pixel art style, retro RPG aesthetic, detailed sprite work',
  'studio_ghibli': 'Studio Ghibli style, soft pastoral colors, whimsical, Hayao Miyazaki aesthetic',
}

// ─── Error Handler ───

function handleError(res: express.Response, error: unknown, fallbackMessage: string) {
  if (error instanceof HttpError) {
    return res.status(error.status).json({ error: error.message })
  }
  const msg = error instanceof Error ? error.message : fallbackMessage
  console.error(fallbackMessage, error)
  res.status(500).json({ error: msg })
}

// ============================================================
// CHARACTER ENDPOINTS
// ============================================================

app.get('/api/characters', async (_req, res) => {
  try {
    if (!fs.existsSync(CHARACTERS_DIR)) return res.json([])

    const files = fs.readdirSync(CHARACTERS_DIR).filter(f => f.endsWith('.json'))
    const characters = files.map(f => {
      const data = JSON.parse(fs.readFileSync(path.join(CHARACTERS_DIR, f), 'utf-8'))
      const portraitName = f.replace('.json', '_portrait.png')
      if (fs.existsSync(path.join(CHARACTERS_DIR, portraitName))) {
        data.image_url = `/images/${portraitName}`
      }
      return data
    })
    res.json(characters)
  } catch (error) {
    handleError(res, error, 'Failed to list characters')
  }
})

function buildPromptWithOverrides(data: any): string {
  let prompt = data.prompt
  if (data.race) prompt += ` (Race: ${data.race})`
  if (data.class) prompt += ` (Class: ${data.class})`
  if (data.level && data.level !== 1) prompt += ` (Level ${data.level})`
  if (data.alignment) prompt += ` (Alignment: ${data.alignment})`
  return prompt
}

app.post('/api/generate', async (req, res) => {
  try {
    const data = req.body
    if (!data.prompt?.trim()) {
      return res.status(400).json({ error: 'Prompt is required' })
    }

    const fullPrompt = buildPromptWithOverrides(data)
    const outputDir = path.join(__dirname, '../../characters')
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true })

    log(`[character] Generating: ${fullPrompt.substring(0, 80)}...`)

    // Step 1: Generate character via agent with validation retry loop
    const maxAttempts = 3
    let validatedCharacter: any = null
    let validation: any = null

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      log(`[character] Step 1/${maxAttempts}: Generation attempt ${attempt}`)

      let agentPrompt = `Create a character: ${fullPrompt}`
      if (attempt > 1 && validation?.errors?.length) {
        agentPrompt += `\n\nPREVIOUS ATTEMPT FAILED VALIDATION. You MUST fix these errors:\n${validation.errors.map((e: string) => `- ${e}`).join('\n')}\n\nGenerate a corrected character JSON that passes all validation.`
      }

      const agentResult = await run(characterCreatorAgent, agentPrompt, { maxTurns: 10 })
      const agentText = extractAllTextOutput(agentResult.newItems)
      const character = extractJSON(agentText, 'object')

      // Step 2: Validate and apply defaults
      validation = validateCharacter(character)
      validatedCharacter = validation.character || character

      if (validation.valid) {
        log(`[character] Validation passed on attempt ${attempt}`)
        break
      }

      log(`[character] Validation failed (${validation.errors.length} errors): ${validation.errors.slice(0, 3).join('; ')}`, 'ERROR')

      if (attempt === maxAttempts) {
        log(`[character] WARNING: Returning character with ${validation.errors.length} validation errors after ${maxAttempts} attempts`, 'ERROR')
      }
    }

    // Step 3: Set art style
    if (data.art_style === 'custom' && data.custom_style) {
      validatedCharacter.art_style = data.custom_style
    } else if (data.art_style) {
      validatedCharacter.art_style = data.art_style
    }

    log(`[character] Generated: ${validatedCharacter.name} (valid: ${validation.valid})`)

    // Step 4: Generate portrait
    const stylePrompt = validatedCharacter.art_style && ART_STYLE_PROMPTS[validatedCharacter.art_style]
      ? ART_STYLE_PROMPTS[validatedCharacter.art_style]
      : (validatedCharacter.art_style || 'fantasy character portrait, detailed digital art')
    const portraitPrompt = `SQUARE FORMAT 1:1 aspect ratio portrait. ${stylePrompt}: ${validatedCharacter.race || ''} ${validatedCharacter.class || ''} character. ${(validatedCharacter.physical_description || '').substring(0, 400)}. Square canvas, centered composition.`
    const safeName = validatedCharacter.name?.toLowerCase().replace(/[^a-z0-9_-]/g, '_') || 'character'
    const portraitPath = path.join(outputDir, `${safeName}_${validatedCharacter.id.slice(0, 8)}_portrait.png`)

    // Portrait generation — retry once on failure
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        log(`[character] Generating portrait (attempt ${attempt}/2)...`)
        await generateImage({ prompt: portraitPrompt, outputPath: portraitPath, resolution: '1K' })
        validatedCharacter.image_url = `/images/${path.basename(portraitPath)}`
        log(`[character] Portrait saved: ${portraitPath}`)
        break
      } catch (e) {
        log(`[character] Portrait attempt ${attempt} failed: ${e}`, 'ERROR')
        if (attempt === 2) {
          log('[character] Portrait generation failed after 2 attempts — character saved without portrait', 'ERROR')
        }
      }
    }

    // Step 5: Save character
    const charPath = path.join(outputDir, `${safeName}_${validatedCharacter.id.slice(0, 8)}.json`)
    fs.writeFileSync(charPath, JSON.stringify(validatedCharacter, null, 2))
    log(`[character] Saved: ${charPath}`)

    res.json({
      ...validatedCharacter,
      _validation: { valid: validation.valid, errors: validation.errors, warnings: validation.warnings },
    })
  } catch (error) {
    handleError(res, error, 'Character generation failed')
  }
})

app.post('/api/generate-portrait', async (req, res) => {
  try {
    const { physical_description, name, race, class: charClass, art_style } = req.body
    if (!physical_description) return res.status(400).json({ error: 'physical_description is required' })

    const stylePrompt = art_style && ART_STYLE_PROMPTS[art_style]
      ? ART_STYLE_PROMPTS[art_style]
      : (art_style || 'fantasy character portrait, detailed digital art')
    const prompt = `SQUARE FORMAT 1:1 aspect ratio portrait. ${stylePrompt}: ${race || ''} ${charClass || ''} character. ${physical_description.substring(0, 500)}. Square canvas, centered composition.`

    const safeName = name?.toLowerCase().replace(/[^a-z0-9_-]/g, '_') || 'character'
    const outputDir = path.join(__dirname, '../../characters')
    const outputPath = path.join(outputDir, `${safeName}_portrait_${Date.now()}.png`)

    await generateImage({ prompt, outputPath, resolution: '1K' })
    res.json({ image_url: `/images/${path.basename(outputPath)}` })
  } catch (error) {
    handleError(res, error, 'Portrait generation failed')
  }
})

app.post('/api/validate', async (req, res) => {
  try {
    res.json(validateCharacter(req.body))
  } catch (error) {
    handleError(res, error, 'Validation failed')
  }
})

// ============================================================
// INVENTORY ENDPOINTS
// ============================================================

app.post('/api/generate-inventory', async (req, res) => {
  try {
    const { character, prompt } = req.body
    if (!character) return res.status(400).json({ error: 'Character data is required' })

    log(`[inventory] Generating for: ${character.name}`)

    const characterSummary = `Character: ${character.name}\nRace: ${character.race}\nClass: ${character.class}\nLevel: ${character.level}\nBackground: ${character.background || 'unknown'}\nBackstory snippet: ${(character.backstory || '').substring(0, 300)}...\nPersonality: ${(character.traits || []).join(', ')}`
    let agentPrompt = `Generate starting inventory for this character:\n${characterSummary}`
    if (prompt) agentPrompt += `\n\nAdditional context: ${prompt}`

    const agentResult = await run(inventoryCreatorAgent, agentPrompt, { maxTurns: 10 })
    const agentText = extractAllTextOutput(agentResult.newItems)
    const inventory = extractJSON<any[]>(agentText, 'array')
    const validation = validateInventory(inventory)

    log(`[inventory] Generated: ${inventory.length} items`)

    res.json({
      inventory: validation.inventory || inventory,
      _validation: { valid: validation.valid, attempts: 1, warnings: validation.warnings, stats: validation.stats },
    })
  } catch (error) {
    handleError(res, error, 'Inventory generation failed')
  }
})

app.post('/api/validate-inventory', async (req, res) => {
  try {
    res.json(validateInventory(req.body))
  } catch (error) {
    handleError(res, error, 'Validation failed')
  }
})

// ============================================================
// CAMPAIGN ENDPOINTS
// ============================================================

app.get('/api/campaigns', async (_req, res) => {
  try {
    if (!fs.existsSync(CAMPAIGNS_DIR)) return res.json([])

    const dirs = fs.readdirSync(CAMPAIGNS_DIR).filter(d =>
      fs.statSync(path.join(CAMPAIGNS_DIR, d)).isDirectory()
    )
    const campaigns = dirs.map(d => {
      const cp = path.join(CAMPAIGNS_DIR, d, 'campaign.json')
      return fs.existsSync(cp) ? JSON.parse(fs.readFileSync(cp, 'utf-8')) : null
    }).filter(Boolean)

    res.json(campaigns)
  } catch (error) {
    handleError(res, error, 'Failed to list campaigns')
  }
})

app.get('/api/campaigns/:id', async (req, res) => {
  try {
    const { campaignDir, campaign } = resolveCampaign(req.params.id)

    // Enrich with current session and character
    if (campaign.current_session) {
      const session = loadSession(campaignDir, campaign.current_session)
      if (session) campaign.currentSessionData = session
    }
    try {
      campaign.character = resolveCharacter(campaign.character_id)
    } catch { /* character may not exist */ }

    res.json(campaign)
  } catch (error) {
    handleError(res, error, 'Failed to get campaign')
  }
})

app.post('/api/campaigns', async (req, res) => {
  try {
    let { name, world, premise, character_id, party, auto_generate } = req.body
    if (!character_id) return res.status(400).json({ error: 'Select at least one character' })

    // Verify party members exist
    const partyMembers = party || [character_id]
    const characters = partyMembers.map((id: string) => resolveCharacter(id))

    // Auto-generate missing fields
    if (auto_generate || !name || !world || !premise) {
      log('[campaign] Auto-generating campaign details')
      const agentResult = await run(campaignGeneratorAgent, `Generate a campaign for:\nCharacter: ${characters[0].name}\nRace: ${characters[0].race}\nClass: ${characters[0].class}\nBackstory: ${characters[0].backstory?.substring(0, 300) || 'unknown'}\nMotivation: ${characters[0].motivation || 'unknown'}\nWound: ${characters[0].wound || 'unknown'}`)
      const agentText = extractAllTextOutput(agentResult.newItems)
      const generated = extractJSON<{ name: string; world: string; premise: string }>(agentText, 'object')
      name = name || generated.name
      world = world || generated.world
      premise = premise || generated.premise
    }

    const { campaign, campaignDir } = createCampaign({ name, world, premise, characterId: character_id, party: partyMembers })

    // Generate intro image (blocking)
    if (premise) {
      const imageUrl = await generateSceneImage(campaignDir, 'intro', premise)
      if (imageUrl) {
        campaign.intro_image_url = imageUrl
        fs.writeFileSync(path.join(campaignDir, 'campaign.json'), JSON.stringify(campaign, null, 2))
      }
    }

    log(`[campaign] Created: ${name} (${campaign.id})`)
    res.json(campaign)
  } catch (error) {
    handleError(res, error, 'Failed to create campaign')
  }
})

app.get('/api/campaigns/:id/sessions', async (req, res) => {
  try {
    const { campaignDir } = resolveCampaign(req.params.id)
    const sessionsDir = path.join(campaignDir, 'sessions')
    if (!fs.existsSync(sessionsDir)) return res.json([])

    const sessions = fs.readdirSync(sessionsDir)
      .filter(f => f.endsWith('.json'))
      .map(f => JSON.parse(fs.readFileSync(path.join(sessionsDir, f), 'utf-8')))
      .sort((a, b) => (a.sequence || 0) - (b.sequence || 0))

    res.json(sessions)
  } catch (error) {
    handleError(res, error, 'Failed to list sessions')
  }
})

app.patch('/api/campaigns/:id/settings', async (req, res) => {
  try {
    const { campaignDir, campaign } = resolveCampaign(req.params.id)
    const { art_style, generate_intro_image } = req.body

    if (art_style) campaign.art_style = art_style
    campaign.updated_at = new Date().toISOString()
    fs.writeFileSync(path.join(campaignDir, 'campaign.json'), JSON.stringify(campaign, null, 2))

    // Generate intro image if requested
    if (generate_intro_image || (art_style && !campaign.intro_image_url)) {
      log(`[settings] Generating intro image with style ${art_style}`)
      const imageUrl = await generateSceneImage(campaignDir, 'intro', campaign.premise, art_style)
      if (imageUrl) {
        campaign.intro_image_url = imageUrl
        fs.writeFileSync(path.join(campaignDir, 'campaign.json'), JSON.stringify(campaign, null, 2))
      }
    }

    res.json({ ok: true, campaign })
  } catch (error) {
    handleError(res, error, 'Failed to update settings')
  }
})

// ============================================================
// WORLD ENDPOINTS
// ============================================================

app.get('/api/worlds', async (_req, res) => {
  try {
    res.json(listWorlds())
  } catch (error) {
    handleError(res, error, 'Failed to list worlds')
  }
})

app.get('/api/worlds/:id', async (req, res) => {
  try {
    const { world } = resolveWorld(req.params.id)
    res.json(world)
  } catch (error) {
    handleError(res, error, 'Failed to get world')
  }
})

app.post('/api/worlds', async (req, res) => {
  try {
    const { prompt, art_style } = req.body
    if (!prompt?.trim()) return res.status(400).json({ error: 'Prompt is required' })

    log(`[world] Generating world from prompt: "${prompt.substring(0, 60)}..."`)
    const result = await generateWorldPipeline(prompt, art_style || 'oil-painting')

    if (!result.ok) {
      return res.status(500).json({ error: result.error, step: result.step })
    }
    res.json(result.data?.world)
  } catch (error) {
    handleError(res, error, 'Failed to generate world')
  }
})

app.patch('/api/worlds/:id/sections/:section', async (req, res) => {
  try {
    const { prompt } = req.body
    if (!prompt?.trim()) return res.status(400).json({ error: 'Prompt is required' })

    const { worldDir, world } = resolveWorld(req.params.id)
    log(`[world] Updating section '${req.params.section}' for world: ${world.name}`)

    const result = await updateWorldSectionPipeline(worldDir, world, req.params.section, prompt)

    if (!result.ok) {
      return res.status(500).json({ error: result.error, step: result.step })
    }
    res.json(result.data?.world)
  } catch (error) {
    handleError(res, error, 'Failed to update world section')
  }
})

app.post('/api/worlds/:id/validate', async (req, res) => {
  try {
    const { world } = resolveWorld(req.params.id)

    // Structural validation
    const structural = validateWorldStructure(world)

    // Semantic coherence check via AI
    let coherence: any[] = []
    try {
      const agentResult = await run(worldCoherenceAgent, JSON.stringify(world, null, 2), { maxTurns: 3 })
      const agentText = extractAllTextOutput(agentResult.newItems)
      coherence = extractJSON<any[]>(agentText, 'array')
    } catch (e) {
      log(`[world] Coherence check failed: ${e}`, 'ERROR')
    }

    res.json({
      structural,
      coherence,
      can_finalize: structural.valid && !coherence.some((i: any) => i.severity === 'error'),
    })
  } catch (error) {
    handleError(res, error, 'Failed to validate world')
  }
})

app.patch('/api/worlds/:id/finalize', async (req, res) => {
  try {
    const { worldDir, world } = resolveWorld(req.params.id)
    world.status = 'active'
    world.updated_at = new Date().toISOString()
    saveWorld(worldDir, world)
    res.json(world)
  } catch (error) {
    handleError(res, error, 'Failed to finalize world')
  }
})

// ============================================================
// GAMEPLAY ENDPOINTS — Structured Pipelines
// ============================================================

app.post('/api/campaigns/:id/session', async (req, res) => {
  try {
    const ctx = resolveGameContext(req.params.id)
    log(`[session] Starting for campaign: ${ctx.campaign.name}`)

    const result = await generateSessionPipeline(ctx)

    if (!result.ok) {
      return res.status(500).json({ error: result.error, step: result.step })
    }
    res.json(result.data)
  } catch (error) {
    handleError(res, error, 'Failed to start session')
  }
})

app.post('/api/campaigns/:id/choice', async (req, res) => {
  try {
    const { choice_id } = req.body
    if (!choice_id) return res.status(400).json({ error: 'choice_id is required' })

    const ctx = resolveGameContext(req.params.id)
    log(`[choice] Making choice ${choice_id} in campaign: ${ctx.campaign.name}`)

    const result = await resolveChoicePipeline(ctx, choice_id)

    if (!result.ok) {
      return res.status(500).json({ error: result.error, step: result.step })
    }
    res.json(result.data)
  } catch (error) {
    handleError(res, error, 'Failed to make choice')
  }
})

// ============================================================
// START SERVER
// ============================================================

app.listen(PORT, () => {
  log(`Loom API running on http://localhost:${PORT}`)
  log(`  Worlds: ${WORLDS_DIR}`)
  log(`  Characters: ${CHARACTERS_DIR}`)
  log(`  Campaigns: ${CAMPAIGNS_DIR}`)
})
