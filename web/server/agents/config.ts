import { setDefaultOpenAIKey } from '@openai/agents'

const apiKey = process.env.OPENAI_API_KEY || ''
if (apiKey) {
  setDefaultOpenAIKey(apiKey)
}

export const MODEL = process.env.OPENAI_MODEL || 'gpt-4.1'
