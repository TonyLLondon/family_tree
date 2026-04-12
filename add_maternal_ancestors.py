#!/usr/bin/env python3
"""
Add maternal line ancestors to family-tree.json

This extends the maternal lineages discovered during research:
- CERPA maternal: Juan Mendez + Nieves Castillo → Rosario Mendez
- LORCA potential: Pedro Lorca + María Josefa Oteiza (research connection)
"""

import json

def add_maternal_ancestors():
    with open('family-tree.json', 'r') as f:
        tree = json.load(f)
    
    # Find next available IDs
    max_person = max(int(p[1:]) for p in tree["people"].keys() if p.startswith("I"))
    max_union = max(int(u[1:]) for u in tree["unions"].keys() if u.startswith("F"))
    
    # Starting IDs (I720-I723 based on people pages created)
    juan_mendez_id = "I720"
    nieves_castillo_id = "I721" 
    pedro_lorca_id = "I722"
    maria_oteiza_id = "I723"
    
    # Next union IDs
    next_union = max_union + 1
    mendez_union_id = f"F{next_union}"
    lorca_union_id = f"F{next_union + 1}"
    
    print(f"Adding maternal ancestors starting at union F{next_union}")
    
    # Add Juan Mendez + Nieves Castillo (parents of Rosario Mendez I692)
    tree["people"][juan_mendez_id] = {
        "id": juan_mendez_id,
        "displayName": "Juan Mendez",
        "birthUnionId": None,
        "spouseUnionIds": [mendez_union_id],
        "sex": "M",
        "birthDate": "1750",
        "birthPlace": "Chile",
        "personPage": "people/juan-mendez-1750s.md"
    }
    
    tree["people"][nieves_castillo_id] = {
        "id": nieves_castillo_id,
        "displayName": "Nieves Castillo",
        "birthUnionId": None,
        "spouseUnionIds": [mendez_union_id],
        "sex": "F",
        "birthPlace": "Chile",
        "personPage": "people/nieves-castillo.md"
    }
    
    # Add Pedro Lorca + María Josefa Oteiza (potential LORCA connection)
    tree["people"][pedro_lorca_id] = {
        "id": pedro_lorca_id,
        "displayName": "Pedro Lorca",
        "birthUnionId": None,
        "spouseUnionIds": [lorca_union_id],
        "sex": "M",
        "birthDate": "1770",
        "birthPlace": "Chile",
        "personPage": "people/pedro-lorca-1770s.md"
    }
    
    tree["people"][maria_oteiza_id] = {
        "id": maria_oteiza_id,
        "displayName": "María Josefa Oteiza",
        "birthUnionId": None,
        "spouseUnionIds": [lorca_union_id],
        "sex": "F",
        "birthPlace": "Chile"
    }
    
    # Create unions
    tree["unions"][mendez_union_id] = {
        "id": mendez_union_id,
        "partnerIds": [juan_mendez_id, nieves_castillo_id],
        "childIds": ["I692"],  # Rosario Mendez
        "marriageDate": None
    }
    
    tree["unions"][lorca_union_id] = {
        "id": lorca_union_id,
        "partnerIds": [pedro_lorca_id, maria_oteiza_id],
        "childIds": [],  # Potential LORCA connection - needs further research
        "marriageDate": None
    }
    
    # Update Rosario Mendez (I692) to have proper parents
    if "I692" in tree["people"]:
        tree["people"]["I692"]["birthUnionId"] = mendez_union_id
    
    # Add graph nodes
    new_nodes = [
        {"id": juan_mendez_id, "kind": "person", "label": "Juan Mendez"},
        {"id": nieves_castillo_id, "kind": "person", "label": "Nieves Castillo"},
        {"id": pedro_lorca_id, "kind": "person", "label": "Pedro Lorca"},
        {"id": maria_oteiza_id, "kind": "person", "label": "María Josefa Oteiza"},
        {"id": mendez_union_id, "kind": "union", "label": "", "marriageDate": None},
        {"id": lorca_union_id, "kind": "union", "label": "", "marriageDate": None}
    ]
    
    # Add graph edges
    new_edges = [
        {"from": juan_mendez_id, "to": mendez_union_id, "kind": "spouse"},
        {"from": nieves_castillo_id, "to": mendez_union_id, "kind": "spouse"},
        {"from": mendez_union_id, "to": "I692", "kind": "descent"},
        {"from": pedro_lorca_id, "to": lorca_union_id, "kind": "spouse"},
        {"from": maria_oteiza_id, "to": lorca_union_id, "kind": "spouse"}
    ]
    
    tree["graph"]["nodes"].extend(new_nodes)
    tree["graph"]["edges"].extend(new_edges)
    
    # Save updated tree
    with open('family-tree.json', 'w') as f:
        json.dump(tree, f, indent=2)
    
    print(f"Added maternal ancestors:")
    print(f"- Juan Mendez ({juan_mendez_id}) + Nieves Castillo ({nieves_castillo_id}) → Rosario Mendez (I692)")
    print(f"- Pedro Lorca ({pedro_lorca_id}) + María Josefa Oteiza ({maria_oteiza_id}) [research connection]")
    print(f"Created unions {mendez_union_id}, {lorca_union_id}")
    print("Extended CERPA maternal lineage back to ~1750s!")

if __name__ == "__main__":
    add_maternal_ancestors()