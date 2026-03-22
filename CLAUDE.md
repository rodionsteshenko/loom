# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Loom is an AI-powered narrative adventure game — choose-your-own-adventure meets D&D with multiplayer turn-based gameplay and AI-generated visuals.

## Architecture

- **Frontend**: React + Vite + Tailwind CSS in `web/` — character creation, gallery, campaign manager, gameplay UI
- **Backend**: Express API server in `web/server/` — serves character/campaign data, proxies AI requests, generates images
- **Python tools**: Character creation CLI, validators, game engine in `src/`
- **State management**: Additive history — all state changes are appended to a changelog (`changelog.jsonl`). Current state is derived by replaying changes. Supports rewind, replay, and snapshots.
- **Campaign structure**: Each campaign lives under `campaigns/{campaign_id}/` with sessions, images, and campaign.json
- **AI as DM**: The AI agent uses read/write tools (defined in `docs/ENGINE.md`) to manage game state — get/update characters, advance time, trigger events, roll dice, generate images.

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
OPENCLAW_URL=http://127.0.0.1:18789/v1/chat/completions
OPENCLAW_TOKEN=<your-token>
GEMINI_API_KEY=<your-key>
```

Never commit `.env` files or hardcode API keys.

## Key Design Documents

- `docs/ENGINE.md` — Technical architecture: state management, AI tool interfaces, validation rules, multiplayer sync
- `docs/GAMEPLAY.md` — Player-facing mechanics: character creation, combat tiers, time system, NPC tiers, goals

## Schemas

- `schemas/character.schema.json` — JSON Schema (draft-07) for player characters and NPCs
- `src/schemas/` — Additional schemas for campaigns, sessions, inventory items

## Design Constraints

- Narrative-first: storytelling over difficulty/tactics
- All JSON files must validate against schemas on load, save, and API input
- Game rules: HP cannot go below 0, location transitions must follow connections, time only moves forward (except rewind)
- Player death only with consent for dramatic moments; 0 HP = incapacitated, not dead
