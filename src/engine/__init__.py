# Loom Game Engine
"""
Core game engine for Loom - Choose Your Own Adventure RPG.

Components:
- difficulty: DC calculation and auto-succeed thresholds
- dice: d20 roll mechanics with modifiers
- dm: AI Dungeon Master using Claude CLI
- game: Session orchestration and state management
"""

from .difficulty import DifficultyTier, calculate_dc, check_auto_succeed, get_relevant_modifier
from .dice import roll_d20, roll_check, CheckResult
from .dm import DungeonMaster
from .game import GameSession, SessionState

__all__ = [
    'DifficultyTier',
    'calculate_dc', 
    'check_auto_succeed',
    'get_relevant_modifier',
    'roll_d20',
    'roll_check', 
    'CheckResult',
    'DungeonMaster',
    'GameSession',
    'SessionState',
]
