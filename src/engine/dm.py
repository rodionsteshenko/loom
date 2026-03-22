#!/usr/bin/env python3
"""
Loom AI Dungeon Master

Uses Claude CLI to generate narrative content for the game.
Handles:
- Session narrative generation
- Choice generation (4 choices per session)
- Outcome narration based on dice rolls
- NPC dialogue and behavior
- World state updates

All AI calls go through Claude CLI for cost efficiency.
"""

import json
import subprocess
import re
import time
import logging
import os
import urllib.request
import urllib.error
from dataclasses import dataclass, field
from typing import Dict, List, Any, Optional
from pathlib import Path

from .dice import CheckResult, RollOutcome

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [DM] %(levelname)s: %(message)s',
    datefmt='%H:%M:%S'
)
logger = logging.getLogger(__name__)

# OpenClaw Gateway config
OPENCLAW_URL = os.environ.get('OPENCLAW_URL', 'http://127.0.0.1:18789/v1/chat/completions')
OPENCLAW_TOKEN = os.environ.get('OPENCLAW_TOKEN', 'b2cd9c1ca38aa28f50ffc2356b827d459dac5b90d7629062')


@dataclass
class Choice:
    """A player choice in a session."""
    id: int                      # 1-4
    text: str                    # What the player sees
    skill: Optional[str]         # Skill check required (or None for narrative)
    ability: Optional[str]       # Ability check if no skill
    difficulty: str              # "trivial", "easy", "medium", "hard", "extreme"
    dc: int                      # Difficulty class
    description: str             # Brief description of what this choice entails
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "text": self.text,
            "skill": self.skill,
            "ability": self.ability,
            "difficulty": self.difficulty,
            "dc": self.dc,
            "description": self.description,
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'Choice':
        return cls(
            id=data["id"],
            text=data["text"],
            skill=data.get("skill"),
            ability=data.get("ability"),
            difficulty=data.get("difficulty", "medium"),
            dc=data.get("dc", 15),
            description=data.get("description", ""),
        )


@dataclass
class SessionContent:
    """Generated content for a game session."""
    narrative: str               # The story text
    choices: List[Choice]        # 4 player choices
    setting: str                 # Current location/scene
    npcs_present: List[str]      # NPCs in this scene
    plot_beat: Optional[str]     # Key story moment if any
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "narrative": self.narrative,
            "choices": [c.to_dict() for c in self.choices],
            "setting": self.setting,
            "npcs_present": self.npcs_present,
            "plot_beat": self.plot_beat,
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'SessionContent':
        return cls(
            narrative=data["narrative"],
            choices=[Choice.from_dict(c) for c in data["choices"]],
            setting=data.get("setting", "Unknown"),
            npcs_present=data.get("npcs_present", []),
            plot_beat=data.get("plot_beat"),
        )


class DungeonMaster:
    """AI Dungeon Master using Claude CLI."""
    
    def __init__(self, campaign_context: Dict[str, Any] = None, verbose: bool = False):
        """
        Initialize the DM.
        
        Args:
            campaign_context: Dict with campaign name, world, history, etc.
            verbose: Print debug output
        """
        self.campaign_context = campaign_context or {}
        self.verbose = verbose
        self.session_history: List[Dict[str, Any]] = []
    
    def _call_claude(self, prompt: str, system: str = None, timeout: int = 120) -> str:
        """Call OpenClaw Gateway API and return the response."""
        prompt_preview = prompt[:100].replace('\n', ' ')
        logger.info(f"OpenClaw API call starting: {prompt_preview}...")
        start_time = time.time()
        
        messages = []
        if system:
            messages.append({"role": "system", "content": system})
        messages.append({"role": "user", "content": prompt})
        
        payload = json.dumps({
            "model": "openclaw",
            "messages": messages
        }).encode('utf-8')
        
        try:
            req = urllib.request.Request(
                OPENCLAW_URL,
                data=payload,
                headers={
                    'Authorization': f'Bearer {OPENCLAW_TOKEN}',
                    'Content-Type': 'application/json',
                    'x-openclaw-agent-id': 'main'
                }
            )
            
            with urllib.request.urlopen(req, timeout=timeout) as response:
                data = json.loads(response.read().decode('utf-8'))
            
            elapsed = time.time() - start_time
            text = data.get('choices', [{}])[0].get('message', {}).get('content', '')
            logger.info(f"OpenClaw API call completed in {elapsed:.1f}s, response length: {len(text)} chars")
            
            if not text:
                raise RuntimeError("Empty response from OpenClaw API")
            
            return text.strip()
        
        except urllib.error.URLError as e:
            elapsed = time.time() - start_time
            logger.error(f"OpenClaw API error after {elapsed:.1f}s: {e}")
            raise RuntimeError(f"OpenClaw API error: {e}")
        except TimeoutError:
            elapsed = time.time() - start_time
            logger.error(f"OpenClaw API timed out after {elapsed:.1f}s (limit: {timeout}s)")
            raise RuntimeError(f"OpenClaw API timed out ({timeout}s limit)")
    
    def _extract_json(self, text: str) -> Dict:
        """Extract JSON from Claude response."""
        text = text.strip()
        
        # Remove markdown code blocks
        if "```" in text:
            # Find JSON block
            match = re.search(r'```(?:json)?\s*(\{.*?\})\s*```', text, re.DOTALL)
            if match:
                text = match.group(1)
            else:
                # Try to extract between first { and last }
                start = text.find("{")
                end = text.rfind("}") + 1
                if start != -1 and end > start:
                    text = text[start:end]
        else:
            # Just extract the JSON object
            start = text.find("{")
            end = text.rfind("}") + 1
            if start != -1 and end > start:
                text = text[start:end]
        
        return json.loads(text)
    
    def generate_session(
        self,
        character: Dict[str, Any],
        previous_session: Optional[Dict[str, Any]] = None,
        plot_direction: Optional[str] = None
    ) -> SessionContent:
        """
        Generate a new game session.
        
        Args:
            character: The player character dict
            previous_session: Summary of previous session (if any)
            plot_direction: Optional hint for story direction
        
        Returns:
            SessionContent with narrative and choices
        """
        logger.info(f"Generating session for character: {character.get('name', 'Unknown')}")
        start_time = time.time()
        
        char_summary = self._summarize_character(character)
        campaign_summary = self._summarize_campaign()
        
        prev_context = ""
        if previous_session:
            prev_context = f"""
PREVIOUS SESSION:
{previous_session.get('summary', 'No previous summary')}
Outcome: {previous_session.get('outcome', 'Unknown')}
"""
        
        plot_hint = ""
        if plot_direction:
            plot_hint = f"\nPLOT DIRECTION: {plot_direction}"
        
        prompt = f"""You are an AI Dungeon Master for a Choose Your Own Adventure RPG called Loom.

{campaign_summary}

CHARACTER:
{char_summary}
{prev_context}{plot_hint}

Generate the next story session. Output ONLY valid JSON in this exact format:
{{
  "narrative": "2-4 paragraphs of story text, immersive second-person (you)",
  "setting": "current location description",
  "npcs_present": ["NPC names in this scene"],
  "plot_beat": "key story moment if any, or null",
  "choices": [
    {{
      "id": 1,
      "text": "Short action text (what player clicks)",
      "description": "What this choice entails",
      "skill": "Skill name or null",
      "ability": "STR/DEX/CON/INT/WIS/CHA if no skill",
      "difficulty": "trivial/easy/medium/hard/extreme",
      "dc": 10
    }},
    // ... 4 total choices
  ]
}}

RULES:
1. Write immersive narrative in second person ("you")
2. Each session ends at a decision point
3. Provide exactly 4 meaningful choices
4. Choices should have varying difficulties
5. At least one choice should be skill-based, one could be pure narrative
6. Consider the character's skills when setting difficulties
7. Create tension and interesting consequences
8. NO markdown, ONLY the JSON object"""

        response = self._call_claude(prompt)
        
        try:
            data = self._extract_json(response)
            content = SessionContent.from_dict(data)
            elapsed = time.time() - start_time
            logger.info(f"Session generated successfully in {elapsed:.1f}s total")
            return content
        except (json.JSONDecodeError, KeyError) as e:
            logger.error(f"Parse error: {e}")
            logger.error(f"Response was: {response[:500]}...")
            raise RuntimeError(f"Failed to parse DM response: {e}")
    
    def narrate_outcome(
        self,
        character: Dict[str, Any],
        choice: Choice,
        roll_result: CheckResult,
        current_narrative: str
    ) -> str:
        """
        Generate narrative for a choice outcome.
        
        Args:
            character: Player character
            choice: The choice that was made
            roll_result: Result of the dice roll
            current_narrative: The current session's narrative
        
        Returns:
            Narrative text describing the outcome
        """
        char_name = character.get("name", "the adventurer")
        
        # Determine outcome tone
        outcome_type = roll_result.outcome.value
        if roll_result.outcome == RollOutcome.CRITICAL_SUCCESS:
            tone = "exceptional success with a bonus"
        elif roll_result.outcome == RollOutcome.SUCCESS:
            tone = "clean success"
        elif roll_result.outcome == RollOutcome.PARTIAL_SUCCESS:
            tone = "success but with a complication or cost"
        elif roll_result.outcome == RollOutcome.FAILURE:
            tone = "failure with consequences"
        else:  # Critical failure
            tone = "disastrous failure with serious consequences"
        
        roll_desc = ""
        if not roll_result.auto_resolved:
            roll_desc = f"\nRoll: {roll_result.natural_roll} + {roll_result.modifier} = {roll_result.total} vs DC {roll_result.dc}"
        else:
            roll_desc = f"\n(Auto-resolved: modifier +{roll_result.modifier} vs DC {roll_result.dc})"
        
        prompt = f"""You are an AI Dungeon Master. Continue the story based on the player's choice and roll.

CURRENT SCENE:
{current_narrative[:1000]}

PLAYER CHOICE:
"{choice.text}" - {choice.description}

ROLL RESULT:
{roll_desc}
Outcome: {outcome_type.replace('_', ' ').title()} ({tone})

CHARACTER: {char_name}

Write 1-2 paragraphs describing what happens. Be vivid and specific.
- For success: describe how they succeed
- For partial: describe success but add a complication
- For failure: describe what goes wrong
- For criticals: make it memorable

Write ONLY the narrative, no JSON, no labels. Second person ("you")."""

        logger.info(f"Narrating outcome: {outcome_type} for choice '{choice.text[:30]}...'")
        return self._call_claude(prompt)
    
    def generate_recap_summary(
        self,
        character: Dict[str, Any],
        session_narrative: str,
        outcome_narrative: str,
        choice_text: str
    ) -> str:
        """
        Generate a 2-3 sentence recap summary for "Story so far" display.
        Written as prose that catches up a returning player.
        
        Args:
            character: Player character
            session_narrative: The scene narrative
            outcome_narrative: What happened after the choice
            choice_text: What the player chose to do
        
        Returns:
            A brief prose summary suitable for "Previously on..." recap
        """
        char_name = character.get("name", "the adventurer")
        
        prompt = f"""Write a 2-3 sentence recap summary of this scene for someone returning to the game.
Write it as natural prose, not a game log. Use third person for the character.
Focus on: what happened, what was discovered, and what changed.

CHARACTER: {char_name}

THE SCENE:
{session_narrative[:800]}

WHAT THEY DID:
{choice_text}

WHAT HAPPENED:
{outcome_narrative[:800]}

Write ONLY the recap summary. Natural prose, 2-3 sentences. Example format:
"{char_name} discovered that the device had been modified with strange crystalline filaments. After examining it closely, they learned it had become a receiver tuned to unknown frequencies—and the Guild would kill to possess this knowledge."

Your summary:"""

        return self._call_claude(prompt)
    
    def generate_npc_dialogue(
        self,
        npc: Dict[str, Any],
        character: Dict[str, Any],
        context: str,
        player_says: str
    ) -> str:
        """
        Generate NPC dialogue response.
        
        Args:
            npc: NPC character dict (can be minimal)
            character: Player character
            context: Current scene/situation
            player_says: What the player said
        
        Returns:
            NPC's dialogue response
        """
        npc_name = npc.get("name", "the stranger")
        npc_voice = npc.get("voice", "speaks normally")
        npc_traits = npc.get("traits", [])
        
        prompt = f"""Generate dialogue for an NPC.

NPC: {npc_name}
Voice: {npc_voice}
Traits: {', '.join(npc_traits) if npc_traits else 'Unknown'}

CONTEXT: {context[:500]}

PLAYER SAYS: "{player_says}"

Write ONLY the NPC's response. Stay in character. 1-3 sentences.
Do not include quotation marks or the NPC's name prefix."""

        return self._call_claude(prompt)
    
    def _summarize_character(self, character: Dict[str, Any]) -> str:
        """Create a summary of a character for prompts."""
        name = character.get("name", "Unknown")
        race = character.get("race", "Unknown")
        char_class = character.get("class", "Unknown")
        level = character.get("level", 1)
        
        skills = character.get("skills", [])
        skills_str = ", ".join(skills[:5]) if skills else "None"
        
        traits = character.get("traits", [])
        traits_str = ", ".join(traits[:3]) if traits else "Unknown"
        
        motivation = character.get("motivation", "Unknown motivation")
        
        return f"""Name: {name}
Race/Class: {race} {char_class} (Level {level})
Skills: {skills_str}
Traits: {traits_str}
Motivation: {motivation[:200] if len(motivation) > 200 else motivation}"""
    
    def _summarize_campaign(self) -> str:
        """Create a summary of the campaign context."""
        if not self.campaign_context:
            return "CAMPAIGN: Generic fantasy adventure"
        
        name = self.campaign_context.get("name", "Untitled Campaign")
        world = self.campaign_context.get("world", "A fantasy world")
        premise = self.campaign_context.get("premise", "An adventure awaits")
        
        return f"""CAMPAIGN: {name}
WORLD: {world}
PREMISE: {premise}"""
    
    def record_session(self, session_summary: Dict[str, Any]) -> None:
        """Record a session in history for context."""
        self.session_history.append(session_summary)
        # Keep only last 5 sessions for context window
        if len(self.session_history) > 5:
            self.session_history = self.session_history[-5:]


if __name__ == "__main__":
    # Test the DM
    print("Testing AI Dungeon Master")
    print("=" * 50)
    
    test_character = {
        "name": "Malachar Voss",
        "race": "Tiefling",
        "class": "Warlock",
        "level": 7,
        "skills": ["Deception", "Persuasion", "Arcana", "Insight"],
        "traits": ["calculating", "charismatic", "self-reliant"],
        "motivation": "To amass enough power to become untouchable",
    }
    
    campaign = {
        "name": "The Crimson Pact",
        "world": "A dark fantasy world where devils walk among mortals",
        "premise": "Malachar seeks the Libram of Infernal Contracts to free himself from his patron",
    }
    
    dm = DungeonMaster(campaign_context=campaign, verbose=True)
    
    print("\nGenerating session...")
    try:
        session = dm.generate_session(test_character)
        print(f"\nNarrative:\n{session.narrative[:500]}...")
        print(f"\nSetting: {session.setting}")
        print(f"\nChoices:")
        for choice in session.choices:
            print(f"  {choice.id}. {choice.text} (DC {choice.dc} {choice.skill or choice.ability})")
    except Exception as e:
        print(f"Error: {e}")
