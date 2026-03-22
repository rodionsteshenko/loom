#!/usr/bin/env python3
"""
Fetch Forgotten Realms lore from the Forgotten Realms Wiki.
Focuses on key locations, factions, deities, and NPCs for AI DM reference.
"""

import json
import os
import re
import time
from pathlib import Path
from urllib.request import urlopen, Request
from urllib.parse import quote
from html.parser import HTMLParser

OUTPUT_DIR = Path(__file__).parent.parent / "reference" / "forgotten_realms"

# Key pages to fetch - focused on what an AI DM needs
PAGES = {
    "regions": [
        "Sword_Coast",
        "Western_Heartlands", 
        "North_(region)",
        "Amn",
        "Cormyr",
        "Dalelands",
    ],
    "cities": [
        "Baldur%27s_Gate",
        "Waterdeep",
        "Neverwinter",
        "Luskan",
        "Candlekeep",
        "Athkatla",
        "Silverymoon",
        "Mithral_Hall",
        "Menzoberranzan",
        "Elturel",
    ],
    "factions": [
        "Harpers",
        "Zhentarim",
        "Lords%27_Alliance",
        "Emerald_Enclave",
        "Order_of_the_Gauntlet",
        "Cult_of_the_Dragon",
        "Red_Wizards_of_Thay",
        "Flaming_Fist",
    ],
    "deities": [
        "Faer%C3%BBnian_pantheon",
        "Tyr",
        "Mystra",
        "Selûne",
        "Lathander",
        "Tempus",
        "Kelemvor",
        "Bane_(deity)",
        "Cyric",
        "Shar",
        "Mask_(deity)",
    ],
    "races_cultures": [
        "Elves",
        "Dwarves",
        "Halflings",
        "Dragonborn",
        "Tieflings",
        "Drow",
    ],
    "history": [
        "Time_of_Troubles",
        "Spellplague",
        "Sundering",
    ],
}

class WikiTextExtractor(HTMLParser):
    """Extract text content from wiki HTML."""
    def __init__(self):
        super().__init__()
        self.text = []
        self.in_content = False
        self.skip_tags = {'script', 'style', 'nav', 'footer', 'aside'}
        self.current_tag = None
        
    def handle_starttag(self, tag, attrs):
        self.current_tag = tag
        attrs_dict = dict(attrs)
        if attrs_dict.get('id') == 'mw-content-text':
            self.in_content = True
            
    def handle_endtag(self, tag):
        if tag == 'div' and self.in_content:
            pass  # Keep going
        self.current_tag = None
            
    def handle_data(self, data):
        if self.in_content and self.current_tag not in self.skip_tags:
            text = data.strip()
            if text:
                self.text.append(text)
                
    def get_text(self):
        return ' '.join(self.text)

def clean_wikitext(text: str) -> str:
    """Remove wiki markup from text."""
    import re
    # Remove templates {{...}}
    text = re.sub(r'\{\{[^}]+\}\}', '', text)
    # Remove [[File:...]] and [[Image:...]]
    text = re.sub(r'\[\[(File|Image):[^\]]+\]\]', '', text)
    # Convert [[Link|Display]] to Display
    text = re.sub(r'\[\[[^\]|]+\|([^\]]+)\]\]', r'\1', text)
    # Convert [[Link]] to Link
    text = re.sub(r'\[\[([^\]]+)\]\]', r'\1', text)
    # Remove refs
    text = re.sub(r'<ref[^>]*>.*?</ref>', '', text, flags=re.DOTALL)
    text = re.sub(r'<ref[^/]*/>', '', text)
    # Remove HTML tags
    text = re.sub(r'<[^>]+>', '', text)
    # Remove section headers markup
    text = re.sub(r'={2,}([^=]+)={2,}', r'\n\n\1\n', text)
    # Clean up whitespace
    text = re.sub(r'\n{3,}', '\n\n', text)
    text = re.sub(r' +', ' ', text)
    return text.strip()

def fetch_wiki_page(page_name: str) -> dict:
    """Fetch a page from Forgotten Realms Wiki."""
    # Use parse API with wikitext
    url = f"https://forgottenrealms.fandom.com/api.php?action=parse&page={page_name}&prop=wikitext&format=json"
    
    try:
        req = Request(url, headers={"User-Agent": "Loom-DM/1.0"})
        with urlopen(req, timeout=30) as response:
            data = json.loads(response.read().decode())
            
            if "parse" in data:
                wikitext = data["parse"].get("wikitext", {}).get("*", "")
                title = data["parse"].get("title", page_name)
                
                # Clean the wikitext
                content = clean_wikitext(wikitext)
                
                if content:
                    return {
                        "title": title,
                        "content": content,
                        "page_id": str(data["parse"].get("pageid", "")),
                    }
    except Exception as e:
        print(f"    Error fetching {page_name}: {e}")
    
    return None

def main():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    
    print("Fetching Forgotten Realms lore from Fandom Wiki...")
    print()
    
    all_lore = {}
    total_pages = 0
    
    for category, pages in PAGES.items():
        print(f"[{category}]")
        category_data = []
        
        for page_name in pages:
            print(f"  Fetching: {page_name}...")
            page_data = fetch_wiki_page(page_name)
            
            if page_data and page_data.get("content"):
                category_data.append(page_data)
                # Truncate very long articles
                if len(page_data["content"]) > 50000:
                    page_data["content"] = page_data["content"][:50000] + "\n\n[Truncated...]"
                total_pages += 1
            
            time.sleep(0.5)  # Rate limiting
        
        if category_data:
            output_path = OUTPUT_DIR / f"{category}.json"
            with open(output_path, "w") as f:
                json.dump(category_data, f, indent=2)
            print(f"  Saved {len(category_data)} pages to {output_path}")
        print()
    
    # Create a combined index
    print("Creating index...")
    index = {
        "total_pages": total_pages,
        "categories": list(PAGES.keys()),
        "pages_by_category": {cat: [p.replace("%27", "'").replace("%C3%BB", "û") for p in pages] for cat, pages in PAGES.items()}
    }
    
    with open(OUTPUT_DIR / "index.json", "w") as f:
        json.dump(index, f, indent=2)
    
    print(f"Done! Total: {total_pages} pages")
    print(f"Output: {OUTPUT_DIR}")

if __name__ == "__main__":
    main()
