#!/usr/bin/env python3
"""
Loom Character Validator

Validates character JSON against the Loom schema.
Can be used as CLI tool or imported as a module.

Usage:
    python character_validator.py <character.json>
    python character_validator.py --stdin < character.json
"""

import json
import sys
import uuid
from pathlib import Path
from datetime import datetime, timezone
from typing import Any

try:
    import jsonschema
    from jsonschema import Draft7Validator, ValidationError
except ImportError:
    print("Error: jsonschema not installed. Run: pip install jsonschema")
    sys.exit(1)


# Prose field minimum lengths
PROSE_MINIMUMS = {
    "physical_description": 200,
    "backstory": 300,
    "childhood": 150,
    "voice": 100,
    "mannerisms": 100,
    "motivation": 100,
    "wound": 100,
}

# Required fields
REQUIRED_FIELDS = [
    "name",
    "type",
    "physical_description",
    "backstory",
    "stats",
    "race",
    "class",
    "level",
    "alignment",
]

# Default values for optional fields
DEFAULTS = {
    "level": 1,
    "experience_points": 0,
    "temp_hp": 0,
    "movement_speed": 30,
    "inspiration": False,
    "exhaustion_level": 0,
    "is_alive": True,
    "currency": {"gp": 0, "sp": 0, "cp": 0},
    "death_saves": {"successes": 0, "failures": 0},
}


def load_schema() -> dict:
    """Load the character JSON schema."""
    schema_path = Path(__file__).parent.parent / "schemas" / "character.json"
    if not schema_path.exists():
        raise FileNotFoundError(f"Schema not found: {schema_path}")
    
    with open(schema_path) as f:
        return json.load(f)


def validate_character(character: dict) -> dict:
    """
    Validate a character against the Loom schema.
    
    Returns:
        {
            "valid": bool,
            "errors": [...],
            "warnings": [...],
            "character": <character with defaults applied>
        }
    """
    errors = []
    warnings = []
    
    # Load schema
    try:
        schema = load_schema()
    except FileNotFoundError as e:
        return {
            "valid": False,
            "errors": [{"field": "_schema", "error": "schema_not_found", "message": str(e)}],
            "warnings": [],
            "character": character,
        }
    
    # Check for extra fields (schema has additionalProperties: false)
    allowed_fields = set(schema.get("properties", {}).keys())
    actual_fields = set(character.keys())
    extra_fields = actual_fields - allowed_fields
    
    for field in extra_fields:
        errors.append({
            "field": field,
            "error": "unexpected_field",
            "message": f"Field '{field}' is not in the schema and will be ignored",
        })
    
    # Auto-generate ID if missing
    if "id" not in character or not character["id"]:
        character["id"] = str(uuid.uuid4())
    
    # Apply defaults
    for field, default in DEFAULTS.items():
        if field not in character:
            character[field] = default
    
    # Add timestamps
    now = datetime.now(timezone.utc).isoformat()
    if "created_at" not in character:
        character["created_at"] = now
    character["updated_at"] = now
    
    # JSON Schema validation
    validator = Draft7Validator(schema)
    for error in validator.iter_errors(character):
        # Get the field path
        path = ".".join(str(p) for p in error.absolute_path) if error.absolute_path else "_root"
        
        errors.append({
            "field": path,
            "error": "schema_violation",
            "message": error.message,
        })
    
    # Check prose field minimums
    for field, min_length in PROSE_MINIMUMS.items():
        if field in character:
            value = character[field]
            if isinstance(value, str):
                if len(value) == 0:
                    warnings.append({
                        "field": field,
                        "warning": "empty_prose_field",
                        "message": f"Prose field '{field}' is empty",
                    })
                elif len(value) < min_length:
                    errors.append({
                        "field": field,
                        "error": "below_minimum_length",
                        "expected": min_length,
                        "actual": len(value),
                        "message": f"Field '{field}' has {len(value)} chars, minimum is {min_length}",
                    })
    
    # Check logical consistency
    if "hp" in character:
        hp = character["hp"]
        if isinstance(hp, dict):
            current = hp.get("current", 0)
            max_hp = hp.get("max", 0)
            if current > max_hp:
                errors.append({
                    "field": "hp",
                    "error": "invalid_hp",
                    "message": f"HP current ({current}) cannot exceed max ({max_hp})",
                })
    
    # Check stats range
    if "stats" in character and isinstance(character["stats"], dict):
        for stat, value in character["stats"].items():
            if isinstance(value, int) and (value < 1 or value > 30):
                errors.append({
                    "field": f"stats.{stat}",
                    "error": "out_of_range",
                    "message": f"Stat {stat} ({value}) must be between 1 and 30",
                })
    
    # Check level range
    if "level" in character:
        level = character["level"]
        if isinstance(level, int) and (level < 1 or level > 20):
            errors.append({
                "field": "level",
                "error": "out_of_range",
                "message": f"Level ({level}) must be between 1 and 20",
            })
    
    return {
        "valid": len(errors) == 0,
        "errors": errors,
        "warnings": warnings,
        "character": character,
    }


def format_result(result: dict, verbose: bool = False) -> str:
    """Format validation result for CLI output."""
    lines = []
    
    if result["valid"]:
        lines.append("✅ Character is valid")
    else:
        lines.append(f"❌ Character is invalid ({len(result['errors'])} errors)")
    
    if result["errors"]:
        lines.append("\nErrors:")
        for err in result["errors"]:
            lines.append(f"  • {err['field']}: {err['message']}")
    
    if result["warnings"]:
        lines.append("\nWarnings:")
        for warn in result["warnings"]:
            lines.append(f"  ⚠ {warn['field']}: {warn['message']}")
    
    if verbose and result["valid"]:
        lines.append(f"\nCharacter: {result['character'].get('name', 'unnamed')}")
        lines.append(f"  Race: {result['character'].get('race', 'unknown')}")
        lines.append(f"  Class: {result['character'].get('class', 'unknown')}")
        lines.append(f"  Level: {result['character'].get('level', 1)}")
    
    return "\n".join(lines)


def main():
    """CLI entry point."""
    import argparse
    
    parser = argparse.ArgumentParser(description="Validate Loom character JSON")
    parser.add_argument("file", nargs="?", help="Character JSON file to validate")
    parser.add_argument("--stdin", action="store_true", help="Read from stdin")
    parser.add_argument("--json", action="store_true", help="Output as JSON")
    parser.add_argument("--verbose", "-v", action="store_true", help="Verbose output")
    
    args = parser.parse_args()
    
    # Read character data
    if args.stdin:
        data = sys.stdin.read()
    elif args.file:
        with open(args.file) as f:
            data = f.read()
    else:
        parser.print_help()
        sys.exit(1)
    
    try:
        character = json.loads(data)
    except json.JSONDecodeError as e:
        print(f"Error: Invalid JSON - {e}")
        sys.exit(1)
    
    # Validate
    result = validate_character(character)
    
    # Output
    if args.json:
        print(json.dumps(result, indent=2))
    else:
        print(format_result(result, verbose=args.verbose))
    
    # Exit code
    sys.exit(0 if result["valid"] else 1)


if __name__ == "__main__":
    main()
