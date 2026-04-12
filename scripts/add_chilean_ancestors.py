#!/usr/bin/env python3
"""
Add Chilean colonial ancestors to family-tree.json

This script adds the missing intermediate generations (1800s-1890s) and 
colonial ancestors (1700s-1780s) to properly connect our genealogical discoveries
to the existing modern Chilean family members.
"""

import json
import sys
from pathlib import Path

def add_chilean_ancestors():
    """Add missing Chilean ancestors to family tree"""
    
    # Load existing family tree
    tree_path = Path("family-tree.json")
    with open(tree_path) as f:
        tree = json.load(f)
    
    # Find next available IDs
    max_person_id = max(int(p[1:]) for p in tree["people"].keys() if p.startswith("I"))
    max_union_id = max(int(u[1:]) for u in tree["unions"].keys() if u.startswith("F"))
    
    next_person_id = max_person_id + 1
    next_union_id = max_union_id + 1
    
    print(f"Next person ID: I{next_person_id}")
    print(f"Next union ID: F{next_union_id}")
    
    # Define the missing generations
    # Format: (person_id, name, birth_year, death_year, birth_place, spouse_id, children_ids)
    
    missing_people = [
        # CERPA Line - connecting Francisco CERPA (I348) back to colonial ancestors
        (f"I{next_person_id}", "Fabián Cerpa", 1808, 1888, "Chile", f"I{next_person_id+1}", ["I348"]),
        (f"I{next_person_id+1}", "Engracia Fernandez", None, None, "Chile", None, []),
        (f"I{next_person_id+2}", "Justo Cerpa", 1775, None, "Chile", f"I{next_person_id+3}", [f"I{next_person_id}"]),
        (f"I{next_person_id+3}", "Rosario Mendez", None, None, "Chile", None, []),
        
        # GONZÁLEZ Line - connecting Ana GONZÁLEZ (I349) back to colonial ancestors  
        (f"I{next_person_id+4}", "Juan González Cardenas", 1838, 1898, "Chile", f"I{next_person_id+5}", ["I349"]),
        (f"I{next_person_id+5}", "Pabla Cardenas", None, None, "Chile", None, []),
        (f"I{next_person_id+6}", "Pablo González", 1798, 1878, "Chile", f"I{next_person_id+7}", [f"I{next_person_id+4}"]),
        (f"I{next_person_id+7}", "Prudencia Arancibia", None, None, "Chile", None, []),
        (f"I{next_person_id+8}", "Pedro González", 1782, 1842, "Chile", f"I{next_person_id+9}", [f"I{next_person_id+6}"]),
        (f"I{next_person_id+9}", "Juana Lorca", None, None, "Chile", None, []),
        (f"I{next_person_id+10}", "José González", 1780, None, "Chile", f"I{next_person_id+9}", [f"I{next_person_id+8}"]),
        
        # PEREZ Line - connecting Francisco PEREZ (I350) back to colonial ancestors
        (f"I{next_person_id+11}", "Valentin Perez", 1827, 1892, "Chile", f"I{next_person_id+12}", ["I350"]),
        (f"I{next_person_id+12}", "Isabel Mora", None, None, "Chile", None, []),
        (f"I{next_person_id+13}", "Ignacio Perez", 1806, 1856, "Chile", f"I{next_person_id+14}", [f"I{next_person_id+11}"]),
        (f"I{next_person_id+14}", "Pascuala Villanueva", None, None, "Chile", None, []),
        (f"I{next_person_id+15}", "Simon Perez", 1763, 1845, "Chile", None, [f"I{next_person_id+13}"]),
        
        # ESCOBAR Line - connecting Zoraida ESCOBAR (I351) back to colonial ancestors
        (f"I{next_person_id+16}", "Felipe Escobar", 1810, 1895, "Chile", f"I{next_person_id+17}", ["I351"]),
        (f"I{next_person_id+17}", "Rosario Urrutia", None, None, "Chile", None, []),
        (f"I{next_person_id+18}", "Teodoro Escobar", 1786, None, "Chile", f"I{next_person_id+19}", [f"I{next_person_id+16}"]),
        (f"I{next_person_id+19}", "Rosa Segura", None, None, "Chile", None, []),
        (f"I{next_person_id+20}", "Pablo Escobar", 1720, None, "Chile", f"I{next_person_id+21}", [f"I{next_person_id+18}"]),
        (f"I{next_person_id+21}", "Antonia Oruna", None, None, "Chile", None, []),
    ]
    
    print(f"Adding {len(missing_people)} people...")
    
    # Add people to tree (simplified - would need full implementation)
    print("This is a template - full implementation would add people, unions, and edges")
    print("Current approach: Manual JSON editing needed")
    
    return missing_people

if __name__ == "__main__":
    add_chilean_ancestors()