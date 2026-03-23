import { Agent } from '@openai/agents'
import { MODEL } from './config.js'

export const imagePromptAgent = new Agent({
  name: 'ImagePromptGenerator',
  instructions: 'Generate a single concise image prompt (max 100 words) for a fantasy RPG scene illustration. Focus on the setting, mood, and key visual elements. Output ONLY the prompt text, nothing else.',
  model: MODEL,
})
