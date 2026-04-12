#!/usr/bin/env python3
"""
Fix genealogical error in GONZÁLEZ family structure

ERROR FOUND: Juan González Cardenas (I693) was incorrectly married to his MOTHER Pabla Cardenas (I694)

CORRECT STRUCTURE according to FamilySearch Q241-2CJ8:
- Pablo González (I695) + Pabla Cardenas (I694) → Juan González Cardenas (I693) 
- Juan González Cardenas (I693) + Maria Ynes Parra (I725) → Ana GONZÁLEZ (I349)
"""

import json

def fix_gonzalez_genealogy():
    # Load existing family tree
    with open('family-tree.json', 'r') as f:
        tree = json.load(f)
    
    print("FIXING GENEALOGICAL ERROR: Juan González Cardenas family structure")
    
    # Current incorrect structure:
    # F251: Juan González Cardenas (I693) + Pabla Cardenas (I694) → Ana GONZÁLEZ (I349)
    
    # Should be:
    # F255: Pablo González (I695) + Pabla Cardenas (I694) → Juan González Cardenas (I693)  
    # F251: Juan González Cardenas (I693) + Maria Ynes Parra (I725) → Ana GONZÁLEZ (I349)
    
    # Step 1: Update F251 union to have correct spouses
    if "F251" in tree["unions"]:
        print("Updating F251 union: Juan González Cardenas + Maria Ynes Parra")
        tree["unions"]["F251"]["partnerIds"] = ["I693", "I725"]  # Juan + Maria Ynes
        # Keep same child: Ana GONZÁLEZ (I349)
    
    # Step 2: Update Pablo González (I695) to be married to Pabla Cardenas
    if "I695" in tree["people"]:
        print("Updating Pablo González (I695) to marry Pabla Cardenas")
        tree["people"]["I695"]["spouseUnionIds"] = ["F255"]
    
    # Step 3: Update Pabla Cardenas (I694) to be married to Pablo González  
    if "I694" in tree["people"]:
        print("Updating Pabla Cardenas (I694) to marry Pablo González")
        tree["people"]["I694"]["spouseUnionIds"] = ["F255"]
    
    # Step 4: Update Juan González Cardenas (I693) to have proper parents and spouse
    if "I693" in tree["people"]:
        print("Updating Juan González Cardenas (I693) birth union and spouse")
        tree["people"]["I693"]["birthUnionId"] = "F255"  # Born from Pablo + Pabla
        tree["people"]["I693"]["spouseUnionIds"] = ["F251"]  # Married to Maria Ynes
    
    # Step 5: Add Maria Ynes Parra (I725) if not exists
    if "I725" not in tree["people"]:
        print("Adding Maria Ynes Parra (I725)")
        tree["people"]["I725"] = {
            "id": "I725",
            "displayName": "Maria Ynes Parra",
            "birthUnionId": None,
            "spouseUnionIds": ["F251"],
            "sex": "F",
            "personPage": "people/maria-ynes-parra.md"
        }
    
    # Step 6: Create F255 union (Pablo + Pabla → Juan)
    if "F255" not in tree["unions"]:
        print("Creating F255 union: Pablo González + Pabla Cardenas")
        tree["unions"]["F255"] = {
            "id": "F255",
            "partnerIds": ["I695", "I694"],  # Pablo + Pabla
            "childIds": ["I693"],  # Juan González Cardenas
            "marriageDate": None
        }
    
    # Step 7: Update graph nodes and edges
    # Add Maria Ynes Parra to graph nodes if not exists
    maria_node_exists = any(node.get("id") == "I725" for node in tree["graph"]["nodes"])
    if not maria_node_exists:
        tree["graph"]["nodes"].append({
            "id": "I725",
            "kind": "person", 
            "label": "Maria Ynes Parra"
        })
    
    # Add F255 union to graph nodes if not exists
    f255_node_exists = any(node.get("id") == "F255" for node in tree["graph"]["nodes"])
    if not f255_node_exists:
        tree["graph"]["nodes"].append({
            "id": "F255",
            "kind": "union",
            "label": "",
            "marriageDate": None
        })
    
    # Add missing graph edges
    new_edges = [
        {"from": "I695", "to": "F255", "kind": "spouse"},  # Pablo → F255
        {"from": "I694", "to": "F255", "kind": "spouse"},  # Pabla → F255  
        {"from": "F255", "to": "I693", "kind": "descent"}, # F255 → Juan
        {"from": "I725", "to": "F251", "kind": "spouse"}   # Maria Ynes → F251
    ]
    
    # Remove old incorrect edges and add new ones
    # Remove: I694 → F251 (Pabla married to Juan - WRONG!)
    tree["graph"]["edges"] = [
        edge for edge in tree["graph"]["edges"] 
        if not (edge.get("from") == "I694" and edge.get("to") == "F251" and edge.get("kind") == "spouse")
    ]
    
    # Add new correct edges
    tree["graph"]["edges"].extend(new_edges)
    
    # Save updated tree
    with open('family-tree.json', 'w') as f:
        json.dump(tree, f, indent=2)
    
    print("\nGENEALOGICAL ERROR FIXED!")
    print("✓ Pablo González (I695) + Pabla Cardenas (I694) → Juan González Cardenas (I693)")
    print("✓ Juan González Cardenas (I693) + Maria Ynes Parra (I725) → Ana GONZÁLEZ (I349)")
    print("✓ Updated unions F255 (parents) and F251 (marriage)")
    print("✓ Fixed graph structure with correct relationships")

if __name__ == "__main__":
    fix_gonzalez_genealogy()