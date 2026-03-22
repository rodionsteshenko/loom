# Character Creator Design

## Overview

A tool that takes a minimal (or detailed) prompt and generates a complete character according to the schema.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    CHARACTER CREATOR                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Input: Prompt (freeform, can be minimal)                   │
│         e.g., "a grizzled dwarven blacksmith with a secret" │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │           Claude Agent (subprocess)                  │   │
│  │                                                      │   │
│  │  - Given: CHARACTER_SCHEMA.md                       │   │
│  │  - Given: JSON structure template                    │   │
│  │  - Tool: validate_character(json)                   │   │
│  │  - Tool: generate_image(physical_description)       │   │
│  │                                                      │   │
│  │  Process:                                            │   │
│  │  1. Generate character JSON from prompt              │   │
│  │  2. Call validator, fix any issues                   │   │
│  │  3. Iterate until valid                              │   │
│  │  4. Generate portrait image                          │   │
│  │  5. Return complete character                        │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  Output: Complete character JSON + image_url                │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## CLI Interface

```bash
# Basic usage - minimal prompt
loom create-character "a half-elf ranger who lost their family"

# More detailed prompt
loom create-character "a 45-year-old human wizard named Aldric, \
  formerly a court mage, now disgraced and drinking too much, \
  brilliant but self-destructive, inspired by Walter White"

# With options
loom create-character "a tiefling bard" \
  --level 5 \
  --class bard \
  --output ./characters/

# Validate existing character
loom validate-character ./characters/aldric.json

# Generate image for existing character
loom generate-portrait ./characters/aldric.json
```

---

## Validator Requirements

The validator is both a CLI tool AND a tool the AI agent can call during generation.

### What it checks:

**1. Schema Compliance**
- All required fields present
- No unexpected fields (reject extras!)
- Correct types (string, array, object, etc.)

**2. Prose Field Minimums**
| Field | Minimum Length |
|-------|----------------|
| physical_description | 200 chars |
| backstory | 300 chars |
| childhood | 150 chars |
| voice | 100 chars |
| mannerisms | 100 chars |
| motivation | 100 chars |
| wound | 100 chars |

**3. Required Fields**
- id (auto-generated if missing)
- name
- type (pc/npc)
- physical_description
- backstory
- stats (all 6)
- race
- class
- level
- alignment

**4. Logical Consistency**
- HP max >= HP current
- Level > 0
- Stats in valid range (1-30)
- proficiency_bonus matches level

### Validator Output

```json
{
  "valid": false,
  "errors": [
    {
      "field": "backstory",
      "error": "below_minimum_length",
      "expected": 300,
      "actual": 87
    },
    {
      "field": "favorite_color",
      "error": "unexpected_field"
    }
  ],
  "warnings": [
    {
      "field": "wound",
      "warning": "empty_prose_field"
    }
  ]
}
```

---

## Implementation Plan

### Phase 1: CLI Core
1. `loom create-character <prompt>` — main generator
2. `loom validate-character <file>` — standalone validator
3. Uses Claude Code / Agent SDK as subprocess
4. Outputs JSON + generates image

### Phase 2: Web Frontend
- Prompt input field
- Dropdown menus for:
  - Race
  - Class
  - Background
  - Alignment
  - Level
- "Inspire by..." field (fictional character, archetype, etc.)
- Generate button
- Preview panel (JSON view + formatted view)
- Portrait preview with regenerate button
- Save / Export

---

## Tech Stack (Proposed)

**CLI:**
- Python or Node.js
- Subprocess to `claude` CLI or Agent SDK
- JSON schema validation (jsonschema or zod)

**Frontend:**
- Simple web app (could be static HTML + JS)
- Talks to local API server
- Image preview via nano-banana-pro

---

## Agent Tools

Tools provided to the Claude agent during character generation:

```python
tools = [
    {
        "name": "validate_character",
        "description": "Validate a character JSON against the schema. Returns errors if invalid.",
        "parameters": {
            "character_json": "The character object to validate"
        }
    },
    {
        "name": "generate_portrait",
        "description": "Generate a character portrait from physical description",
        "parameters": {
            "physical_description": "Detailed physical description text",
            "style": "Art style (fantasy, realistic, anime, etc.)"
        }
    },
    {
        "name": "get_schema",
        "description": "Get the full character schema with field requirements",
        "parameters": {}
    }
]
```

---

## Example Flow

**Input prompt:** "a goblin who thinks she's a princess"

**Agent process:**
1. Reads schema, understands all 75 fields
2. Generates creative interpretation:
   - Name: Griselda Thornwick III
   - Race: Goblin
   - Class: Rogue (con artist)
   - Backstory: Found a tiara in the trash as a child, convinced herself it was her birthright...
   - Wound: Abandoned by her tribe for being "too uppity"
   - Lie she believes: "I really am royalty, I just need to prove it"
3. Fills all fields according to schema
4. Calls validate_character() — catches missing fields
5. Fixes issues, validates again
6. Generates portrait from physical_description
7. Returns complete character

---

## Notes

- The validator rejecting extra fields is important — prevents AI from inventing fields that won't be used
- Minimum lengths for prose fields ensure narrative depth
- The agent should iterate until valid, not just try once
