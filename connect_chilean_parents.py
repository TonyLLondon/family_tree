#!/usr/bin/env python3
"""
Connect Chilean parents to fix the sun/fan chart extension

This script adds the immediate parents for all 4 modern Chilean ancestors:
- I348 Francisco CERPA → parents Fabián Cerpa + Engracia Fernandez  
- I349 Ana GONZÁLEZ → parents Juan González Cardenas + Pabla Cardenas
- I350 Francisco PEREZ → parents Valentin Perez + Isabel Mora
- I351 Zoraida ESCOBAR → parents Felipe Escobar + Rosario Urrutia
"""

import json

def connect_chilean_parents():
    # Load existing family tree
    with open('family-tree.json', 'r') as f:
        tree = json.load(f)
    
    # Find current max IDs (we already have I689, I690 from Fabián)
    max_person = max(int(p[1:]) for p in tree["people"].keys() if p.startswith("I"))
    max_union = max(int(u[1:]) for u in tree["unions"].keys() if u.startswith("F"))
    
    print(f"Current max person: I{max_person}, union: F{max_union}")
    
    # Define the 4 immediate parent pairs needed (Fabián already exists as I689+I690)
    parent_couples = [
        # GONZÁLEZ parents for Ana GONZÁLEZ (I349)
        {
            "father_id": "I693", "father_name": "Juan González Cardenas",
            "mother_id": "I694", "mother_name": "Pabla Cardenas", 
            "union_id": "F251", "child_id": "I349"
        },
        # PÉREZ parents for Francisco PEREZ (I350)  
        {
            "father_id": "I700", "father_name": "Valentin Perez",
            "mother_id": "I701", "mother_name": "Isabel Mora",
            "union_id": "F252", "child_id": "I350"
        },
        # ESCOBAR parents for Zoraida ESCOBAR (I351)
        {
            "father_id": "I708", "father_name": "Felipe Escobar", 
            "mother_id": "I709", "mother_name": "Rosario Urrutia",
            "union_id": "F253", "child_id": "I351"
        }
    ]
    
    new_people = []
    new_unions = []
    new_nodes = []
    new_edges = []
    
    for couple in parent_couples:
        # Add father (if has people page, otherwise minimal)
        father_data = {
            "id": couple["father_id"],
            "displayName": couple["father_name"],
            "birthUnionId": None,  # Will add grandparents later
            "spouseUnionIds": [couple["union_id"]],
            "sex": "M",
            "birthPlace": "Chile"
        }
        
        # Add personPage if we created one
        if couple["father_id"] in ["I693", "I700", "I708"]:
            pages = {
                "I693": "people/juan-gonzalez-cardenas-1838.md",
                "I700": "people/valentin-perez-1827.md", 
                "I708": "people/felipe-escobar-1810.md"
            }
            father_data["personPage"] = pages[couple["father_id"]]
        
        tree["people"][couple["father_id"]] = father_data
        
        # Add mother
        tree["people"][couple["mother_id"]] = {
            "id": couple["mother_id"],
            "displayName": couple["mother_name"],
            "birthUnionId": None,
            "spouseUnionIds": [couple["union_id"]],
            "sex": "F",
            "birthPlace": "Chile"
        }
        
        # Create union
        tree["unions"][couple["union_id"]] = {
            "id": couple["union_id"],
            "partnerIds": [couple["father_id"], couple["mother_id"]],
            "childIds": [couple["child_id"]], 
            "marriageDate": None
        }
        
        # Update child's birthUnionId
        tree["people"][couple["child_id"]]["birthUnionId"] = couple["union_id"]
        
        # Add graph nodes
        new_nodes.extend([
            {"id": couple["father_id"], "kind": "person", "label": couple["father_name"]},
            {"id": couple["mother_id"], "kind": "person", "label": couple["mother_name"]},
            {"id": couple["union_id"], "kind": "union", "label": "", "marriageDate": None}
        ])
        
        # Add graph edges  
        new_edges.extend([
            {"from": couple["father_id"], "to": couple["union_id"], "kind": "spouse"},
            {"from": couple["mother_id"], "to": couple["union_id"], "kind": "spouse"},
            {"from": couple["union_id"], "to": couple["child_id"], "kind": "descent"}
        ])
        
        print(f"Added: {couple['father_name']} + {couple['mother_name']} → {couple['child_id']}")
    
    # Add all new graph elements
    tree["graph"]["nodes"].extend(new_nodes)
    tree["graph"]["edges"].extend(new_edges)
    
    # Save updated tree
    with open('family-tree.json', 'w') as f:
        json.dump(tree, f, indent=2)
    
    print(f"\nAdded {len(parent_couples)} parent couples connecting to modern Chilean family")
    print("Updated birthUnionIds for I349 (Ana), I350 (Francisco), I351 (Zoraida)")
    print("The sun/fan chart should now extend 1-2 generations deeper across ALL 4 Chilean lines!")

if __name__ == "__main__":
    connect_chilean_parents()