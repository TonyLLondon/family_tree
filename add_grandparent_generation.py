#!/usr/bin/env python3
"""
Add grandparent generation to extend chart with proper dates
"""

import json

def add_grandparent_generation():
    with open('family-tree.json', 'r') as f:
        tree = json.load(f)
    
    # Define grandparent generation
    grandparents = [
        # CERPA: Justo Cerpa + Rosario Mendez → Fabián Cerpa (I689)
        {
            "father_id": "I691", "father_name": "Justo Cerpa", "father_birth": "1775",
            "mother_id": "I692", "mother_name": "Rosario Mendez", 
            "union_id": "F254", "child_id": "I689"
        },
        # GONZÁLEZ: Pablo González + Prudencia Arancibia → Juan González Cardenas (I693)  
        {
            "father_id": "I695", "father_name": "Pablo González", "father_birth": "1798", "father_death": "1878",
            "mother_id": "I696", "mother_name": "Prudencia Arancibia",
            "union_id": "F255", "child_id": "I693"
        },
        # PÉREZ: Ignacio Perez + Pascuala Villanueva → Valentin Perez (I700)
        {
            "father_id": "I702", "father_name": "Ignacio Perez", "father_birth": "1806", "father_death": "1856", 
            "mother_id": "I703", "mother_name": "Pascuala Villanueva",
            "union_id": "F256", "child_id": "I700"
        },
        # ESCOBAR: Teodoro Escobar + Rosa Segura → Felipe Escobar (I708)
        {
            "father_id": "I710", "father_name": "Teodoro Escobar", "father_birth": "1786",
            "mother_id": "I711", "mother_name": "Rosa Segura",
            "union_id": "F257", "child_id": "I708"
        }
    ]
    
    new_nodes = []
    new_edges = []
    
    for gp in grandparents:
        # Add father
        father_data = {
            "id": gp["father_id"],
            "displayName": gp["father_name"], 
            "birthUnionId": None,
            "spouseUnionIds": [gp["union_id"]],
            "sex": "M",
            "birthPlace": "Chile"
        }
        if gp.get("father_birth"):
            father_data["birthDate"] = gp["father_birth"]
        if gp.get("father_death"):
            father_data["deathDate"] = gp["father_death"]
        
        # Add personPage for those we created
        pages = {
            "I691": "people/justo-cerpa.md",
            "I695": "people/pablo-gonzalez-1798.md", 
            "I702": "people/ignacio-perez-1806.md",
            "I710": "people/teodoro-escobar-1786.md"
        }
        if gp["father_id"] in pages:
            father_data["personPage"] = pages[gp["father_id"]]
            
        tree["people"][gp["father_id"]] = father_data
        
        # Add mother
        tree["people"][gp["mother_id"]] = {
            "id": gp["mother_id"],
            "displayName": gp["mother_name"],
            "birthUnionId": None,
            "spouseUnionIds": [gp["union_id"]],
            "sex": "F", 
            "birthPlace": "Chile"
        }
        
        # Create union
        tree["unions"][gp["union_id"]] = {
            "id": gp["union_id"],
            "partnerIds": [gp["father_id"], gp["mother_id"]],
            "childIds": [gp["child_id"]],
            "marriageDate": None
        }
        
        # Update child's birthUnionId
        tree["people"][gp["child_id"]]["birthUnionId"] = gp["union_id"]
        
        # Add graph nodes
        new_nodes.extend([
            {"id": gp["father_id"], "kind": "person", "label": gp["father_name"]},
            {"id": gp["mother_id"], "kind": "person", "label": gp["mother_name"]},
            {"id": gp["union_id"], "kind": "union", "label": "", "marriageDate": None}
        ])
        
        # Add graph edges
        new_edges.extend([
            {"from": gp["father_id"], "to": gp["union_id"], "kind": "spouse"},
            {"from": gp["mother_id"], "to": gp["union_id"], "kind": "spouse"},
            {"from": gp["union_id"], "to": gp["child_id"], "kind": "descent"}
        ])
        
        birth_str = f" ({gp.get('father_birth', '?')})" if gp.get('father_birth') else ""
        print(f"Added: {gp['father_name']}{birth_str} + {gp['mother_name']} → {gp['child_id']}")
    
    # Add to graph
    tree["graph"]["nodes"].extend(new_nodes)
    tree["graph"]["edges"].extend(new_edges)
    
    # Save
    with open('family-tree.json', 'w') as f:
        json.dump(tree, f, indent=2)
    
    print(f"\nAdded grandparent generation - chart should now extend 2-3 generations with dates!")
    print("CERPA: 1775-1808, GONZÁLEZ: 1798-1838, PÉREZ: 1806-1827, ESCOBAR: 1786-1810")

if __name__ == "__main__":
    add_grandparent_generation()