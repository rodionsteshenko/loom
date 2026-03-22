#!/usr/bin/env python3
"""
Loom Character Creator

Creates a complete character from a minimal prompt using Claude CLI.
Schema is embedded in the system prompt (passive context).
Validation runs automatically after generation.

Usage:
    python create_character.py "a goblin who thinks she's a princess"
    python create_character.py "an old wizard" --level 10 --output ./characters/
"""

import json
import sys
import os
import re
import argparse
import subprocess
import tempfile
from pathlib import Path
from datetime import datetime, timezone

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))
from validators.character_validator import validate_character

# Condensed schema for system prompt (fits in CLI)
SCHEMA_PROMPT = """You are a character creator for Loom, a D&D RPG.

SCHEMA (72 fields):
Required: name, type(pc/npc), physical_description(200+ chars), backstory(300+ chars), stats{STR,DEX,CON,INT,WIS,CHA}, race, class, level(1-20), alignment

Prose fields (min lengths): physical_description:200, backstory:300, childhood:150, voice:100, mannerisms:100, motivation:100, wound:100

All fields: id, name, type, player_id | physical_description, height, weight, image_url | voice, mannerisms | origin, backstory, childhood, parents[], siblings[], key_people[] | motivation, want, need, wound, lie_they_believe, fear, arc_direction(positive/negative/flat/ambiguous) | traits[], values[], flaws[], secrets[], archetype | stats{}, race, class, subclass, level, experience_points, background, alignment, birthday, languages[] | skills[], tool_proficiencies[], weapon_proficiencies[], armor_proficiencies[], feats[] | hp{current,max}, temp_hp, armor_class, movement_speed, initiative_bonus, saving_throws{}, hit_dice{}, death_saves{}, inspiration, resistances[], immunities[], vulnerabilities[] | spell_slots{}, mana{}, spells_known[] | currency{gp,sp,cp}, inventory[] | ailments[], exhaustion_level, knowledge[], current_location, abilities[] | relationships[], reputation{} | is_alive, created_at, updated_at

Array structures: parents/siblings{name,relationship,alive,notes}, key_people{name,relationship,role_in_life,alive,notes}, relationships{character_id,name,type,description,trust_level(1-10),notes}

Alignments: lawful_good, neutral_good, chaotic_good, lawful_neutral, true_neutral, chaotic_neutral, lawful_evil, neutral_evil, chaotic_evil

Archetypes: Innocent, Orphan, Hero, Caregiver, Explorer, Rebel, Lover, Creator, Jester, Sage, Magician, Ruler

RULES:
1. Output ONLY valid JSON - no markdown, no explanation
2. No extra fields beyond the schema
3. All prose fields must meet minimum character lengths
4. Be creative - add depth beyond user's prompt
5. Connect wound, lie_they_believe, want, need for narrative tension
6. Fill reasonable D&D stats based on class/level"""

def extract_json(text: str) -> dict:
    """Extract JSON from response, handling markdown code blocks."""
    text = text.strip()
    
    # Remove markdown code blocks if present
    if text.startswith("```"):
        first_newline = text.find("\n")
        if first_newline != -1:
            text = text[first_newline + 1:]
        if text.rstrip().endswith("```"):
            text = text.rstrip()[:-3].rstrip()
    
    # Try to find JSON object
    start = text.find("{")
    end = text.rfind("}") + 1
    if start != -1 and end > start:
        text = text[start:end]
    
    return json.loads(text)

def call_claude(prompt: str, verbose: bool = False) -> str:
    """Call Claude CLI and return the response."""
    
    full_prompt = f"{SCHEMA_PROMPT}\n\nCreate a character: {prompt}"
    
    cmd = [
        "claude",
        "-p", full_prompt,
        "--output-format", "text",
        "--dangerously-skip-permissions"
    ]
    
    if verbose:
        print(f"  Calling Claude...")
    
    result = subprocess.run(
        cmd,
        capture_output=True,
        text=True,
        timeout=120
    )
    
    if result.returncode != 0:
        raise RuntimeError(f"Claude CLI error: {result.stderr}")
    
    return result.stdout

def generate_character(
    prompt: str,
    level: int = None,
    character_class: str = None,
    race: str = None,
    max_retries: int = 3,
    verbose: bool = False
) -> dict:
    """Generate a character from a prompt using Claude."""
    
    # Build user message with any overrides
    full_prompt = prompt
    if level:
        full_prompt += f" (Level {level})"
    if character_class:
        full_prompt += f" (Class: {character_class})"
    if race:
        full_prompt += f" (Race: {race})"
    
    for attempt in range(max_retries):
        if verbose:
            print(f"Attempt {attempt + 1}/{max_retries}...")
        
        try:
            response_text = call_claude(full_prompt, verbose)
        except Exception as e:
            if verbose:
                print(f"  Claude error: {e}")
            continue
        
        # Parse JSON
        try:
            character = extract_json(response_text)
        except json.JSONDecodeError as e:
            if verbose:
                print(f"  JSON parse error: {e}")
            full_prompt = f"{prompt}\n\n(Previous attempt had invalid JSON. Output ONLY valid JSON, no markdown.)"
            continue
        
        # Validate
        result = validate_character(character)
        
        if result["valid"]:
            if verbose:
                print("  ✅ Character valid!")
            return result["character"]
        
        # Feed errors back for correction
        if verbose:
            print(f"  ❌ Validation failed: {len(result['errors'])} errors")
            for err in result["errors"][:3]:
                print(f"     • {err['field']}: {err['message']}")
        
        error_list = "; ".join(f"{e['field']}: {e['message']}" for e in result["errors"][:5])
        full_prompt = f"{prompt}\n\n(Fix: {error_list})"
    
    raise RuntimeError(f"Failed to generate valid character after {max_retries} attempts")

def generate_portrait(character: dict, output_dir: Path, verbose: bool = False) -> str:
    """Generate a portrait image using nano-banana-pro."""
    
    physical_desc = character.get("physical_description", "")
    name = character.get("name", "character")
    race = character.get("race", "")
    char_class = character.get("class", "")
    
    prompt = f"Fantasy character portrait, detailed digital art: {race} {char_class}. {physical_desc[:500]}"
    
    safe_name = re.sub(r'[^a-zA-Z0-9_-]', '_', name.lower())
    output_path = output_dir / f"{safe_name}_portrait.png"
    
    script_path = "/opt/homebrew/lib/node_modules/openclaw/skills/nano-banana-pro/scripts/generate_image.py"
    
    if verbose:
        print(f"Generating portrait for {name}...")
    
    try:
        result = subprocess.run(
            ["uv", "run", script_path, "--prompt", prompt, "--output", str(output_path), "--aspect", "1:1"],
            capture_output=True,
            text=True,
            timeout=60
        )
        
        if result.returncode == 0 and output_path.exists():
            if verbose:
                print(f"  Portrait saved: {output_path}")
            return str(output_path)
    except Exception as e:
        if verbose:
            print(f"  Portrait error: {e}")
    
    return None

def save_character(character: dict, output_dir: Path, verbose: bool = False) -> Path:
    """Save character to JSON file."""
    name = character.get("name", "character")
    safe_name = re.sub(r'[^a-zA-Z0-9_-]', '_', name.lower())
    char_id = character.get("id", "unknown")[:8]
    
    filename = f"{safe_name}_{char_id}.json"
    output_path = output_dir / filename
    
    with open(output_path, "w") as f:
        json.dump(character, f, indent=2)
    
    if verbose:
        print(f"Character saved: {output_path}")
    
    return output_path

def main():
    parser = argparse.ArgumentParser(description="Create a Loom character from a prompt")
    parser.add_argument("prompt", help="Character concept")
    parser.add_argument("--level", "-l", type=int, help="Character level (1-20)")
    parser.add_argument("--class", "-c", dest="character_class", help="Character class")
    parser.add_argument("--race", "-r", help="Character race")
    parser.add_argument("--output", "-o", type=Path, default=Path("./characters"), help="Output directory")
    parser.add_argument("--no-portrait", action="store_true", help="Skip portrait generation")
    parser.add_argument("--verbose", "-v", action="store_true", help="Verbose output")
    parser.add_argument("--json", action="store_true", help="Output JSON to stdout")
    
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    
    try:
        if args.verbose:
            print(f"Creating character: {args.prompt}")
        
        character = generate_character(
            prompt=args.prompt,
            level=args.level,
            character_class=args.character_class,
            race=args.race,
            verbose=args.verbose
        )
        
        if not args.no_portrait:
            portrait_path = generate_portrait(character, args.output, verbose=args.verbose)
            if portrait_path:
                character["image_url"] = portrait_path
        
        output_path = save_character(character, args.output, verbose=args.verbose)
        
        if args.json:
            print(json.dumps(character, indent=2))
        else:
            print(f"\n✅ Created: {character['name']}")
            print(f"   Race: {character.get('race', 'unknown')}")
            print(f"   Class: {character.get('class', 'unknown')}")
            print(f"   Level: {character.get('level', 1)}")
            print(f"   File: {output_path}")
            if character.get("image_url"):
                print(f"   Portrait: {character['image_url']}")
    
    except Exception as e:
        print(f"Error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
