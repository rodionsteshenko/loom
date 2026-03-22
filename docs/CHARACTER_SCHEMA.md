# Loom Character Schema

Last updated: 2026-01-29

## Overview

This schema supports both Player Characters (PCs) and Non-Player Characters (NPCs), balancing D&D mechanical foundation with narrative depth for AI-driven storytelling.

---

## Field Categories

### Identity (4 fields)
| Field | Type | Description |
|-------|------|-------------|
| id | string | Unique identifier |
| name | string | Character name |
| type | enum | "pc" or "npc" |
| player_id | string | Player who controls this character (null for NPCs) |

---

### Physical Description (4 fields) — FOR IMAGE GENERATION
| Field | Type | Description |
|-------|------|-------------|
| physical_description | text (prose) | **Detailed physical appearance for image generation.** Height, build, skin tone, hair, eyes, distinguishing features, typical clothing, posture, how they carry themselves. 2-4 paragraphs. |
| height | string | e.g., "5'10\"" or "tall" |
| weight | string | e.g., "180 lbs" or "stocky build" |
| image_url | string | Generated portrait URL |

**Example physical_description:**
> *Mira stands just under six feet, lean and sharp-angled like a blade left too long on the whetstone. Her skin is warm brown, weathered by sun and wind, with a thin scar running from her left temple to her jaw—a gift from a knife fight in her twenties she refuses to discuss. Her hair is black, shot through with early gray, usually pulled back in a practical braid. Her eyes are dark amber, almost gold in certain light, and they rarely blink when she's sizing someone up. She favors practical clothing: worn leather armor over dark linen, boots that have seen better days, a cloak the color of dried blood. She moves like someone who expects to be attacked at any moment.*

---

### Voice & Mannerisms (2 fields)
| Field | Type | Description |
|-------|------|-------------|
| voice | text (prose) | How they sound, speech patterns, accent, vocabulary, verbal tics, what they sound like when angry vs. calm. |
| mannerisms | text (prose) | Physical habits, gestures, how they move, nervous tics, body language. |

**Example voice:**
> *Speaks in short, clipped sentences. Rarely raises her voice—when she's angry, she gets quieter. Has a slight northern accent she's mostly trained out of herself. Uses profanity sparingly but precisely. Never says "I'm sorry" even when she means it.*

---

### Background & History (6 fields) — PROSE SECTIONS
| Field | Type | Description |
|-------|------|-------------|
| origin | string | Where they're from (place name) |
| backstory | text (prose) | **Their full history.** Childhood, formative experiences, what shaped them, key events, how they got where they are. 3-6 paragraphs minimum. |
| childhood | text (prose) | Specifically: early years, family dynamics, what kind of kid they were, earliest memories, traumas or joys. |
| parents | array of objects | { name, relationship, alive, notes } |
| siblings | array of objects | { name, relationship, alive, notes } |
| key_people | array of objects | { name, relationship, role_in_life, alive, notes } |

**Example backstory:**
> *Mira grew up in the fishing village of Saltmere, the middle child of five. Her father was a fisherman who drowned when she was nine; her mother remarried a man Mira never trusted. She left home at fifteen, lied about her age to join a mercenary company, and spent the next decade learning that violence was the only currency that never devalued.*
>
> *She rose through the ranks not through ambition but through survival—everyone above her kept dying. By twenty-five she was running her own crew. By thirty she'd made enough enemies that retirement wasn't an option. The company dissolved after a job went bad in Kestrel, and she's been working solo ever since, taking contracts that let her sleep at night. Most of them, anyway.*

---

### Psychological Profile (7 fields) — WRITER'S TOOLKIT
| Field | Type | Description |
|-------|------|-------------|
| motivation | text (prose) | What drives them. What do they want? What gets them out of bed? |
| want | string | External goal — what they're actively pursuing |
| need | string | Internal need — what they actually require for fulfillment (often conflicts with want) |
| wound | text (prose) | The ghost/trauma — past pain that shapes current behavior. The thing they're running from or trying to fix. |
| lie_they_believe | string | False belief about themselves or the world they need to overcome |
| fear | string | Deepest fear — what would break them |
| arc_direction | enum | "positive" (growth), "negative" (fall), "flat" (catalyst for others), "ambiguous" |

**Example:**
> **want:** To find her brother, who disappeared five years ago
> **need:** To forgive herself for not being there when he vanished
> **wound:** She was passed out drunk the night he was taken. She heard something and didn't get up.
> **lie_they_believe:** "If I'd been sober, I could have saved him."
> **fear:** That he's dead and it's her fault. Or worse: that he's alive and doesn't want to be found.

---

### Personality (5 fields)
| Field | Type | Description |
|-------|------|-------------|
| traits | array | Personality traits (brave, cynical, loyal, etc.) |
| values | array | What they care about deeply |
| flaws | array | Weaknesses, vices, blind spots |
| secrets | array | Things they hide from others |
| archetype | string | Jungian archetype if applicable (Hero, Rebel, Caregiver, Explorer, etc.) |

---

### D&D Core Stats (10 fields)
| Field | Type | Description |
|-------|------|-------------|
| stats | object | { STR, DEX, CON, INT, WIS, CHA } — each 1-20+ |
| race | string | Species/ancestry |
| class | string | Fighter, Wizard, Rogue, etc. |
| subclass | string | Champion, Evocation, Assassin, etc. |
| level | integer | Character level |
| experience_points | integer | XP tracking for level-ups |
| background | string | D&D background: Soldier, Noble, Criminal, etc. |
| alignment | enum | lawful_good, neutral_good, chaotic_good, lawful_neutral, true_neutral, chaotic_neutral, lawful_evil, neutral_evil, chaotic_evil |
| birthday | date | For calculating age from game time |
| languages | array | Languages spoken/read |

---

### Proficiencies (5 fields)
| Field | Type | Description |
|-------|------|-------------|
| skills | array | Proficient skills (Athletics, Perception, etc.) |
| tool_proficiencies | array | Blacksmith tools, thieves' tools, etc. |
| weapon_proficiencies | array | Simple, martial, specific weapons |
| armor_proficiencies | array | Light, medium, heavy, shields |
| feats | array | Special feats (Sentinel, Lucky, etc.) |

---

### Combat Stats (14 fields)
| Field | Type | Description |
|-------|------|-------------|
| hp | object | { current, max } |
| temp_hp | integer | Temporary hit points |
| armor_class | integer | AC |
| movement_speed | integer | Feet per turn (typically 30) |
| initiative_bonus | integer | Modifier for turn order |
| saving_throws | object | { STR, DEX, CON, INT, WIS, CHA } bonuses |
| proficiency_bonus | integer | Level-based bonus |
| hit_dice | object | { type: "d8", current, max } |
| death_saves | object | { successes: 0-3, failures: 0-3 } |
| inspiration | boolean | D&D reward mechanic |
| passive_perception | integer | 10 + perception modifier |
| resistances | array | Damage types with half damage |
| immunities | array | Damage types with no effect |
| vulnerabilities | array | Damage types with double damage |

---

### Magic (3 fields)
| Field | Type | Description |
|-------|------|-------------|
| spell_slots | object | Levels 1-9, each { current, max } |
| mana | object | { current, max } — alternative magic system |
| spells_known | array | List of known spells with details |

---

### Resources & Economy (3 fields)
| Field | Type | Description |
|-------|------|-------------|
| currency | object | { gold, silver, copper } or { gp, sp, cp } |
| inventory | array | Items carried with weights |
| carrying_capacity | integer | Max weight in lbs (STR × 15 by default) |

---

### State (5 fields)
| Field | Type | Description |
|-------|------|-------------|
| ailments | array | Conditions, diseases, curses |
| exhaustion_level | integer | 0-6 (D&D 5e exhaustion) |
| knowledge | array | What they know (facts, rumors, discoveries) |
| current_location | string | Where they are now |
| abilities | array | Special abilities, class features, racial traits |

---

### Social & Relationships (2 fields)
| Field | Type | Description |
|-------|------|-------------|
| relationships | array | { character_id, name, type, description, trust_level (1-10), notes } |
| reputation | object | { faction_name: reputation_level } — how groups see them |

---

### Meta (3 fields)
| Field | Type | Description |
|-------|------|-------------|
| is_alive | boolean | Living or dead |
| created_at | timestamp | When created |
| updated_at | timestamp | Last modified |

---

## Total Field Count: 75

### Breakdown by Category:
- Identity: 4
- Physical Description: 4
- Voice & Mannerisms: 2
- Background & History: 6
- Psychological Profile: 7
- Personality: 5
- D&D Core Stats: 10
- Proficiencies: 5
- Combat Stats: 14
- Magic: 3
- Resources & Economy: 3
- State: 5
- Social & Relationships: 2
- Meta: 3

---

## Prose Fields Summary

These fields should be written as full prose (paragraphs, not bullet points):

| Field | Purpose |
|-------|---------|
| physical_description | Image generation prompt + visualization |
| voice | Dialogue writing, speech patterns |
| mannerisms | Action descriptions, body language |
| backstory | Full history, narrative foundation |
| childhood | Early formation, family dynamics |
| motivation | Drive and agency |
| wound | Trauma that shapes behavior |

---

## Design Philosophy

1. **Mechanical foundation** — Full D&D 5e stat support so the AI has rules to work with
2. **Narrative depth** — Writer's toolkit fields (want/need, wound, lie, arc) for meaningful stories
3. **Prose sections** — Freeform text for things that can't be reduced to numbers
4. **Image generation** — physical_description written to feed directly to image AI
5. **Queryable + readable** — Structured enough to search, human enough to read
