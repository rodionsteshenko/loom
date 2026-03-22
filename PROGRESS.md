# Loom Progress Tracker

## Current Status
**Phase:** Phase 4 (Game Engine) - CORE COMPLETE
**Last Updated:** 2026-02-05

---

## Phase 1: Character Creator CLI ✅ DONE

### Done
- [x] 75-field character schema (CHARACTER_SCHEMA.md)
- [x] Character validator (schema compliance, prose minimums)
- [x] `create_character.py` CLI using Claude
- [x] Portrait generation via nano-banana-pro
- [x] JSON output to `characters/` folder
- [x] 3 test characters created:
  - Borin Stonehand
  - Malachar Voss (Tiefling Warlock)
  - Thalindor Silverleaf

---

## Phase 2: Inventory System 🔲 NOT STARTED

- [ ] Inventory item schema
- [ ] Inventory validator
- [ ] Initial inventory creator (from character class/background)
- [ ] Inventory loader (session prep)

---

## Phase 3: Web Frontend 🟡 IN PROGRESS

### Done
- [x] Vite + React + TypeScript setup
- [x] Basic project structure
- [x] Types defined (types.ts)

### Remaining
- [ ] Character creation UI with dropdowns
- [ ] Prompt + inspiration field
- [ ] Preview panel
- [ ] Portrait preview with regenerate
- [ ] Character gallery view

---

## Phase 4: Game Engine ✅ CORE COMPLETE

The core Choose Your Own Adventure system is built!

### Campaign Management ✅
- [x] Campaign schema (`src/schemas/campaign.json`)
- [x] Campaign CRUD operations
- [x] Campaign state persistence
- [x] Campaign loading/saving

### Session System ✅
- [x] Session schema (`src/schemas/session.json`)
- [x] Session generator (AI creates narrative + choices)
- [x] Choice difficulty calculator (character stats vs task)
- [x] Session flow (narrative → choices → selection → roll → outcome)

### Difficulty & Dice System ✅
- [x] Difficulty tiers (trivial/easy/medium/hard/extreme)
- [x] Auto-succeed threshold (high skill + easy task = skip roll)
- [x] Die roll mechanics (d20 + modifiers)
- [x] Success/partial/failure outcomes
- [x] Critical success/failure handling
- [x] Advantage/disadvantage support
- [x] Contested rolls

### AI DM ✅
- [x] DM prompt template (world state, character sheet, session context)
- [x] Narrative generation based on choice + roll
- [x] NPC dialogue generation
- [x] Session content generation (narrative + 4 choices)
- [x] Outcome narration

### CLI Interface ✅
- [x] `play.py new` - Create new campaigns
- [x] `play.py play` - Play a campaign
- [x] `play.py list` - List all campaigns
- [x] `play.py status` - Show campaign status
- [x] `play.py test` - Run engine tests

### Test Campaign ✅
- [x] "The Crimson Pact" test campaign created
- [x] Uses Malachar Voss character
- [x] Plot beats defined
- [x] Ready for play testing

---

## Engine Architecture

```
src/engine/
├── __init__.py      # Public API exports
├── difficulty.py    # DC calculation, auto-succeed, skill analysis
├── dice.py          # d20 rolls, outcomes, contested checks
├── dm.py            # AI Dungeon Master (Claude CLI integration)
└── game.py          # Session orchestration, state management

src/schemas/
├── character.json   # Character schema
├── inventory_item.json
├── campaign.json    # Campaign schema (NEW)
└── session.json     # Session schema (NEW)

src/cli/
├── create_character.py
└── play.py          # Game CLI (NEW)

campaigns/
└── test_campaign/   # The Crimson Pact
    ├── campaign.json
    └── sessions/
```

---

## How It Works

1. **Create a campaign** with `play.py new`
2. **Load a character** (from `characters/` folder)
3. **AI DM generates** narrative + 4 choices via Claude CLI
4. **Player picks a choice** (1-4)
5. **System calculates** DC vs character modifier
6. **Auto-succeed** if modifier is high enough, else roll d20
7. **AI DM narrates** the outcome based on roll result
8. **Loop continues** with next session

### Difficulty System

| Tier | DC | Description |
|------|-----|-------------|
| Trivial | 5 | Almost anyone can do this |
| Easy | 10 | Slight challenge |
| Medium | 15 | Standard challenge |
| Hard | 20 | Difficult, needs expertise |
| Extreme | 25 | Near-impossible |

**Auto-succeed**: If modifier >= (DC - 5), skip the roll.

### Roll Outcomes

| Outcome | Condition |
|---------|-----------|
| Critical Success | Natural 20 |
| Success | Beat DC by 5+ |
| Partial Success | Beat DC by 0-4 |
| Failure | Didn't beat DC |
| Critical Failure | Natural 1 |

---

## Known Issues

1. **Claude CLI latency**: AI calls can take 30-60+ seconds
2. **Rate limiting**: May hit Claude API limits with rapid play

---

## Next Steps

1. **Polish**: Add better error handling for AI timeouts
2. **Inventory**: Add item management between sessions
3. **Web UI**: Build React frontend for the game
4. **State updates**: Track world state changes (NPCs met, items gained)
5. **Combat**: Add simplified combat resolution if needed

---

## Files Reference

| File | Purpose |
|------|---------|
| `docs/CHARACTER_SCHEMA.md` | 75-field character definition |
| `docs/DESIGN_NOTES.md` | Design philosophy and decisions |
| `docs/ENUMS.md` | Valid values for enum fields |
| `src/cli/create_character.py` | Character generation CLI |
| `src/cli/play.py` | Game CLI (NEW) |
| `src/engine/difficulty.py` | DC and difficulty system (NEW) |
| `src/engine/dice.py` | Dice rolling mechanics (NEW) |
| `src/engine/dm.py` | AI Dungeon Master (NEW) |
| `src/engine/game.py` | Game session management (NEW) |
| `src/schemas/campaign.json` | Campaign schema (NEW) |
| `src/schemas/session.json` | Session schema (NEW) |
| `src/validators/character_validator.py` | Schema validation |
| `characters/*.json` | Generated character files |
| `campaigns/test_campaign/` | Test campaign (NEW) |
| `web/` | React frontend |
