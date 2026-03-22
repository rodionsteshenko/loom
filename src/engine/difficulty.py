#!/usr/bin/env python3
"""
Loom Difficulty System

Handles DC (Difficulty Class) calculation and auto-succeed thresholds.
Uses D&D 5e as a foundation but simplified for narrative play.

Difficulty Tiers:
- Trivial (DC 5): Almost anyone can do this
- Easy (DC 10): Slight challenge for trained individuals
- Medium (DC 15): Standard challenge, requires skill
- Hard (DC 20): Difficult, needs expertise
- Extreme (DC 25): Near-impossible, needs mastery + luck

Auto-succeed threshold: If modifier >= DC - 5, skip the roll.
This means a character with +10 auto-succeeds on DC 15 or lower.
"""

from enum import Enum
from dataclasses import dataclass
from typing import Optional, Dict, Any

class DifficultyTier(Enum):
    """Difficulty tiers with base DCs."""
    TRIVIAL = 5
    EASY = 10
    MEDIUM = 15
    HARD = 20
    EXTREME = 25
    IMPOSSIBLE = 30  # Requires crits or divine intervention

    @classmethod
    def from_string(cls, s: str) -> 'DifficultyTier':
        """Parse difficulty from string."""
        return cls[s.upper()]
    
    @classmethod
    def from_dc(cls, dc: int) -> 'DifficultyTier':
        """Get tier from DC value."""
        if dc <= 5:
            return cls.TRIVIAL
        elif dc <= 10:
            return cls.EASY
        elif dc <= 15:
            return cls.MEDIUM
        elif dc <= 20:
            return cls.HARD
        elif dc <= 25:
            return cls.EXTREME
        else:
            return cls.IMPOSSIBLE


# Skill to ability score mapping (D&D 5e)
SKILL_ABILITIES: Dict[str, str] = {
    # Strength
    "Athletics": "STR",
    # Dexterity
    "Acrobatics": "DEX",
    "Sleight of Hand": "DEX",
    "Stealth": "DEX",
    # Intelligence
    "Arcana": "INT",
    "History": "INT",
    "Investigation": "INT",
    "Nature": "INT",
    "Religion": "INT",
    # Wisdom
    "Animal Handling": "WIS",
    "Insight": "WIS",
    "Medicine": "WIS",
    "Perception": "WIS",
    "Survival": "WIS",
    # Charisma
    "Deception": "CHA",
    "Intimidation": "CHA",
    "Performance": "CHA",
    "Persuasion": "CHA",
}


def get_ability_modifier(score: int) -> int:
    """Calculate ability modifier from score (D&D 5e formula)."""
    return (score - 10) // 2


def get_proficiency_bonus(level: int) -> int:
    """Get proficiency bonus from level (D&D 5e)."""
    return (level - 1) // 4 + 2


def get_relevant_modifier(
    character: Dict[str, Any],
    skill: Optional[str] = None,
    ability: Optional[str] = None
) -> int:
    """
    Calculate the relevant modifier for a check.
    
    Args:
        character: Character dict with stats, skills, level
        skill: Skill name (e.g., "Stealth", "Persuasion")
        ability: Raw ability name (e.g., "DEX", "CHA")
    
    Returns:
        Total modifier including ability + proficiency if applicable
    """
    stats = character.get("stats", {})
    skills = character.get("skills", [])
    level = character.get("level", 1)
    
    # Determine which ability score to use
    if skill and skill in SKILL_ABILITIES:
        ability = SKILL_ABILITIES[skill]
    elif not ability:
        ability = "STR"  # Default fallback
    
    # Get ability modifier
    ability_score = stats.get(ability, 10)
    ability_mod = get_ability_modifier(ability_score)
    
    # Add proficiency if skilled
    if skill and skill in skills:
        prof_bonus = get_proficiency_bonus(level)
        return ability_mod + prof_bonus
    
    return ability_mod


@dataclass
class DifficultyCheck:
    """Result of a difficulty analysis."""
    dc: int
    tier: DifficultyTier
    modifier: int
    auto_succeed: bool
    auto_fail: bool
    success_chance: float  # Percentage (0-100)
    description: str


def calculate_dc(
    base_difficulty: DifficultyTier | int,
    circumstance_modifier: int = 0
) -> int:
    """
    Calculate the final DC for a check.
    
    Args:
        base_difficulty: Difficulty tier or raw DC
        circumstance_modifier: Bonus/penalty from circumstances
    
    Returns:
        Final DC (minimum 1)
    """
    if isinstance(base_difficulty, DifficultyTier):
        base_dc = base_difficulty.value
    else:
        base_dc = base_difficulty
    
    return max(1, base_dc + circumstance_modifier)


def check_auto_succeed(modifier: int, dc: int, threshold: int = 5) -> bool:
    """
    Check if a character auto-succeeds.
    
    If the modifier is so high that even the worst possible roll
    (technically 1, but we use a threshold) would succeed, skip the dice.
    
    Args:
        modifier: Character's total modifier
        dc: Difficulty class
        threshold: How much margin required for auto-succeed (default 5)
    
    Returns:
        True if character auto-succeeds
    """
    # Auto-succeed if modifier alone beats (DC - threshold)
    # This means even rolling a 1 would give you (1 + modifier) >= DC
    return modifier >= (dc - threshold)


def check_auto_fail(modifier: int, dc: int) -> bool:
    """
    Check if a task is impossible for this character.
    
    If even a natural 20 wouldn't hit the DC, it's auto-fail.
    
    Args:
        modifier: Character's total modifier  
        dc: Difficulty class
    
    Returns:
        True if the task is impossible
    """
    # Even a nat 20 + modifier wouldn't reach DC
    return (20 + modifier) < dc


def calculate_success_chance(modifier: int, dc: int) -> float:
    """
    Calculate the percentage chance of success.
    
    Args:
        modifier: Character's total modifier
        dc: Difficulty class
    
    Returns:
        Success chance as percentage (0-100)
    """
    # Need to roll (dc - modifier) or higher on d20
    required_roll = dc - modifier
    
    if required_roll <= 1:
        return 100.0  # Auto-succeed
    elif required_roll > 20:
        return 0.0  # Impossible
    else:
        # Each number 1-20 has 5% chance
        success_count = 21 - required_roll
        return success_count * 5.0


def analyze_difficulty(
    character: Dict[str, Any],
    dc: int,
    skill: Optional[str] = None,
    ability: Optional[str] = None
) -> DifficultyCheck:
    """
    Analyze how difficult a check is for a specific character.
    
    Args:
        character: Character dict
        dc: Difficulty class
        skill: Skill to use (optional)
        ability: Ability to use (optional, derived from skill if given)
    
    Returns:
        DifficultyCheck with full analysis
    """
    modifier = get_relevant_modifier(character, skill, ability)
    tier = DifficultyTier.from_dc(dc)
    auto_succeed = check_auto_succeed(modifier, dc)
    auto_fail = check_auto_fail(modifier, dc)
    chance = calculate_success_chance(modifier, dc)
    
    # Generate description
    if auto_succeed:
        desc = "This is trivial for you."
    elif auto_fail:
        desc = "This is beyond your capabilities."
    elif chance >= 80:
        desc = "You're confident you can do this."
    elif chance >= 60:
        desc = "A reasonable challenge."
    elif chance >= 40:
        desc = "This will be difficult."
    elif chance >= 20:
        desc = "The odds are against you."
    else:
        desc = "You'd need a miracle."
    
    return DifficultyCheck(
        dc=dc,
        tier=tier,
        modifier=modifier,
        auto_succeed=auto_succeed,
        auto_fail=auto_fail,
        success_chance=chance,
        description=desc
    )


if __name__ == "__main__":
    # Test the system
    test_character = {
        "name": "Test Rogue",
        "level": 5,
        "stats": {"STR": 10, "DEX": 18, "CON": 12, "INT": 14, "WIS": 12, "CHA": 10},
        "skills": ["Stealth", "Sleight of Hand", "Acrobatics", "Perception"]
    }
    
    print("Testing difficulty system with Level 5 Rogue (DEX 18)")
    print("=" * 50)
    
    for tier in DifficultyTier:
        result = analyze_difficulty(test_character, tier.value, skill="Stealth")
        print(f"\n{tier.name} (DC {tier.value}):")
        print(f"  Modifier: +{result.modifier}")
        print(f"  Success chance: {result.success_chance}%")
        print(f"  Auto-succeed: {result.auto_succeed}")
        print(f"  {result.description}")
