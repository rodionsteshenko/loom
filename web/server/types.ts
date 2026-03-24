// Re-export frontend types for server use
export type {
  Character,
  Stats,
  Session,
  SessionContent,
  Choice,
  RollResult,
  Campaign,
  CampaignWithSession,
  CharacterFormData,
  World,
  WorldSection,
  WorldOverview,
  WorldHistory,
  WorldGeography,
  WorldFaction,
  WorldRegion,
  WorldReligion,
  WorldDeity,
  WorldKeyFigure,
  WorldConceptImage,
  CoherenceIssue,
  GameEvent,
  GameEventType,
  CampaignNPC,
  CampaignState,
  CampaignArc,
} from '../src/types.js'

import type { Campaign, Character } from '../src/types.js'

// ─── Server-only types ───

export interface GameContext {
  campaignDir: string
  campaign: Campaign
  character: Character
}

export interface PipelineResult<T> {
  ok: boolean
  data?: T
  error?: string
  step?: string
}

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message)
  }
}
