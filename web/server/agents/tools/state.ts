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
export function buildCampaignStoryContext(campaignDir: string, campaign: any, character?: any): string {
  if (!campaign.sessions?.length) return ''

  // Structured state summary
  const stateContext = character ? buildStructuredStateContext(campaign, character) : ''

  // Recent scene summaries (last 5 for narrative flow)
  const recentCount = 5
  const sessionCount = campaign.sessions.length
  const startFrom = Math.max(0, sessionCount - recentCount)

  const parts: string[] = []
  for (let i = startFrom; i < sessionCount; i++) {
    const session = loadSession(campaignDir, campaign.sessions[i])
    if (!session) continue

    const summary = session.summary
    const chosenOption = session.chosen_option
    const rollOutcome = session.roll_result?.outcome
    const choices = session.content?.choices || []
    const chosenChoice = choices.find((c: any) => c.id === chosenOption)

    let entry = `Scene ${i + 1}`
    if (summary) entry += `: ${summary}`
    if (chosenChoice) entry += ` [Chose: "${chosenChoice.text}" → ${rollOutcome || 'unknown'}]`

    parts.push(entry)
  }

  let result = ''
  if (stateContext) result += stateContext
  if (parts.length > 0) {
    result += `\n\nRECENT SCENES (${parts.length} of ${sessionCount}):\n${parts.join('\n')}`
  }

  return result
}

// ─── Campaign State ───

const DEFAULT_CAMPAIGN_STATE = {
  hp_delta: 0,
  items: [],
  npcs: [],
  locations_visited: [],
  knowledge: [],
  active_quests: [],
  completed_quests: [],
  reputation: {},
  events_log: [],
}

export function getCampaignState(campaign: any): any {
  const state = campaign.state || {}
  return { ...DEFAULT_CAMPAIGN_STATE, ...state }
}

/**
 * Accumulate extracted events into the campaign state.
 */
export function accumulateCampaignState(
  campaignDir: string,
  campaign: any,
  events: any[],
  sceneNumber: number
): void {
  const state = getCampaignState(campaign)

  for (const event of events) {
    // Always log the event
    state.events_log.push({ ...event, scene: sceneNumber })

    switch (event.type) {
      case 'hp_change':
        state.hp_delta += (event.value || 0)
        break

      case 'item_gained':
        if (event.name && !state.items.includes(event.name)) {
          state.items.push(event.name)
        }
        break

      case 'item_lost':
        state.items = state.items.filter((i: string) => i !== event.name)
        break

      case 'npc_encountered': {
        const existing = state.npcs.find((n: any) => n.name === event.name)
        if (existing) {
          existing.last_seen_scene = sceneNumber
          if (event.disposition) existing.disposition = event.disposition
        } else {
          state.npcs.push({
            name: event.name,
            description: event.description || '',
            disposition: event.disposition || 'unknown',
            faction: event.faction || undefined,
            first_met_scene: sceneNumber,
            last_seen_scene: sceneNumber,
            alive: true,
          })
        }
        break
      }

      case 'location_entered':
        if (event.name && !state.locations_visited.includes(event.name)) {
          state.locations_visited.push(event.name)
        }
        break

      case 'knowledge_gained':
        if (event.fact && !state.knowledge.includes(event.fact)) {
          state.knowledge.push(event.fact)
        }
        break

      case 'quest_started':
        if (event.name && !state.active_quests.some((q: any) => q.name === event.name)) {
          state.active_quests.push({
            name: event.name,
            description: event.description || '',
            started_scene: sceneNumber,
          })
        }
        break

      case 'quest_completed': {
        const questIdx = state.active_quests.findIndex((q: any) => q.name === event.name)
        if (questIdx >= 0) {
          const quest = state.active_quests.splice(questIdx, 1)[0]
          state.completed_quests.push({
            name: quest.name,
            outcome: event.outcome || 'completed',
            completed_scene: sceneNumber,
          })
        } else {
          state.completed_quests.push({
            name: event.name,
            outcome: event.outcome || 'completed',
            completed_scene: sceneNumber,
          })
        }
        break
      }

      case 'reputation_change':
        if (event.faction) {
          state.reputation[event.faction] = (state.reputation[event.faction] || 0) + (event.delta || 0)
        }
        break
    }
  }

  campaign.state = state
  saveCampaign(campaignDir, campaign)
}

/**
 * Build structured campaign state context for the DM prompt.
 */
export function buildStructuredStateContext(campaign: any, character: any): string {
  const state = getCampaignState(campaign)
  const parts: string[] = ['\nCAMPAIGN STATE:']

  // HP
  if (character.hp) {
    const currentHp = Math.max(0, (character.hp.current || character.hp.max) + state.hp_delta)
    parts.push(`- HP: ${currentHp}/${character.hp.max}${state.hp_delta !== 0 ? ` (${state.hp_delta > 0 ? '+' : ''}${state.hp_delta} from events)` : ''}`)
  }

  // Items
  if (state.items.length > 0) {
    parts.push(`- Items carried: ${state.items.join(', ')}`)
  }

  // NPCs
  if (state.npcs.length > 0) {
    const npcList = state.npcs.map((n: any) => `${n.name} (${n.disposition}${n.faction ? ', ' + n.faction : ''})`).join(', ')
    parts.push(`- NPCs met: ${npcList}`)
  }

  // Locations
  if (state.locations_visited.length > 0) {
    parts.push(`- Locations visited: ${state.locations_visited.join(', ')}`)
  }

  // Knowledge
  if (state.knowledge.length > 0) {
    parts.push(`- Known facts: ${state.knowledge.join('; ')}`)
  }

  // Quests
  if (state.active_quests.length > 0) {
    parts.push(`- Active quests: ${state.active_quests.map((q: any) => q.name).join(', ')}`)
  }
  if (state.completed_quests.length > 0) {
    parts.push(`- Completed quests: ${state.completed_quests.map((q: any) => `${q.name} (${q.outcome})`).join(', ')}`)
  }

  // Reputation
  const repEntries = Object.entries(state.reputation).filter(([_, v]) => v !== 0)
  if (repEntries.length > 0) {
    parts.push(`- Reputation: ${repEntries.map(([f, v]) => `${f} ${(v as number) > 0 ? '+' : ''}${v}`).join(', ')}`)
  }

  return parts.length > 1 ? parts.join('\n') : ''
}
