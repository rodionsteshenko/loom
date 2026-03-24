import { Agent } from '@openai/agents'
import { MODEL } from './config.js'

const CAMPAIGN_GENERATION_PROMPT = `You are a D&D campaign creator. Generate a campaign concept with a three-act narrative arc.

OUTPUT FORMAT: Return ONLY valid JSON (no markdown):
{
  "name": "Campaign Name (evocative, 2-5 words)",
  "world": "Brief world description (1 sentence)",
  "premise": "The opening situation that hooks this specific character (2-3 sentences, connect to their backstory/motivation/wound)",
  "arc": {
    "type": "three_act",
    "total_scenes_estimate": 8,
    "act_1": {
      "name": "Act 1 name (e.g., 'The Discovery')",
      "end_scene": 3,
      "goal": "What should be established by end of Act 1 (1 sentence)"
    },
    "act_2": {
      "name": "Act 2 name (e.g., 'The Pursuit')",
      "end_scene": 6,
      "goal": "How stakes escalate in Act 2 (1 sentence)"
    },
    "act_3": {
      "name": "Act 3 name (e.g., 'The Reckoning')",
      "end_scene": 8,
      "goal": "What the climax and resolution look like (1 sentence)"
    },
    "antagonist": "Main antagonist name and brief description",
    "stakes": "What's at risk if the hero fails (1 sentence)",
    "themes": ["theme1", "theme2"]
  }
}

RULES:
1. The premise MUST connect to the character's personal story
2. Use their wound, motivation, or secrets as hooks
3. Create tension between their want and need
4. Make it personal, not generic "save the world"
5. The arc should have clear escalation: Act 1 introduces, Act 2 complicates, Act 3 resolves
6. total_scenes_estimate should be 6-10 depending on complexity
7. The antagonist should connect to the character's backstory or world's factions
8. Output ONLY the JSON, nothing else
9. Do NOT wrap JSON in markdown code blocks.`

export const campaignGeneratorAgent = new Agent({
  name: 'CampaignGenerator',
  instructions: CAMPAIGN_GENERATION_PROMPT,
  model: MODEL,
  modelSettings: {
    temperature: 0.9,
  },
})
