#!/usr/bin/env python3
"""
Loom Game Engine

Main orchestration layer for game sessions.
Handles:
- Campaign and session state management
- Session flow (narrative → choices → roll → outcome)
- State persistence (JSON files)
- Character state updates
"""

import json
from datetime import datetime, timezone
from dataclasses import dataclass, field
from typing import Dict, List, Any, Optional
from pathlib import Path
from enum import Enum
import uuid

from .difficulty import (
    DifficultyTier,
    get_relevant_modifier,
    check_auto_succeed,
    check_auto_fail,
    analyze_difficulty,
)
from .dice import roll_check, CheckResult, RollOutcome
from .dm import DungeonMaster, SessionContent, Choice


class SessionState(Enum):
    """State of a game session."""
    NARRATIVE = "narrative"      # Showing the story
    CHOICES = "choices"          # Player choosing
    ROLLING = "rolling"          # Dice being rolled
    OUTCOME = "outcome"          # Showing result
    COMPLETE = "complete"        # Session done


@dataclass
class Campaign:
    """A campaign containing multiple sessions."""
    id: str
    name: str
    world: str
    premise: str
    character_id: str
    sessions: List[str] = field(default_factory=list)  # Session IDs
    current_session: Optional[str] = None
    state: Dict[str, Any] = field(default_factory=dict)  # World state
    created_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "name": self.name,
            "world": self.world,
            "premise": self.premise,
            "character_id": self.character_id,
            "sessions": self.sessions,
            "current_session": self.current_session,
            "state": self.state,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'Campaign':
        return cls(
            id=data["id"],
            name=data["name"],
            world=data["world"],
            premise=data["premise"],
            character_id=data["character_id"],
            sessions=data.get("sessions", []),
            current_session=data.get("current_session"),
            state=data.get("state", {}),
            created_at=data.get("created_at", datetime.now(timezone.utc).isoformat()),
            updated_at=data.get("updated_at", datetime.now(timezone.utc).isoformat()),
        )
    
    def save(self, campaign_dir: Path) -> None:
        """Save campaign to JSON file."""
        campaign_dir.mkdir(parents=True, exist_ok=True)
        with open(campaign_dir / "campaign.json", "w") as f:
            json.dump(self.to_dict(), f, indent=2)
    
    @classmethod
    def load(cls, campaign_dir: Path) -> 'Campaign':
        """Load campaign from directory."""
        with open(campaign_dir / "campaign.json") as f:
            return cls.from_dict(json.load(f))


@dataclass
class Session:
    """A single game session within a campaign."""
    id: str
    campaign_id: str
    sequence: int                # Session number in campaign
    content: Optional[SessionContent] = None
    state: SessionState = SessionState.NARRATIVE
    chosen_option: Optional[int] = None
    roll_result: Optional[Dict[str, Any]] = None
    outcome_narrative: Optional[str] = None
    summary: Optional[str] = None
    created_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    completed_at: Optional[str] = None
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "campaign_id": self.campaign_id,
            "sequence": self.sequence,
            "content": self.content.to_dict() if self.content else None,
            "state": self.state.value,
            "chosen_option": self.chosen_option,
            "roll_result": self.roll_result,
            "outcome_narrative": self.outcome_narrative,
            "summary": self.summary,
            "created_at": self.created_at,
            "completed_at": self.completed_at,
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'Session':
        content = None
        if data.get("content"):
            content = SessionContent.from_dict(data["content"])
        
        return cls(
            id=data["id"],
            campaign_id=data["campaign_id"],
            sequence=data["sequence"],
            content=content,
            state=SessionState(data.get("state", "narrative")),
            chosen_option=data.get("chosen_option"),
            roll_result=data.get("roll_result"),
            outcome_narrative=data.get("outcome_narrative"),
            summary=data.get("summary"),
            created_at=data.get("created_at", datetime.now(timezone.utc).isoformat()),
            completed_at=data.get("completed_at"),
        )
    
    def save(self, campaign_dir: Path) -> None:
        """Save session to JSON file."""
        sessions_dir = campaign_dir / "sessions"
        sessions_dir.mkdir(parents=True, exist_ok=True)
        with open(sessions_dir / f"{self.id}.json", "w") as f:
            json.dump(self.to_dict(), f, indent=2)
    
    @classmethod
    def load(cls, campaign_dir: Path, session_id: str) -> 'Session':
        """Load session from file."""
        with open(campaign_dir / "sessions" / f"{session_id}.json") as f:
            return cls.from_dict(json.load(f))


class GameSession:
    """
    Main game controller.
    
    Manages the flow of a play session:
    1. Generate/load session content
    2. Present narrative and choices
    3. Handle player choice
    4. Roll dice if needed
    5. Generate outcome narrative
    6. Update state and save
    """
    
    def __init__(
        self,
        campaign_dir: Path,
        character: Dict[str, Any],
        verbose: bool = False
    ):
        """
        Initialize a game session.
        
        Args:
            campaign_dir: Path to campaign directory
            character: Player character dict
            verbose: Print debug output
        """
        self.campaign_dir = Path(campaign_dir)
        self.character = character
        self.verbose = verbose
        
        # Load or create campaign
        if (self.campaign_dir / "campaign.json").exists():
            self.campaign = Campaign.load(self.campaign_dir)
        else:
            raise FileNotFoundError(f"No campaign found at {self.campaign_dir}")
        
        # Initialize DM
        self.dm = DungeonMaster(
            campaign_context={
                "name": self.campaign.name,
                "world": self.campaign.world,
                "premise": self.campaign.premise,
            },
            verbose=verbose
        )
        
        # Load current session if any
        self.session: Optional[Session] = None
        if self.campaign.current_session:
            try:
                self.session = Session.load(self.campaign_dir, self.campaign.current_session)
            except FileNotFoundError:
                self.session = None
    
    def start_new_session(self, plot_direction: Optional[str] = None) -> Session:
        """
        Start a new game session.
        
        Args:
            plot_direction: Optional hint for story direction
        
        Returns:
            The new Session
        """
        # Get previous session summary if any
        previous = None
        if self.campaign.sessions:
            try:
                last_session = Session.load(self.campaign_dir, self.campaign.sessions[-1])
                previous = {
                    "summary": last_session.summary,
                    "outcome": last_session.outcome_narrative,
                }
            except FileNotFoundError:
                pass
        
        # Generate content from DM
        if self.verbose:
            print("Generating session content...")
        
        content = self.dm.generate_session(
            character=self.character,
            previous_session=previous,
            plot_direction=plot_direction
        )
        
        # Create session
        session_id = str(uuid.uuid4())[:8]
        sequence = len(self.campaign.sessions) + 1
        
        self.session = Session(
            id=session_id,
            campaign_id=self.campaign.id,
            sequence=sequence,
            content=content,
            state=SessionState.CHOICES,
        )
        
        # Update campaign
        self.campaign.sessions.append(session_id)
        self.campaign.current_session = session_id
        self.campaign.updated_at = datetime.now(timezone.utc).isoformat()
        
        # Save
        self.session.save(self.campaign_dir)
        self.campaign.save(self.campaign_dir)
        
        return self.session
    
    def get_choices(self) -> List[Dict[str, Any]]:
        """Get the current choices with difficulty analysis."""
        if not self.session or not self.session.content:
            return []
        
        choices = []
        for choice in self.session.content.choices:
            analysis = analyze_difficulty(
                self.character,
                choice.dc,
                skill=choice.skill,
                ability=choice.ability
            )
            
            choices.append({
                "id": choice.id,
                "text": choice.text,
                "description": choice.description,
                "difficulty": choice.difficulty,
                "dc": choice.dc,
                "skill": choice.skill,
                "ability": choice.ability,
                "your_modifier": analysis.modifier,
                "success_chance": analysis.success_chance,
                "auto_succeed": analysis.auto_succeed,
                "auto_fail": analysis.auto_fail,
                "assessment": analysis.description,
            })
        
        return choices
    
    def make_choice(self, choice_id: int) -> Dict[str, Any]:
        """
        Handle a player's choice.
        
        Args:
            choice_id: The ID of the chosen option (1-4)
        
        Returns:
            Dict with roll_result and outcome_narrative
        """
        if not self.session or not self.session.content:
            raise RuntimeError("No active session")
        
        if self.session.state != SessionState.CHOICES:
            raise RuntimeError(f"Cannot make choice in state {self.session.state}")
        
        # Find the choice
        choice = None
        for c in self.session.content.choices:
            if c.id == choice_id:
                choice = c
                break
        
        if not choice:
            raise ValueError(f"Invalid choice ID: {choice_id}")
        
        self.session.chosen_option = choice_id
        self.session.state = SessionState.ROLLING
        
        # Calculate modifier and check for auto-resolve
        modifier = get_relevant_modifier(
            self.character,
            skill=choice.skill,
            ability=choice.ability
        )
        
        auto_succeed = check_auto_succeed(modifier, choice.dc)
        auto_fail = check_auto_fail(modifier, choice.dc)
        
        # Roll the dice
        if self.verbose:
            if auto_succeed:
                print(f"Auto-succeed! Modifier +{modifier} vs DC {choice.dc}")
            elif auto_fail:
                print(f"Auto-fail. Even a nat 20 wouldn't help.")
            else:
                print(f"Rolling d20 + {modifier} vs DC {choice.dc}...")
        
        result = roll_check(
            modifier=modifier,
            dc=choice.dc,
            skill=choice.skill,
            ability=choice.ability,
            auto_succeed=auto_succeed,
            auto_fail=auto_fail,
        )
        
        self.session.roll_result = result.to_dict()
        self.session.state = SessionState.OUTCOME
        
        if self.verbose:
            print(f"Result: {result}")
        
        # Generate outcome narrative
        if self.verbose:
            print("Generating outcome narrative...")
        
        outcome = self.dm.narrate_outcome(
            character=self.character,
            choice=choice,
            roll_result=result,
            current_narrative=self.session.content.narrative
        )
        
        self.session.outcome_narrative = outcome
        self.session.state = SessionState.COMPLETE
        self.session.completed_at = datetime.now(timezone.utc).isoformat()
        
        # Generate summary for future context
        self.session.summary = self._generate_summary(choice, result)
        
        # Save
        self.session.save(self.campaign_dir)
        
        return {
            "choice": choice.to_dict(),
            "roll_result": result.to_dict(),
            "outcome_narrative": outcome,
        }
    
    def _generate_summary(self, choice: Choice, result: CheckResult) -> str:
        """Generate a prose recap summary for 'Story so far' display."""
        # Use the DM to generate a proper narrative recap
        if self.session and self.session.content and self.session.outcome_narrative:
            try:
                recap = self.dm.generate_recap_summary(
                    character=self.character,
                    session_narrative=self.session.content.narrative,
                    outcome_narrative=self.session.outcome_narrative,
                    choice_text=choice.text
                )
                return recap
            except Exception as e:
                if self.verbose:
                    print(f"  [Game] Failed to generate recap: {e}")
        
        # Fallback to simple summary if AI fails
        char_name = self.character.get("name", "The adventurer")
        outcome_word = "succeeded" if result.outcome in [RollOutcome.SUCCESS, RollOutcome.CRITICAL_SUCCESS] else "failed"
        return f"{char_name} attempted to {choice.text.lower()} and {outcome_word}."
    
    def get_narrative(self) -> str:
        """Get the current session's narrative."""
        if not self.session or not self.session.content:
            return "No active session."
        return self.session.content.narrative
    
    def get_full_story(self) -> str:
        """Get the complete story so far (narrative + outcome if any)."""
        if not self.session or not self.session.content:
            return "No active session."
        
        story = self.session.content.narrative
        if self.session.outcome_narrative:
            story += "\n\n" + self.session.outcome_narrative
        return story
    
    def get_state(self) -> Dict[str, Any]:
        """Get the current game state."""
        return {
            "campaign": self.campaign.to_dict(),
            "session": self.session.to_dict() if self.session else None,
            "character_name": self.character.get("name"),
        }


def create_campaign(
    campaign_dir: Path,
    name: str,
    world: str,
    premise: str,
    character_id: str
) -> Campaign:
    """
    Create a new campaign.
    
    Args:
        campaign_dir: Where to store the campaign
        name: Campaign name
        world: World description
        premise: Story premise
        character_id: ID of the player character
    
    Returns:
        The new Campaign
    """
    campaign_id = str(uuid.uuid4())[:8]
    
    campaign = Campaign(
        id=campaign_id,
        name=name,
        world=world,
        premise=premise,
        character_id=character_id,
    )
    
    campaign.save(campaign_dir)
    
    # Create sessions subdirectory
    (campaign_dir / "sessions").mkdir(parents=True, exist_ok=True)
    
    return campaign


if __name__ == "__main__":
    # Test the game engine
    print("Testing Game Engine")
    print("=" * 50)
    
    from pathlib import Path
    import tempfile
    
    # Create a test campaign
    with tempfile.TemporaryDirectory() as tmpdir:
        campaign_dir = Path(tmpdir) / "test_campaign"
        
        # Create campaign
        campaign = create_campaign(
            campaign_dir=campaign_dir,
            name="Test Adventure",
            world="A simple fantasy world",
            premise="A hero seeks treasure",
            character_id="test-char"
        )
        
        print(f"Created campaign: {campaign.name}")
        print(f"Directory: {campaign_dir}")
        
        # Test character
        test_character = {
            "name": "Test Hero",
            "race": "Human",
            "class": "Fighter",
            "level": 3,
            "stats": {"STR": 16, "DEX": 14, "CON": 14, "INT": 10, "WIS": 12, "CHA": 10},
            "skills": ["Athletics", "Perception", "Intimidation"],
            "traits": ["brave", "stubborn"],
            "motivation": "Glory and gold",
        }
        
        # Initialize game session
        game = GameSession(
            campaign_dir=campaign_dir,
            character=test_character,
            verbose=True
        )
        
        print("\nStarting new session...")
        session = game.start_new_session()
        
        print(f"\nNarrative:\n{game.get_narrative()[:500]}...")
        
        print("\nChoices:")
        choices = game.get_choices()
        for c in choices:
            print(f"  {c['id']}. {c['text']}")
            print(f"     DC {c['dc']} {c['skill'] or c['ability']} - {c['assessment']}")
        
        # Make a choice
        print("\nMaking choice 1...")
        result = game.make_choice(1)
        
        print(f"\nRoll: {result['roll_result']}")
        print(f"\nOutcome:\n{result['outcome_narrative']}")
