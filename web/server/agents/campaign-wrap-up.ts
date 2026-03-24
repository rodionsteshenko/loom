import { Agent } from '@openai/agents'
import { MODEL } from './config.js'

const WRAP_UP_PROMPT = `You are a campaign wrap-up agent for a D&D RPG. Given the full campaign history, accumulated state, and character details, propose updates that should be applied after the campaign ends.

Output ONLY valid JSON with this structure:
{
  "character_updates": {
    "hp_change": 0,
    "xp_award": 300,
    "items_to_add": ["Item Name"],
    "items_to_remove": [],
    "new_relationships": [
      {"name": "NPC Name", "type": "ally", "description": "Brief description of relationship"}
    ],
    "knowledge_to_add": ["Fact learned during campaign"],
    "backstory_addition": "A paragraph summarizing what happened during this campaign, written in third person past tense, to append to the character's backstory."
  },
  "world_updates": {
    "faction_changes": [
      {"faction": "Faction Name", "change": "Description of what changed"}
    ],
    "npc_changes": [
      {"name": "NPC Name", "change": "Status change (e.g., 'now allied with the player', 'killed', 'promoted')"}
    ],
    "new_locations": [
      {"name": "Location Name", "description": "Brief description", "region": "Region it belongs to"}
    ],
    "timeline_event": {
      "name": "Campaign event name",
      "description": "1-2 sentence description of what happened",
      "impact": "How this changed the world"
    }
  },
  "campaign_summary": "2-3 paragraph narrative summary of the entire campaign arc, suitable for a campaign journal."
}

RULES:
1. Base ALL updates on what ACTUALLY happened in the events log — do not invent
2. XP award should be 50-100 per scene completed, with bonuses for boss encounters
3. Only add items the player actually found (from events log)
4. HP change should account for healing between sessions (partial recovery)
5. The backstory_addition should read naturally as a continuation of the character's story
6. World updates should only reflect significant changes, not minor events
7. The timeline_event is a single entry summarizing the campaign for the world's history
8. Output ONLY the JSON. No markdown code blocks.`

export const campaignWrapUpAgent = new Agent({
  name: 'CampaignWrapUp',
  instructions: WRAP_UP_PROMPT,
  model: MODEL,
  modelSettings: { temperature: 0.5 },
})

export function buildWrapUpPrompt(opts: {
  campaign: any
  character: any
  campaignState: any
  sessions: any[]
}): string {
  const { campaign, character, campaignState, sessions } = opts

  const sessionSummaries = sessions.map((s: any, i: number) => {
    const choice = s.content?.choices?.find((c: any) => c.id === s.chosen_option)
    return `Scene ${i + 1}: ${s.summary || 'No summary'} [${choice?.text || 'no choice'} → ${s.roll_result?.outcome || 'unknown'}]`
  }).join('\n')

  return `CHARACTER: ${character.name} (Level ${character.level} ${character.race} ${character.class})
CAMPAIGN: ${campaign.name}
WORLD: ${campaign.world}
PREMISE: ${campaign.premise}

CAMPAIGN STATE:
- HP delta: ${campaignState.hp_delta || 0}
- Items found: ${(campaignState.items || []).join(', ') || 'none'}
- NPCs met: ${(campaignState.npcs || []).map((n: any) => `${n.name} (${n.disposition})`).join(', ') || 'none'}
- Locations visited: ${(campaignState.locations_visited || []).join(', ') || 'none'}
- Knowledge gained: ${(campaignState.knowledge || []).join('; ') || 'none'}
- Completed quests: ${(campaignState.completed_quests || []).map((q: any) => q.name).join(', ') || 'none'}
- Reputation: ${Object.entries(campaignState.reputation || {}).map(([f, v]) => `${f}: ${v}`).join(', ') || 'none'}

SESSION HISTORY:
${sessionSummaries}

FULL EVENT LOG:
${JSON.stringify(campaignState.events_log || [], null, 2)}

Generate the wrap-up summary and proposed updates.`
}
