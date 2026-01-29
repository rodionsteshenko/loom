# Loom Gameplay Design

Player-facing features and game mechanics.

---

## Overview

Loom is an AI-powered narrative adventure game combining:
- Choose your own adventure structure
- D&D-style campaign management and dice mechanics
- Multiplayer turn-based gameplay
- AI-generated visuals

**Core principle**: Focus on **narrative and storytelling**, not combat difficulty. Players should feel agency and freedom while experiencing a compelling story.

---

## Game Flow

### Phase 1: Character Creation

Players define their character:

**Identity**
- Name
- Appearance (physical description)
- Voice/mannerisms

**Background**
- Origin (where they're from)
- Parents (alive? relationship?)
- Siblings (if any)
- Key people in their life (mentor, rival, lost love, etc.)
- Backstory (few sentences: what shaped them?)

**Abilities**
- Stats (based on D&D: STR, DEX, CON, INT, WIS, CHA)
- Skills/proficiencies
- Starting equipment

**Personality** (evolves during play)
- Traits (brave, cautious, curious, etc.)
- Values (loyalty, freedom, knowledge, etc.)
- Flaws (hot-tempered, greedy, naive, etc.)

---

### Phase 2: Campaign Creation

The AI (DM) builds the campaign skeleton — **hidden from players**:

**NPCs**
- Name, role, appearance
- Motivation (what do they want?)
- Secrets (what are they hiding?)
- Relationships (to PCs and other NPCs)

**Locations**
- Name, description, atmosphere
- Connections (what's nearby, how far)
- Points of interest
- Hazards or opportunities

**Items**
- Key objects that matter to the plot
- Properties, current location
- Who wants them and why

**Events**
- Plot triggers (conditions that activate them)
- Consequences (what happens when triggered)
- Timing (when can this happen?)

**Goals**
- Session objectives
- Campaign objectives
- Hidden objectives (revealed later)

**Campaign Structure**
- **Simple**: 1 session (single scene/location)
- **Standard**: 3 sessions (three acts)
- Each session has a defined endpoint

---

### Phase 3: Session Play

The core gameplay loop:

```
┌─────────────────────────────────────────┐
│  1. PRESENT SITUATION                   │
│  • Narrate current scene                │
│  • Show AI-generated image              │
│  • Display relevant state (HP, goals)   │
└────────────────┬────────────────────────┘
                 ↓
┌─────────────────────────────────────────┐
│  2. OFFER CHOICES                       │
│  • 4 suggested options (varied)         │
│  • Freeform input allowed               │
│  • "Ask the DM" option for questions    │
└────────────────┬────────────────────────┘
                 ↓
┌─────────────────────────────────────────┐
│  3. VALIDATE INPUT                      │
│  • Reject nonsense/inappropriate        │
│  • Accept logical actions               │
│  • Clarify ambiguous choices            │
└────────────────┬────────────────────────┘
                 ↓
┌─────────────────────────────────────────┐
│  4. DETERMINE DIFFICULTY                │
│  • Trivial → auto-success               │
│  • Risky → roll required                │
│  • Impossible → auto-fail (with reason) │
└────────────────┬────────────────────────┘
                 ↓
┌─────────────────────────────────────────┐
│  5. RESOLVE ACTION                      │
│  • Execute dice roll if needed          │
│  • Determine: success / partial / fail  │
│  • Narrate outcome                      │
└────────────────┬────────────────────────┘
                 ↓
┌─────────────────────────────────────────┐
│  6. UPDATE STATE                        │
│  • Advance time                         │
│  • Character changes (HP, items, etc.)  │
│  • World state changes                  │
│  • Goal progress                        │
│  • Spawn NPCs if newly referenced       │
└────────────────┬────────────────────────┘
                 ↓
        [Next player's turn or continue]
```

---

## Combat System

**Principle**: Combat serves the narrative. Keep it moving, make it dramatic, don't let it become a slog.

### Combat Tiers

| Tier | Description | Rounds | Example |
|------|-------------|--------|---------|
| **Minor** | Trivial threats | 1 (single roll) | Bar brawl, wild animal |
| **Standard** | Real danger | 2-3 | Bandits, guards, small monster |
| **Boss** | Major threat | 5-7 | Dragon, villain, horde |

### Minor Encounters

- Single skill check or attack roll
- Narrate the whole encounter based on success/failure
- No turn-by-turn breakdown
- Example: "You face down the wolves. Roll..."
  - Success: "Your blade flashes and the pack scatters."
  - Failure: "They overwhelm you. Take 5 damage and you're forced to flee."

### Standard Combat

- 2-3 rounds of decisions
- Each round: choose action (attack, defend, special, flee, other)
- Simplified: no initiative tracking, players act then enemies act
- Focus on interesting choices, not optimal tactics

### Boss Combat

- Full turn-by-turn (5-7 rounds typical)
- Bullet time engaged (time slows down)
- More tactical options available
- Environmental interactions encouraged
- Dramatic moments: close calls, turning points
- Should feel cinematic, not mechanical

### Death & Defeat

- **Player death is rare** — narrative focus means close calls, not TPKs
- At 0 HP: incapacitated, not dead
- Defeat usually means: captured, robbed, left for dead, forced to retreat
- Actual death only for dramatic story moments (player consent)

---

## Time System

Real-world time maps to game time with variable scaling:

| Mode | Scale | Use Case |
|------|-------|----------|
| **Normal** | 1:1 | Standard scenes, dialogue |
| **Travel** | 10-16:1 | Moving between locations |
| **Bullet Time** | 1:60 | Combat, critical moments |
| **Montage** | 100:1+ | Training, long journeys |

The DM adjusts time scale contextually. Players see: "3 hours pass as you travel through the forest..."

---

## Multiplayer

### Turn Order

- Players take turns making decisions
- No split party — everyone is in the same scene
- Order can be: round-robin, narrative priority, or voluntary

### Time Limits

Configurable per campaign:
- **Fast**: 15 minutes per turn
- **Medium**: 1-2 hours per turn  
- **Slow**: Once per day

### Night Hours

- Set hours where no one is expected to move (e.g., 11pm-7am)
- Clock pauses for time limit purposes
- If someone plays during night hours, great — but no penalty for not

### Auto-Move

When time limit expires:
1. AI analyzes player's character personality
2. Generates an "in-character" action
3. Executes as if player chose it
4. Marked in history as auto-generated
5. Player sees what happened when they return

### Catch-Up

When player returns after time away:
1. Synopsis of what happened (expandable)
2. Current scene image
3. Current state (HP, inventory, goals)
4. Their turn to act

---

## NPC System

### When NPCs Are Created

Any time an NPC is mentioned or encountered, they get a sheet:
- Referenced in backstory → create sheet
- Met during play → create sheet
- Named by player → create sheet

### NPC Tiers

| Tier | Detail Level | Example |
|------|--------------|---------|
| **Extra** | Name + 1 line | "Bartender, gruff" |
| **Supporting** | Name, motivation, 1 secret | Town guard captain |
| **Major** | Full sheet with relationships | Villain, mentor, rival |

NPCs can be promoted as they become more important.

---

## Goals & Progress

### Goal Types

- **Main**: Campaign-level objective
- **Session**: Current session objective
- **Side**: Optional, discovered during play
- **Hidden**: Revealed when conditions met

### Goal States

- **Active**: Currently pursuable
- **Completed**: Achieved
- **Failed**: No longer achievable
- **Abandoned**: Player chose to give up

### Goal Reminders

- Show active goals at session start
- Remind when relevant choices appear
- Update immediately when status changes

---

## Presentation

### Scene Cards

Each scene presented as:
- AI-generated image (setting/moment)
- Narration text
- Current state sidebar (HP, key items, active goals)
- Choice interface

### History Feed

- Scrollable narrative history
- Each entry: timestamp, action, outcome
- Expandable for more detail
- Images preserved in feed

### Catch-Up View

When returning after absence:
- "While you were away..." summary
- Key events highlighted
- Option to read full detail
- "Ready to continue" button

---

## Open Questions

- [ ] Should players be able to suggest goals?
- [ ] How to handle PvP moments (player vs player intentions)?
- [ ] Voice/audio narration option?
- [ ] Achievement/milestone system?
