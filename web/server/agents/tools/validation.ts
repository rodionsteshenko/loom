import { tool } from '@openai/agents'
import { z } from 'zod'
import Ajv from 'ajv'
import addFormats from 'ajv-formats'
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// --- Load schemas ---

const CHARACTER_SCHEMA_PATH = path.join(__dirname, '../../../../src/schemas/character.json')
const INVENTORY_SCHEMA_PATH = path.join(__dirname, '../../../../src/schemas/inventory_item.json')

const characterSchema = JSON.parse(fs.readFileSync(CHARACTER_SCHEMA_PATH, 'utf-8'))
const inventoryItemSchema = JSON.parse(fs.readFileSync(INVENTORY_SCHEMA_PATH, 'utf-8'))

// --- Setup AJV ---

const ajv = new Ajv({ allErrors: true, strict: false })
addFormats(ajv)

const validateCharacterSchema = ajv.compile(characterSchema)
const validateInventoryItemSchema = ajv.compile(inventoryItemSchema)

// --- Constants ---

const PROSE_MINIMUMS: Record<string, number> = {
  physical_description: 200,
  backstory: 300,
  childhood: 150,
  voice: 100,
  mannerisms: 100,
  motivation: 100,
  wound: 100,
}

const REQUIRED_FIELDS = [
  'name', 'type', 'physical_description', 'backstory',
  'stats', 'race', 'class', 'level', 'alignment',
]

const DEFAULTS: Record<string, any> = {
  level: 1,
  experience_points: 0,
  temp_hp: 0,
  movement_speed: 30,
  inspiration: false,
  exhaustion_level: 0,
  is_alive: true,
  currency: { gp: 0, sp: 0, cp: 0 },
  death_saves: { successes: 0, failures: 0 },
}

const ITEM_TYPES = ['weapon', 'armor', 'consumable', 'tool', 'gear', 'treasure', 'wondrous', 'quest']
const HEAVY_ITEM_THRESHOLD = 50
const TOTAL_WEIGHT_WARNING = 150
const HIGH_VALUE_ITEM = 1000

// --- Character Validation ---

export function validateCharacter(character: any): {
  valid: boolean
  errors: string[]
  warnings: string[]
  character: any
} {
  const errors: string[] = []
  const warnings: string[] = []

  // Deep clone to avoid mutating input
  const char = JSON.parse(JSON.stringify(character))

  // 1. Check for extra fields not in schema
  const schemaProperties = Object.keys(characterSchema.properties || {})
  const inputKeys = Object.keys(char)
  for (const key of inputKeys) {
    if (!schemaProperties.includes(key)) {
      errors.push(`Unknown field: '${key}' is not defined in the character schema`)
    }
  }

  // 2. Auto-generate UUID if missing id
  if (!char.id) {
    char.id = crypto.randomUUID()
  }

  // 3. Apply defaults for optional fields
  for (const [field, defaultValue] of Object.entries(DEFAULTS)) {
    if (char[field] === undefined) {
      char[field] = JSON.parse(JSON.stringify(defaultValue))
    }
  }

  // 4. Add created_at/updated_at timestamps
  const now = new Date().toISOString()
  if (!char.created_at) {
    char.created_at = now
  }
  char.updated_at = now

  // 5. JSON Schema validation (Draft-07)
  const schemaValid = validateCharacterSchema(char)
  if (!schemaValid && validateCharacterSchema.errors) {
    for (const err of validateCharacterSchema.errors) {
      const field = err.instancePath || err.schemaPath
      errors.push(`Schema validation: ${field} ${err.message}`)
    }
  }

  // 6. Check prose field minimums
  for (const [field, minLength] of Object.entries(PROSE_MINIMUMS)) {
    if (char[field] !== undefined && typeof char[field] === 'string') {
      if (char[field].length < minLength) {
        errors.push(
          `'${field}' is too short: ${char[field].length} characters (minimum ${minLength})`
        )
      }
    }
  }

  // 7. Check HP consistency (current <= max)
  if (char.hp) {
    if (char.hp.current > char.hp.max) {
      errors.push(`HP inconsistency: current HP (${char.hp.current}) exceeds max HP (${char.hp.max})`)
    }
  }

  // 8. Check stat ranges (1-30)
  if (char.stats && typeof char.stats === 'object') {
    for (const [stat, value] of Object.entries(char.stats)) {
      if (typeof value === 'number' && (value < 1 || value > 30)) {
        errors.push(`Stat '${stat}' out of range: ${value} (must be 1-30)`)
      }
    }
  }

  // 9. Check level range (1-20)
  if (typeof char.level === 'number' && (char.level < 1 || char.level > 20)) {
    errors.push(`Level out of range: ${char.level} (must be 1-20)`)
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    character: char,
  }
}

// --- Inventory Validation ---

export function validateInventory(inventory: any): {
  valid: boolean
  errors: string[]
  warnings: string[]
  inventory: any[]
  stats: { total_weight: number; total_value: number; item_count: number }
} {
  const errors: string[] = []
  const warnings: string[] = []
  let totalWeight = 0
  let totalValue = 0

  if (!Array.isArray(inventory)) {
    return {
      valid: false,
      errors: ['Inventory must be an array'],
      warnings: [],
      inventory: [],
      stats: { total_weight: 0, total_value: 0, item_count: 0 },
    }
  }

  const validatedItems: any[] = []
  const schemaProperties = Object.keys(inventoryItemSchema.properties || {})

  for (let i = 0; i < inventory.length; i++) {
    const item = JSON.parse(JSON.stringify(inventory[i]))
    const prefix = `Item [${i}] (${item.name || 'unnamed'})`

    // Auto-gen ID if missing
    if (!item.id) {
      item.id = crypto.randomUUID()
    }

    // Check for extra fields
    const itemKeys = Object.keys(item)
    for (const key of itemKeys) {
      if (!schemaProperties.includes(key)) {
        errors.push(`${prefix}: Unknown field '${key}' is not defined in the inventory item schema`)
      }
    }

    // Schema validation
    const schemaValid = validateInventoryItemSchema(item)
    if (!schemaValid && validateInventoryItemSchema.errors) {
      for (const err of validateInventoryItemSchema.errors) {
        const field = err.instancePath || err.schemaPath
        errors.push(`${prefix}: Schema validation: ${field} ${err.message}`)
      }
    }

    // Item type check
    if (item.type && !ITEM_TYPES.includes(item.type)) {
      errors.push(`${prefix}: Invalid item type '${item.type}'. Must be one of: ${ITEM_TYPES.join(', ')}`)
    }

    // Weight warnings
    const itemWeight = (item.weight || 0) * (item.quantity || 1)
    if (item.weight > HEAVY_ITEM_THRESHOLD) {
      warnings.push(`${prefix}: Heavy item (${item.weight} lbs)`)
    }
    totalWeight += itemWeight

    // Value tracking
    let itemValue = 0
    if (item.value) {
      itemValue = (item.value.gp || 0) + (item.value.sp || 0) / 10 + (item.value.cp || 0) / 100
      itemValue *= (item.quantity || 1)
    }
    if (itemValue >= HIGH_VALUE_ITEM) {
      warnings.push(`${prefix}: High value item (${itemValue} gp equivalent)`)
    }
    totalValue += itemValue

    // Magical without notes warning
    if (item.magical && !item.notes) {
      warnings.push(`${prefix}: Magical item has no notes describing its magical properties`)
    }

    // Attunement logic
    if (item.attunement) {
      if (item.attunement.required && !item.magical) {
        warnings.push(`${prefix}: Item requires attunement but is not marked as magical`)
      }
      if (item.attunement.attuned && !item.attunement.required) {
        warnings.push(`${prefix}: Item is attuned but attunement is not required`)
      }
    }

    validatedItems.push(item)
  }

  // Total weight warning
  if (totalWeight > TOTAL_WEIGHT_WARNING) {
    warnings.push(`Total inventory weight (${totalWeight} lbs) exceeds ${TOTAL_WEIGHT_WARNING} lbs`)
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    inventory: validatedItems,
    stats: {
      total_weight: totalWeight,
      total_value: totalValue,
      item_count: validatedItems.length,
    },
  }
}

// --- Tool exports for @openai/agents ---

export const validateCharacterTool = tool({
  name: 'validate_character',
  description:
    'Validate a character JSON object against the schema. Pass the character as a JSON string. Returns {valid, errors, warnings, character}. Call this after generating a character to check for errors.',
  parameters: z.object({
    character_json: z.string().describe('The character JSON object serialized as a string'),
  }),
  async execute({ character_json }) {
    const character = JSON.parse(character_json)
    const result = validateCharacter(character)
    return JSON.stringify(result)
  },
})

export const validateInventoryTool = tool({
  name: 'validate_inventory',
  description:
    'Validate an inventory JSON array against the schema. Pass the inventory as a JSON string. Returns {valid, errors, warnings, inventory, stats}. Call this after generating inventory items.',
  parameters: z.object({
    inventory_json: z.string().describe('The inventory JSON array serialized as a string'),
  }),
  async execute({ inventory_json }) {
    const inventory = JSON.parse(inventory_json)
    const result = validateInventory(inventory)
    return JSON.stringify(result)
  },
})
