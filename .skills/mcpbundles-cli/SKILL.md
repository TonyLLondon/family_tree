---
name: mcpbundles-cli
description: >-
  Discover and execute third-party API tools via the mcpbundles CLI. Use when
  the user asks to "call an MCP tool", "use mcpbundles", "list available
  bundles", "run a bundle tool", "search for tools", execute any mcpbundles
  command, or interact with services connected through MCPBundles. For **browser
  automation**, use the **remote-browser** bundle (hosted Playwright), not
  Cloudflare Browser, unless the user names Cloudflare explicitly.
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

## Remote Browser — bundle `remote-browser`

Use this bundle for **navigate / snapshot / click / type / screenshot** workflows.
It is **MCPBundles’ hosted Playwright browser**. Do **not** default to the
**Cloudflare Browser** bundle unless the user asks for Cloudflare by name.

```bash
mcpbundles tools --bundle remote-browser
mcpbundles tools browser-navigate-743 --bundle remote-browser
```

**Typical flow**

1. **`browser-navigate-743`** — `url` must include `http://` or `https://`.
   Optional: `wait_until` (`load`, `domcontentloaded`, `networkidle`, `commit`),
   `timeout` (ms).
2. **`browser-snapshot-743`** — accessibility tree (use this to pick refs for
   clicks and typing; better than screenshot-only loops).
3. **`browser-click-743`**, **`browser-type-743`**, **`browser-fill-form-743`**,
   etc., as needed.
4. **`browser-take-screenshot-743`** or **`browser-save-as-pdf-743`** when you
   need pixels or PDF.
5. **`browser-close-743`** — release the session when finished.

**Call shape**

```bash
mcpbundles call browser-navigate-743 --bundle remote-browser url=https://example.com
```

Tool names use **hyphens** (e.g. `browser-navigate-743`), as printed by
`mcpbundles tools --bundle remote-browser`.

**Hitting `localhost` dev servers**

Remote Browser runs **outside** your machine. To reach `http://localhost:PORT`,
the MCPBundles **proxy tunnel** must expose that port (daemon connected):

`mcpbundles proxy expose <PORT>`

Then navigate to the **tunnel/public URL** you get from expose (not bare
`localhost` from the remote browser’s perspective), or follow current
MCPBundles docs for the exact URL pattern.

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
