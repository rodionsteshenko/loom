#!/usr/bin/env python3
"""
Loom Inventory Validator

Validates inventory items against the Loom schema.
"""

import json
import sys
import uuid
from pathlib import Path
from typing import Any

try:
    import jsonschema
    from jsonschema import Draft7Validator
except ImportError:
    print("Error: jsonschema not installed. Run: pip install jsonschema")
    sys.exit(1)


# Valid item types
ITEM_TYPES = ["weapon", "armor", "consumable", "tool", "gear", "treasure", "wondrous", "quest"]

# Rarity levels
RARITIES = ["common", "uncommon", "rare", "very_rare", "legendary", "artifact"]

# Weight thresholds for warnings
HEAVY_ITEM_THRESHOLD = 50  # lbs
TOTAL_WEIGHT_WARNING = 150  # lbs

# Value thresholds
HIGH_VALUE_ITEM = 1000  # gp equivalent


def load_schema() -> dict:
    """Load the inventory item JSON schema."""
    schema_path = Path(__file__).parent.parent / "schemas" / "inventory_item.json"
    if not schema_path.exists():
        raise FileNotFoundError(f"Schema not found: {schema_path}")
    
    with open(schema_path) as f:
        return json.load(f)


def value_to_gp(value: dict) -> float:
    """Convert value object to gold piece equivalent."""
    if not value:
        return 0
    return value.get("gp", 0) + value.get("sp", 0) / 10 + value.get("cp", 0) / 100


def validate_item(item: dict, schema: dict) -> dict:
    """Validate a single inventory item."""
    errors = []
    warnings = []
    
    # Auto-generate ID if missing
    if "id" not in item or not item["id"]:
        item["id"] = str(uuid.uuid4())
    
    # Check for extra fields
    allowed_fields = set(schema.get("properties", {}).keys())
    actual_fields = set(item.keys())
    extra_fields = actual_fields - allowed_fields
    
    for field in extra_fields:
        errors.append({
            "field": field,
            "error": "unexpected_field",
            "message": f"Field '{field}' is not in the schema",
        })
    
    # JSON Schema validation
    validator = Draft7Validator(schema)
    for error in validator.iter_errors(item):
        path = ".".join(str(p) for p in error.absolute_path) if error.absolute_path else "_root"
        errors.append({
            "field": path,
            "error": "schema_violation",
            "message": error.message,
        })
    
    # Weight warnings
    weight = item.get("weight", 0)
    if weight > HEAVY_ITEM_THRESHOLD:
        warnings.append({
            "field": "weight",
            "warning": "heavy_item",
            "message": f"Item weighs {weight} lbs - very heavy",
        })
    
    # Value warnings
    value = item.get("value", {})
    gp_value = value_to_gp(value)
    if gp_value > HIGH_VALUE_ITEM:
        warnings.append({
            "field": "value",
            "warning": "high_value",
            "message": f"Item worth {gp_value} gp - very valuable",
        })
    
    # Magical item without notes warning
    if item.get("magical") and not item.get("notes"):
        warnings.append({
            "field": "notes",
            "warning": "magical_no_notes",
            "message": "Magical item should have notes describing its properties",
        })
    
    # Attunement logic
    attunement = item.get("attunement", {})
    if attunement.get("attuned") and not attunement.get("required"):
        errors.append({
            "field": "attunement",
            "error": "invalid_attunement",
            "message": "Item is attuned but attunement is not required",
        })
    
    return {
        "valid": len(errors) == 0,
        "errors": errors,
        "warnings": warnings,
        "item": item,
    }


def validate_inventory(inventory: list) -> dict:
    """
    Validate a full inventory (list of items).
    
    Returns:
        {
            "valid": bool,
            "errors": [...],
            "warnings": [...],
            "inventory": <inventory with defaults applied>,
            "stats": { total_weight, total_value, item_count }
        }
    """
    errors = []
    warnings = []
    validated_items = []
    
    if not isinstance(inventory, list):
        return {
            "valid": False,
            "errors": [{"field": "_root", "error": "not_array", "message": "Inventory must be an array"}],
            "warnings": [],
            "inventory": inventory,
            "stats": {},
        }
    
    try:
        schema = load_schema()
    except FileNotFoundError as e:
        return {
            "valid": False,
            "errors": [{"field": "_schema", "error": "schema_not_found", "message": str(e)}],
            "warnings": [],
            "inventory": inventory,
            "stats": {},
        }
    
    total_weight = 0
    total_value = 0
    
    for i, item in enumerate(inventory):
        result = validate_item(item, schema)
        
        # Prefix errors with item index
        for err in result["errors"]:
            err["item_index"] = i
            err["item_name"] = item.get("name", f"item_{i}")
            errors.append(err)
        
        for warn in result["warnings"]:
            warn["item_index"] = i
            warn["item_name"] = item.get("name", f"item_{i}")
            warnings.append(warn)
        
        validated_items.append(result["item"])
        
        # Accumulate stats
        qty = item.get("quantity", 1)
        total_weight += item.get("weight", 0) * qty
        total_value += value_to_gp(item.get("value", {})) * qty
    
    # Total weight warning
    if total_weight > TOTAL_WEIGHT_WARNING:
        warnings.append({
            "field": "_total",
            "warning": "heavy_inventory",
            "message": f"Total inventory weight is {total_weight} lbs - may cause encumbrance",
        })
    
    return {
        "valid": len(errors) == 0,
        "errors": errors,
        "warnings": warnings,
        "inventory": validated_items,
        "stats": {
            "total_weight": total_weight,
            "total_value": round(total_value, 2),
            "item_count": len(validated_items),
        },
    }


def format_result(result: dict) -> str:
    """Format validation result for CLI output."""
    lines = []
    
    if result["valid"]:
        lines.append(f"✅ Inventory is valid ({result['stats'].get('item_count', 0)} items)")
    else:
        lines.append(f"❌ Inventory is invalid ({len(result['errors'])} errors)")
    
    if result.get("stats"):
        stats = result["stats"]
        lines.append(f"\nStats:")
        lines.append(f"  Items: {stats.get('item_count', 0)}")
        lines.append(f"  Weight: {stats.get('total_weight', 0)} lbs")
        lines.append(f"  Value: {stats.get('total_value', 0)} gp")
    
    if result["errors"]:
        lines.append("\nErrors:")
        for err in result["errors"]:
            item_name = err.get("item_name", "unknown")
            lines.append(f"  • [{item_name}] {err['field']}: {err['message']}")
    
    if result["warnings"]:
        lines.append("\nWarnings:")
        for warn in result["warnings"]:
            item_name = warn.get("item_name", "")
            prefix = f"[{item_name}] " if item_name else ""
            lines.append(f"  ⚠ {prefix}{warn['field']}: {warn['message']}")
    
    return "\n".join(lines)


def main():
    """CLI entry point."""
    import argparse
    
    parser = argparse.ArgumentParser(description="Validate Loom inventory JSON")
    parser.add_argument("file", nargs="?", help="Inventory JSON file to validate")
    parser.add_argument("--stdin", action="store_true", help="Read from stdin")
    parser.add_argument("--json", action="store_true", help="Output as JSON")
    
    args = parser.parse_args()
    
    # Read inventory data
    if args.stdin:
        data = sys.stdin.read()
    elif args.file:
        with open(args.file) as f:
            data = f.read()
    else:
        parser.print_help()
        sys.exit(1)
    
    try:
        inventory = json.loads(data)
    except json.JSONDecodeError as e:
        print(f"Error: Invalid JSON - {e}")
        sys.exit(1)
    
    # Validate
    result = validate_inventory(inventory)
    
    # Output
    if args.json:
        print(json.dumps(result, indent=2))
    else:
        print(format_result(result))
    
    # Exit code
    sys.exit(0 if result["valid"] else 1)


if __name__ == "__main__":
    main()
