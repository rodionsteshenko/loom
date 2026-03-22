#!/usr/bin/env python3
"""
Loom Game CLI

Main interface for playing Loom - Choose Your Own Adventure RPG.

Usage:
    # Create a new campaign
    python play.py new --name "The Crimson Pact" --character malachar_voss_d7f3a2c1.json
    
    # Start or continue playing
    python play.py play --campaign campaigns/the_crimson_pact
    
    # List campaigns
    python play.py list
    
    # Show campaign status
    python play.py status --campaign campaigns/the_crimson_pact
"""

import argparse
import json
import sys
import re
from pathlib import Path
from typing import Optional

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from engine.game import GameSession, create_campaign, Campaign, Session
from engine.dice import RollOutcome


def load_character(path: Path) -> dict:
    """Load a character from JSON file."""
    with open(path) as f:
        return json.load(f)


def slugify(text: str) -> str:
    """Convert text to a valid directory name."""
    text = text.lower()
    text = re.sub(r'[^a-z0-9\s-]', '', text)
    text = re.sub(r'[\s-]+', '_', text)
    return text.strip('_')


def print_narrative(text: str, width: int = 80) -> None:
    """Print narrative text with word wrapping."""
    import textwrap
    wrapped = textwrap.fill(text, width=width)
    print(wrapped)


def print_choices(choices: list) -> None:
    """Print choices with difficulty indicators."""
    print("\n" + "=" * 60)
    print("WHAT DO YOU DO?")
    print("=" * 60)
    
    for c in choices:
        # Difficulty indicator
        if c['auto_succeed']:
            diff_indicator = "✓ TRIVIAL"
        elif c['auto_fail']:
            diff_indicator = "✗ IMPOSSIBLE"
        elif c['success_chance'] >= 80:
            diff_indicator = "◆ Easy"
        elif c['success_chance'] >= 60:
            diff_indicator = "◆◆ Medium"
        elif c['success_chance'] >= 40:
            diff_indicator = "◆◆◆ Hard"
        else:
            diff_indicator = "◆◆◆◆ Very Hard"
        
        skill_str = c['skill'] or c['ability'] or "Narrative"
        
        print(f"\n  [{c['id']}] {c['text']}")
        print(f"      {c['description']}")
        print(f"      {skill_str} DC {c['dc']} | {diff_indicator} ({c['success_chance']:.0f}%)")


def print_roll_result(result: dict) -> None:
    """Print the dice roll result."""
    print("\n" + "-" * 40)
    
    if result['auto_resolved']:
        if result['outcome'] in ['success', 'critical_success']:
            print("AUTO-SUCCESS! This was trivial for you.")
        else:
            print("AUTO-FAIL. This was beyond your capabilities.")
    else:
        nat = result['natural_roll']
        mod = result['modifier']
        total = result['total']
        dc = result['dc']
        
        # Dramatic roll reveal
        if nat == 20:
            print("🎲 NATURAL 20! 🎲")
        elif nat == 1:
            print("🎲 NATURAL 1... 🎲")
        else:
            print(f"🎲 Rolled: {nat}")
        
        print(f"   {nat} + {mod} = {total} vs DC {dc}")
        
        outcome = result['outcome'].replace('_', ' ').upper()
        margin = result['margin']
        
        if margin > 0:
            print(f"   {outcome} (beat DC by {margin})")
        elif margin < 0:
            print(f"   {outcome} (missed DC by {abs(margin)})")
        else:
            print(f"   {outcome} (exactly DC)")
    
    print("-" * 40)


def find_character_by_id(char_id: str) -> Optional[Path]:
    """Find a character file by ID."""
    chars_dir = Path("characters")
    if not chars_dir.exists():
        return None
    
    for f in chars_dir.glob("*.json"):
        try:
            with open(f) as fp:
                data = json.load(fp)
                if data.get('id') == char_id:
                    return f
        except:
            continue
    return None


def cmd_new(args):
    """Create a new campaign."""
    # Load character - by ID or by path
    char_path = None
    
    if Path(args.character).exists():
        char_path = Path(args.character)
    else:
        # Try in characters directory
        char_path = Path("characters") / args.character
        if not char_path.exists():
            # Try finding by ID
            char_path = find_character_by_id(args.character)
    
    if not char_path or not char_path.exists():
        if args.json:
            print(json.dumps({"error": f"Character not found: {args.character}"}))
        else:
            print(f"Error: Character file not found: {args.character}")
        sys.exit(1)
    
    character = load_character(char_path)
    
    # Determine campaign directory
    if args.output:
        campaign_dir = Path(args.output)
    else:
        campaign_dir = Path("campaigns") / slugify(args.name)
    
    if campaign_dir.exists():
        if args.json:
            print(json.dumps({"error": f"Campaign already exists: {campaign_dir}"}))
        else:
            print(f"Error: Campaign directory already exists: {campaign_dir}")
        sys.exit(1)
    
    # Get world and premise
    world = args.world or (input("Describe the world: ") if not args.json else "")
    premise = args.premise or (input("What's the story premise? ") if not args.json else "")
    
    if not world or not premise:
        if args.json:
            print(json.dumps({"error": "world and premise are required"}))
        sys.exit(1)
    
    # Create campaign
    campaign = create_campaign(
        campaign_dir=campaign_dir,
        name=args.name,
        world=world,
        premise=premise,
        character_id=character.get('id', 'unknown')
    )
    
    if args.json:
        print(json.dumps(campaign.to_dict()))
    else:
        print(f"\n✅ Campaign created: {campaign.name}")
        print(f"   Directory: {campaign_dir}")
        print(f"   Character: {character.get('name', 'Unknown')}")
        print(f"\nTo play, run:")
        print(f"   python play.py play --campaign {campaign_dir} --character {char_path}")


def cmd_play(args):
    """Start or continue playing a campaign."""
    campaign_dir = Path(args.campaign)
    if not campaign_dir.exists():
        print(f"Error: Campaign not found: {campaign_dir}")
        sys.exit(1)
    
    # Load character
    char_path = Path(args.character)
    if not char_path.exists():
        char_path = Path("characters") / args.character
        if not char_path.exists():
            print(f"Error: Character file not found: {args.character}")
            sys.exit(1)
    
    character = load_character(char_path)
    
    # Initialize game
    game = GameSession(
        campaign_dir=campaign_dir,
        character=character,
        verbose=args.verbose
    )
    
    print(f"\n{'='*60}")
    print(f"  LOOM - {game.campaign.name}")
    print(f"  Playing as: {character.get('name', 'Unknown')}")
    print(f"{'='*60}")
    
    # Main game loop
    while True:
        # Check if we need a new session
        if not game.session or game.session.state.value == 'complete':
            print("\n[Starting new session...]")
            try:
                game.start_new_session()
            except Exception as e:
                print(f"Error generating session: {e}")
                if args.verbose:
                    import traceback
                    traceback.print_exc()
                break
        
        # Show narrative
        print("\n")
        print_narrative(game.get_narrative())
        
        # Show choices
        choices = game.get_choices()
        print_choices(choices)
        
        # Get player input
        while True:
            try:
                choice_input = input("\nEnter choice (1-4) or 'q' to quit: ").strip()
                
                if choice_input.lower() == 'q':
                    print("\nSaving and exiting...")
                    return
                
                choice_id = int(choice_input)
                if 1 <= choice_id <= 4:
                    break
                else:
                    print("Please enter 1, 2, 3, or 4")
            except ValueError:
                print("Please enter a number (1-4) or 'q' to quit")
        
        # Make the choice
        try:
            result = game.make_choice(choice_id)
        except Exception as e:
            print(f"Error processing choice: {e}")
            if args.verbose:
                import traceback
                traceback.print_exc()
            break
        
        # Show roll result
        print_roll_result(result['roll_result'])
        
        # Show outcome
        print("\n")
        print_narrative(result['outcome_narrative'])
        
        # Prompt to continue
        input("\n[Press Enter to continue...]")


def cmd_list(args):
    """List all campaigns."""
    campaigns_dir = Path("campaigns")
    if not campaigns_dir.exists():
        print("No campaigns directory found.")
        return
    
    campaigns = []
    for path in campaigns_dir.iterdir():
        if path.is_dir() and (path / "campaign.json").exists():
            try:
                campaign = Campaign.load(path)
                campaigns.append((path, campaign))
            except Exception:
                continue
    
    if not campaigns:
        print("No campaigns found.")
        return
    
    print("\nAvailable Campaigns:")
    print("=" * 60)
    
    for path, campaign in campaigns:
        session_count = len(campaign.sessions)
        print(f"\n  {campaign.name}")
        print(f"  Path: {path}")
        print(f"  Sessions: {session_count}")
        print(f"  Character: {campaign.character_id}")


def cmd_status(args):
    """Show campaign status."""
    campaign_dir = Path(args.campaign)
    if not campaign_dir.exists():
        print(f"Error: Campaign not found: {campaign_dir}")
        sys.exit(1)
    
    campaign = Campaign.load(campaign_dir)
    
    print(f"\n{'='*60}")
    print(f"  Campaign: {campaign.name}")
    print(f"{'='*60}")
    print(f"\n  World: {campaign.world[:100]}...")
    print(f"  Premise: {campaign.premise[:100]}...")
    print(f"  Character ID: {campaign.character_id}")
    print(f"  Sessions played: {len(campaign.sessions)}")
    
    if campaign.current_session:
        try:
            session = Session.load(campaign_dir, campaign.current_session)
            print(f"\n  Current Session: #{session.sequence}")
            print(f"  State: {session.state.value}")
            if session.summary:
                print(f"  Last action: {session.summary}")
        except FileNotFoundError:
            print(f"  Current session not found: {campaign.current_session}")
    
    print()


def cmd_session(args):
    """Start a new session (for web API)."""
    campaign_dir = Path(args.campaign)
    if not campaign_dir.exists():
        if args.json:
            print(json.dumps({"error": f"Campaign not found: {campaign_dir}"}))
        else:
            print(f"Error: Campaign not found: {campaign_dir}")
        sys.exit(1)
    
    # Load character
    char_path = Path(args.character)
    if not char_path.exists():
        char_path = Path("characters") / args.character
        if not char_path.exists():
            if args.json:
                print(json.dumps({"error": f"Character not found: {args.character}"}))
            else:
                print(f"Error: Character file not found: {args.character}")
            sys.exit(1)
    
    character = load_character(char_path)
    
    # Initialize game
    game = GameSession(
        campaign_dir=campaign_dir,
        character=character,
        verbose=not args.json
    )
    
    # Start new session
    try:
        session = game.start_new_session()
        
        if args.json:
            # Return session with choices analyzed
            choices = game.get_choices()
            result = {
                "session": session.to_dict(),
                "choices": choices,
                "narrative": game.get_narrative()
            }
            print(json.dumps(result))
        else:
            print(f"Session {session.sequence} started!")
            print_narrative(game.get_narrative())
            print_choices(game.get_choices())
    except Exception as e:
        if args.json:
            print(json.dumps({"error": str(e)}))
        else:
            print(f"Error: {e}")
        sys.exit(1)


def cmd_choice(args):
    """Make a choice (for web API)."""
    campaign_dir = Path(args.campaign)
    if not campaign_dir.exists():
        if args.json:
            print(json.dumps({"error": f"Campaign not found: {campaign_dir}"}))
        else:
            print(f"Error: Campaign not found: {campaign_dir}")
        sys.exit(1)
    
    # Load character
    char_path = Path(args.character)
    if not char_path.exists():
        char_path = Path("characters") / args.character
        if not char_path.exists():
            if args.json:
                print(json.dumps({"error": f"Character not found: {args.character}"}))
            else:
                print(f"Error: Character file not found: {args.character}")
            sys.exit(1)
    
    character = load_character(char_path)
    
    # Initialize game
    game = GameSession(
        campaign_dir=campaign_dir,
        character=character,
        verbose=not args.json
    )
    
    if not game.session:
        if args.json:
            print(json.dumps({"error": "No active session"}))
        else:
            print("Error: No active session")
        sys.exit(1)
    
    # Make choice
    try:
        result = game.make_choice(int(args.choice))
        
        if args.json:
            print(json.dumps(result))
        else:
            print_roll_result(result['roll_result'])
            print_narrative(result['outcome_narrative'])
    except Exception as e:
        if args.json:
            print(json.dumps({"error": str(e)}))
        else:
            print(f"Error: {e}")
        sys.exit(1)


def cmd_test(args):
    """Run a quick test of the game engine."""
    import tempfile
    
    print("Running game engine test...")
    print("=" * 50)
    
    # Create temp campaign
    with tempfile.TemporaryDirectory() as tmpdir:
        campaign_dir = Path(tmpdir) / "test_campaign"
        
        # Create campaign
        campaign = create_campaign(
            campaign_dir=campaign_dir,
            name="Test Adventure",
            world="A dark forest full of mystery",
            premise="You seek the lost artifact of the ancients",
            character_id="test"
        )
        
        print(f"✓ Created campaign: {campaign.name}")
        
        # Test character
        test_character = {
            "name": "Test Hero",
            "race": "Human",
            "class": "Rogue",
            "level": 5,
            "stats": {"STR": 10, "DEX": 18, "CON": 12, "INT": 14, "WIS": 12, "CHA": 10},
            "skills": ["Stealth", "Acrobatics", "Perception", "Investigation"],
            "traits": ["cunning", "cautious"],
            "motivation": "To find the artifact",
        }
        
        # Initialize game
        game = GameSession(
            campaign_dir=campaign_dir,
            character=test_character,
            verbose=args.verbose
        )
        
        print("✓ Initialized game session")
        
        # Generate session
        print("\n[Generating session with AI DM...]")
        session = game.start_new_session()
        
        print(f"✓ Session generated")
        print(f"\nNarrative preview:")
        print("-" * 40)
        print(game.get_narrative()[:300] + "...")
        
        print(f"\nChoices:")
        choices = game.get_choices()
        for c in choices:
            print(f"  [{c['id']}] {c['text']} (DC {c['dc']} - {c['success_chance']:.0f}%)")
        
        # Make a choice
        print("\n[Making choice 1...]")
        result = game.make_choice(1)
        
        print(f"✓ Choice processed")
        print(f"\nRoll: {result['roll_result']['natural_roll']} + {result['roll_result']['modifier']} = {result['roll_result']['total']}")
        print(f"Outcome: {result['roll_result']['outcome']}")
        print(f"\nOutcome preview:")
        print("-" * 40)
        print(result['outcome_narrative'][:300] + "..." if len(result['outcome_narrative']) > 300 else result['outcome_narrative'])
        
        print("\n" + "=" * 50)
        print("✓ All tests passed!")


def main():
    parser = argparse.ArgumentParser(
        description="Loom - Choose Your Own Adventure RPG",
        formatter_class=argparse.RawDescriptionHelpFormatter
    )
    
    subparsers = parser.add_subparsers(dest="command", help="Commands")
    
    # new command
    new_parser = subparsers.add_parser("new", help="Create a new campaign")
    new_parser.add_argument("--name", "-n", required=True, help="Campaign name")
    new_parser.add_argument("--character", "-c", required=True, help="Character JSON file or ID")
    new_parser.add_argument("--world", "-w", help="World description")
    new_parser.add_argument("--premise", "-p", help="Story premise")
    new_parser.add_argument("--output", "-o", help="Campaign directory path")
    new_parser.add_argument("--json", action="store_true", help="Output JSON")
    
    # play command
    play_parser = subparsers.add_parser("play", help="Play a campaign")
    play_parser.add_argument("--campaign", "-C", required=True, help="Campaign directory")
    play_parser.add_argument("--character", "-c", required=True, help="Character JSON file")
    play_parser.add_argument("--verbose", "-v", action="store_true", help="Verbose output")
    
    # list command
    list_parser = subparsers.add_parser("list", help="List campaigns")
    
    # status command
    status_parser = subparsers.add_parser("status", help="Show campaign status")
    status_parser.add_argument("--campaign", "-C", required=True, help="Campaign directory")
    
    # test command
    test_parser = subparsers.add_parser("test", help="Run engine tests")
    test_parser.add_argument("--verbose", "-v", action="store_true", help="Verbose output")
    
    # session command (for web API)
    session_parser = subparsers.add_parser("session", help="Start a new session")
    session_parser.add_argument("--campaign", "-C", required=True, help="Campaign directory")
    session_parser.add_argument("--character", "-c", required=True, help="Character JSON file")
    session_parser.add_argument("--json", action="store_true", help="Output JSON")
    
    # choice command (for web API)
    choice_parser = subparsers.add_parser("choice", help="Make a choice")
    choice_parser.add_argument("--campaign", "-C", required=True, help="Campaign directory")
    choice_parser.add_argument("--character", "-c", required=True, help="Character JSON file")
    choice_parser.add_argument("--choice", required=True, help="Choice ID (1-4)")
    choice_parser.add_argument("--json", action="store_true", help="Output JSON")
    
    args = parser.parse_args()
    
    if not args.command:
        parser.print_help()
        sys.exit(1)
    
    if args.command == "new":
        cmd_new(args)
    elif args.command == "play":
        cmd_play(args)
    elif args.command == "list":
        cmd_list(args)
    elif args.command == "status":
        cmd_status(args)
    elif args.command == "test":
        cmd_test(args)
    elif args.command == "session":
        cmd_session(args)
    elif args.command == "choice":
        cmd_choice(args)


if __name__ == "__main__":
    main()
