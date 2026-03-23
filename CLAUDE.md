# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Loom is an AI-powered narrative adventure game — choose-your-own-adventure meets D&D with multiplayer turn-based gameplay and AI-generated visuals. Pure TypeScript stack (React frontend + Express/OpenAI Agents SDK backend).

## Architecture

- **Frontend**: React + Vite + Tailwind CSS in `web/src/` — character creation, gallery, campaign manager, gameplay UI
- **Backend**: Express API server in `web/server/` — pure TypeScript, no Python dependencies
- **AI Framework**: OpenAI Agents SDK (`@openai/agents`) with specialized agents for each task
- **AI Model**: GPT-5.4 Mini via OpenAI API (configurable via `OPENAI_MODEL` env var)
- **Image Generation**: Google Gemini API (direct REST calls, no Python)
- **State management**: File-based JSON — campaigns, sessions, characters stored in project root directories
- **Campaign structure**: Each campaign lives under `campaigns/{campaign_id}/` with sessions and images

## Server Structure

```
web/server/
  index.ts                     -- Express routes (thin — delegates to pipelines)
  types.ts                     -- Shared types (re-exports frontend types + server-only)
  utils.ts                     -- extractJSON, resolveCampaign, resolveCharacter, validateEnv
  pipeline/
    session.ts                 -- 7-step structured session generation pipeline
    choice.ts                  -- 8-step structured choice resolution pipeline
  agents/
    config.ts                  -- OpenAI SDK setup (model, API key)
    character-creator.ts       -- CharacterCreator agent + validate tool
    inventory-creator.ts       -- InventoryCreator agent + validate tool
    campaign-generator.ts      -- CampaignGenerator agent
    dungeon-master.ts          -- Session, Outcome, Recap agents + prompt builders
    image-prompt.ts            -- Narrative-to-image-prompt agent
    tools/
      dice.ts                  -- D&D 5e dice system (d20, outcomes, contested)
      difficulty.ts            -- DC analysis, modifiers, auto-succeed/fail
      validation.ts            -- Character + inventory validation (AJV, pure TS)
      state.ts                 -- Campaign/session/character file I/O
      image.ts                 -- Gemini API image generation
```

## Running the App

```bash
cd web && npm install && cd server && npm install && cd ..
npm run dev
```

- Frontend: http://localhost:5180
- Backend API: http://localhost:3001

## Environment Variables

The backend requires API keys configured in `web/server/.env`:

```
OPENAI_API_KEY=<your-openai-key>
OPENAI_MODEL=gpt-5.4-mini
GEMINI_API_KEY=<your-gemini-key>
```

Never commit `.env` files or hardcode API keys.

## Key Patterns

- **Structured pipelines**: Session and choice resolution use step-by-step pipelines with validation gates and logging at each step
- **Agent per task**: Each AI task (character creation, session generation, outcome narration, recap, image prompts) has its own agent with focused instructions
- **extractJSON()**: Single utility for parsing agent output — handles markdown fences, proper brace counting
- **resolveCampaign()/resolveCharacter()**: Single lookup functions, no duplication
- **Types shared**: Frontend types in `web/src/types.ts` are re-exported by `web/server/types.ts`

## Schemas

- `src/schemas/character.json` — JSON Schema (draft-07) for player characters
- `src/schemas/inventory_item.json` — JSON Schema for inventory items
- `src/schemas/campaign.json` — Campaign schema
- `src/schemas/session.json` — Session schema

## Design Constraints

- Narrative-first: storytelling over difficulty/tactics
- All JSON files must validate against schemas
- Game rules: HP cannot go below 0, time only moves forward
- Player death only with consent for dramatic moments; 0 HP = incapacitated, not dead
- Pure TypeScript — no Python dependencies in the web server
