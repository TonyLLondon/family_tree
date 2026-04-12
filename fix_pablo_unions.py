#!/usr/bin/env python3
"""
Fix Pablo González union structure

CURRENT ISSUE:
- F255 shows Pablo González (I695) + Prudencia Arancibia (I696) → Juan González Cardenas (I693)
- But this is wrong! Prudencia was Pablo's MOTHER, Pabla was his WIFE

CORRECT STRUCTURE:
- Pedro González (I697) + Prudencia Arancibia (I696) → Pablo González (I695) [birth parents]
- Pablo González (I695) + Pabla Cardenas (I694) → Juan González Cardenas (I693) [marriage]
"""

import json

def fix_pablo_unions():
    # Load existing family tree
    with open('family-tree.json', 'r') as f:
        tree = json.load(f)
    
    print("FIXING PABLO GONZÁLEZ UNION STRUCTURE")
    
    # Step 1: Fix F255 to be Pablo + Pabla (not Pablo + Prudencia)
    if "F255" in tree["unions"]:
        print("Correcting F255: Pablo González + Pabla Cardenas → Juan González Cardenas")
        tree["unions"]["F255"]["partnerIds"] = ["I695", "I694"]  # Pablo + Pabla
        tree["unions"]["F255"]["childIds"] = ["I693"]  # Juan González Cardenas
    
    # Step 2: Update Prudencia Arancibia (I696) spouse unions
    if "I696" in tree["people"]:
        # Prudencia should be married to Pedro González (I697), not Pablo
        print("Updating Prudencia Arancibia (I696) to be married to Pedro González") 
        # We need to find Pedro's union ID - let's create a new one
        tree["people"]["I696"]["spouseUnionIds"] = ["F256"]  # New union with Pedro
    
    # Step 3: Update Pablo González (I695) 
    if "I695" in tree["people"]:
        print("Updating Pablo González (I695) birth and marriage unions")
        tree["people"]["I695"]["birthUnionId"] = "F256"  # Born from Pedro + Prudencia
        tree["people"]["I695"]["spouseUnionIds"] = ["F255"]  # Married to Pabla
    
    # Step 4: Update Pedro González (I697) if exists
    if "I697" in tree["people"]:
        print("Updating Pedro González (I697) to marry Prudencia Arancibia")
        tree["people"]["I697"]["spouseUnionIds"] = ["F256"]
    
    # Step 5: Create F256 union (Pedro + Prudencia → Pablo)
    print("Creating F256 union: Pedro González + Prudencia Arancibia → Pablo González")
    tree["unions"]["F256"] = {
        "id": "F256",
        "partnerIds": ["I697", "I696"],  # Pedro + Prudencia  
        "childIds": ["I695"],  # Pablo González
        "marriageDate": None
    }
    
    # Step 6: Update graph structure
    # Add F256 union node
    f256_node_exists = any(node.get("id") == "F256" for node in tree["graph"]["nodes"])
    if not f256_node_exists:
        tree["graph"]["nodes"].append({
            "id": "F256", 
            "kind": "union",
            "label": "",
            "marriageDate": None
        })
    
    # Update graph edges - remove incorrect ones and add correct ones
    # Remove: I696 → F255 (Prudencia married to Pablo - WRONG!)
    tree["graph"]["edges"] = [
        edge for edge in tree["graph"]["edges"]
        if not (edge.get("from") == "I696" and edge.get("to") == "F255" and edge.get("kind") == "spouse")
    ]
    
    # Add correct edges
    new_edges = [
        {"from": "I697", "to": "F256", "kind": "spouse"},  # Pedro → F256
        {"from": "I696", "to": "F256", "kind": "spouse"},  # Prudencia → F256
        {"from": "F256", "to": "I695", "kind": "descent"}  # F256 → Pablo
    ]
    
    tree["graph"]["edges"].extend(new_edges)
    
    # Save updated tree
    with open('family-tree.json', 'w') as f:
        json.dump(tree, f, indent=2)
    
    print("\nPABLO GONZÁLEZ UNION STRUCTURE FIXED!")
    print("✓ Pedro González (I697) + Prudencia Arancibia (I696) → Pablo González (I695) [F256]")
    print("✓ Pablo González (I695) + Pabla Cardenas (I694) → Juan González Cardenas (I693) [F255]") 
    print("✓ Juan González Cardenas (I693) + Maria Ynes Parra (I725) → Ana GONZÁLEZ (I349) [F251]")

if __name__ == "__main__":
    fix_pablo_unions()