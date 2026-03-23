import fs from 'fs'
import path from 'path'
import { HttpError } from './types.js'
import type { Campaign, Character } from './types.js'
import { CAMPAIGNS_DIR, CHARACTERS_DIR, loadCampaign, findCharacterById } from './agents/tools/state.js'

// ─── Logging ───

const LOG_FILE = '/tmp/loom-server.log'

export function log(message: string, level: 'INFO' | 'ERROR' | 'DEBUG' = 'INFO') {
  const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 19)
  const line = `${timestamp} [${level}] ${message}`
  console.log(line)
  fs.appendFileSync(LOG_FILE, line + '\n')
}

export function initLog() {
  fs.writeFileSync(LOG_FILE, `=== Loom Server Started at ${new Date().toISOString()} ===\n`)
}

// ─── Environment Validation ───

export function validateEnv() {
  const openaiKey = process.env.OPENAI_API_KEY
  const gemini = process.env.GEMINI_API_KEY
  const model = process.env.OPENAI_MODEL || 'gpt-4.1'

  if (!openaiKey) {
    log('WARNING: OPENAI_API_KEY not set — AI features will fail', 'ERROR')
  }
  if (!gemini) {
    log('WARNING: GEMINI_API_KEY not set — image generation will be skipped', 'ERROR')
  }

  log(`OpenAI model: ${model}`)
  log(`OpenAI API: ${openaiKey?.trim() ? 'configured' : 'NOT SET'}`)
  log(`Gemini API: ${gemini ? 'configured' : 'NOT SET'}`)
  log(`Campaigns dir: ${CAMPAIGNS_DIR}`)
  log(`Characters dir: ${CHARACTERS_DIR}`)
}

// ─── JSON Extraction ───

/**
 * Extract JSON from agent output text, handling markdown fences and surrounding prose.
 */
export function extractJSON<T = any>(text: string, kind: 'object' | 'array'): T {
  let cleaned = text.trim()

  // Strip markdown code fences
  const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fenceMatch) {
    cleaned = fenceMatch[1].trim()
  }

  const open = kind === 'object' ? '{' : '['
  const close = kind === 'object' ? '}' : ']'

  // Find the first opening bracket
  const startIdx = cleaned.indexOf(open)
  if (startIdx === -1) {
    throw new Error(`No ${kind} found in agent output (missing '${open}'). Output starts with: "${cleaned.slice(0, 100)}"`)
  }

  // Walk forward counting brackets to find matching close
  let depth = 0
  let inString = false
  let escape = false

  for (let i = startIdx; i < cleaned.length; i++) {
    const ch = cleaned[i]

    if (escape) {
      escape = false
      continue
    }

    if (ch === '\\' && inString) {
      escape = true
      continue
    }

    if (ch === '"' && !escape) {
      inString = !inString
      continue
    }

    if (inString) continue

    if (ch === open) depth++
    if (ch === close) {
      depth--
      if (depth === 0) {
        const jsonStr = cleaned.slice(startIdx, i + 1)
        try {
          return JSON.parse(jsonStr) as T
        } catch (e) {
          throw new Error(`Found ${kind} but JSON.parse failed: ${(e as Error).message}. JSON starts with: "${jsonStr.slice(0, 100)}"`)
        }
      }
    }
  }

  throw new Error(`Unbalanced ${kind} in agent output — found '${open}' at position ${startIdx} but no matching '${close}'`)
}

// ─── Campaign Resolution ───

/**
 * Find campaign directory and load campaign data. Throws HttpError(404) if not found.
 */
export function resolveCampaign(campaignIdOrPath: string): { campaignDir: string; campaign: any } {
  // Try direct path
  let campaignDir = path.join(CAMPAIGNS_DIR, campaignIdOrPath)

  if (fs.existsSync(path.join(campaignDir, 'campaign.json'))) {
    return { campaignDir, campaign: loadCampaign(campaignDir) }
  }

  // Search by campaign ID
  if (fs.existsSync(CAMPAIGNS_DIR)) {
    const dirs = fs.readdirSync(CAMPAIGNS_DIR).filter(d =>
      fs.statSync(path.join(CAMPAIGNS_DIR, d)).isDirectory()
    )

    for (const d of dirs) {
      const cp = path.join(CAMPAIGNS_DIR, d, 'campaign.json')
      if (fs.existsSync(cp)) {
        const data = JSON.parse(fs.readFileSync(cp, 'utf-8'))
        if (data.id === campaignIdOrPath) {
          return { campaignDir: path.join(CAMPAIGNS_DIR, d), campaign: data }
        }
      }
    }
  }

  throw new HttpError(404, `Campaign not found: ${campaignIdOrPath}`)
}

// ─── Character Resolution ───

/**
 * Find character by ID. Throws HttpError(404) if not found.
 */
export function resolveCharacter(characterId: string): Character {
  const character = findCharacterById(characterId) as Character | null
  if (!character) {
    throw new HttpError(404, `Character not found: ${characterId}`)
  }
  return character
}

// ─── Game Context ───

import type { GameContext } from './types.js'

/**
 * Resolve campaign + character into a GameContext. Throws HttpError on failure.
 */
export function resolveGameContext(campaignIdOrPath: string): GameContext {
  const { campaignDir, campaign } = resolveCampaign(campaignIdOrPath)
  const character = resolveCharacter(campaign.character_id)
  return { campaignDir, campaign, character }
}

// ─── Session Content Validation ───

/**
 * Validate that raw session content from the agent has the required structure.
 */
export function validateSessionContent(raw: any): void {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Session content must be an object')
  }

  if (typeof raw.narrative !== 'string' || raw.narrative.length < 50) {
    throw new Error(`Session narrative is missing or too short (${raw.narrative?.length || 0} chars, need 50+)`)
  }

  if (!Array.isArray(raw.choices) || raw.choices.length === 0) {
    throw new Error(`Session must have choices array (got ${typeof raw.choices})`)
  }

  for (let i = 0; i < raw.choices.length; i++) {
    const c = raw.choices[i]
    if (typeof c.id !== 'number') {
      throw new Error(`Choice ${i}: id must be a number (got ${typeof c.id})`)
    }
    if (typeof c.text !== 'string' || c.text.length === 0) {
      throw new Error(`Choice ${i}: text is required`)
    }
    if (typeof c.dc !== 'number' || c.dc < 1) {
      throw new Error(`Choice ${i}: dc must be a positive number (got ${c.dc})`)
    }
  }
}
