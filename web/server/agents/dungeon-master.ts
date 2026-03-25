import { Agent } from '@openai/agents'
import { MODEL } from './config.js'

// ─── Session generation agent ───

const SESSION_GENERATION_PROMPT = `You are an AI Dungeon Master for a Choose Your Own Adventure RPG called Loom.

You will receive campaign context, character details, CAMPAIGN STATE (items, NPCs, quests, reputation), and RECENT SCENES.

IMPORTANT — Use the campaign state:
- Reference items the player carries ("You grip the rusty key..." or "Your map fragment shows...")
- Have NPCs the player has met remember them and react accordingly
- Build on active quests — advance them toward resolution
- React to reputation — hostile factions may send agents, friendly ones offer help
- Reference locations visited — the player knows these places
- Use known facts in dialogue and narrative

Do NOT repeat or contradict what happened in previous scenes. Advance the story naturally.

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
  campaign: any
  character: any
  previousSession?: { summary: string; outcome: string } | null
  plotDirection?: string
  sceneNumber?: number
}): string {
  const { campaign, character, previousSession, plotDirection, sceneNumber } = opts

  const charSummary = [
    `Name: ${character.name}`,
    `Race/Class: ${character.race} ${character.class} (Level ${character.level})`,
    `Skills: ${(character.skills || []).slice(0, 5).join(', ') || 'None'}`,
    `Traits: ${(character.traits || []).slice(0, 3).join(', ') || 'Unknown'}`,
    `Motivation: ${(character.motivation || 'Unknown').slice(0, 200)}`,
  ].join('\n')

  let prompt = `CAMPAIGN: ${campaign.name}\nWORLD: ${campaign.world}\nPREMISE: ${campaign.premise}\n\nCHARACTER:\n${charSummary}`

  // Arc pacing with guardrails
  if (campaign.arc && sceneNumber) {
    const arc = campaign.arc
    const target = arc.total_scenes_estimate || 8
    const hardLimit = Math.ceil(target * 1.5)
    const isOverTarget = sceneNumber > target
    const isForcedEnd = sceneNumber >= hardLimit

    let actInfo = ''
    if (isForcedEnd) {
      actInfo = `FINAL SCENE (hard limit reached). You MUST write a conclusive ending NOW. Resolve all plot threads. The story ends here, for better or worse.`
    } else if (sceneNumber >= target) {
      actInfo = `Act 3 "${arc.act_3?.name || 'Resolution'}" — scene ${sceneNumber} (target was ${target}). The story has gone longer than expected. Begin wrapping up. Move toward a clear resolution within the next 1-2 scenes.`
    } else if (sceneNumber >= target - 1) {
      actInfo = `Act 3 "${arc.act_3?.name || 'Resolution'}" — CLIMAX SCENE (scene ${sceneNumber} of ~${target}). This should be the dramatic high point. ${arc.act_3?.goal || 'Climax and resolution.'}`
    } else if (sceneNumber > (arc.act_2?.end_scene || Math.floor(target * 0.75))) {
      actInfo = `Act 3 "${arc.act_3?.name || 'Resolution'}" (scene ${sceneNumber} of ~${target}). Goal: ${arc.act_3?.goal || 'Build toward the climax.'}`
    } else if (sceneNumber > (arc.act_1?.end_scene || Math.floor(target * 0.35))) {
      actInfo = `Act 2 "${arc.act_2?.name || 'Confrontation'}" (scene ${sceneNumber} of ~${target}). Goal: ${arc.act_2?.goal || 'Escalate stakes and complications.'}`
    } else {
      actInfo = `Act 1 "${arc.act_1?.name || 'Setup'}" (scene ${sceneNumber} of ~${target}). Goal: ${arc.act_1?.goal || 'Establish the world and threat.'}`
    }

    prompt += `\n\nSTORY ARC:\n${actInfo}`
    if (arc.antagonist) prompt += `\nAntagonist: ${arc.antagonist}`
    if (arc.stakes) prompt += `\nStakes: ${arc.stakes}`
    if (arc.themes?.length) prompt += `\nThemes: ${arc.themes.join(', ')}`
    if (isOverTarget && !isForcedEnd) prompt += `\nNote: Campaign is ${sceneNumber - target} scene(s) past target. Prioritize resolution over new complications.`
  }

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
