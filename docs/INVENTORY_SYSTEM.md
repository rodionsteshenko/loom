# Inventory System Design

## Overview

Two-phase inventory management:
1. **Initial Inventory** — Created with new character
2. **Inventory Loader** — Expands inventory for session prep

---

## Inventory Item Schema

```json
{
  "id": "uuid",
  "name": "Longsword",
  "type": "weapon",
  "subtype": "martial melee",
  "description": "A well-balanced blade with a worn leather grip",
  "weight": 3,
  "value": {
    "gp": 15,
    "sp": 0,
    "cp": 0
  },
  "quantity": 1,
  "equipped": true,
  "attunement": {
    "required": false,
    "attuned": false
  },
  "magical": false,
  "rarity": "common",
  "properties": ["versatile"],
  "damage": {
    "dice": "1d8",
    "type": "slashing",
    "versatile_dice": "1d10"
  },
  "notes": "Inherited from her father"
}
```

---

## Item Types

| Type | Subtypes |
|------|----------|
| weapon | simple melee, simple ranged, martial melee, martial ranged |
| armor | light, medium, heavy, shield |
| consumable | potion, scroll, food, ammunition |
| tool | artisan, gaming, musical, thieves, etc. |
| gear | adventuring, clothing, container |
| treasure | art, gem, trade goods, currency |
| wondrous | magic items that don't fit other categories |
| quest | plot-relevant items |

---

## Inventory Validator

Similar to character validator:

**Checks:**
- All items have required fields (id, name, type, weight, quantity)
- No unknown item types
- Weight values are numbers
- Value object has correct structure
- Quantity >= 1
- No unexpected fields

**Warnings:**
- Very high weight (encumbrance check)
- Very high value (wealth balance)
- Unidentified magical items without notes

---

## Phase 1: Initial Inventory Creator

When a new character is created, automatically generate starting inventory.

**Inputs:**
- Character class
- Character level
- Character background
- Optional prompt ("they're paranoid about poison")

**Process:**
1. Base equipment from class (PHB starting equipment)
2. Background equipment
3. Level-appropriate gold
4. Prompt-based additions

**Example:**
```bash
# Auto-generate based on character
loom create-inventory --from-character ./characters/mira.json

# With additional prompt
loom create-inventory --from-character ./characters/mira.json \
  --prompt "she's obsessed with maps and always carries backup weapons"
```

---

## Phase 2: Inventory Loader (Session Prep)

Before a session, expand/update inventory based on:
- Session context (going into a dungeon? desert? social event?)
- Character goals
- Available resources (gold, shops)

**Example:**
```bash
loom load-inventory ./characters/mira.json \
  --session "infiltrating a noble's masquerade ball" \
  --budget 50gp
```

**Output:**
```
Suggested additions for session "infiltrating a noble's masquerade ball":
- Courtier's outfit (fine clothes) — 15gp
- Mask (masquerade) — 5gp
- Dagger (concealed) — 2gp
- Potion of Glibness — 25gp (if available)
- Forged invitation — 3gp

Total: 50gp

Add these items? [y/n/edit]
```

---

## Integration with Character Creator

When `loom create-character` runs:

1. Generate character (all 75 fields)
2. Validate character
3. Generate portrait
4. **Call inventory creator** with character context
5. Validate inventory
6. Attach inventory to character
7. Output complete character + inventory

---

## Inventory Constraints

**Encumbrance (optional):**
- carrying_capacity = STR × 15
- Total inventory weight should not exceed

**Starting Wealth by Class:**
| Class | Starting Gold |
|-------|---------------|
| Fighter | 5d4 × 10 gp |
| Wizard | 4d4 × 10 gp |
| Rogue | 4d4 × 10 gp |
| Cleric | 5d4 × 10 gp |
| etc. | ... |

**Or use background:**
- Noble: 25gp
- Soldier: 10gp
- Criminal: 15gp
- etc.

---

## Notes

- Initial inventory should feel "lived in" — not just a generic starter kit
- Items should connect to backstory where possible
- The loader is for convenience; players can always manually edit
- Session-based loading helps the AI know what's relevant
