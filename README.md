# Loom

An AI-powered narrative adventure game. Choose your own adventure meets D&D, with multiplayer turn-based gameplay and AI-generated visuals.

## Core Concept

- **Narrative-first**: Focus on storytelling, not difficulty
- **AI DM**: Runs the campaign, generates scenes, adapts to player choices
- **Multiplayer**: Turn-based with time limits, no blocking
- **Visual**: AI-generated images for scenes and characters
- **Time-aware**: Variable time scaling (bullet time for combat, fast-forward for travel)

## Game Flow

1. **Character Creation** — Define your character(s)
2. **Campaign Creation** — AI builds the skeleton (hidden from players): NPCs, locations, items, events, goals
3. **Session Play** — Present choices → validate → roll if needed → resolve → advance time → update state

## Project Structure

```
loom/
├── docs/           # Design documents
├── schemas/        # JSON schemas for game data
├── src/            # Source code
└── campaigns/      # Sample campaigns
```

## Status

🚧 In design phase
