# Loom Engine Design

Technical architecture and system features.

---

## State Management

### Principle: Additive State History

All state changes are logged additively. The current state is the result of applying all changes in sequence. This enables:
- **Rewind**: Restore to any previous point
- **Replay**: Step through history for debugging
- **Audit**: See exactly what changed and when

### Directory Structure

```
campaigns/{campaign_id}/
├── state/
│   ├── current/           # Current live state
│   │   ├── characters.json
│   │   ├── world.json
│   │   ├── goals.json
│   │   └── session.json
│   ├── snapshots/         # Point-in-time backups
│   │   ├── 2026-01-28T22-00-00.json
│   │   └── 2026-01-28T22-15-00.json
│   └── changelog.jsonl    # Append-only log of all changes
├── skeleton/              # Campaign skeleton (hidden from players)
│   ├── npcs.json
│   ├── locations.json
│   ├── items.json
│   └── events.json
└── history/               # Narrative history for catch-up
    └── actions.jsonl
```

### Changelog Format

Each state change is logged:

```json
{
  "timestamp": "2026-01-28T22:15:32Z",
  "action_id": "act_abc123",
  "player_id": "player_1",
  "type": "character_update",
  "target": "char_xyz",
  "changes": {
    "hp": { "from": 20, "to": 15 },
    "inventory": { "added": ["silver_key"], "removed": [] }
  }
}
```

### Rewind Command

```
loom rewind --campaign {id} --to {timestamp|snapshot_name}
```

Restores `current/` state from the changelog or snapshot.

### Automatic Snapshots

- Before each session starts
- After each session ends
- On demand via `loom snapshot`

---

## Logging

### Log Levels

- **debug**: Detailed internal state (dev only)
- **info**: Normal operations (player actions, state changes)
- **warn**: Recoverable issues (validation failures, retries)
- **error**: Failures requiring attention

### Log Structure

```
logs/
├── engine.log      # System operations
├── gameplay.log    # Player actions, dice rolls, outcomes
└── ai.log          # AI decisions, prompts, responses
```

---

## AI Integration

### Tools the Agent Needs

**Read operations:**
- `get_character(id)` → character state
- `get_location(id)` → location details
- `list_npcs_at_location(location_id)` → NPCs present
- `get_nearby_locations(location_id, radius)` → connected places
- `get_goals()` → current goal states
- `get_session_state()` → time, location, active players

**Write operations:**
- `update_character(id, changes)` → modify HP, inventory, etc.
- `update_goal(id, status)` → mark complete/failed/abandoned
- `advance_time(minutes, scale)` → progress game clock
- `trigger_event(event_id)` → activate a plot event
- `create_npc(data)` → spawn new NPC when referenced
- `log_action(action)` → record to history

**Utility:**
- `roll_dice(difficulty, modifiers)` → success/failure + margin
- `generate_image(description)` → scene/character image
- `generate_catch_up(player_id, since)` → summary of missed events

---

## Validation

### Schema Validation

All JSON files validated against schemas on:
- Load
- Save
- API input

### Game Rule Validation

- HP cannot go below 0 (character is dead/incapacitated)
- Inventory weight/slot limits (if implemented)
- Location transitions must follow connections
- Time can only move forward (except rewind)

---

## Multiplayer Sync

### Turn Management

- Track whose turn it is
- Track last action timestamp per player
- Calculate time until auto-move triggers

### Auto-Move Logic

1. Time limit exceeded
2. Load player's character personality traits
3. Generate "in-character" action
4. Execute as if player chose it
5. Mark action as `auto: true` in history

---

## Future Considerations

- [ ] Real-time WebSocket updates for spectators
- [ ] Campaign export/import
- [ ] Forking campaigns (alternate timeline branches)
- [ ] Analytics (play patterns, common choices)
