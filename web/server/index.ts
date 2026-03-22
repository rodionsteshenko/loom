import express from 'express'
import cors from 'cors'
import { spawn } from 'child_process'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Logging helper
const LOG_FILE = '/tmp/loom-server.log'
function log(message: string, level: 'INFO' | 'ERROR' | 'DEBUG' = 'INFO') {
  const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 19)
  const line = `${timestamp} [${level}] ${message}`
  console.log(line)
  fs.appendFileSync(LOG_FILE, line + '\n')
}

// Initialize log file
fs.writeFileSync(LOG_FILE, `=== Loom Server Started at ${new Date().toISOString()} ===\n`)

const app = express()
const PORT = process.env.PORT || 3001

// OpenClaw Gateway config (set in .env)
const OPENCLAW_URL = process.env.OPENCLAW_URL || 'http://127.0.0.1:18789/v1/chat/completions'
const OPENCLAW_TOKEN = process.env.OPENCLAW_TOKEN || ''
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || ''

// Paths
const VALIDATOR_PATH = path.join(__dirname, '../../src/validators/character_validator.py')
const INVENTORY_VALIDATOR_PATH = path.join(__dirname, '../../src/validators/inventory_validator.py')
const PYTHON_PATH = path.join(__dirname, '../../.venv/bin/python')

app.use(cors())
app.use(express.json())

// Serve generated images
app.use('/images', express.static(path.join(__dirname, '../../characters')))
app.use('/scene-images', express.static(path.join(__dirname, '../../campaigns')))

// Scene image generation helper
const SCENE_IMAGES_DIR = path.join(__dirname, '../../campaigns')

// Art style prompts for scene generation (sync with web/src/constants/artStyles.ts)
const SCENE_ART_STYLES: Record<string, string> = {
  'oil-painting': 'Oil painting style, rich textured brushstrokes, dramatic lighting, classic fantasy art',
  'classic-fantasy': 'Classic fantasy art style, Larry Elmore, TSR, 1980s D&D, detailed oil painting',
  'dark-fantasy': 'Dark fantasy art, gritty moody atmosphere, deep shadows, ominous lighting, FromSoftware aesthetic',
  'watercolor': 'Watercolor illustration, soft flowing colors, ethereal dreamy quality',
  'storybook': 'Storybook illustration, whimsical charming style, children\'s book aesthetic',
  'art-nouveau': 'Art nouveau style, ornate flowing lines, natural motifs, decorative borders',
  'digital-art': 'Digital art, clean polished illustration, modern fantasy style',
  'concept-art': 'Concept art, film production quality, detailed environment design',
  'realistic': 'Photorealistic fantasy, highly detailed, lifelike rendering',
  'comic-book': 'Comic book art style, bold ink lines, dynamic composition, vivid colors',
  'anime': 'Anime illustration style, expressive characters, Japanese animation aesthetic, vibrant',
  'pixel-art': 'Pixel art style, retro game aesthetic, chunky pixels, 16-bit era',
  'noir': 'Film noir style, high contrast black and white, dramatic shadows, mystery',
  'gothic': 'Gothic art style, dark romantic atmosphere, Victorian aesthetic, ornate details',
  'eldritch': 'Eldritch horror art, Lovecraftian aesthetic, unsettling, cosmic dread',
}

async function generateSceneImage(prompt: string, campaignId: string, filename: string, artStyle?: string): Promise<string | null> {
  const scriptPath = '/opt/homebrew/lib/node_modules/openclaw/skills/nano-banana-pro/scripts/generate_image.py'
  const outputPath = path.join(SCENE_IMAGES_DIR, campaignId, filename)
  
  // Ensure directory exists
  const dir = path.dirname(outputPath)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  
  // Use campaign art style or default to oil painting
  const stylePrefix = SCENE_ART_STYLES[artStyle || 'oil-painting'] || SCENE_ART_STYLES['oil-painting']
  const fullPrompt = `${stylePrefix}, cinematic composition: ${prompt}`
  
  try {
    await new Promise<void>((resolve, reject) => {
      const proc = spawn('uv', ['run', scriptPath, '--prompt', fullPrompt, '--filename', outputPath, '--resolution', '1K'], {
        env: { ...process.env, GEMINI_API_KEY }
      })
      proc.on('close', (code) => code === 0 ? resolve() : reject(new Error('Image generation failed')))
      proc.on('error', reject)
    })
    // Return relative URL
    return `/scene-images/${campaignId}/${filename}`
  } catch (e) {
    console.log('Scene image generation failed:', e)
    return null
  }
}

async function generateImagePromptFromNarrative(narrative: string): Promise<string> {
  // Use Claude to generate a concise image prompt from the narrative
  const response = await fetch(OPENCLAW_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENCLAW_TOKEN}`,
      'Content-Type': 'application/json',
      'x-openclaw-agent-id': 'main'
    },
    body: JSON.stringify({
      model: 'openclaw',
      messages: [
        { role: 'system', content: 'Generate a single concise image prompt (max 100 words) for a fantasy RPG scene illustration. Focus on the setting, mood, and key visual elements. Output ONLY the prompt text, nothing else.' },
        { role: 'user', content: narrative.substring(0, 1000) }
      ]
    })
  })
  
  if (!response.ok) return narrative.substring(0, 200)
  
  const data = await response.json()
  return data.choices?.[0]?.message?.content?.trim() || narrative.substring(0, 200)
}

// Background image generation - updates session/campaign files when complete
async function generateSessionImageBackground(campaignDir: string, sessionId: string, narrative: string, type: 'scene' | 'outcome', artStyle?: string) {
  try {
    console.log(`Generating ${type} image for session ${sessionId}...`)
    const prompt = await generateImagePromptFromNarrative(narrative)
    const campaignId = path.basename(campaignDir)
    const filename = `${sessionId}_${type}.png`
    const imageUrl = await generateSceneImage(prompt, campaignId, filename, artStyle)
    
    if (imageUrl) {
      // Update session file with image URL
      const sessionPath = path.join(campaignDir, 'sessions', `${sessionId}.json`)
      if (fs.existsSync(sessionPath)) {
        const session = JSON.parse(fs.readFileSync(sessionPath, 'utf-8'))
        if (type === 'scene') {
          session.content = session.content || {}
          session.content.image_url = imageUrl
          session.content.image_prompt = prompt
        } else {
          session.outcome_image_url = imageUrl
        }
        fs.writeFileSync(sessionPath, JSON.stringify(session, null, 2))
        console.log(`${type} image saved: ${imageUrl}`)
      }
    }
  } catch (e) {
    console.log(`Failed to generate ${type} image:`, e)
  }
}

async function generateIntroImageBackground(campaignDir: string, premise: string, artStyle?: string) {
  try {
    console.log('Generating intro image...')
    const prompt = await generateImagePromptFromNarrative(premise)
    const campaignId = path.basename(campaignDir)
    const imageUrl = await generateSceneImage(prompt, campaignId, 'intro.png', artStyle)
    
    if (imageUrl) {
      const campaignPath = path.join(campaignDir, 'campaign.json')
      if (fs.existsSync(campaignPath)) {
        const campaign = JSON.parse(fs.readFileSync(campaignPath, 'utf-8'))
        campaign.intro_image_url = imageUrl
        fs.writeFileSync(campaignPath, JSON.stringify(campaign, null, 2))
        console.log(`Intro image saved: ${imageUrl}`)
      }
    }
  } catch (e) {
    console.log('Failed to generate intro image:', e)
  }
}

const ART_STYLE_PROMPTS: Record<string, string> = {
  'classic_fantasy': 'classic fantasy art style, Larry Elmore, TSR, 1980s D&D, detailed oil painting',
  'anime': 'anime art style, JRPG character portrait, vibrant colors, cel shaded',
  'dark_souls': 'dark fantasy art style, FromSoftware aesthetic, moody lighting, grim atmosphere',
  'watercolor': 'watercolor illustration, soft edges, artistic brush strokes, delicate colors',
  'oil_painting': 'renaissance oil painting style, dramatic chiaroscuro, classical portrait',
  'comic_book': 'comic book art style, bold lines, dynamic shading, superhero aesthetic',
  'realistic': 'photorealistic digital art, highly detailed, cinematic lighting, 8k',
  'pixel_art': '16-bit pixel art style, retro RPG aesthetic, detailed sprite work',
  'studio_ghibli': 'Studio Ghibli style, soft pastoral colors, whimsical, Hayao Miyazaki aesthetic'
}

const CHARACTER_SCHEMA_PROMPT = `You are a D&D character creator for Loom RPG. Create detailed characters with rich backstories.

OUTPUT FORMAT: Return ONLY valid JSON (no markdown, no explanation) with this structure:
{
  "id": "uuid",
  "name": "Character Name",
  "type": "pc",
  "race": "Race",
  "class": "Class",
  "subclass": "Subclass or null",
  "level": 1-20,
  "alignment": "lawful_good|neutral_good|chaotic_good|lawful_neutral|true_neutral|chaotic_neutral|lawful_evil|neutral_evil|chaotic_evil",
  "background": "D&D Background",
  "physical_description": "Detailed 2-4 paragraph physical description for image generation (MINIMUM 200 characters)",
  "height": "e.g. 5'10\\"",
  "weight": "e.g. 180 lbs",
  "voice": "How they speak, accent, verbal tics (MINIMUM 100 characters)",
  "mannerisms": "Physical habits, gestures (MINIMUM 100 characters)",
  "origin": "Where they're from",
  "backstory": "Full history, 3-6 paragraphs (MINIMUM 300 characters)",
  "childhood": "Early years (MINIMUM 150 characters)",
  "motivation": "What drives them (MINIMUM 100 characters)",
  "want": "External goal",
  "need": "Internal need (often conflicts with want)",
  "wound": "Past trauma (MINIMUM 100 characters)",
  "lie_they_believe": "False belief about self/world",
  "fear": "Deepest fear",
  "arc_direction": "positive|negative|flat|ambiguous",
  "traits": ["trait1", "trait2"],
  "values": ["value1", "value2"],
  "flaws": ["flaw1", "flaw2"],
  "secrets": ["secret1"],
  "archetype": "Innocent|Orphan|Hero|Caregiver|Explorer|Rebel|Lover|Creator|Jester|Sage|Magician|Ruler",
  "stats": {"STR": 10, "DEX": 10, "CON": 10, "INT": 10, "WIS": 10, "CHA": 10},
  "hp": {"current": 10, "max": 10},
  "armor_class": 10,
  "movement_speed": 30,
  "skills": ["skill1", "skill2"],
  "languages": ["Common", "other"],
  "abilities": ["ability1"],
  "spells_known": []
}

CRITICAL RULES:
1. Output ONLY valid JSON - no markdown code blocks, no explanation
2. All prose fields MUST meet their minimum character counts
3. Be creative - add depth beyond the user's prompt
4. Connect wound, lie_they_believe, want, need for narrative tension
5. Fill reasonable D&D 5e stats based on class/level
6. Do NOT include any fields not listed in the schema above`

const INVENTORY_SCHEMA_PROMPT = `You are an inventory creator for Loom D&D RPG. Generate starting equipment for characters.

OUTPUT FORMAT: Return ONLY a valid JSON array (no markdown, no explanation) of inventory items:
[
  {
    "id": "uuid",
    "name": "Item Name",
    "type": "weapon|armor|consumable|tool|gear|treasure|wondrous|quest",
    "subtype": "specific category (e.g., 'martial melee', 'light armor')",
    "description": "Flavor text - make it personal and connected to the character",
    "weight": 3,
    "value": { "gp": 15, "sp": 0, "cp": 0 },
    "quantity": 1,
    "equipped": true,
    "magical": false,
    "rarity": "common",
    "properties": ["versatile"],
    "damage": { "dice": "1d8", "type": "slashing" },
    "notes": "Personal significance to the character"
  }
]

ITEM TYPES:
- weapon: Include damage dice and type
- armor: Include armor_class object if applicable
- consumable: Potions, scrolls, food, ammunition
- tool: Artisan tools, thieves tools, etc.
- gear: Adventuring gear, clothing, containers
- treasure: Valuables, gems, art objects
- wondrous: Magic items
- quest: Plot-relevant items

RULES:
1. Output ONLY a valid JSON array - no markdown, no explanation
2. Every item MUST have: id, name, type, weight, quantity
3. Descriptions should connect to the character's backstory
4. Include class-appropriate starting equipment (PHB)
5. Include background equipment
6. Add 1-3 personal items that reflect the character's personality or history
7. Be realistic about starting wealth (typically 10-25gp worth for level 1)`

async function validateInventory(inventory: any): Promise<{ valid: boolean; errors: any[]; warnings: any[]; inventory: any; stats: any }> {
  return new Promise((resolve, reject) => {
    const proc = spawn(PYTHON_PATH, [INVENTORY_VALIDATOR_PATH, '--stdin', '--json'], {
      cwd: path.join(__dirname, '../..')
    })

    let stdout = ''
    let stderr = ''

    proc.stdin.write(JSON.stringify(inventory))
    proc.stdin.end()

    proc.stdout.on('data', (data) => { stdout += data.toString() })
    proc.stderr.on('data', (data) => { stderr += data.toString() })

    proc.on('close', (code) => {
      try {
        const result = JSON.parse(stdout)
        resolve(result)
      } catch (e) {
        reject(new Error(`Inventory validation failed: ${stderr || stdout || e}`))
      }
    })

    proc.on('error', reject)
  })
}

async function validateCharacter(character: any): Promise<{ valid: boolean; errors: any[]; warnings: any[]; character: any }> {
  return new Promise((resolve, reject) => {
    const proc = spawn(PYTHON_PATH, [VALIDATOR_PATH, '--stdin', '--json'], {
      cwd: path.join(__dirname, '../..')
    })

    let stdout = ''
    let stderr = ''

    proc.stdin.write(JSON.stringify(character))
    proc.stdin.end()

    proc.stdout.on('data', (data) => { stdout += data.toString() })
    proc.stderr.on('data', (data) => { stderr += data.toString() })

    proc.on('close', (code) => {
      try {
        const result = JSON.parse(stdout)
        resolve(result)
      } catch (e) {
        reject(new Error(`Validation failed: ${stderr || stdout || e}`))
      }
    })

    proc.on('error', reject)
  })
}

async function generateWithOpenClaw(prompt: string, previousErrors?: string): Promise<any> {
  let fullPrompt = `Create a character: ${prompt}`
  
  if (previousErrors) {
    fullPrompt += `\n\nPREVIOUS ATTEMPT FAILED VALIDATION. Fix these errors:\n${previousErrors}\n\nGenerate a corrected character JSON.`
  }

  const response = await fetch(OPENCLAW_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENCLAW_TOKEN}`,
      'Content-Type': 'application/json',
      'x-openclaw-agent-id': 'main'
    },
    body: JSON.stringify({
      model: 'openclaw',
      messages: [
        { role: 'system', content: CHARACTER_SCHEMA_PROMPT },
        { role: 'user', content: fullPrompt }
      ]
    })
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`OpenClaw API error: ${response.status} - ${error}`)
  }

  const data = await response.json()
  const text = data.choices?.[0]?.message?.content

  if (!text) {
    throw new Error('No response from OpenClaw')
  }

  // Extract JSON from response
  let jsonText = text.trim()
  if (jsonText.startsWith('```')) {
    const firstNewline = jsonText.indexOf('\n')
    jsonText = jsonText.slice(firstNewline + 1)
    if (jsonText.endsWith('```')) {
      jsonText = jsonText.slice(0, -3).trim()
    }
  }

  const start = jsonText.indexOf('{')
  const end = jsonText.lastIndexOf('}') + 1
  if (start !== -1 && end > start) {
    jsonText = jsonText.slice(start, end)
  }

  return JSON.parse(jsonText)
}

async function generateValidatedCharacter(prompt: string, maxRetries: number = 3): Promise<{ character: any; validation: any; attempts: number }> {
  let lastErrors: string | undefined
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    console.log(`  Attempt ${attempt}/${maxRetries}...`)
    
    // Generate character
    const character = await generateWithOpenClaw(prompt, lastErrors)
    
    // Validate
    const validation = await validateCharacter(character)
    
    if (validation.valid) {
      console.log(`  ✅ Validation passed on attempt ${attempt}`)
      return { character: validation.character, validation, attempts: attempt }
    }
    
    // Format errors for retry
    const errorMessages = validation.errors
      .map((e: any) => `- ${e.field}: ${e.message}`)
      .join('\n')
    
    console.log(`  ❌ Validation failed (${validation.errors.length} errors)`)
    lastErrors = errorMessages
  }
  
  throw new Error(`Failed to generate valid character after ${maxRetries} attempts`)
}

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
    
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true })
    }

    console.log('Generating character:', fullPrompt.substring(0, 100) + '...')

    // Generate and validate character (with retries)
    const { character, validation, attempts } = await generateValidatedCharacter(fullPrompt)
    
    // Store art style
    if (data.art_style === 'custom' && data.custom_style) {
      character.art_style = data.custom_style
    } else if (data.art_style) {
      character.art_style = data.art_style
    }

    console.log(`Character generated: ${character.name} (validated in ${attempts} attempt(s))`)

    // Generate portrait with Gemini (nano-banana-pro)
    const stylePrompt = character.art_style && ART_STYLE_PROMPTS[character.art_style]
      ? ART_STYLE_PROMPTS[character.art_style]
      : (character.art_style || 'fantasy character portrait, detailed digital art')

    const portraitPrompt = `SQUARE FORMAT 1:1 aspect ratio portrait. ${stylePrompt}: ${character.race || ''} ${character.class || ''} character. ${(character.physical_description || '').substring(0, 400)}. Square canvas, centered composition.`
    
    const safeName = character.name?.toLowerCase().replace(/[^a-z0-9_-]/g, '_') || 'character'
    const portraitPath = path.join(outputDir, `${safeName}_${character.id.slice(0, 8)}_portrait.png`)
    
    const scriptPath = '/opt/homebrew/lib/node_modules/openclaw/skills/nano-banana-pro/scripts/generate_image.py'

    try {
      console.log('Generating portrait...')
      await new Promise<void>((resolve, reject) => {
        const proc = spawn('uv', ['run', scriptPath, '--prompt', portraitPrompt, '--filename', portraitPath, '--resolution', '1K'], {
          env: { ...process.env, GEMINI_API_KEY }
        })
        proc.on('close', (code) => code === 0 ? resolve() : reject(new Error('Portrait failed')))
        proc.on('error', reject)
      })
      character.image_url = `/images/${path.basename(portraitPath)}`
      console.log('Portrait generated:', portraitPath)
    } catch (e) {
      console.log('Portrait generation failed:', e)
    }

    // Save character
    const charPath = path.join(outputDir, `${safeName}_${character.id.slice(0, 8)}.json`)
    fs.writeFileSync(charPath, JSON.stringify(character, null, 2))

    console.log('Character saved:', charPath)
    
    // Return character with validation info
    res.json({
      ...character,
      _validation: {
        valid: true,
        attempts,
        warnings: validation.warnings
      }
    })
  } catch (error) {
    console.error('Generation error:', error)
    res.status(500).json({ error: error instanceof Error ? error.message : 'Generation failed' })
  }
})

app.post('/api/generate-portrait', async (req, res) => {
  try {
    const { physical_description, name, race, class: charClass, art_style } = req.body

    if (!physical_description) {
      return res.status(400).json({ error: 'physical_description is required' })
    }

    const stylePrompt = art_style && ART_STYLE_PROMPTS[art_style] 
      ? ART_STYLE_PROMPTS[art_style] 
      : (art_style || 'fantasy character portrait, detailed digital art')

    const prompt = `SQUARE FORMAT 1:1 aspect ratio portrait. ${stylePrompt}: ${race || ''} ${charClass || ''} character. ${physical_description.substring(0, 500)}. Square canvas, centered composition.`

    const safeName = name?.toLowerCase().replace(/[^a-z0-9_-]/g, '_') || 'character'
    const outputDir = path.join(__dirname, '../../characters')
    const outputPath = path.join(outputDir, `${safeName}_portrait_${Date.now()}.png`)

    const scriptPath = '/opt/homebrew/lib/node_modules/openclaw/skills/nano-banana-pro/scripts/generate_image.py'

    await new Promise<void>((resolve, reject) => {
      const proc = spawn('uv', ['run', scriptPath, '--prompt', prompt, '--filename', outputPath, '--resolution', '1K'], {
        env: { ...process.env, GEMINI_API_KEY }
      })
      proc.on('close', (code) => code === 0 ? resolve() : reject(new Error('Portrait generation failed')))
      proc.on('error', reject)
    })

    res.json({ image_url: `/images/${path.basename(outputPath)}` })
  } catch (error) {
    console.error('Portrait error:', error)
    res.status(500).json({ error: error instanceof Error ? error.message : 'Portrait generation failed' })
  }
})

// Validation endpoint for testing
app.post('/api/validate', async (req, res) => {
  try {
    const character = req.body
    const result = await validateCharacter(character)
    res.json(result)
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Validation failed' })
  }
})

// Inventory generation
async function generateInventoryWithClaude(character: any, additionalPrompt?: string, previousErrors?: string): Promise<any[]> {
  const characterSummary = `
Character: ${character.name}
Race: ${character.race}
Class: ${character.class}
Level: ${character.level}
Background: ${character.background || 'unknown'}
Backstory snippet: ${(character.backstory || '').substring(0, 300)}...
Personality: ${(character.traits || []).join(', ')}
`

  let prompt = `Generate starting inventory for this character:\n${characterSummary}`
  
  if (additionalPrompt) {
    prompt += `\n\nAdditional context: ${additionalPrompt}`
  }
  
  if (previousErrors) {
    prompt += `\n\nPREVIOUS ATTEMPT FAILED VALIDATION. Fix these errors:\n${previousErrors}\n\nGenerate a corrected inventory JSON array.`
  }

  const response = await fetch(OPENCLAW_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENCLAW_TOKEN}`,
      'Content-Type': 'application/json',
      'x-openclaw-agent-id': 'main'
    },
    body: JSON.stringify({
      model: 'openclaw',
      messages: [
        { role: 'system', content: INVENTORY_SCHEMA_PROMPT },
        { role: 'user', content: prompt }
      ]
    })
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`OpenClaw API error: ${response.status} - ${error}`)
  }

  const data = await response.json()
  const text = data.choices?.[0]?.message?.content

  if (!text) {
    throw new Error('No response from OpenClaw')
  }

  // Extract JSON array from response
  let jsonText = text.trim()
  if (jsonText.startsWith('```')) {
    const firstNewline = jsonText.indexOf('\n')
    jsonText = jsonText.slice(firstNewline + 1)
    if (jsonText.endsWith('```')) {
      jsonText = jsonText.slice(0, -3).trim()
    }
  }

  const start = jsonText.indexOf('[')
  const end = jsonText.lastIndexOf(']') + 1
  if (start !== -1 && end > start) {
    jsonText = jsonText.slice(start, end)
  }

  return JSON.parse(jsonText)
}

async function generateValidatedInventory(character: any, additionalPrompt?: string, maxRetries: number = 3): Promise<{ inventory: any[]; validation: any; attempts: number }> {
  let lastErrors: string | undefined
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    console.log(`  Inventory attempt ${attempt}/${maxRetries}...`)
    
    const inventory = await generateInventoryWithClaude(character, additionalPrompt, lastErrors)
    const validation = await validateInventory(inventory)
    
    if (validation.valid) {
      console.log(`  ✅ Inventory validation passed on attempt ${attempt}`)
      return { inventory: validation.inventory, validation, attempts: attempt }
    }
    
    const errorMessages = validation.errors
      .map((e: any) => `- [${e.item_name || 'item'}] ${e.field}: ${e.message}`)
      .join('\n')
    
    console.log(`  ❌ Inventory validation failed (${validation.errors.length} errors)`)
    lastErrors = errorMessages
  }
  
  throw new Error(`Failed to generate valid inventory after ${maxRetries} attempts`)
}

app.post('/api/generate-inventory', async (req, res) => {
  try {
    const { character, prompt } = req.body
    
    if (!character) {
      return res.status(400).json({ error: 'Character data is required' })
    }

    console.log(`Generating inventory for: ${character.name}...`)
    
    const { inventory, validation, attempts } = await generateValidatedInventory(character, prompt)
    
    console.log(`Inventory generated: ${inventory.length} items (validated in ${attempts} attempt(s))`)
    
    res.json({
      inventory,
      _validation: {
        valid: true,
        attempts,
        warnings: validation.warnings,
        stats: validation.stats
      }
    })
  } catch (error) {
    console.error('Inventory generation error:', error)
    res.status(500).json({ error: error instanceof Error ? error.message : 'Inventory generation failed' })
  }
})

// Validate inventory endpoint
app.post('/api/validate-inventory', async (req, res) => {
  try {
    const inventory = req.body
    const result = await validateInventory(inventory)
    res.json(result)
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Validation failed' })
  }
})

// ============================================================
// GAME ENDPOINTS
// ============================================================

const CHARACTERS_DIR = path.join(__dirname, '../../characters')
const CAMPAIGNS_DIR = path.join(__dirname, '../../campaigns')
const PLAY_CLI = path.join(__dirname, '../../src/cli/play.py')

// List all characters
app.get('/api/characters', async (req, res) => {
  try {
    if (!fs.existsSync(CHARACTERS_DIR)) {
      return res.json([])
    }
    
    const files = fs.readdirSync(CHARACTERS_DIR).filter(f => f.endsWith('.json'))
    const characters = files.map(f => {
      const data = JSON.parse(fs.readFileSync(path.join(CHARACTERS_DIR, f), 'utf-8'))
      // Add image URL if portrait exists
      const portraitName = f.replace('.json', '_portrait.png')
      if (fs.existsSync(path.join(CHARACTERS_DIR, portraitName))) {
        data.image_url = `/images/${portraitName}`
      }
      return data
    })
    
    res.json(characters)
  } catch (error) {
    console.error('Error listing characters:', error)
    res.status(500).json({ error: 'Failed to list characters' })
  }
})

// List all campaigns
app.get('/api/campaigns', async (req, res) => {
  try {
    if (!fs.existsSync(CAMPAIGNS_DIR)) {
      return res.json([])
    }
    
    const dirs = fs.readdirSync(CAMPAIGNS_DIR).filter(d => 
      fs.statSync(path.join(CAMPAIGNS_DIR, d)).isDirectory()
    )
    
    const campaigns = dirs.map(d => {
      const campaignPath = path.join(CAMPAIGNS_DIR, d, 'campaign.json')
      if (fs.existsSync(campaignPath)) {
        return JSON.parse(fs.readFileSync(campaignPath, 'utf-8'))
      }
      return null
    }).filter(Boolean)
    
    res.json(campaigns)
  } catch (error) {
    console.error('Error listing campaigns:', error)
    res.status(500).json({ error: 'Failed to list campaigns' })
  }
})

const CAMPAIGN_GENERATION_PROMPT = `You are a D&D campaign creator. Generate a campaign concept based on a character's background.

OUTPUT FORMAT: Return ONLY valid JSON (no markdown):
{
  "name": "Campaign Name (evocative, 2-5 words)",
  "world": "Brief world description (1 sentence)",
  "premise": "The opening situation that hooks this specific character (2-3 sentences, connect to their backstory/motivation/wound)"
}

RULES:
1. The premise MUST connect to the character's personal story
2. Use their wound, motivation, or secrets as hooks
3. Create tension between their want and need
4. Make it personal, not generic "save the world"`

async function generateCampaignDetails(character: any): Promise<{ name: string; world: string; premise: string }> {
  const characterSummary = `
Character: ${character.name}
Race: ${character.race}
Class: ${character.class}
Background: ${character.background || 'unknown'}
Origin: ${character.origin || 'unknown'}
Backstory: ${character.backstory || 'unknown'}
Motivation: ${character.motivation || 'unknown'}
Want: ${character.want || 'unknown'}
Need: ${character.need || 'unknown'}
Wound: ${character.wound || 'unknown'}
Lie they believe: ${character.lie_they_believe || 'unknown'}
Fear: ${character.fear || 'unknown'}
Secrets: ${(character.secrets || []).join(', ') || 'none'}
`

  const response = await fetch(OPENCLAW_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENCLAW_TOKEN}`,
      'Content-Type': 'application/json',
      'x-openclaw-agent-id': 'main'
    },
    body: JSON.stringify({
      model: 'openclaw',
      messages: [
        { role: 'system', content: CAMPAIGN_GENERATION_PROMPT },
        { role: 'user', content: `Generate a campaign for:\n${characterSummary}` }
      ]
    })
  })

  if (!response.ok) {
    throw new Error(`OpenClaw API error: ${response.status}`)
  }

  const data = await response.json()
  const text = data.choices?.[0]?.message?.content

  let jsonText = text.trim()
  if (jsonText.startsWith('```')) {
    jsonText = jsonText.slice(jsonText.indexOf('\n') + 1)
    if (jsonText.endsWith('```')) jsonText = jsonText.slice(0, -3).trim()
  }
  
  const start = jsonText.indexOf('{')
  const end = jsonText.lastIndexOf('}') + 1
  if (start !== -1 && end > start) {
    jsonText = jsonText.slice(start, end)
  }

  return JSON.parse(jsonText)
}

// Create new campaign
app.post('/api/campaigns', async (req, res) => {
  try {
    let { name, world, premise, character_id, party, auto_generate } = req.body
    
    if (!character_id) {
      return res.status(400).json({ error: 'Select at least one character' })
    }
    
    // Load characters and verify they exist
    const charFiles = fs.readdirSync(CHARACTERS_DIR).filter(f => f.endsWith('.json'))
    const partyMembers = party || [character_id]
    const characters: any[] = []
    
    for (const memberId of partyMembers) {
      let found = false
      for (const f of charFiles) {
        const data = JSON.parse(fs.readFileSync(path.join(CHARACTERS_DIR, f), 'utf-8'))
        if (data.id === memberId) {
          found = true
          characters.push(data)
          break
        }
      }
      if (!found) {
        return res.status(400).json({ error: `Character not found: ${memberId}` })
      }
    }
    
    // Auto-generate missing fields based on lead character
    if (auto_generate || !name || !world || !premise) {
      console.log('Auto-generating campaign details from character:', characters[0].name)
      const generated = await generateCampaignDetails(characters[0])
      name = name || generated.name
      world = world || generated.world
      premise = premise || generated.premise
      console.log('Generated:', { name, world, premise: premise.substring(0, 50) + '...' })
    }
    
    // Create campaign via Python CLI
    const result = await new Promise<any>((resolve, reject) => {
      const proc = spawn(PYTHON_PATH, [
        PLAY_CLI, 'new',
        '--name', name,
        '--world', world,
        '--premise', premise,
        '--character', character_id,
        '--json'
      ], { cwd: path.join(__dirname, '../..') })
      
      let stdout = ''
      let stderr = ''
      
      proc.stdout.on('data', d => stdout += d.toString())
      proc.stderr.on('data', d => stderr += d.toString())
      
      proc.on('close', code => {
        if (code === 0) {
          try {
            const campaign = JSON.parse(stdout)
            campaign.party = partyMembers
            
            // Update campaign file with party
            const safeName = name.toLowerCase().replace(/[^a-z0-9]+/g, '_')
            const campaignDir = path.join(CAMPAIGNS_DIR, campaign.id.split('-')[0] + '_' + safeName)
            const campaignPath = path.join(campaignDir, 'campaign.json')
            if (fs.existsSync(campaignPath)) {
              const savedCampaign = JSON.parse(fs.readFileSync(campaignPath, 'utf-8'))
              savedCampaign.party = partyMembers
              fs.writeFileSync(campaignPath, JSON.stringify(savedCampaign, null, 2))
            }
            
            resolve(campaign)
          } catch (e) {
            reject(new Error(`Invalid JSON: ${stdout}`))
          }
        } else {
          reject(new Error(stderr || stdout || 'Failed to create campaign'))
        }
      })
      
      proc.on('error', reject)
    })
    
    // Start background intro image generation
    if (premise) {
      const safeName = name.toLowerCase().replace(/[^a-z0-9]+/g, '_')
      const campaignDir = path.join(CAMPAIGNS_DIR, result.id.split('-')[0] + '_' + safeName)
      generateIntroImageBackground(campaignDir, premise)
        .catch(e => console.log('Background intro image error:', e))
    }
    
    res.json(result)
  } catch (error) {
    console.error('Error creating campaign:', error)
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to create campaign' })
  }
})

// Get all sessions for a campaign
app.get('/api/campaigns/:id/sessions', async (req, res) => {
  try {
    // Find campaign directory
    let campaignDir = path.join(CAMPAIGNS_DIR, req.params.id)
    
    if (!fs.existsSync(path.join(campaignDir, 'campaign.json'))) {
      const dirs = fs.readdirSync(CAMPAIGNS_DIR).filter(d => 
        fs.statSync(path.join(CAMPAIGNS_DIR, d)).isDirectory()
      )
      
      for (const d of dirs) {
        const cp = path.join(CAMPAIGNS_DIR, d, 'campaign.json')
        if (fs.existsSync(cp)) {
          const data = JSON.parse(fs.readFileSync(cp, 'utf-8'))
          if (data.id === req.params.id) {
            campaignDir = path.join(CAMPAIGNS_DIR, d)
            break
          }
        }
      }
    }
    
    const sessionsDir = path.join(campaignDir, 'sessions')
    if (!fs.existsSync(sessionsDir)) {
      return res.json([])
    }
    
    const sessionFiles = fs.readdirSync(sessionsDir).filter(f => f.endsWith('.json'))
    const sessions = sessionFiles.map(f => {
      return JSON.parse(fs.readFileSync(path.join(sessionsDir, f), 'utf-8'))
    })
    
    // Sort by sequence number
    sessions.sort((a, b) => (a.sequence || 0) - (b.sequence || 0))
    
    res.json(sessions)
  } catch (error) {
    console.error('Error listing sessions:', error)
    res.status(500).json({ error: 'Failed to list sessions' })
  }
})

// Get campaign with current session
app.get('/api/campaigns/:id', async (req, res) => {
  try {
    const campaignDir = path.join(CAMPAIGNS_DIR, req.params.id)
    const campaignPath = path.join(campaignDir, 'campaign.json')
    
    if (!fs.existsSync(campaignPath)) {
      // Try finding by name
      const dirs = fs.readdirSync(CAMPAIGNS_DIR).filter(d => 
        fs.statSync(path.join(CAMPAIGNS_DIR, d)).isDirectory()
      )
      
      for (const d of dirs) {
        const cp = path.join(CAMPAIGNS_DIR, d, 'campaign.json')
        if (fs.existsSync(cp)) {
          const data = JSON.parse(fs.readFileSync(cp, 'utf-8'))
          if (data.id === req.params.id) {
            return res.json(await enrichCampaign(data, path.join(CAMPAIGNS_DIR, d)))
          }
        }
      }
      
      return res.status(404).json({ error: 'Campaign not found' })
    }
    
    const campaign = JSON.parse(fs.readFileSync(campaignPath, 'utf-8'))
    res.json(await enrichCampaign(campaign, campaignDir))
  } catch (error) {
    console.error('Error getting campaign:', error)
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to get campaign' })
  }
})

async function enrichCampaign(campaign: any, campaignDir: string) {
  // Load current session if any
  if (campaign.current_session) {
    const sessionPath = path.join(campaignDir, 'sessions', `${campaign.current_session}.json`)
    if (fs.existsSync(sessionPath)) {
      campaign.currentSessionData = JSON.parse(fs.readFileSync(sessionPath, 'utf-8'))
    }
  }
  
  // Load character
  const charFiles = fs.readdirSync(CHARACTERS_DIR).filter(f => f.endsWith('.json'))
  for (const f of charFiles) {
    const data = JSON.parse(fs.readFileSync(path.join(CHARACTERS_DIR, f), 'utf-8'))
    if (data.id === campaign.character_id) {
      campaign.character = data
      break
    }
  }
  
  return campaign
}

// Update campaign settings
app.patch('/api/campaigns/:id/settings', async (req, res) => {
  try {
    // Find campaign directory
    let campaignDir = path.join(CAMPAIGNS_DIR, req.params.id)
    
    if (!fs.existsSync(path.join(campaignDir, 'campaign.json'))) {
      // Try finding by ID
      const dirs = fs.readdirSync(CAMPAIGNS_DIR).filter(d => 
        fs.statSync(path.join(CAMPAIGNS_DIR, d)).isDirectory()
      )
      
      for (const d of dirs) {
        const cp = path.join(CAMPAIGNS_DIR, d, 'campaign.json')
        if (fs.existsSync(cp)) {
          const data = JSON.parse(fs.readFileSync(cp, 'utf-8'))
          if (data.id === req.params.id) {
            campaignDir = path.join(CAMPAIGNS_DIR, d)
            break
          }
        }
      }
    }
    
    const campaignPath = path.join(campaignDir, 'campaign.json')
    if (!fs.existsSync(campaignPath)) {
      return res.status(404).json({ error: 'Campaign not found' })
    }
    
    const campaign = JSON.parse(fs.readFileSync(campaignPath, 'utf-8'))
    
    // Update allowed settings
    const { art_style, generate_intro_image } = req.body
    if (art_style) {
      campaign.art_style = art_style
    }
    
    campaign.updated_at = new Date().toISOString()
    fs.writeFileSync(campaignPath, JSON.stringify(campaign, null, 2))
    
    // Generate intro image if requested or if art style changed and no intro image exists
    if (generate_intro_image || (art_style && !campaign.intro_image_url)) {
      log(`Generating intro image for campaign ${campaign.name} with style ${art_style}...`)
      try {
        const prompt = await generateImagePromptFromNarrative(campaign.premise)
        const campaignId = path.basename(campaignDir)
        const imageUrl = await generateSceneImage(prompt, campaignId, 'intro.png', art_style)
        
        if (imageUrl) {
          campaign.intro_image_url = imageUrl
          fs.writeFileSync(campaignPath, JSON.stringify(campaign, null, 2))
          log(`Intro image saved: ${imageUrl}`)
        }
      } catch (e) {
        log(`Intro image generation failed: ${e}`, 'ERROR')
      }
    }
    
    res.json({ ok: true, campaign })
  } catch (error) {
    console.error('Error updating campaign settings:', error)
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to update settings' })
  }
})

// Start new session
app.post('/api/campaigns/:id/session', async (req, res) => {
  try {
    // Find campaign directory
    let campaignDir = path.join(CAMPAIGNS_DIR, req.params.id)
    
    if (!fs.existsSync(path.join(campaignDir, 'campaign.json'))) {
      // Try finding by ID
      const dirs = fs.readdirSync(CAMPAIGNS_DIR).filter(d => 
        fs.statSync(path.join(CAMPAIGNS_DIR, d)).isDirectory()
      )
      
      for (const d of dirs) {
        const cp = path.join(CAMPAIGNS_DIR, d, 'campaign.json')
        if (fs.existsSync(cp)) {
          const data = JSON.parse(fs.readFileSync(cp, 'utf-8'))
          if (data.id === req.params.id) {
            campaignDir = path.join(CAMPAIGNS_DIR, d)
            break
          }
        }
      }
    }
    
    const campaign = JSON.parse(fs.readFileSync(path.join(campaignDir, 'campaign.json'), 'utf-8'))
    
    // Find character file
    const charFiles = fs.readdirSync(CHARACTERS_DIR).filter(f => f.endsWith('.json'))
    let characterPath = ''
    for (const f of charFiles) {
      const data = JSON.parse(fs.readFileSync(path.join(CHARACTERS_DIR, f), 'utf-8'))
      if (data.id === campaign.character_id) {
        characterPath = path.join(CHARACTERS_DIR, f)
        break
      }
    }
    
    if (!characterPath) {
      return res.status(400).json({ error: 'Character not found' })
    }
    
    log(`Starting new session for campaign: ${campaign.name}`)
    const sessionStartTime = Date.now()
    
    // Call Python CLI to start session
    const result = await new Promise<any>((resolve, reject) => {
      const proc = spawn(PYTHON_PATH, [
        PLAY_CLI, 'session',
        '--campaign', campaignDir,
        '--character', characterPath,
        '--json'
      ], { 
        cwd: path.join(__dirname, '../..'),
        env: { ...process.env }
      })
      
      let stdout = ''
      let stderr = ''
      
      // Set up timeout
      const timeout = setTimeout(() => {
        log(`Session generation timed out after 3 minutes`, 'ERROR')
        proc.kill('SIGTERM')
        reject(new Error('Session generation timed out (3 min)'))
      }, 180000) // 3 minutes
      
      proc.stdout.on('data', d => {
        const chunk = d.toString()
        stdout += chunk
        log(`play.py stdout: ${chunk.substring(0, 200)}`, 'DEBUG')
      })
      proc.stderr.on('data', d => {
        const chunk = d.toString()
        stderr += chunk
        log(`play.py stderr: ${chunk}`, 'DEBUG')
      })
      
      proc.on('close', code => {
        clearTimeout(timeout)
        const elapsed = ((Date.now() - sessionStartTime) / 1000).toFixed(1)
        log(`play.py exited with code ${code} after ${elapsed}s`)
        
        if (code === 0) {
          try {
            // Find the JSON in stdout
            const jsonMatch = stdout.match(/\{[\s\S]*\}/)
            if (jsonMatch) {
              resolve(JSON.parse(jsonMatch[0]))
            } else {
              log(`No JSON found in output: ${stdout.substring(0, 500)}`, 'ERROR')
              reject(new Error('No JSON in output'))
            }
          } catch (e) {
            log(`Invalid JSON: ${stdout.substring(0, 500)}`, 'ERROR')
            reject(new Error(`Invalid JSON: ${stdout}`))
          }
        } else {
          log(`Session failed: ${stderr || stdout || 'Unknown error'}`, 'ERROR')
          reject(new Error(stderr || stdout || 'Failed to start session'))
        }
      })
      
      proc.on('error', (err) => {
        clearTimeout(timeout)
        log(`Process error: ${err.message}`, 'ERROR')
        reject(err)
      })
    })
    
    // Generate scene image BEFORE returning (synchronous)
    // result structure: { session: { id, content: { narrative } }, choices, narrative }
    const sessionId = result.session?.id
    const narrative = result.narrative || result.session?.content?.narrative
    
    if (sessionId && narrative) {
      const campaignPath = path.join(campaignDir, 'campaign.json')
      const campaignData = fs.existsSync(campaignPath) ? JSON.parse(fs.readFileSync(campaignPath, 'utf-8')) : {}
      
      log(`Generating scene image for session ${sessionId}...`)
      try {
        const prompt = await generateImagePromptFromNarrative(narrative)
        const campaignId = path.basename(campaignDir)
        const filename = `${sessionId}_scene.png`
        const imageUrl = await generateSceneImage(prompt, campaignId, filename, campaignData.art_style)
        
        if (imageUrl) {
          // Update result object
          if (result.session?.content) {
            result.session.content.image_url = imageUrl
          }
          // Update session file
          const sessionPath = path.join(campaignDir, 'sessions', `${sessionId}.json`)
          if (fs.existsSync(sessionPath)) {
            const session = JSON.parse(fs.readFileSync(sessionPath, 'utf-8'))
            session.content = session.content || {}
            session.content.image_url = imageUrl
            fs.writeFileSync(sessionPath, JSON.stringify(session, null, 2))
          }
          log(`Scene image saved: ${imageUrl}`)
        }
      } catch (e) {
        log(`Scene image generation failed: ${e}`, 'ERROR')
      }
    }
    
    res.json(result)
  } catch (error) {
    console.error('Error starting session:', error)
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to start session' })
  }
})

// Make a choice
app.post('/api/campaigns/:id/choice', async (req, res) => {
  try {
    const { choice_id } = req.body
    
    if (!choice_id) {
      return res.status(400).json({ error: 'choice_id is required' })
    }
    
    // Find campaign directory
    let campaignDir = path.join(CAMPAIGNS_DIR, req.params.id)
    
    if (!fs.existsSync(path.join(campaignDir, 'campaign.json'))) {
      const dirs = fs.readdirSync(CAMPAIGNS_DIR).filter(d => 
        fs.statSync(path.join(CAMPAIGNS_DIR, d)).isDirectory()
      )
      
      for (const d of dirs) {
        const cp = path.join(CAMPAIGNS_DIR, d, 'campaign.json')
        if (fs.existsSync(cp)) {
          const data = JSON.parse(fs.readFileSync(cp, 'utf-8'))
          if (data.id === req.params.id) {
            campaignDir = path.join(CAMPAIGNS_DIR, d)
            break
          }
        }
      }
    }
    
    const campaign = JSON.parse(fs.readFileSync(path.join(campaignDir, 'campaign.json'), 'utf-8'))
    
    // Find character file
    const charFiles = fs.readdirSync(CHARACTERS_DIR).filter(f => f.endsWith('.json'))
    let characterPath = ''
    for (const f of charFiles) {
      const data = JSON.parse(fs.readFileSync(path.join(CHARACTERS_DIR, f), 'utf-8'))
      if (data.id === campaign.character_id) {
        characterPath = path.join(CHARACTERS_DIR, f)
        break
      }
    }
    
    log(`Making choice ${choice_id} in campaign: ${campaign.name}`)
    const choiceStartTime = Date.now()
    
    // Call Python CLI to make choice
    const result = await new Promise<any>((resolve, reject) => {
      const proc = spawn(PYTHON_PATH, [
        PLAY_CLI, 'choice',
        '--campaign', campaignDir,
        '--character', characterPath,
        '--choice', String(choice_id),
        '--json'
      ], { 
        cwd: path.join(__dirname, '../..'),
        env: { ...process.env }
      })
      
      let stdout = ''
      let stderr = ''
      
      // Set up timeout
      const timeout = setTimeout(() => {
        log(`Choice processing timed out after 3 minutes`, 'ERROR')
        proc.kill('SIGTERM')
        reject(new Error('Choice processing timed out (3 min)'))
      }, 180000) // 3 minutes
      
      proc.stdout.on('data', d => {
        const chunk = d.toString()
        stdout += chunk
        log(`play.py choice stdout: ${chunk.substring(0, 200)}`, 'DEBUG')
      })
      proc.stderr.on('data', d => {
        const chunk = d.toString()
        stderr += chunk
        log(`play.py choice stderr: ${chunk}`, 'DEBUG')
      })
      
      proc.on('close', code => {
        clearTimeout(timeout)
        const elapsed = ((Date.now() - choiceStartTime) / 1000).toFixed(1)
        log(`play.py choice exited with code ${code} after ${elapsed}s`)
        
        if (code === 0) {
          try {
            const jsonMatch = stdout.match(/\{[\s\S]*\}/)
            if (jsonMatch) {
              resolve(JSON.parse(jsonMatch[0]))
            } else {
              log(`No JSON found in choice output: ${stdout.substring(0, 500)}`, 'ERROR')
              reject(new Error('No JSON in output'))
            }
          } catch (e) {
            log(`Invalid JSON in choice: ${stdout.substring(0, 500)}`, 'ERROR')
            reject(new Error(`Invalid JSON: ${stdout}`))
          }
        } else {
          log(`Choice failed: ${stderr || stdout || 'Unknown error'}`, 'ERROR')
          reject(new Error(stderr || stdout || 'Failed to make choice'))
        }
      })
      
      proc.on('error', (err) => {
        clearTimeout(timeout)
        log(`Choice process error: ${err.message}`, 'ERROR')
        reject(err)
      })
    })
    
    // Generate outcome image BEFORE returning (synchronous)
    // Get session ID from campaign's current_session since result doesn't include it
    const campaignPath = path.join(campaignDir, 'campaign.json')
    const campaignData = fs.existsSync(campaignPath) ? JSON.parse(fs.readFileSync(campaignPath, 'utf-8')) : {}
    const currentSessionId = campaignData.current_session
    
    if (currentSessionId && result.outcome_narrative) {
      log(`Generating outcome image for session ${currentSessionId}...`)
      try {
        const prompt = await generateImagePromptFromNarrative(result.outcome_narrative)
        const campaignId = path.basename(campaignDir)
        const filename = `${currentSessionId}_outcome.png`
        const imageUrl = await generateSceneImage(prompt, campaignId, filename, campaignData.art_style)
        
        if (imageUrl) {
          result.outcome_image_url = imageUrl
          result.session_id = currentSessionId  // Add session_id to result for frontend
          // Update session file
          const sessionPath = path.join(campaignDir, 'sessions', `${currentSessionId}.json`)
          if (fs.existsSync(sessionPath)) {
            const session = JSON.parse(fs.readFileSync(sessionPath, 'utf-8'))
            session.outcome_image_url = imageUrl
            fs.writeFileSync(sessionPath, JSON.stringify(session, null, 2))
          }
          log(`Outcome image saved: ${imageUrl}`)
        }
      } catch (e) {
        log(`Outcome image generation failed: ${e}`, 'ERROR')
      }
    } else {
      log(`Cannot generate outcome image: sessionId=${currentSessionId}, has_narrative=${!!result.outcome_narrative}`, 'ERROR')
    }
    
    res.json(result)
  } catch (error) {
    console.error('Error making choice:', error)
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to make choice' })
  }
})

app.listen(PORT, () => {
  log(`🎲 Loom API running on http://localhost:${PORT}`)
  log(`   - Character generation with validation`)
  log(`   - Inventory generation with validation`)
  log(`   - Using OpenClaw Gateway API (Claude)`)
  log(`   - Portraits via Gemini (nano-banana-pro)`)
  log(`   - Logs: ${LOG_FILE}`)
})
