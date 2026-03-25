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

import { getArtStylePrompt, ART_STYLE_PROMPTS } from './agents/tools/art-styles.js'

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
    if (!data.world_id) {
      return res.status(400).json({ error: 'world_id is required — characters must belong to a world' })
    }

    // Load world for context and art style
    const { world } = resolveWorld(data.world_id)

    const fullPrompt = buildPromptWithOverrides(data)
    const outputDir = path.join(__dirname, '../../characters')
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true })

    // Build world context for the agent
    const worldContext = [
      `\n\nWORLD CONTEXT (character must fit in this world):`,
      `World: ${world.name} — ${world.tagline || ''}`,
      `Tone: ${world.overview?.tone || 'unknown'}, Genre: ${world.overview?.genre || 'fantasy'}, Era: ${world.overview?.era || 'unknown'}`,
      world.geography?.regions?.length > 0 ? `Regions: ${world.geography.regions.map((r: any) => r.name).join(', ')}` : '',
      Array.isArray(world.factions) && world.factions.length > 0 ? `Factions: ${world.factions.map((f: any) => `${f.name} (${f.type})`).join(', ')}` : '',
      world.religion?.deities_or_forces?.length > 0 ? `Deities/Forces: ${world.religion.deities_or_forces.map((d: any) => `${d.name} (${d.domain})`).join(', ')}` : '',
      `\nCreate a character that fits naturally in this world. They should have connections to the world's regions, factions, or religion.`,
    ].filter(Boolean).join('\n')

    log(`[character] Generating in world "${world.name}": ${fullPrompt.substring(0, 60)}...`)

    // Step 1: Generate character via agent with validation retry loop
    const maxAttempts = 3
    let validatedCharacter: any = null
    let validation: any = null

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      log(`[character] Step 1/${maxAttempts}: Generation attempt ${attempt}`)

      let agentPrompt = `Create a character: ${fullPrompt}${worldContext}`
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

    // Art style inherited from world
    validatedCharacter.art_style = world.art_style
    validatedCharacter.world_id = data.world_id

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

    // Step 5: Save character as draft
    validatedCharacter.status = 'draft'
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

// Refine a character section via prompt
app.patch('/api/characters/:id/refine', async (req, res) => {
  try {
    const { prompt } = req.body
    if (!prompt?.trim()) return res.status(400).json({ error: 'Prompt is required' })

    // Find character file
    const charFiles = fs.readdirSync(CHARACTERS_DIR).filter(f => f.endsWith('.json'))
    let charPath = ''
    let character: any = null
    for (const f of charFiles) {
      const data = JSON.parse(fs.readFileSync(path.join(CHARACTERS_DIR, f), 'utf-8'))
      if (data.id === req.params.id) {
        charPath = path.join(CHARACTERS_DIR, f)
        character = data
        break
      }
    }
    if (!character) return res.status(404).json({ error: 'Character not found' })

    log(`[character] Refining ${character.name}: "${prompt.slice(0, 60)}..."`)

    // Build context with full character + update instruction
    const agentPrompt = `Here is an existing character (JSON):\n${JSON.stringify(character, null, 2)}\n\nThe user wants to update this character:\n${prompt}\n\nReturn the COMPLETE updated character JSON with the requested changes applied. Keep all existing fields, only modify what the user asked for. Output ONLY the JSON.`

    const agentResult = await run(characterCreatorAgent, agentPrompt, { maxTurns: 10 })
    const agentText = extractAllTextOutput(agentResult.newItems)
    const updated = extractJSON(agentText, 'object')

    // Preserve server-managed fields
    updated.id = character.id
    updated.world_id = character.world_id
    updated.art_style = character.art_style
    updated.image_url = character.image_url
    updated.status = 'draft'
    updated.created_at = character.created_at
    updated.updated_at = new Date().toISOString()

    const validation = validateCharacter(updated)
    const final = validation.character || updated

    fs.writeFileSync(charPath, JSON.stringify(final, null, 2))
    log(`[character] Refined and saved: ${final.name}`)

    res.json(final)
  } catch (error) {
    handleError(res, error, 'Character refinement failed')
  }
})

// Finalize a character
app.patch('/api/characters/:id/finalize', async (req, res) => {
  try {
    const charFiles = fs.readdirSync(CHARACTERS_DIR).filter(f => f.endsWith('.json'))
    for (const f of charFiles) {
      const charPath = path.join(CHARACTERS_DIR, f)
      const data = JSON.parse(fs.readFileSync(charPath, 'utf-8'))
      if (data.id === req.params.id) {
        data.status = 'active'
        data.updated_at = new Date().toISOString()
        fs.writeFileSync(charPath, JSON.stringify(data, null, 2))
        return res.json(data)
      }
    }
    res.status(404).json({ error: 'Character not found' })
  } catch (error) {
    handleError(res, error, 'Failed to finalize character')
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
    const { name: hintName, premise: hintPremise, character_id, party, world_id, campaign_length } = req.body

    // Map campaign length to scene counts
    const lengthConfig: Record<string, { min: number; max: number; target: number }> = {
      short: { min: 5, max: 6, target: 5 },
      standard: { min: 8, max: 10, target: 9 },
      epic: { min: 15, max: 20, target: 17 },
    }
    const length = lengthConfig[campaign_length || 'standard'] || lengthConfig.standard
    if (!character_id) return res.status(400).json({ error: 'Select at least one character' })

    const partyMembers = party || [character_id]
    const partyChars = partyMembers.map((id: string) => resolveCharacter(id))
    const lead = partyChars[0]

    // Load world context if provided
    let worldContext = ''
    let worldName = ''
    let worldArtStyle = ''
    if (world_id) {
      const { world: w } = resolveWorld(world_id)
      worldName = w.name
      worldArtStyle = w.art_style || ''
      worldContext = `\nWorld: ${w.name} — ${w.tagline || ''}\nTone: ${w.overview?.tone || ''}, Genre: ${w.overview?.genre || ''}\nRegions: ${(w.geography?.regions || []).map((r: any) => r.name).join(', ')}\nFactions: ${(w.factions || []).map((f: any) => f.name).join(', ')}`
    }

    // Always generate campaign details via AI
    log(`[campaign] Generating campaign for ${lead.name} in ${worldName || 'unspecified world'}`)
    const agentPrompt = `Generate a campaign for:\nCharacter: ${lead.name}\nRace: ${lead.race}\nClass: ${lead.class}\nBackstory: ${lead.backstory?.substring(0, 300) || 'unknown'}\nMotivation: ${lead.motivation || 'unknown'}\nWound: ${lead.wound || 'unknown'}${worldContext}\n\nCAMPAIGN LENGTH: ${length.target} scenes (${length.min}-${length.max} range). Set total_scenes_estimate to ${length.target}. Divide the three acts proportionally.${hintName ? `\nCampaign name hint: ${hintName}` : ''}${hintPremise ? `\nPremise hint: ${hintPremise}` : ''}`

    const agentResult = await run(campaignGeneratorAgent, agentPrompt)
    const agentText = extractAllTextOutput(agentResult.newItems)
    const generated = extractJSON<{ name: string; world: string; premise: string }>(agentText, 'object')

    const { campaign, campaignDir } = createCampaign({
      name: generated.name,
      world: worldName || generated.world,
      premise: generated.premise,
      characterId: character_id,
      party: partyMembers,
    })
    campaign.world_id = world_id || undefined
    campaign.art_style = worldArtStyle || undefined
    campaign.arc = generated.arc || undefined
    campaign.status = 'draft'

    // Generate intro image
    const imageUrl = await generateSceneImage(campaignDir, 'intro', generated.premise, worldArtStyle)
    if (imageUrl) {
      campaign.intro_image_url = imageUrl
    }

    fs.writeFileSync(path.join(campaignDir, 'campaign.json'), JSON.stringify(campaign, null, 2))
    log(`[campaign] Created: ${generated.name} (${campaign.id})`)
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

// Refine a campaign via prompt
app.patch('/api/campaigns/:id/refine', async (req, res) => {
  try {
    const { prompt } = req.body
    if (!prompt?.trim()) return res.status(400).json({ error: 'Prompt is required' })

    const { campaignDir, campaign } = resolveCampaign(req.params.id)
    const character = resolveCharacter(campaign.character_id)

    log(`[campaign] Refining "${campaign.name}": "${prompt.slice(0, 60)}..."`)

    // Load world context if available
    let worldContext = ''
    if (campaign.world_id) {
      try {
        const { world } = resolveWorld(campaign.world_id)
        worldContext = `\nWorld: ${world.name}\nTone: ${world.overview?.tone || ''}\nRegions: ${(world.geography?.regions || []).map((r: any) => r.name).join(', ')}`
      } catch {}
    }

    const agentPrompt = `Here is an existing campaign:\nName: ${campaign.name}\nWorld: ${campaign.world}\nPremise: ${campaign.premise}\nCharacter: ${character.name} (${character.race} ${character.class})${worldContext}\n\nThe user wants to update this campaign:\n${prompt}\n\nReturn ONLY valid JSON with updated fields: {"name": "...", "world": "...", "premise": "..."}`

    const agentResult = await run(campaignGeneratorAgent, agentPrompt)
    const agentText = extractAllTextOutput(agentResult.newItems)
    const updated = extractJSON<{ name: string; world: string; premise: string }>(agentText, 'object')

    campaign.name = updated.name || campaign.name
    campaign.premise = updated.premise || campaign.premise
    campaign.updated_at = new Date().toISOString()
    fs.writeFileSync(path.join(campaignDir, 'campaign.json'), JSON.stringify(campaign, null, 2))

    log(`[campaign] Refined: ${campaign.name}`)
    res.json(campaign)
  } catch (error) {
    handleError(res, error, 'Campaign refinement failed')
  }
})

// Finalize a campaign (must be finalized before playing)
app.patch('/api/campaigns/:id/finalize', async (req, res) => {
  try {
    const { campaignDir, campaign } = resolveCampaign(req.params.id)
    campaign.status = 'active'
    campaign.updated_at = new Date().toISOString()
    fs.writeFileSync(path.join(campaignDir, 'campaign.json'), JSON.stringify(campaign, null, 2))
    res.json(campaign)
  } catch (error) {
    handleError(res, error, 'Failed to finalize campaign')
  }
})

// Complete a campaign and generate wrap-up
app.post('/api/campaigns/:id/complete', async (req, res) => {
  try {
    const { campaignDir, campaign } = resolveCampaign(req.params.id)
    const character = resolveCharacter(campaign.character_id)

    // Load all sessions
    const sessionsDir = path.join(campaignDir, 'sessions')
    const sessions = fs.existsSync(sessionsDir)
      ? fs.readdirSync(sessionsDir).filter(f => f.endsWith('.json'))
          .map(f => JSON.parse(fs.readFileSync(path.join(sessionsDir, f), 'utf-8')))
          .sort((a: any, b: any) => (a.sequence || 0) - (b.sequence || 0))
      : []

    const { getCampaignState } = await import('./agents/tools/state.js')
    const campaignState = getCampaignState(campaign)

    // Generate wrap-up
    log(`[campaign] Generating wrap-up for: ${campaign.name}`)
    const { campaignWrapUpAgent, buildWrapUpPrompt } = await import('./agents/campaign-wrap-up.js')
    const wrapUpPrompt = buildWrapUpPrompt({ campaign, character, campaignState, sessions })
    const agentResult = await run(campaignWrapUpAgent, wrapUpPrompt, { maxTurns: 5 })
    const agentText = extractAllTextOutput(agentResult.newItems)
    const wrapUp = extractJSON(agentText, 'object')

    // Save wrap-up on campaign
    campaign.status = 'completed'
    campaign.wrap_up = wrapUp
    campaign.updated_at = new Date().toISOString()
    fs.writeFileSync(path.join(campaignDir, 'campaign.json'), JSON.stringify(campaign, null, 2))

    log(`[campaign] Wrap-up generated for: ${campaign.name}`)
    res.json({ campaign, wrap_up: wrapUp })
  } catch (error) {
    handleError(res, error, 'Failed to complete campaign')
  }
})

// Apply wrap-up updates to character and world
app.post('/api/campaigns/:id/wrap-up/apply', async (req, res) => {
  try {
    const { campaignDir, campaign } = resolveCampaign(req.params.id)
    if (!campaign.wrap_up) return res.status(400).json({ error: 'No wrap-up generated. Complete the campaign first.' })

    const wrapUp = campaign.wrap_up
    const { approved_character, approved_world } = req.body || {}

    // Apply character updates
    if (approved_character !== false && wrapUp.character_updates) {
      const charFiles = fs.readdirSync(CHARACTERS_DIR).filter(f => f.endsWith('.json'))
      for (const f of charFiles) {
        const charPath = path.join(CHARACTERS_DIR, f)
        const char = JSON.parse(fs.readFileSync(charPath, 'utf-8'))
        if (char.id === campaign.character_id) {
          const updates = wrapUp.character_updates

          // XP
          if (updates.xp_award) char.experience_points = (char.experience_points || 0) + updates.xp_award

          // Items (add to knowledge array as placeholder — no inventory system yet)
          if (updates.items_to_add?.length) {
            char.knowledge = char.knowledge || []
            for (const item of updates.items_to_add) {
              if (!char.knowledge.includes(`Item: ${item}`)) char.knowledge.push(`Item: ${item}`)
            }
          }

          // Knowledge
          if (updates.knowledge_to_add?.length) {
            char.knowledge = char.knowledge || []
            for (const fact of updates.knowledge_to_add) {
              if (!char.knowledge.includes(fact)) char.knowledge.push(fact)
            }
          }

          // Relationships
          if (updates.new_relationships?.length) {
            char.relationships = char.relationships || []
            for (const rel of updates.new_relationships) {
              char.relationships.push({ ...rel, character_id: null, trust_level: rel.type === 'ally' ? 7 : rel.type === 'enemy' ? 2 : 5, notes: `Met during ${campaign.name}` })
            }
          }

          // Backstory addition
          if (updates.backstory_addition) {
            char.backstory = (char.backstory || '') + '\n\n' + updates.backstory_addition
          }

          char.updated_at = new Date().toISOString()
          fs.writeFileSync(charPath, JSON.stringify(char, null, 2))
          log(`[wrap-up] Character ${char.name} updated with campaign results`)
          break
        }
      }
    }

    // Apply world updates
    if (approved_world !== false && wrapUp.world_updates && campaign.world_id) {
      try {
        const { resolveWorld: rw, saveWorld: sw } = await import('./agents/tools/world-state.js')
        const { worldDir, world } = rw(campaign.world_id)
        const updates = wrapUp.world_updates

        // Timeline event
        if (updates.timeline_event) {
          world.history = world.history || { creation_myth: '', timeline: [] }
          world.history.timeline = world.history.timeline || []
          world.history.timeline.push({
            era: 'Recent',
            name: updates.timeline_event.name,
            year_label: 'Recent events',
            description: updates.timeline_event.description,
            impact: updates.timeline_event.impact,
          })
        }

        world.updated_at = new Date().toISOString()
        sw(worldDir, world)
        log(`[wrap-up] World ${world.name} updated with campaign results`)
      } catch (e) {
        log(`[wrap-up] World update failed: ${e}`, 'ERROR')
      }
    }

    campaign.wrap_up_applied = true
    campaign.updated_at = new Date().toISOString()
    fs.writeFileSync(path.join(campaignDir, 'campaign.json'), JSON.stringify(campaign, null, 2))

    res.json({ ok: true, campaign })
  } catch (error) {
    handleError(res, error, 'Failed to apply wrap-up')
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
