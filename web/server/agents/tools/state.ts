import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export const CAMPAIGNS_DIR = path.join(__dirname, '../../../../campaigns')
export const CHARACTERS_DIR = path.join(__dirname, '../../../../characters')

// ─── Campaign helpers ───

export function findCampaignDir(campaignId: string): string | null {
  if (!fs.existsSync(CAMPAIGNS_DIR)) return null

  // Try direct path first
  const direct = path.join(CAMPAIGNS_DIR, campaignId)
  if (fs.existsSync(path.join(direct, 'campaign.json'))) return direct

  // Search by campaign ID in campaign.json
  const dirs = fs.readdirSync(CAMPAIGNS_DIR).filter(d =>
    fs.statSync(path.join(CAMPAIGNS_DIR, d)).isDirectory()
  )
  for (const d of dirs) {
    const cp = path.join(CAMPAIGNS_DIR, d, 'campaign.json')
    if (fs.existsSync(cp)) {
      const data = JSON.parse(fs.readFileSync(cp, 'utf-8'))
      if (data.id === campaignId) return path.join(CAMPAIGNS_DIR, d)
    }
  }
  return null
}

export function loadCampaign(campaignDir: string): any {
  return JSON.parse(fs.readFileSync(path.join(campaignDir, 'campaign.json'), 'utf-8'))
}

export function saveCampaign(campaignDir: string, campaign: any): void {
  fs.writeFileSync(path.join(campaignDir, 'campaign.json'), JSON.stringify(campaign, null, 2))
}

export function loadSession(campaignDir: string, sessionId: string): any {
  const sessionPath = path.join(campaignDir, 'sessions', `${sessionId}.json`)
  if (!fs.existsSync(sessionPath)) return null
  return JSON.parse(fs.readFileSync(sessionPath, 'utf-8'))
}

export function saveSession(campaignDir: string, session: any): void {
  const sessionsDir = path.join(campaignDir, 'sessions')
  if (!fs.existsSync(sessionsDir)) fs.mkdirSync(sessionsDir, { recursive: true })
  fs.writeFileSync(path.join(sessionsDir, `${session.id}.json`), JSON.stringify(session, null, 2))
}

export function findCharacterById(characterId: string): any | null {
  if (!fs.existsSync(CHARACTERS_DIR)) return null
  const files = fs.readdirSync(CHARACTERS_DIR).filter(f => f.endsWith('.json'))
  for (const f of files) {
    const data = JSON.parse(fs.readFileSync(path.join(CHARACTERS_DIR, f), 'utf-8'))
    if (data.id === characterId) return data
  }
  return null
}

export function findCharacterPath(characterId: string): string | null {
  if (!fs.existsSync(CHARACTERS_DIR)) return null
  const files = fs.readdirSync(CHARACTERS_DIR).filter(f => f.endsWith('.json'))
  for (const f of files) {
    const data = JSON.parse(fs.readFileSync(path.join(CHARACTERS_DIR, f), 'utf-8'))
    if (data.id === characterId) return path.join(CHARACTERS_DIR, f)
  }
  return null
}

// ─── Campaign creation (ported from game.py create_campaign) ───

export function createCampaign(opts: {
  name: string
  world: string
  premise: string
  characterId: string
  party?: string[]
}): { campaign: any; campaignDir: string } {
  const campaignId = crypto.randomUUID().slice(0, 8)
  const safeName = opts.name.toLowerCase().replace(/[^a-z0-9]+/g, '_')
  const dirName = `${campaignId}_${safeName}`
  const campaignDir = path.join(CAMPAIGNS_DIR, dirName)

  const campaign = {
    id: campaignId,
    name: opts.name,
    world: opts.world,
    premise: opts.premise,
    character_id: opts.characterId,
    party: opts.party || [opts.characterId],
    sessions: [],
    current_session: null,
    state: {},
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }

  fs.mkdirSync(path.join(campaignDir, 'sessions'), { recursive: true })
  saveCampaign(campaignDir, campaign)

  return { campaign, campaignDir }
}

// ─── Session creation ───

export function createSession(campaignDir: string, campaign: any): any {
  const sessionId = crypto.randomUUID().slice(0, 8)
  const sequence = (campaign.sessions?.length || 0) + 1

  const session = {
    id: sessionId,
    campaign_id: campaign.id,
    sequence,
    content: null,
    state: 'narrative',
    chosen_option: null,
    roll_result: null,
    outcome_narrative: null,
    summary: null,
    created_at: new Date().toISOString(),
    completed_at: null,
  }

  // Update campaign
  campaign.sessions = campaign.sessions || []
  campaign.sessions.push(sessionId)
  campaign.current_session = sessionId
  campaign.updated_at = new Date().toISOString()

  saveSession(campaignDir, session)
  saveCampaign(campaignDir, campaign)

  return session
}

// ─── Previous session context ───

export function getPreviousSessionContext(campaignDir: string, campaign: any): { summary: string; outcome: string } | null {
  if (!campaign.sessions?.length) return null

  const lastSessionId = campaign.sessions[campaign.sessions.length - 1]
  const lastSession = loadSession(campaignDir, lastSessionId)
  if (!lastSession) return null

  return {
    summary: lastSession.summary || 'No previous summary',
    outcome: lastSession.outcome_narrative || 'Unknown',
  }
}

/**
 * Build a running story context from ALL completed sessions.
 * This gives the DM full knowledge of what's happened in the campaign.
 */
export function buildCampaignStoryContext(campaignDir: string, campaign: any): string {
  if (!campaign.sessions?.length) return ''

  const parts: string[] = []

  for (let i = 0; i < campaign.sessions.length; i++) {
    const session = loadSession(campaignDir, campaign.sessions[i])
    if (!session) continue

    const summary = session.summary
    const chosenOption = session.chosen_option
    const rollOutcome = session.roll_result?.outcome
    const choices = session.content?.choices || []
    const chosenChoice = choices.find((c: any) => c.id === chosenOption)

    let entry = `Scene ${i + 1}`
    if (summary) {
      entry += `: ${summary}`
    }
    if (chosenChoice) {
      entry += ` [Chose: "${chosenChoice.text}" → ${rollOutcome || 'unknown'}]`
    }

    parts.push(entry)
  }

  if (parts.length === 0) return ''

  return `\n\nCAMPAIGN HISTORY (${parts.length} scenes so far):\n${parts.join('\n')}`
}
