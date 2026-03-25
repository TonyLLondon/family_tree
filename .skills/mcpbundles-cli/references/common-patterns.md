# MCPBundles Common Workflow Templates

Reusable patterns. Replace `<slug>` with the bundle slug and `<function_name>`
with the actual tool function name discovered via `list_tools`.

## Discover Bundles and Tool Counts

```bash
cat > /tmp/mcb_discover.py << 'PYEOF'
bundles = await get_bundles()
for b in bundles.get("bundles", []):
    print(f"{b['slug']:30s} {b.get('tool_count', '?')} tools")
PYEOF

mcpbundles exec -f /tmp/mcb_discover.py
```

## List Tools in a Bundle

```bash
cat > /tmp/mcb_list.py << 'PYEOF'
tools = await list_tools("<slug>")
for t in tools:
    print(f"{t['function_name']:50s} {t['description'][:60]}")
PYEOF

mcpbundles exec -f /tmp/mcb_list.py
```

## Get a Tool's Schema Before Calling

```bash
cat > /tmp/mcb_schema.py << 'PYEOF'
import json
schema = await get_tool_schema("<function_name>")
print(json.dumps(schema, indent=2))
PYEOF

mcpbundles exec -f /tmp/mcb_schema.py
```

## Call a Tool With Complex Arguments

```bash
cat > /tmp/mcb_call.py << 'PYEOF'
import json

result = await <function_name>(
    bundle="<slug>",
    param1="value",
    param2={"nested": "object", "with": ["complex", "structure"]}
)
print(json.dumps(result, indent=2, default=str))
PYEOF

mcpbundles exec -f /tmp/mcb_call.py
```

## Chain Multiple Tool Calls

```bash
cat > /tmp/mcb_chain.py << 'PYEOF'
import json

# Step 1: Get data from one tool
result1 = await <function_name_1>(bundle="<slug>", param="value")
items = result1.get("data", [])
print(f"Step 1: got {len(items)} items")

# Step 2: Use results in another call
for item in items[:3]:
    result2 = await <function_name_2>(
        bundle="<slug>",
        id=item["id"]
    )
    print(f"  {item['id']}: {result2.get('status')}")
PYEOF

mcpbundles exec -f /tmp/mcb_chain.py
```

## Simple Direct Calls (No File Needed)

```bash
mcpbundles call health_check
mcpbundles call get_bundles
mcpbundles call search_tools -- query="email"
mcpbundles call <tool-name> --bundle <slug>
mcpbundles call <tool-name> --bundle <slug> -- limit:=5
```
