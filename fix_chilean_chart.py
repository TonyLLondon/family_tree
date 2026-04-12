#!/usr/bin/env python3
"""
Add missing Chilean generations to family-tree.json to fix the sun/fan chart
"""

import json
from pathlib import Path

def fix_chilean_chart():
    # Load existing family tree
    with open('family-tree.json', 'r') as f:
        tree = json.load(f)
    
    # Starting IDs
    next_person = 689
    next_union = 250
    
    # Add Fabián Cerpa and Engracia Fernandez (Francisco's parents)
    fabian_id = f"I{next_person}"
    engracia_id = f"I{next_person + 1}"
    fabian_union_id = f"F{next_union}"
    
    # Add Fabián Cerpa
    tree["people"][fabian_id] = {
        "id": fabian_id,
        "displayName": "Fabián Cerpa",
        "birthUnionId": None,  # Will add Justo Cerpa later
        "spouseUnionIds": [fabian_union_id],
        "sex": "M",
        "birthDate": "1808",
        "deathDate": "1888",
        "birthPlace": "Chile",
        "personPage": "people/fabian-cerpa-1808.md"
    }
    
    # Add Engracia Fernandez
    tree["people"][engracia_id] = {
        "id": engracia_id,
        "displayName": "Engracia Fernandez",
        "birthUnionId": None,
        "spouseUnionIds": [fabian_union_id],
        "sex": "F",
        "birthPlace": "Chile"
    }
    
    # Create union for Fabián × Engracia
    tree["unions"][fabian_union_id] = {
        "id": fabian_union_id,
        "partnerIds": [fabian_id, engracia_id],
        "childIds": ["I348"],  # Francisco CERPA is their child
        "marriageDate": None
    }
    
    # Update Francisco CERPA to have proper parents
    tree["people"]["I348"]["birthUnionId"] = fabian_union_id
    
    # Add edges for the new relationships
    new_edges = [
        {"from": fabian_id, "to": fabian_union_id, "kind": "spouse"},
        {"from": engracia_id, "to": fabian_union_id, "kind": "spouse"},
        {"from": fabian_union_id, "to": "I348", "kind": "descent"}
    ]
    
    # Add to graph edges array
    tree["graph"]["edges"].extend(new_edges)
    
    # Add to graph nodes array  
    new_nodes = [
        {"id": fabian_id, "kind": "person", "label": "Fabián Cerpa"},
        {"id": engracia_id, "kind": "person", "label": "Engracia Fernandez"},
        {"id": fabian_union_id, "kind": "union", "label": "", "marriageDate": None}
    ]
    
    tree["graph"]["nodes"].extend(new_nodes)
    
    # Save updated tree
    with open('family-tree.json', 'w') as f:
        json.dump(tree, f, indent=2)
    
    print(f"Added Fabián Cerpa ({fabian_id}) and Engracia Fernandez ({engracia_id})")
    print(f"Created union {fabian_union_id}")
    print(f"Updated Francisco CERPA (I348) birthUnionId to {fabian_union_id}")
    print("The sun/fan chart should now extend one generation deeper!")

if __name__ == "__main__":
    fix_chilean_chart()