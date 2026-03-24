import { Agent } from '@openai/agents'
import { MODEL } from './config.js'

export const imagePromptAgent = new Agent({
  name: 'ImagePromptGenerator',
  instructions: `Generate a single concise image prompt (max 120 words) for a fantasy RPG scene illustration.
Focus on the setting, mood, and key visual elements.
If a character description is provided, include their distinctive physical features (race, build, hair, clothing, notable features) in the scene for visual consistency across images.
The character should be present in the scene, interacting with the environment.
Output ONLY the prompt text, nothing else.`,
  model: MODEL,
})
