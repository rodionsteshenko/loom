#!/usr/bin/env python3
"""
Loom Dice System

Handles d20 rolls with modifiers, critical success/failure, and outcome determination.

Roll Outcomes:
- Critical Success (nat 20): Best possible outcome, bonus effects
- Success: Achieved the goal
- Partial Success: Achieved the goal but with a complication
- Failure: Did not achieve the goal
- Critical Failure (nat 1): Worst possible outcome, additional consequences

The partial success zone is when you beat the DC by less than 5.
"""

import random
from enum import Enum
from dataclasses import dataclass
from typing import Optional, Dict, Any


class RollOutcome(Enum):
    """Possible outcomes of a d20 check."""
    CRITICAL_SUCCESS = "critical_success"
    SUCCESS = "success"
    PARTIAL_SUCCESS = "partial_success"
    FAILURE = "failure"
    CRITICAL_FAILURE = "critical_failure"
    
    @property
    def is_success(self) -> bool:
        """Returns True if the outcome is any kind of success."""
        return self in (RollOutcome.CRITICAL_SUCCESS, RollOutcome.SUCCESS, RollOutcome.PARTIAL_SUCCESS)
    
    @property
    def description(self) -> str:
        """Human-readable description."""
        descriptions = {
            RollOutcome.CRITICAL_SUCCESS: "Critical Success! Exceptional outcome.",
            RollOutcome.SUCCESS: "Success! You achieved your goal.",
            RollOutcome.PARTIAL_SUCCESS: "Partial success. You succeeded, but with complications.",
            RollOutcome.FAILURE: "Failure. You did not achieve your goal.",
            RollOutcome.CRITICAL_FAILURE: "Critical Failure! Something went terribly wrong.",
        }
        return descriptions[self]


@dataclass
class CheckResult:
    """Complete result of a skill/ability check."""
    natural_roll: int          # What the d20 showed (1-20)
    modifier: int              # Total modifier applied
    total: int                 # natural_roll + modifier
    dc: int                    # Difficulty class to beat
    outcome: RollOutcome       # Final outcome
    margin: int                # How much above/below DC (positive = over)
    auto_resolved: bool        # True if this was auto-succeed/fail
    skill: Optional[str]       # Skill used (if any)
    ability: Optional[str]     # Ability used
    
    @property
    def is_critical(self) -> bool:
        """True if this was a natural 1 or 20."""
        return self.natural_roll in (1, 20)
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for serialization."""
        return {
            "natural_roll": self.natural_roll,
            "modifier": self.modifier,
            "total": self.total,
            "dc": self.dc,
            "outcome": self.outcome.value,
            "margin": self.margin,
            "auto_resolved": self.auto_resolved,
            "skill": self.skill,
            "ability": self.ability,
            "is_critical": self.is_critical,
        }
    
    def __str__(self) -> str:
        if self.auto_resolved:
            return f"Auto-{self.outcome.value.replace('_', ' ')} (modifier +{self.modifier} vs DC {self.dc})"
        return f"Rolled {self.natural_roll} + {self.modifier} = {self.total} vs DC {self.dc}: {self.outcome.value.replace('_', ' ').title()}"


def roll_d20() -> int:
    """Roll a d20 and return the result (1-20)."""
    return random.randint(1, 20)


def determine_outcome(
    natural_roll: int,
    total: int,
    dc: int,
    partial_threshold: int = 5
) -> RollOutcome:
    """
    Determine the outcome of a roll.
    
    Args:
        natural_roll: The raw d20 result
        total: Roll + modifiers
        dc: Difficulty class
        partial_threshold: Margin under which success is "partial"
    
    Returns:
        The RollOutcome
    """
    margin = total - dc
    
    # Critical failure always fails (unless house-ruling otherwise)
    if natural_roll == 1:
        return RollOutcome.CRITICAL_FAILURE
    
    # Critical success always succeeds
    if natural_roll == 20:
        return RollOutcome.CRITICAL_SUCCESS
    
    # Did we beat the DC?
    if total >= dc:
        # Check for partial success (beat DC but by small margin)
        if margin < partial_threshold:
            return RollOutcome.PARTIAL_SUCCESS
        return RollOutcome.SUCCESS
    
    return RollOutcome.FAILURE


def roll_check(
    modifier: int,
    dc: int,
    skill: Optional[str] = None,
    ability: Optional[str] = None,
    auto_succeed: bool = False,
    auto_fail: bool = False,
    advantage: bool = False,
    disadvantage: bool = False
) -> CheckResult:
    """
    Perform a full ability/skill check.
    
    Args:
        modifier: Total modifier to add to the roll
        dc: Difficulty class to beat
        skill: Skill being used (for logging)
        ability: Ability being used (for logging)
        auto_succeed: If True, skip roll and return success
        auto_fail: If True, skip roll and return failure
        advantage: Roll 2d20, take higher
        disadvantage: Roll 2d20, take lower
    
    Returns:
        CheckResult with full details
    """
    # Handle auto-resolution
    if auto_succeed:
        return CheckResult(
            natural_roll=20,  # Represent as nat 20
            modifier=modifier,
            total=20 + modifier,
            dc=dc,
            outcome=RollOutcome.SUCCESS,
            margin=20 + modifier - dc,
            auto_resolved=True,
            skill=skill,
            ability=ability,
        )
    
    if auto_fail:
        return CheckResult(
            natural_roll=1,  # Represent as nat 1
            modifier=modifier,
            total=1 + modifier,
            dc=dc,
            outcome=RollOutcome.FAILURE,
            margin=1 + modifier - dc,
            auto_resolved=True,
            skill=skill,
            ability=ability,
        )
    
    # Roll the dice
    if advantage or disadvantage:
        roll1 = roll_d20()
        roll2 = roll_d20()
        if advantage:
            natural_roll = max(roll1, roll2)
        else:
            natural_roll = min(roll1, roll2)
    else:
        natural_roll = roll_d20()
    
    total = natural_roll + modifier
    margin = total - dc
    outcome = determine_outcome(natural_roll, total, dc)
    
    return CheckResult(
        natural_roll=natural_roll,
        modifier=modifier,
        total=total,
        dc=dc,
        outcome=outcome,
        margin=margin,
        auto_resolved=False,
        skill=skill,
        ability=ability,
    )


def roll_contested(
    attacker_mod: int,
    defender_mod: int,
    attacker_advantage: bool = False,
    defender_advantage: bool = False
) -> tuple[CheckResult, CheckResult, bool]:
    """
    Roll a contested check (e.g., grapple, stealth vs perception).
    
    Both sides roll, highest total wins. Ties go to defender.
    
    Returns:
        (attacker_result, defender_result, attacker_wins)
    """
    # Attacker rolls
    if attacker_advantage:
        atk_roll = max(roll_d20(), roll_d20())
    else:
        atk_roll = roll_d20()
    atk_total = atk_roll + attacker_mod
    
    # Defender rolls
    if defender_advantage:
        def_roll = max(roll_d20(), roll_d20())
    else:
        def_roll = roll_d20()
    def_total = def_roll + defender_mod
    
    # Determine winner (ties go to defender)
    attacker_wins = atk_total > def_total
    
    # Create results
    attacker_result = CheckResult(
        natural_roll=atk_roll,
        modifier=attacker_mod,
        total=atk_total,
        dc=def_total,  # Defender's total is effectively the DC
        outcome=RollOutcome.SUCCESS if attacker_wins else RollOutcome.FAILURE,
        margin=atk_total - def_total,
        auto_resolved=False,
        skill=None,
        ability=None,
    )
    
    defender_result = CheckResult(
        natural_roll=def_roll,
        modifier=defender_mod,
        total=def_total,
        dc=atk_total,
        outcome=RollOutcome.SUCCESS if not attacker_wins else RollOutcome.FAILURE,
        margin=def_total - atk_total,
        auto_resolved=False,
        skill=None,
        ability=None,
    )
    
    return attacker_result, defender_result, attacker_wins


def roll_damage(dice_expr: str, modifier: int = 0) -> tuple[int, list[int]]:
    """
    Roll damage dice.
    
    Args:
        dice_expr: Dice expression like "2d6" or "1d8"
        modifier: Flat modifier to add
    
    Returns:
        (total, individual_rolls)
    """
    import re
    match = re.match(r"(\d+)d(\d+)", dice_expr.lower())
    if not match:
        return modifier, []
    
    num_dice = int(match.group(1))
    die_size = int(match.group(2))
    
    rolls = [random.randint(1, die_size) for _ in range(num_dice)]
    total = sum(rolls) + modifier
    
    return total, rolls


if __name__ == "__main__":
    # Test the dice system
    print("Testing dice system")
    print("=" * 50)
    
    # Test basic rolls
    print("\n5 basic d20 rolls:")
    for i in range(5):
        result = roll_check(modifier=5, dc=15)
        print(f"  {result}")
    
    # Test advantage
    print("\n5 rolls with advantage:")
    for i in range(5):
        result = roll_check(modifier=5, dc=15, advantage=True)
        print(f"  {result}")
    
    # Test contested
    print("\n5 contested rolls (Stealth vs Perception):")
    for i in range(5):
        atk, def_, winner = roll_contested(attacker_mod=7, defender_mod=4)
        print(f"  Stealth {atk.total} vs Perception {def_.total}: {'Stealth wins' if winner else 'Perception wins'}")
    
    # Test auto-succeed
    print("\nAuto-succeed example:")
    result = roll_check(modifier=10, dc=10, auto_succeed=True)
    print(f"  {result}")
