import { Agent } from '@openai/agents'
import { MODEL } from './config.js'

const EVENT_EXTRACTION_PROMPT = `You are a game state tracker for a D&D RPG. Given a scene outcome, extract structured events that happened.

Read the narrative carefully. Output ONLY a JSON array of events. Be CONSERVATIVE — only extract events that CLEARLY happened in the text. Do not invent or assume events.

Event types and their fields:
- {"type": "hp_change", "value": -5, "reason": "Hit by arrow trap"}
- {"type": "item_gained", "name": "Rusty Iron Key", "description": "Found on the dead guard's belt"}
- {"type": "item_lost", "name": "Healing Potion", "reason": "Used to heal wounds"}
- {"type": "npc_encountered", "name": "Captain Voss", "disposition": "hostile", "description": "Scarred guard captain of the Iron Guild", "faction": "Iron Guild"}
- {"type": "location_entered", "name": "The Undercroft", "description": "Damp tunnels beneath the city walls"}
- {"type": "knowledge_gained", "fact": "The guild is smuggling weapons through the sewers"}
- {"type": "quest_started", "name": "Find the Architect", "description": "Discover who controls the smuggling operation"}
- {"type": "quest_completed", "name": "Escape the Docks", "outcome": "success"}
- {"type": "reputation_change", "faction": "Iron Guild", "delta": -10, "reason": "Fought their guards"}

RULES:
1. Only extract events that are explicitly described in the narrative
2. For hp_change: only if damage or healing is clearly mentioned. Estimate reasonable D&D values (1-10 for minor, 10-20 for serious)
3. For npc_encountered: only named NPCs that the character interacted with. Include a brief description.
4. For disposition: infer from the interaction (helped = friendly, attacked = hostile, neutral if unclear)
5. For knowledge_gained: only clear revelations or discoveries, not general observations
6. For quest_started: only if a clear objective was established
7. If nothing notable happened (e.g., simple travel), return an empty array []
8. Output ONLY the JSON array. No markdown, no explanation.
9. Do NOT wrap in code blocks.`

export const eventExtractorAgent = new Agent({
  name: 'EventExtractor',
  instructions: EVENT_EXTRACTION_PROMPT,
  model: MODEL,
  modelSettings: { temperature: 0.2 }, // Low temperature for accuracy
})

export function buildEventExtractionPrompt(opts: {
  outcomeNarrative: string
  choiceText: string
  rollOutcome: string
  characterName: string
  sceneNarrative: string
}): string {
  return `CHARACTER: ${opts.characterName}

SCENE CONTEXT:
${opts.sceneNarrative.slice(0, 500)}

PLAYER ACTION: "${opts.choiceText}"
ROLL RESULT: ${opts.rollOutcome}

OUTCOME:
${opts.outcomeNarrative}

Extract all game events from this outcome.`
}
