---
name: mcpbundles-cli
description: >-
  Discover and execute third-party API tools via the mcpbundles CLI. Use when
  the user asks to "call an MCP tool", "use mcpbundles", "list available
  bundles", "run a bundle tool", "search for tools", execute any mcpbundles
  command, or interact with services connected through MCPBundles. Also use
  when you see mcpbundles installed or a named connection configured.
---

# MCPBundles CLI — Tool Discovery and Execution

The `mcpbundles` CLI connects you to third-party API tools. Tools are organized
into **bundles** (e.g. `posthog`, `stripe`, `hubspot-crm`). Each bundle groups
related tools for one service.

## Key Concept: Hub vs Bundle

There are two layers and you must understand both:

| Layer | What it contains | How to access |
|-------|-----------------|---------------|
| **Hub** | Platform tools: `search_tools`, `get_bundles`, `code_execution` | `mcpbundles tools` (no `--bundle` flag) |
| **Bundle** | Actual service tools for a specific provider | `mcpbundles tools --bundle <slug>` |

**`mcpbundles tools` alone only shows hub-level meta-tools.** The actual service
tools live on bundle endpoints. You must use `--bundle <slug>` to see them.

## Step 1: Discover Available Bundles

```bash
mcpbundles call get_bundles
```

Returns all enabled bundles with their slugs and tool counts. Filter:

```bash
mcpbundles call get_bundles -- search="analytics"
```

## Step 2: Discover Tools in a Bundle

```bash
mcpbundles tools --bundle <slug>
```

Filter within a bundle:

```bash
mcpbundles tools --bundle <slug> -f query
```

Get the full schema for a specific tool (you need the exact name from step 2):

```bash
mcpbundles tools <tool-name> --bundle <slug>
```

## Step 3: Call a Tool

Two paths — choose based on complexity.

### Path A: Direct Call (`call --bundle`)

Best for simple calls with straightforward arguments.

```bash
mcpbundles call <tool-name> --bundle <slug>
mcpbundles call <tool-name> --bundle <slug> -- key=value limit:=5
```

### Path B: Code Execution (`exec -f`)

Best for complex arguments, chaining multiple calls, or data processing.
**Write a Python file and pass it with `-f` to avoid shell quoting entirely.**

```bash
cat > /tmp/mcb_query.py << 'PYEOF'
import json

# Step 1: Discover tools in the bundle
tools = await list_tools("<slug>")
for t in tools[:5]:
    print(t["function_name"], "-", t["description"][:80])

# Step 2: Get schema for a tool you want to call
schema = await get_tool_schema("<function_name_from_step_1>")
print(json.dumps(schema, indent=2))
PYEOF

mcpbundles exec -f /tmp/mcb_query.py
```

Once you know the function name and schema, call it:

```bash
cat > /tmp/mcb_call.py << 'PYEOF'
import json

result = await <function_name>(
    bundle="<slug>",
    param1="value1",
    param2={"nested": "object"}
)
print(json.dumps(result, indent=2, default=str))
PYEOF

mcpbundles exec -f /tmp/mcb_call.py
```

The `exec -f` pattern is strongly preferred for any call with nested JSON,
multiple steps, or data manipulation. It eliminates all shell quoting issues.

For quick inline code:

```bash
mcpbundles exec "result = await health_check(); print(result)"
```

## Critical Rules

1. **Tool names have hash suffixes** — Every tool has a unique suffix like
   `-67e` or `-5b7`. Never guess. Always discover names first with
   `mcpbundles tools --bundle <slug>` or `await list_tools("<slug>")`.

2. **Bundle tools require `bundle=` in exec** — When calling tools inside
   `code_execution`, always pass `bundle="<slug>"`. Platform tools
   (`health_check`, `get_bundles`, `search_tools`) do NOT take `bundle=`.

3. **Use `exec -f` for complex args** — If the tool takes nested JSON objects,
   write a `.py` file and use `mcpbundles exec -f /tmp/script.py`. Never
   wrestle with shell quoting for nested JSON.

4. **Variables don't persist between exec calls** — Put all related operations
   in one Python file.

5. **Named connections** — If multiple connections exist, use `--as <name>` on
   every command. Run `mcpbundles connections` to see available names.

## Searching for Tools

When you don't know which bundle has the tool you need:

```bash
mcpbundles call search_tools -- query="send email"
```

Returns results with `function_name`, `bundle_slug`, and usage examples.

## Recommended Workflow

1. `mcpbundles call get_bundles` — find the right bundle slug
2. `mcpbundles tools --bundle <slug>` — find the right tool name
3. `mcpbundles tools <tool-name> --bundle <slug>` — get the schema
4. Call via `mcpbundles call ... --bundle <slug>` (simple) or write a
   Python file and use `mcpbundles exec -f /tmp/script.py` (complex)

## Reference

See [references/argument-formats.md](references/argument-formats.md) for the
full argument syntax (key=value, :=json, JSON string, file, stdin).

See [references/common-patterns.md](references/common-patterns.md) for
reusable workflow templates.
