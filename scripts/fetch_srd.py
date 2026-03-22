#!/usr/bin/env python3
"""
Fetch D&D 5e SRD content from Open5e API.
Stores as JSON files for the AI DM to reference.
"""

import json
import os
import time
from pathlib import Path
from urllib.request import urlopen, Request
from urllib.error import HTTPError

BASE_URL = "https://api.open5e.com/v1"
OUTPUT_DIR = Path(__file__).parent.parent / "reference" / "srd"

# Endpoints to fetch
ENDPOINTS = [
    ("spells", "spells"),
    ("monsters", "monsters"),
    ("classes", "classes"),
    ("races", "races"),
    ("conditions", "conditions"),
    ("magicitems", "magic_items"),
    ("weapons", "weapons"),
    ("armor", "armor"),
    ("backgrounds", "backgrounds"),
    ("feats", "feats"),
]

def fetch_all(endpoint: str, limit: int = 100) -> list:
    """Fetch all items from a paginated endpoint."""
    items = []
    url = f"{BASE_URL}/{endpoint}/?limit={limit}&format=json"
    
    while url:
        print(f"  Fetching: {url[:80]}...")
        try:
            req = Request(url, headers={"User-Agent": "Loom-DM/1.0"})
            with urlopen(req, timeout=30) as response:
                data = json.loads(response.read().decode())
                items.extend(data.get("results", []))
                url = data.get("next")
                if url:
                    time.sleep(0.5)  # Rate limiting
        except HTTPError as e:
            print(f"  Error: {e}")
            break
    
    return items

def main():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    
    print("Fetching D&D 5e SRD content from Open5e API...")
    print()
    
    total_items = 0
    
    for endpoint, filename in ENDPOINTS:
        print(f"[{endpoint}]")
        items = fetch_all(endpoint)
        
        if items:
            output_path = OUTPUT_DIR / f"{filename}.json"
            with open(output_path, "w") as f:
                json.dump(items, f, indent=2)
            print(f"  Saved {len(items)} items to {output_path}")
            total_items += len(items)
        else:
            print(f"  No items found")
        print()
    
    print(f"Done! Total: {total_items} items")
    print(f"Output: {OUTPUT_DIR}")

if __name__ == "__main__":
    main()
