import { Agent } from '@openai/agents'
import { MODEL } from './config.js'

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
4. Make it personal, not generic "save the world"
5. Output ONLY the JSON, nothing else
6. Do NOT wrap JSON in markdown code blocks (\`\`\`json). Output raw JSON only, no prose before or after.`

export const campaignGeneratorAgent = new Agent({
  name: 'CampaignGenerator',
  instructions: CAMPAIGN_GENERATION_PROMPT,
  model: MODEL,
  modelSettings: {
    temperature: 0.9,
  },
})
