# Loom Character Schema

IMPORTANT: Follow this schema exactly. Do not invent fields not listed here. Use schema-led reasoning, not training-led reasoning about D&D characters.

## Required Fields
- name (string)
- type: "pc" or "npc"
- physical_description (200+ chars) — detailed appearance for image generation
- backstory (300+ chars) — full history, 3-6 paragraphs
- stats: {STR, DEX, CON, INT, WIS, CHA} — each 1-30
- race (string)
- class (string)
- level (1-20)
- alignment: lawful_good|neutral_good|chaotic_good|lawful_neutral|true_neutral|chaotic_neutral|lawful_evil|neutral_evil|chaotic_evil

## Prose Fields (minimum lengths)
- physical_description: 200 chars — height, build, skin, hair, eyes, scars, clothing, posture
- backstory: 300 chars — childhood, formative events, how they got here
- childhood: 150 chars — early years, family dynamics
- voice: 100 chars — speech patterns, accent, vocabulary
- mannerisms: 100 chars — gestures, body language, habits
- motivation: 100 chars — what drives them
- wound: 100 chars — past trauma shaping behavior

## All Fields by Category

### Identity
id, name, type, player_id

### Physical (for image generation)
physical_description, height, weight, image_url

### Voice & Mannerisms
voice, mannerisms

### Background
origin, backstory, childhood, parents[], siblings[], key_people[]

### Psychological (Writer's Toolkit)
motivation, want, need, wound, lie_they_believe, fear, arc_direction

### Personality
traits[], values[], flaws[], secrets[], archetype

### D&D Stats
stats{}, race, class, subclass, level, experience_points, background, alignment, birthday, languages[]

### Proficiencies
skills[], tool_proficiencies[], weapon_proficiencies[], armor_proficiencies[], feats[]

### Combat
hp{current,max}, temp_hp, armor_class, movement_speed, initiative_bonus, saving_throws{}, hit_dice{}, death_saves{}, inspiration, resistances[], immunities[], vulnerabilities[]

### Magic
spell_slots{}, mana{}, spells_known[]

### Resources
currency{gp,sp,cp}, inventory[]

### State
ailments[], exhaustion_level, knowledge[], current_location, abilities[]

### Social
relationships[], reputation{}

### Meta
is_alive, created_at, updated_at

## Arc Direction Values
- positive: character grows, overcomes lie
- negative: character falls, succumbs to flaw  
- flat: doesn't change but changes others
- ambiguous: morally complex

## Archetype Values (Jungian)
Innocent, Orphan, Hero, Caregiver, Explorer, Rebel, Lover, Creator, Jester, Sage, Magician, Ruler

## Array Field Structures
- parents/siblings: {name, relationship, alive, notes}
- key_people: {name, relationship, role_in_life, alive, notes}
- relationships: {character_id, name, type, description, trust_level(1-10), notes}

## Output Format
Return ONLY valid JSON. No markdown, no explanation, no code blocks. Just the JSON object.
