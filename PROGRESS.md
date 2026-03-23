# Loom Progress Tracker

## Current Status
**Phase:** Phase 5 (Full TypeScript + OpenAI Agents SDK)
**Last Updated:** 2026-03-23

---

## Phase 1: Character Creator CLI - DONE

- [x] 75-field character schema
- [x] Character validator (schema compliance, prose minimums)
- [x] Character creation CLI using Claude
- [x] Portrait generation via Gemini
- [x] JSON output to `characters/` folder

---

## Phase 2: Inventory System - DONE

- [x] Inventory item schema (`src/schemas/inventory_item.json`)
- [x] Inventory validator (pure TypeScript with AJV)
- [x] Inventory generator agent with validation tool
- [x] Inventory endpoint (`POST /api/generate-inventory`)

---

## Phase 3: Web Frontend - DONE

- [x] Vite + React + TypeScript + Tailwind setup
- [x] Character creation form with dropdowns (race, class, alignment, art style)
- [x] Character gallery with portraits
- [x] Character detail page
- [x] Campaign manager (create, list, settings)
- [x] Gameplay page (narrative, choices, dice rolls, outcomes)
- [x] Campaign settings (art style picker, intro image generation)

---

## Phase 4: Game Engine - DONE

- [x] Campaign schema and CRUD
- [x] Session generation (AI narrative + 4 choices)
- [x] Difficulty system (D&D 5e DCs, modifiers, auto-succeed/fail)
- [x] Dice system (d20, outcomes, criticals, advantage/disadvantage)
- [x] AI Dungeon Master (session narration, outcome narration, recap summaries)
- [x] Scene image generation per session
- [x] Outcome image generation per choice

---

## Phase 5: TypeScript Migration + OpenAI Agents SDK - DONE

Migrated entire backend from Python subprocess calls to pure TypeScript.

### OpenAI Agents SDK Integration
- [x] SDK setup with configurable model (`gpt-5.4-mini` default)
- [x] CharacterCreator agent with validation tool
- [x] InventoryCreator agent with validation tool
- [x] CampaignGenerator agent
- [x] SessionGenerator agent
- [x] OutcomeNarrator agent
- [x] RecapWriter agent
- [x] ImagePromptGenerator agent

### Python to TypeScript Ports
- [x] Dice system (`agents/tools/dice.ts`)
- [x] Difficulty system (`agents/tools/difficulty.ts`)
- [x] Character validator (AJV, pure TS — no Python subprocess)
- [x] Inventory validator (AJV, pure TS)
- [x] Campaign/session state management (`agents/tools/state.ts`)
- [x] Image generation via Gemini REST API (`agents/tools/image.ts`)

### Backend Hardening
- [x] Structured session pipeline (7 steps with validation gates)
- [x] Structured choice pipeline (8 steps with validation gates)
- [x] Shared types (re-export frontend types for backend)
- [x] Single `extractJSON()` utility (replaces 4 copy-pasted patterns)
- [x] Single `resolveCampaign()`/`resolveCharacter()` (replaces 3x duplication)
- [x] Blocking image generation (images included in response)
- [x] RollResult field names match frontend types
- [x] Agent instructions tightened (explicit "no markdown" rules)
- [x] Environment validation at startup
- [x] Consistent error handling with HttpError class
- [x] index.ts slimmed from 940 lines to 393 lines

### Zero Python Dependencies
- [x] No `spawn()` or `child_process` in server
- [x] No Python interpreter required
- [x] All validation, dice, difficulty, state management in TypeScript
- [x] Image generation via direct Gemini REST API (no Python script)

---

## Architecture

```
web/server/
  index.ts                     -- Express routes (thin)
  types.ts                     -- Shared types
  utils.ts                     -- Utilities (JSON extraction, lookups)
  pipeline/
    session.ts                 -- 7-step session generation
    choice.ts                  -- 8-step choice resolution
  agents/
    config.ts                  -- OpenAI SDK setup
    character-creator.ts       -- Character agent
    inventory-creator.ts       -- Inventory agent
    campaign-generator.ts      -- Campaign agent
    dungeon-master.ts          -- DM agents (session, outcome, recap)
    image-prompt.ts            -- Image prompt agent
    tools/
      dice.ts                  -- D&D dice system
      difficulty.ts            -- DC analysis
      validation.ts            -- Schema validation (AJV)
      state.ts                 -- File I/O
      image.ts                 -- Gemini image gen
```

---

## Next Steps

1. **Multiplayer** — Turn-based with auto-move for AFK players
2. **Combat tiers** — Minor (1 roll), Standard (2-3 rounds), Boss (5-7 rounds)
3. **Changelog state** — Append-only history with rewind/snapshots
4. **World state** — Track NPCs met, items gained, locations visited
5. **Goal tracking** — Active/completed/failed quest objectives
