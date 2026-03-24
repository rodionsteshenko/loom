# Gameplay Roadmap — State Tracking & Campaign Lifecycle

## Current State (What Works)

- World building with 6 sections, concept images, refinement
- Character creation grounded in world context
- Campaign generation with AI premise
- Session gameplay: narrative → choices → dice roll → outcome → next scene
- Campaign history passed to DM for continuity
- Scene + outcome images with character description for consistency
- Review/refine/finalize flow for worlds, characters, campaigns

## What's Missing

### 1. In-Session State Tracking

**During gameplay, nothing changes on the character or world.** The narrative says "you find a magic sword" but the character's inventory doesn't update. The DM says "you lose 5 HP" but the character sheet still shows full health.

#### Proposed: Session Event Log

After each choice resolution, the AI extracts key state changes from the outcome narrative:

```json
{
  "session_events": [
    { "type": "hp_change", "value": -5, "reason": "Arrow trap in the corridor" },
    { "type": "item_gained", "item": "Rusty Iron Key", "description": "Found on the dead guard" },
    { "type": "npc_met", "npc": "Captain Voss", "disposition": "hostile" },
    { "type": "location_visited", "location": "The Undercroft" },
    { "type": "knowledge_gained", "fact": "The guild is smuggling weapons through the sewers" }
  ]
}
```

**Implementation**: A new `event-extractor` agent runs after outcome narration. It reads the narrative and outputs structured events. These are saved on the session JSON and accumulated in the campaign.

**Why not update the character immediately?** Because:
- The narrative is AI-generated — it might hallucinate items
- The user should review what "happened" before it's permanent
- Events can be corrected during campaign review

### 2. Campaign Running State

The campaign `state` field (currently empty `{}`) should track accumulated state:

```json
{
  "state": {
    "hp_delta": -12,
    "items_found": ["Rusty Iron Key", "Map Fragment"],
    "items_lost": [],
    "npcs_met": [
      { "name": "Captain Voss", "disposition": "hostile", "met_in_scene": 2 },
      { "name": "Old Mara", "disposition": "friendly", "met_in_scene": 1 }
    ],
    "locations_visited": ["The Undercroft", "Market Square", "Docks"],
    "knowledge": ["The guild is smuggling weapons", "Voss answers to someone called 'The Architect'"],
    "active_quests": [
      { "name": "Find the Architect", "status": "active", "started_scene": 3 }
    ],
    "completed_quests": [],
    "reputation_changes": { "Iron Guild": -10, "City Watch": +5 }
  }
}
```

This state is accumulated from session events. The DM prompt includes this state so it knows:
- The character is wounded (HP delta)
- What items the character has
- Who they've met and their relationships
- What they know
- Active plot threads

### 3. Campaign Completion & Character Update

When a campaign is "completed" (user finishes all scenes or marks it done):

**Step 1: Campaign Summary Agent** — Generates a prose summary of the entire campaign

**Step 2: Character Update Agent** — Reviews all campaign events and proposes updates to the character:
- HP: Apply net HP changes
- XP: Award experience based on scenes completed and difficulty
- Items: Add gained items to inventory, remove lost items
- Skills: Potentially unlock new skills based on repeated use
- Relationships: Add NPCs met to character's relationships
- Knowledge: Add facts learned to character's knowledge array
- Backstory update: Append a paragraph about this campaign to the backstory

**Step 3: World Update Agent** — Reviews campaign events and proposes world changes:
- Faction reputation shifts
- NPC status changes (alive/dead, disposition)
- Location discoveries (new areas added to world geography)
- Historical events (campaign events added to world timeline)

**Step 4: User Review** — All proposed updates shown to user for approval before applying

### 4. Enhanced DM Context

The session generation prompt should include:

```
CAMPAIGN STATE:
- HP: 15/20 (-5 from scene 2)
- Items: Rusty Iron Key, Map Fragment, Standard Equipment
- NPCs met: Captain Voss (hostile), Old Mara (friendly)
- Known facts: The guild smuggles weapons; Voss works for "The Architect"
- Active quests: Find the Architect (started scene 3)
- Locations visited: The Undercroft, Market Square, Docks
```

This gives the DM much richer context than just summaries of what happened.

### 5. Multi-Session Campaign Arc

Campaigns should have a narrative arc structure:

```json
{
  "arc": {
    "type": "three_act",
    "total_scenes": 8,
    "current_act": 2,
    "act_1_end": 3,
    "act_2_end": 6,
    "climax_scene": 7,
    "resolution_scene": 8,
    "themes": ["betrayal", "redemption"],
    "main_antagonist": "The Architect",
    "stakes": "Control of the Eastern Wallfront"
  }
}
```

The DM uses this to pace the story — building tension in Act 1, escalating in Act 2, climax in Act 3. The campaign generator creates this arc when generating the campaign.

---

## Implementation Priority

### Phase 1: Event Extraction (Most impactful, moderate effort)
1. Create `event-extractor` agent — reads outcome narrative, outputs structured events
2. Save events on each session after choice resolution
3. Accumulate events into campaign `state`
4. Pass campaign state to DM prompt
5. Display accumulated state in campaign settings (items found, NPCs met, etc.)

### Phase 2: Enhanced DM Context (Builds on Phase 1)
6. Include full campaign state in session generation prompt
7. DM references items, NPCs, and knowledge in narratives
8. Choices can reference known facts ("Use the key you found")
9. NPCs remember previous interactions

### Phase 3: Campaign Arc & Completion (New feature)
10. Campaign generator creates arc structure (3 acts, climax, resolution)
11. DM paces story according to arc
12. Campaign completion detection (final scene reached)
13. Campaign summary generation

### Phase 4: Character & World Updates (After campaign)
14. Character update agent proposes changes after campaign completion
15. World update agent proposes changes
16. User review/approval UI for proposed updates
17. Apply approved updates to character and world JSON

### Phase 5: Advanced Gameplay (Future)
18. Combat system — multi-round encounters with initiative
19. Inventory management UI — equip/unequip items
20. NPC dialogue system — talk to NPCs between scenes
21. Party dynamics — multiple characters with individual actions
22. Character leveling — XP thresholds, ability score improvements

---

## Technical Notes

- Event extraction runs as a parallel agent call after outcome narration (doesn't slow down the response)
- Campaign state is a JSON object on campaign.json — no new files needed
- DM context grows with each session but should be capped (summarize old events if too long)
- Character updates are non-destructive — proposed changes are stored separately until approved
- World updates follow the same review pattern as world section refinement
