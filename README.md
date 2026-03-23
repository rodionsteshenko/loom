# Loom

A narrative-focused D&D adventure game powered by AI. Choose-your-own-adventure meets D&D with AI-generated storytelling and visuals.

## Stack

- **Frontend**: React + Vite + Tailwind CSS
- **Backend**: Express + OpenAI Agents SDK (TypeScript)
- **AI**: GPT-5.4 Mini (narrative, characters, campaigns) + Gemini (image generation)
- **Game Mechanics**: D&D 5e dice system, difficulty tiers, skill checks

## Quick Start

```bash
cd web && npm install
cd server && npm install
cd ..

# Add your API keys
cp server/.env.example server/.env
# Edit server/.env with your OPENAI_API_KEY and GEMINI_API_KEY

npm run dev
```

- Frontend: http://localhost:5180
- Backend: http://localhost:3001

## Features

- **Character Creation** — AI-generated D&D characters with 70+ fields, portraits, and rich backstories
- **Campaign Generation** — AI creates personalized campaigns based on character backgrounds
- **Gameplay** — Choose-your-own-adventure with D&D 5e dice mechanics, AI narration, and scene images
- **Inventory System** — AI-generated starting equipment validated against D&D rules
- **Multiple Art Styles** — Classic fantasy, anime, dark fantasy, watercolor, pixel art, and more

## How It Works

1. **Create a character** — describe who you want to play, AI generates a full D&D 5e character sheet
2. **Start a campaign** — AI creates a story premise connected to your character's backstory
3. **Play sessions** — AI DM presents narrative + 4 choices with varying difficulty
4. **Make choices** — system rolls d20 + your modifiers vs difficulty class
5. **See outcomes** — AI narrates what happens based on your roll, generates scene images
6. **Continue** — each session builds on the last with recap summaries

## Project Structure

```
loom/
├── web/
│   ├── src/                    # React frontend
│   │   ├── pages/              # CharacterGallery, CampaignManager, GamePlay, etc.
│   │   ├── components/         # CharacterForm, CharacterPreview, PortraitPreview
│   │   └── types.ts            # Shared TypeScript interfaces
│   └── server/                 # Express backend
│       ├── index.ts            # API routes
│       ├── pipeline/           # Structured session & choice pipelines
│       ├── agents/             # OpenAI Agents SDK agents & tools
│       └── utils.ts            # JSON extraction, lookups, validation
├── src/
│   ├── schemas/                # JSON Schema (draft-07) definitions
│   └── engine/                 # Original Python engine (legacy, not used by web server)
├── characters/                 # Generated character JSON + portraits
├── campaigns/                  # Campaign data, sessions, scene images
├── reference/                  # D&D SRD data, Forgotten Realms lore
└── docs/                       # Design documents
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `OPENAI_API_KEY` | Yes | OpenAI API key for AI agents |
| `OPENAI_MODEL` | No | Model to use (default: `gpt-5.4-mini`) |
| `GEMINI_API_KEY` | No | Google Gemini API key for image generation |

## Game Mechanics

### Difficulty Tiers

| Tier | DC | Description |
|------|-----|-------------|
| Trivial | 5 | Almost anyone can do this |
| Easy | 10 | Slight challenge |
| Medium | 15 | Standard challenge |
| Hard | 20 | Difficult, needs expertise |
| Extreme | 25 | Near-impossible |

### Roll Outcomes

| Outcome | Condition |
|---------|-----------|
| Critical Success | Natural 20 |
| Success | Beat DC by 5+ |
| Partial Success | Beat DC by 0-4 |
| Failure | Didn't beat DC |
| Critical Failure | Natural 1 |

Auto-succeed: If modifier >= (DC - 5), skip the roll.
