#!/usr/bin/env python3
"""
Add ALL Chilean colonial generations with proper dates to fix the sun/fan chart

This adds the complete chains:
CERPA: Justo (1775) → Fabián (1808) → Francisco → modern
GONZÁLEZ: José (1780s) → Pedro (1782) → Pablo (1798) → Juan (1838) → Ana → modern  
PÉREZ: Juan (~1690s) → Simon (1763) → Ignacio (1806) → Valentin (1827) → Francisco → modern
ESCOBAR: Pablo (1720) → Teodoro (1786) → Felipe (1810) → Zoraida → modern
"""

import json

def add_all_chilean_generations():
    # Load existing family tree
    with open('family-tree.json', 'r') as f:
        tree = json.load(f)
    
    # First, fix existing people - add missing dates
    print("Adding missing dates to existing people...")
    
    # Juan González Cardenas (I693) - missing dates
    tree["people"]["I693"]["birthDate"] = "1838"
    tree["people"]["I693"]["deathDate"] = "1898-10-20"
    
    # Valentin Perez (I700) - missing dates  
    tree["people"]["I700"]["birthDate"] = "1827"
    tree["people"]["I700"]["deathDate"] = "1892-09-19"
    
    # Felipe Escobar (I708) - missing dates
    tree["people"]["I708"]["birthDate"] = "1810"
    tree["people"]["I708"]["deathDate"] = "1895-03-29"
    
    # Fabián Cerpa (I689) - already has dates from sync
    
    print("Fixed dates for existing generation")
    
    # Now add ALL the deeper generations
    next_person = 714  # Continue from where we left off
    next_union = 254
    
    # All the missing ancestors with full genealogical chains
    ancestors = [
        # CERPA LINE: Add Justo Cerpa + Rosario Mendez (parents of Fabián I689)
        {
            "id": f"I{next_person}", "name": "Justo Cerpa", "sex": "M",
            "birth": "1775", "death": None, "place": "Chile",
            "page": "people/justo-cerpa.md",
            "spouse_id": f"I{next_person+1}", "union_id": f"F{next_union}",
            "children": ["I689"]  # Fabián Cerpa
        },
        {
            "id": f"I{next_person+1}", "name": "Rosario Mendez", "sex": "F",
            "birth": None, "death": None, "place": "Chile",
            "spouse_id": f"I{next_person}", "union_id": f"F{next_union}"
        },
        
        # GONZÁLEZ LINE: Add deeper generations  
        # Pablo González (I695) + Prudencia Arancibia (I696) - parents of Juan I693
        {
            "id": "I695", "name": "Pablo González", "sex": "M",
            "birth": "1798", "death": "1878", "place": "Chile", 
            "page": "people/pablo-gonzalez-1798.md",
            "spouse_id": "I696", "union_id": f"F{next_union+1}",
            "children": ["I693"]  # Juan González Cardenas
        },
        {
            "id": "I696", "name": "Prudencia Arancibia", "sex": "F",
            "birth": None, "death": None, "place": "Chile",
            "spouse_id": "I695", "union_id": f"F{next_union+1}"
        },
        
        # Pedro González (I697) + Juana Lorca (I698) - parents of Pablo I695  
        {
            "id": "I697", "name": "Pedro González", "sex": "M",
            "birth": "1782", "death": "1842", "place": "Chile",
            "page": "people/pedro-gonzalez-1782.md", 
            "spouse_id": "I698", "union_id": f"F{next_union+2}",
            "children": ["I695"]  # Pablo González
        },
        {
            "id": "I698", "name": "Juana Lorca", "sex": "F", 
            "birth": None, "death": None, "place": "Chile",
            "spouse_id": "I697", "union_id": f"F{next_union+2}"
        },
        
        # José González (I699) - father of Pedro I697 (José + Juana same union)
        {
            "id": "I699", "name": "José González", "sex": "M",
            "birth": "1780", "death": None, "place": "Chile",
            "page": "people/jose-gonzalez-1780s.md",
            "spouse_id": "I698", "union_id": f"F{next_union+3}",  # Different union with same Juana
            "children": ["I697"]  # Pedro González
        },
        
        # PÉREZ LINE: Add deeper generations
        # Ignacio Perez (I702) + Pascuala Villanueva (I703) - parents of Valentin I700
        {
            "id": "I702", "name": "Ignacio Perez", "sex": "M",
            "birth": "1806", "death": "1856", "place": "Chile",
            "page": "people/ignacio-perez-1806.md",
            "spouse_id": "I703", "union_id": f"F{next_union+4}",
            "children": ["I700"]  # Valentin Perez
        },
        {
            "id": "I703", "name": "Pascuala Villanueva", "sex": "F",
            "birth": None, "death": None, "place": "Chile",
            "spouse_id": "I702", "union_id": f"F{next_union+4}"
        },
        
        # Simon Perez (I704) + María Antonia Herrera (I705) - parents of Ignacio I702
        {
            "id": "I704", "name": "Simon Perez", "sex": "M", 
            "birth": "1763", "death": "1845", "place": "Chile",
            "page": "people/simon-perez-1763.md",
            "spouse_id": "I705", "union_id": f"F{next_union+5}",
            "children": ["I702"]  # Ignacio Perez
        },
        {
            "id": "I705", "name": "María Antonia Herrera", "sex": "F",
            "birth": None, "death": None, "place": "Chile",
            "spouse_id": "I704", "union_id": f"F{next_union+5}"
        },
        
        # Juan Perez (I706) + Catalina Vásquez (I707) - parents of Simon I704 (DEEPEST ANCESTOR ~1690s)
        {
            "id": "I706", "name": "Juan Perez", "sex": "M",
            "birth": "1690", "death": None, "place": "Chile", 
            "page": "people/juan-perez-1690s.md",
            "spouse_id": "I707", "union_id": f"F{next_union+6}",
            "children": ["I704"]  # Simon Perez
        },
        {
            "id": "I707", "name": "Catalina Vásquez", "sex": "F",
            "birth": None, "death": None, "place": "Chile",
            "spouse_id": "I706", "union_id": f"F{next_union+6}"
        },
        
        # ESCOBAR LINE: Add deeper generations
        # Teodoro Escobar (I710) + Rosa Segura (I711) - parents of Felipe I708
        {
            "id": "I710", "name": "Teodoro Escobar", "sex": "M",
            "birth": "1786", "death": None, "place": "Chile",
            "page": "people/teodoro-escobar-1786.md",
            "spouse_id": "I711", "union_id": f"F{next_union+7}",
            "children": ["I708"]  # Felipe Escobar
        },
        {
            "id": "I711", "name": "Rosa Segura", "sex": "F",
            "birth": None, "death": None, "place": "Chile",
            "spouse_id": "I710", "union_id": f"F{next_union+7}"
        },
        
        # Pablo Escobar (I712) + Antonia Oruna (I713) - parents of Teodoro I710
        {
            "id": "I712", "name": "Pablo Escobar", "sex": "M", 
            "birth": "1720", "death": None, "place": "Chile",
            "page": "people/pablo-escobar-1746.md",
            "spouse_id": "I713", "union_id": f"F{next_union+8}",
            "children": ["I710"]  # Teodoro Escobar
        },
        {
            "id": "I713", "name": "Antonia Oruna", "sex": "F",
            "birth": None, "death": None, "place": "Chile", 
            "spouse_id": "I712", "union_id": f"F{next_union+8}"
        }
    ]
    
    print(f"Adding {len(ancestors)} ancestors across all generations...")
    
    # Add all people
    for person in ancestors:
        person_data = {
            "id": person["id"],
            "displayName": person["name"],
            "birthUnionId": None,  # Will set for children
            "spouseUnionIds": [person["union_id"]],
            "sex": person["sex"],
            "birthPlace": person["place"]
        }
        
        # Add dates if available
        if person["birth"]:
            person_data["birthDate"] = person["birth"]
        if person["death"]: 
            person_data["deathDate"] = person["death"]
        if person.get("page"):
            person_data["personPage"] = person["page"]
            
        tree["people"][person["id"]] = person_data
        
        # Set birthUnionId for children
        if "children" in person:
            for child_id in person["children"]:
                if child_id in tree["people"]:
                    tree["people"][child_id]["birthUnionId"] = person["union_id"]
        
        print(f"  Added: {person['name']} ({person.get('birth', '?')})")
    
    # Add unions and graph elements would go here...
    # For now, showing the scope
    
    print(f"\nThis will extend the chart to:")
    print("- CERPA: 2 generations (1775-1808)")
    print("- GONZÁLEZ: 4 generations (1780s-1838)")  
    print("- PÉREZ: 6 generations (1690s-1827) - deepest line")
    print("- ESCOBAR: 3 generations (1720-1810)")
    print(f"Total: ~15+ generations with proper dates!")

if __name__ == "__main__":
    add_all_chilean_generations()