#!/usr/bin/env python3
"""
Historical one-off patch — DO NOT re-run against current canonical tree.

As of 2026-04, policy is in sources/chile-mora-line-evidence-status-2026.md:
- I701 parents (Isidro / María Estrada) are not in family-tree.json until a film
  transcription proves the link to Valentin’s mother.
- I726 × I733 (Mabricio × Ránquil Isabel) are encoded separately from I701.

Original intent: fix Isabel as Valentin's mother (not wife) and add indexed parents.
That parent union (F265) has been removed from the live JSON.
"""

import json

# Read current family tree
with open('family-tree.json', 'r', encoding='utf-8') as f:
    tree = json.load(f)

print("CORRECTING ISABEL MORA RELATIONSHIP")
print("==================================")

# Current incorrect structure:
# I700 (Valentin Perez) married to I701 (Isabel Mora) in F252
# Should be:  
# Isabel Mora (I701) is Valentin's MOTHER, not wife
# Valentin's wife should be Rosario Gonzalez (new person)

# Add new people
new_people = {
    "I730": {
        "id": "I730", 
        "displayName": "Isidro Mora",
        "birthUnionId": None,
        "spouseUnionIds": ["F265"],
        "sex": "M",
        "personPage": "people/isidro-mora-1750s.md",
        "birthDate": "~1750",
        "birthPlace": "Chile"
    },
    "I731": {
        "id": "I731",
        "displayName": "Maria Estrada", 
        "birthUnionId": None,
        "spouseUnionIds": ["F265"],
        "sex": "F",
        "personPage": "people/maria-estrada-1760s.md", 
        "birthDate": "~1760",
        "birthPlace": "Chile"
    },
    "I732": {
        "id": "I732",
        "displayName": "Rosario Gonzalez",
        "birthUnionId": None, 
        "spouseUnionIds": ["F252"],
        "sex": "F",
        "personPage": "people/rosario-gonzalez-valentin-wife.md",
        "birthDate": "~1830", 
        "birthPlace": "Chile"
    }
}

# Add new people to tree
for person_id, person_data in new_people.items():
    tree["people"][person_id] = person_data
    print(f"✓ Added {person_data['displayName']} ({person_id})")

# Fix Isabel Mora's birthUnionId - she should have parents
tree["people"]["I701"]["birthUnionId"] = "F265"
print("✓ Updated Isabel Mora (I701) birthUnionId to F265")

# Remove Isabel Mora from F252 spouseUnionIds and add Rosario Gonzalez
tree["unions"]["F252"]["partnerIds"] = ["I700", "I732"]  # Valentin + Rosario
print("✓ Updated F252 to be Valentin Perez + Rosario Gonzalez")

# Remove Isabel Mora's spouseUnionId to F252
if "F252" in tree["people"]["I701"]["spouseUnionIds"]:
    tree["people"]["I701"]["spouseUnionIds"].remove("F252") 
print("✓ Removed Isabel Mora from F252 spouse relationship")

# Create new union F265: Isidro Mora + Maria Estrada
tree["unions"]["F265"] = {
    "id": "F265",
    "partnerIds": ["I730", "I731"],  # Isidro + Maria
    "childIds": ["I701"],  # Isabel Mora
    "marriageDate": None
}
print("✓ Created F265: Isidro Mora + Maria Estrada → Isabel Mora")

# Update Isabel Mora to show she's mother of Valentin Perez
# This might need a new parent-child union, but let's see the current structure first
print(f"\nCurrent Valentin Perez birthUnionId: {tree['people']['I700']['birthUnionId']}")

# Valentin Perez (I700) should have birthUnionId pointing to parents Ignacio + Isabel  
# Need to create F266: Ignacio Perez + Isabel Mora → Valentin Perez
tree["unions"]["F266"] = {
    "id": "F266", 
    "partnerIds": ["I702", "I701"],  # Ignacio Perez + Isabel Mora
    "childIds": ["I700"],  # Valentin Perez
    "marriageDate": None
}

# Update Valentin's birthUnionId
tree["people"]["I700"]["birthUnionId"] = "F266"
print("✓ Created F266: Ignacio Perez + Isabel Mora → Valentin Perez")
print("✓ Updated Valentin Perez birthUnionId to F266")

# Add Isabel Mora to spouseUnionIds for F266
if "spouseUnionIds" not in tree["people"]["I701"]:
    tree["people"]["I701"]["spouseUnionIds"] = []
tree["people"]["I701"]["spouseUnionIds"].append("F266")

# Add Ignacio Perez to spouseUnionIds for F266  
if "spouseUnionIds" not in tree["people"]["I702"]:
    tree["people"]["I702"]["spouseUnionIds"] = []
tree["people"]["I702"]["spouseUnionIds"].append("F266")
print("✓ Updated spouse relationships for F266")

# Update graph nodes
new_nodes = [
    {"id": "I730", "kind": "person", "label": "Isidro Mora"},
    {"id": "I731", "kind": "person", "label": "Maria Estrada"}, 
    {"id": "I732", "kind": "person", "label": "Rosario Gonzalez"},
    {"id": "F265", "kind": "union", "label": "", "marriageDate": None},
    {"id": "F266", "kind": "union", "label": "", "marriageDate": None}
]

tree["graph"]["nodes"].extend(new_nodes)
print("✓ Added new graph nodes")

# Update graph edges
new_edges = [
    {"from": "I730", "to": "F265", "kind": "spouse"},  # Isidro → F265
    {"from": "I731", "to": "F265", "kind": "spouse"},  # Maria → F265  
    {"from": "F265", "to": "I701", "kind": "descent"}, # F265 → Isabel
    {"from": "I702", "to": "F266", "kind": "spouse"},  # Ignacio → F266
    {"from": "I701", "to": "F266", "kind": "spouse"},  # Isabel → F266
    {"from": "F266", "to": "I700", "kind": "descent"}, # F266 → Valentin  
    {"from": "I732", "to": "F252", "kind": "spouse"}   # Rosario → F252
]

# Remove old edge: Isabel Mora → F252 (spouse) 
tree["graph"]["edges"] = [edge for edge in tree["graph"]["edges"] 
                          if not (edge["from"] == "I701" and edge["to"] == "F252" and edge["kind"] == "spouse")]

tree["graph"]["edges"].extend(new_edges)
print("✓ Updated graph edges")

# Update meta counts
tree["meta"]["personCount"] = len(tree["people"])
tree["meta"]["unionCount"] = len(tree["unions"]) 
tree["meta"]["edgeCount"] = len(tree["graph"]["edges"])

print(f"\nUpdated counts:")
print(f"People: {tree['meta']['personCount']}")
print(f"Unions: {tree['meta']['unionCount']}")  
print(f"Edges: {tree['meta']['edgeCount']}")

# Save updated family tree
with open('family-tree.json', 'w', encoding='utf-8') as f:
    json.dump(tree, f, indent=2, ensure_ascii=False)

print(f"\n✅ FAMILY TREE CORRECTED")
print("Isabel Mora is now correctly shown as Valentin Perez's MOTHER")
print("Added indigenous ancestry pathway: Isidro Mora + Maria Estrada → Isabel Mora")