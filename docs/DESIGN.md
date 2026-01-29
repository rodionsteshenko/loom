# Loom Design Document

## Overview

Loom is an AI-powered narrative adventure game combining:
- Choose your own adventure structure
- D&D-style campaign management and dice mechanics
- Multiplayer turn-based gameplay
- AI-generated visuals

The focus is on **narrative and storytelling**, not combat difficulty. Players should feel agency and freedom while experiencing a compelling story.

---

## Three Phases

### 1. Character Creation

Players create their character(s):
- Name, appearance, background
- Starting stats/abilities
- Personality traits (updated as they play)

### 2. Campaign Creation

The AI (DM) builds the campaign skeleton — **hidden from players**:
- **NPCs**: Motivations, secrets, relationships
- **Locations**: Places, distances, connections between them
- **Items**: Key objects, properties, where they are
- **Events**: Plot triggers, conditions that activate them
- **Goals**: Objectives for the session/campaign

Campaign structure:
- **Simple**: 1 session (single scene/location)
- **Standard**: 3 sessions (three scenes/locations)
- Each session has a defined endpoint

### 3. Session Play

The core gameplay loop:

```
┌─────────────────────────────────────────┐
│  Present current situation              │
│  (narration + AI-generated image)       │
└────────────────┬────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────┐
│  Offer choices:                         │
│  • 4 suggested options (varied)         │
│  • Freeform input allowed               │
└────────────────┬────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────┐
│  Validate input                         │
│  • Reject nonsense/inappropriate        │
│  • Accept logical actions               │
└────────────────┬────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────┐
│  Determine difficulty                   │
│  • Auto-success (trivial actions)       │
│  • Roll required (risky actions)        │
└────────────────┬────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────┐
│  Resolve action                         │
│  • Execute dice roll if needed          │
│  • Determine success/failure/partial    │
│  • Narrate outcome                      │
└────────────────┬────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────┐
│  Update state                           │
│  • Advance time                         │
│  • Character changes (HP, items, etc.)  │
│  • World state changes                  │
│  • Goal progress                        │
└────────────────┬────────────────────────┘
                 │
                 ▼
        [Next player's turn or continue]
```

---

## Time System

Real-world time maps to game time, with variable scaling:

| Mode | Scale | Example |
|------|-------|---------|
| Normal | 1x | 5 min real = 5 min game |
| Travel | 10-16x | 5 min real = 50-80 min game |
| Combat ("bullet time") | 1/60x | 60 min real = 1 min game |

The DM adjusts time scale based on context.

---

## Multiplayer

### Turn-Based with Time Limits

- Players take turns (no split party — always together)
- Configurable time limits between moves:
  - Fast: 15 minutes
  - Medium: 1-2 hours
  - Slow: daily
- **Night hours**: Configurable window where moves aren't expected

### Auto-Move

If a player doesn't act within the time limit:
- AI makes a move for them
- Based on their character's personality traits
- Personality traits are inferred/updated as player makes choices

### Catch-Up

When a player returns after being away:
- Show synopsis of what happened
- Option to drill into details
- See current state + scene image
- Then make their move

---

## State Tracking

### Character State
- HP / health status
- Inventory (items held)
- Ailments / conditions
- Knowledge (what they know)
- Personality traits (for auto-move)
- Relationships with NPCs

### World State
- Current location
- Time (in-game)
- NPC positions / states
- Item positions
- Triggered events
- Environmental conditions

### Goal State
- Pending goals
- Completed goals
- Failed goals
- Abandoned goals

---

## Presentation Layer

- **Feed-style UI**: Scrolling narrative with images
- **Scene cards**: Each scene has synopsis + image
- **Current state panel**: HP, inventory, goals at a glance
- **Action input**: 4 choices + freeform text
- **History**: Expandable details for past events

Future: Mobile app

---

## Technical Approach

### Data Storage
- JSON schemas for all game entities
- Validators for required fields
- Tools for AI to read/modify state

### AI Tools Needed
- Character CRUD
- Location queries (nearby, connections)
- NPC queries (at location, relationships)
- Goal management
- Dice rolling
- Time advancement
- Image generation
- Catch-up summary generation

---

## Open Questions

- [ ] How granular should combat be? (action-by-action vs. abstracted)
- [ ] How to handle player disagreements in multiplayer?
- [ ] Should there be a "spectator" mode?
- [ ] How to balance AI creativity vs. campaign constraints?
- [ ] Save/load campaign state for pause/resume?
