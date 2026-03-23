# Loom Web App

React frontend + Express backend for the Loom D&D adventure game.

## Setup

```bash
npm install
cd server && npm install && cd ..
```

## Development

```bash
npm run dev
```

Runs both frontend (Vite, port 5180) and backend (Express, port 3001) concurrently.

## Frontend (`src/`)

React + Vite + Tailwind CSS.

- `src/pages/` — CharacterGallery, CharacterDetail, CampaignManager, CampaignSettings, GamePlay
- `src/components/` — CharacterForm, CharacterPreview, PortraitPreview
- `src/types.ts` — Shared TypeScript interfaces (Character, Session, Campaign, Choice, RollResult)
- `src/constants/artStyles.ts` — Art style options for image generation

## Backend (`server/`)

Express + OpenAI Agents SDK. Pure TypeScript, no Python.

- `server/index.ts` — API routes
- `server/pipeline/` — Structured session and choice resolution pipelines
- `server/agents/` — OpenAI Agents SDK agents and tools
- `server/utils.ts` — JSON extraction, campaign/character lookup, env validation
- `server/types.ts` — Re-exports frontend types + server-only types

### API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/characters` | List all characters |
| POST | `/api/generate` | Generate a new character |
| POST | `/api/generate-portrait` | Generate a character portrait |
| POST | `/api/validate` | Validate character JSON |
| POST | `/api/generate-inventory` | Generate starting inventory |
| GET | `/api/campaigns` | List all campaigns |
| GET | `/api/campaigns/:id` | Get campaign with current session |
| POST | `/api/campaigns` | Create a new campaign |
| PATCH | `/api/campaigns/:id/settings` | Update campaign settings |
| GET | `/api/campaigns/:id/sessions` | List campaign sessions |
| POST | `/api/campaigns/:id/session` | Start a new session |
| POST | `/api/campaigns/:id/choice` | Make a choice in current session |

### Environment Variables

Create `server/.env`:

```
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-5.4-mini
GEMINI_API_KEY=...
```
