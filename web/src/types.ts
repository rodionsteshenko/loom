export interface Stats {
  STR: number
  DEX: number
  CON: number
  INT: number
  WIS: number
  CHA: number
}

export interface Character {
  id: string
  name: string
  type: 'pc' | 'npc'
  world_id?: string
  race: string
  class: string
  subclass?: string
  level: number
  alignment: string
  background?: string
  
  // Physical
  physical_description: string
  height?: string
  weight?: string
  image_url?: string
  art_style?: string
  
  // Voice & Mannerisms
  voice?: string
  mannerisms?: string
  
  // Background
  origin?: string
  backstory: string
  childhood?: string
  
  // Psychological
  motivation?: string
  want?: string
  need?: string
  wound?: string
  lie_they_believe?: string
  fear?: string
  arc_direction?: 'positive' | 'negative' | 'flat' | 'ambiguous'
  
  // Personality
  traits?: string[]
  values?: string[]
  flaws?: string[]
  secrets?: string[]
  archetype?: string
  
  // Stats
  stats: Stats
  
  // Combat
  hp?: { current: number; max: number }
  armor_class?: number
  movement_speed?: number
  
  // Skills & Abilities
  skills?: string[]
  languages?: string[]
  abilities?: string[]
  spells_known?: string[]
}

export interface CharacterFormData {
  prompt: string
  race?: string
  class?: string
  level: number
  alignment?: string
  art_style?: string
  custom_style?: string
}

export const RACES = [
  '', 'Human', 'Elf', 'Dwarf', 'Halfling', 'Half-Elf', 'Half-Orc', 
  'Gnome', 'Tiefling', 'Dragonborn', 'Goliath', 'Aasimar', 'Tabaxi',
  'Firbolg', 'Kenku', 'Lizardfolk', 'Tortle', 'Goblin', 'Orc'
]

export const CLASSES = [
  '', 'Barbarian', 'Bard', 'Cleric', 'Druid', 'Fighter', 'Monk',
  'Paladin', 'Ranger', 'Rogue', 'Sorcerer', 'Warlock', 'Wizard', 'Artificer'
]

export const ALIGNMENTS = [
  '', 'lawful_good', 'neutral_good', 'chaotic_good',
  'lawful_neutral', 'true_neutral', 'chaotic_neutral',
  'lawful_evil', 'neutral_evil', 'chaotic_evil'
]

export const ART_STYLES = [
  { value: '', label: 'Default Fantasy' },
  { value: 'classic_fantasy', label: 'Classic Fantasy (Larry Elmore style)' },
  { value: 'anime', label: 'Anime / JRPG' },
  { value: 'dark_souls', label: 'Dark Souls / Dark Fantasy' },
  { value: 'watercolor', label: 'Watercolor Illustration' },
  { value: 'oil_painting', label: 'Oil Painting / Renaissance' },
  { value: 'comic_book', label: 'Comic Book' },
  { value: 'realistic', label: 'Photorealistic' },
  { value: 'pixel_art', label: 'Pixel Art' },
  { value: 'studio_ghibli', label: 'Studio Ghibli' },
  { value: 'custom', label: 'Custom (enter below)' }
]

export const ARCHETYPES = [
  'Innocent', 'Orphan', 'Hero', 'Caregiver', 'Explorer',
  'Rebel', 'Lover', 'Creator', 'Jester', 'Sage', 'Magician', 'Ruler'
]

// ─── World types ───

export interface WorldOverview {
  tone: string
  genre: string
  era: string
  description: string
  themes: string[]
}

export interface WorldTimelineEvent {
  era: string
  name: string
  year_label: string
  description: string
  impact: string
}

export interface WorldHistory {
  creation_myth: string
  timeline: WorldTimelineEvent[]
}

export interface WorldRegion {
  id: string
  name: string
  type: string
  description: string
  notable_features: string[]
  connections: string[]
  controlling_faction?: string
}

export interface WorldGeography {
  overview: string
  regions: WorldRegion[]
}

export interface WorldFaction {
  id: string
  name: string
  type: string
  description: string
  goals: string
  methods: string
  leader: string
  allies: string[]
  enemies: string[]
  territory?: string
}

export interface WorldDeity {
  name: string
  domain: string
  description: string
  followers: string
  symbol: string
}

export interface WorldReligion {
  overview: string
  deities_or_forces: WorldDeity[]
}

export interface WorldKeyFigure {
  name: string
  title: string
  description: string
  role: string
  faction_id?: string
  alive: boolean
  location?: string
}

export interface WorldConceptImage {
  type: 'landscape' | 'city' | 'landmark'
  subject: string
  url: string
  prompt: string
}

export interface World {
  id: string
  name: string
  tagline: string
  status: 'generating' | 'draft' | 'validated' | 'active'
  art_style: string
  overview: WorldOverview
  history: WorldHistory
  geography: WorldGeography
  factions: WorldFaction[]
  religion: WorldReligion
  key_figures: WorldKeyFigure[]
  concept_images: WorldConceptImage[]
  created_at: string
  updated_at: string
}

export type WorldSection = 'overview' | 'history' | 'geography' | 'factions' | 'religion' | 'key_figures'

export interface CoherenceIssue {
  severity: 'error' | 'warning' | 'suggestion'
  message: string
  sections: string[]
}

// Game types

export interface Choice {
  id: number
  text: string
  description: string
  difficulty: 'trivial' | 'easy' | 'medium' | 'hard' | 'extreme'
  dc: number
  skill?: string
  ability?: string
  your_modifier?: number
  success_chance?: number
  auto_succeed?: boolean
  auto_fail?: boolean
  assessment?: string
}

export interface SessionContent {
  narrative: string
  choices: Choice[]
  location?: string
  npcs_present?: string[]
  mood?: string
  image_url?: string        // Generated scene image
  image_prompt?: string     // Prompt used to generate
}

export interface RollResult {
  natural: number
  modifier: number
  total: number
  dc: number
  outcome: 'critical_success' | 'success' | 'partial_success' | 'failure' | 'critical_failure'
  skill?: string
  ability?: string
  margin?: number
  auto_succeed?: boolean
  auto_fail?: boolean
}

export interface Session {
  id: string
  campaign_id: string
  sequence: number
  content?: SessionContent
  state: 'narrative' | 'choices' | 'rolling' | 'outcome' | 'complete'
  chosen_option?: number
  roll_result?: RollResult
  outcome_narrative?: string
  outcome_image_url?: string    // Generated outcome image
  summary?: string
  story_so_far?: string         // Cumulative story summary
  created_at: string
  completed_at?: string
}

export interface Campaign {
  id: string
  name: string
  world: string
  world_id?: string
  premise: string
  character_id: string  // Primary/active character (backward compat)
  party: string[]       // All party members (for multiplayer)
  sessions: string[]
  current_session?: string
  state: Record<string, unknown>
  intro_image_url?: string  // Generated intro image
  created_at: string
  updated_at: string
}

export interface CampaignWithSession extends Campaign {
  currentSessionData?: Session
  character?: Character
}
