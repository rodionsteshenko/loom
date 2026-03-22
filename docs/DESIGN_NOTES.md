# Loom Design Notes

## 2026-01-29 — Schema Design

### Philosophy
- Mechanical foundation + narrative depth
- Full D&D 5e support so the AI has rules to fall back on
- Writer's toolkit for meaningful character arcs
- Prose sections for things that can't be reduced to numbers

---

## Field Evolution

### Wave 1 (34 fields)
Core identity, appearance, background, basic stats, state, personality, social, NPC-specific, meta.

### Wave 2 (+11 fields = 45)
Added: alignment, race, class, level, birthday, height, weight, languages, spell_slots, mana, armor_class

### Wave 3 (+10 fields = 55)
Added: movement_speed, initiative_bonus, saving_throws, proficiency_bonus, hit_dice, death_saves, inspiration, passive_perception, resistances, spells_known

### Wave 4 (+3 fields = 58)
Added: immunities, vulnerabilities, temp_hp

### Wave 5 — Final (+17 fields = 75)
Added mechanical fields:
- experience_points
- currency (as object)
- carrying_capacity
- tool_proficiencies
- weapon_proficiencies
- armor_proficiencies
- subclass
- background (D&D)
- feats

Added writer's toolkit fields:
- want (external goal)
- need (internal need)
- wound (ghost/trauma)
- lie_they_believe
- fear
- arc_direction
- archetype

Expanded prose fields:
- physical_description (detailed, for image gen)
- childhood (separate from backstory)
- mannerisms
- reputation

---

## Writer's Toolkit Explanation

From character development theory:

**Want vs Need**
- Want = external goal (find the treasure, kill the dragon)
- Need = internal requirement for fulfillment (learn to trust, forgive themselves)
- Great stories happen when want and need conflict

**The Wound (Ghost)**
- Past trauma that shapes present behavior
- Why they are the way they are
- Often hidden from other characters

**The Lie They Believe**
- False belief about self or world
- Must be challenged/overcome for positive arc
- Reinforced for negative arc

**Arc Direction**
- Positive: character grows, overcomes lie
- Negative: character falls, succumbs to flaw
- Flat: character doesn't change but changes others
- Ambiguous: unclear, morally complex

---

## Prose Fields

These exist because some things can't be bullet points:

| Field | Why prose? |
|-------|------------|
| physical_description | Needs to be detailed enough for image AI |
| voice | Speech patterns require examples, not lists |
| mannerisms | Body language needs description |
| backstory | History is a story, not data |
| childhood | Formative years need narrative |
| wound | Trauma needs context |
| motivation | Drive needs explanation |

---

## Open Questions

1. **World state** — How do we track the game world, not just characters?
2. **Session logs** — How to record what happened each session?
3. **AI DM** — How much autonomy? How does it access character sheets?
4. **Combat resolution** — Full D&D rules or simplified?
5. **Relationship dynamics** — How do NPCs update their view of PCs?
