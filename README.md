# Loom 🎲

A narrative-focused D&D game system with AI-powered character creation.

## Project Structure

```
loom/
├── docs/
│   ├── CHARACTER_SCHEMA.md    # 75-field character schema
│   ├── CHARACTER_CREATOR.md   # Character generator design
│   ├── INVENTORY_SYSTEM.md    # Inventory schema & loader
│   ├── DESIGN_NOTES.md        # Design decisions
│   └── GAME_RULES.md          # Game mechanics (TBD)
├── src/
│   ├── cli/                   # Command-line tools
│   │   ├── create_character.py
│   │   ├── validate_character.py
│   │   └── create_inventory.py
│   ├── validators/            # Validation logic
│   │   ├── character_validator.py
│   │   └── inventory_validator.py
│   ├── schemas/               # JSON schemas
│   │   ├── character.json
│   │   └── inventory_item.json
│   └── web/                   # Frontend (Phase 2)
├── characters/                # Generated characters
└── tests/
```

## Roadmap

### Phase 1: Character Creator CLI ← CURRENT
- [ ] Character validator (schema compliance, prose minimums, no extra fields)
- [ ] `loom create-character <prompt>` using Claude subprocess
- [ ] Portrait generation via nano-banana-pro
- [ ] JSON output

### Phase 2: Inventory System
- [ ] Inventory item schema
- [ ] Inventory validator
- [ ] Initial inventory creator (from character)
- [ ] Inventory loader (session prep)

### Phase 3: Web Frontend
- [ ] Character creation UI with dropdowns
- [ ] Prompt + inspiration field
- [ ] Preview panel
- [ ] Portrait preview with regenerate

### Phase 4: Game Engine (TBD)
- [ ] Session management
- [ ] AI DM
- [ ] Combat resolution
- [ ] World state tracking

## Philosophy

- **Mechanical foundation** — Full D&D 5e stat support
- **Narrative depth** — Writer's toolkit (want/need, wound, lie, arc)
- **Prose sections** — Rich descriptions for storytelling + image gen
- **AI-native** — Built to work with Claude as co-creator and DM
