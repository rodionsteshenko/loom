import { Agent } from '@openai/agents'
import { MODEL } from './config.js'

// ─── Session generation agent ───

const SESSION_GENERATION_PROMPT = `You are an AI Dungeon Master for a Choose Your Own Adventure RPG called Loom.

Generate the next story session. Output ONLY valid JSON in this exact format:
{
  "narrative": "2-4 paragraphs of story text, immersive second-person (you)",
  "setting": "current location description",
  "npcs_present": ["NPC names in this scene"],
  "plot_beat": "key story moment if any, or null",
  "choices": [
    {
      "id": 1,
      "text": "Short action text (what player clicks)",
      "description": "What this choice entails",
      "skill": "Skill name or null",
      "ability": "STR/DEX/CON/INT/WIS/CHA if no skill, or null",
      "difficulty": "trivial/easy/medium/hard/extreme",
      "dc": 10
    }
  ]
}

RULES:
1. Write immersive narrative in second person ("you")
2. Each session ends at a decision point
3. Provide exactly 4 meaningful choices
4. Choices should have varying difficulties
5. At least one choice should be skill-based, one could be pure narrative
6. Consider the character's skills when setting difficulties
7. Create tension and interesting consequences
8. Output ONLY the raw JSON object. Do NOT wrap in markdown code blocks (\`\`\`json). No prose before or after the JSON.`

export const sessionGeneratorAgent = new Agent({
  name: 'SessionGenerator',
  instructions: SESSION_GENERATION_PROMPT,
  model: MODEL,
  modelSettings: { temperature: 0.9 },
})

// ─── Outcome narration agent ───

const OUTCOME_NARRATION_PROMPT = `You are an AI Dungeon Master. Continue the story based on the player's choice and roll result.

Write 1-2 paragraphs describing what happens. Be vivid and specific.
- For success: describe how they succeed
- For partial success: describe success but add a complication
- For failure: describe what goes wrong
- For critical success: make it memorable and exceptional
- For critical failure: make it memorable with serious consequences

Write ONLY the narrative, no JSON, no labels. Second person ("you").`

export const outcomeNarrationAgent = new Agent({
  name: 'OutcomeNarrator',
  instructions: OUTCOME_NARRATION_PROMPT,
  model: MODEL,
  modelSettings: { temperature: 0.9 },
})

// ─── Recap summary agent ───

const RECAP_PROMPT = `Write a 2-3 sentence recap summary for someone returning to the game.
Write it as natural prose, not a game log. Use third person for the character.
Focus on: what happened, what was discovered, and what changed.

Write ONLY the recap summary. Natural prose, 2-3 sentences.`

export const recapAgent = new Agent({
  name: 'RecapWriter',
  instructions: RECAP_PROMPT,
  model: MODEL,
  modelSettings: { temperature: 0.7 },
})

// ─── Helper to build session prompt ───

export function buildSessionPrompt(opts: {
  campaign: { name: string; world: string; premise: string }
  character: any
  previousSession?: { summary: string; outcome: string } | null
  plotDirection?: string
}): string {
  const { campaign, character, previousSession, plotDirection } = opts

  const charSummary = [
    `Name: ${character.name}`,
    `Race/Class: ${character.race} ${character.class} (Level ${character.level})`,
    `Skills: ${(character.skills || []).slice(0, 5).join(', ') || 'None'}`,
    `Traits: ${(character.traits || []).slice(0, 3).join(', ') || 'Unknown'}`,
    `Motivation: ${(character.motivation || 'Unknown').slice(0, 200)}`,
  ].join('\n')

  let prompt = `CAMPAIGN: ${campaign.name}\nWORLD: ${campaign.world}\nPREMISE: ${campaign.premise}\n\nCHARACTER:\n${charSummary}`

  if (previousSession) {
    prompt += `\n\nPREVIOUS SESSION:\n${previousSession.summary}\nOutcome: ${previousSession.outcome}`
  }

  if (plotDirection) {
    prompt += `\n\nPLOT DIRECTION: ${plotDirection}`
  }

  return prompt
}

// ─── Helper to build outcome prompt ───

export function buildOutcomePrompt(opts: {
  narrative: string
  choice: { text: string; description: string }
  rollResult: {
    natural_roll: number
    modifier: number
    total: number
    dc: number
    outcome: string
    auto_resolved: boolean
  }
  characterName: string
}): string {
  const { narrative, choice, rollResult, characterName } = opts

  const outcomeType = rollResult.outcome.replace(/_/g, ' ')
  const toneMap: Record<string, string> = {
    critical_success: 'exceptional success with a bonus',
    success: 'clean success',
    partial_success: 'success but with a complication or cost',
    failure: 'failure with consequences',
    critical_failure: 'disastrous failure with serious consequences',
  }
  const tone = toneMap[rollResult.outcome] || 'unknown'

  let rollDesc = ''
  if (!rollResult.auto_resolved) {
    rollDesc = `Roll: ${rollResult.natural_roll} + ${rollResult.modifier} = ${rollResult.total} vs DC ${rollResult.dc}`
  } else {
    rollDesc = `(Auto-resolved: modifier +${rollResult.modifier} vs DC ${rollResult.dc})`
  }

  return `CURRENT SCENE:\n${narrative.slice(0, 1000)}\n\nPLAYER CHOICE:\n"${choice.text}" - ${choice.description}\n\nROLL RESULT:\n${rollDesc}\nOutcome: ${outcomeType} (${tone})\n\nCHARACTER: ${characterName}`
}

// ─── Helper to build recap prompt ───

export function buildRecapPrompt(opts: {
  characterName: string
  narrative: string
  choiceText: string
  outcomeNarrative: string
}): string {
  return `CHARACTER: ${opts.characterName}\n\nTHE SCENE:\n${opts.narrative.slice(0, 800)}\n\nWHAT THEY DID:\n${opts.choiceText}\n\nWHAT HAPPENED:\n${opts.outcomeNarrative.slice(0, 800)}`
}
