---
name: mcpbundles-cli
description: >-
  Discover and execute MCP server tools via the mcpbundles CLI. Use when
  the user asks to call MCP tools, use mcpbundles, list MCP servers, search for
  tools, or interact with services connected through MCPBundles.
---

# MCPBundles CLI

Tools live on **MCP servers** (e.g. `uk-property-intelligence`, `stripe`).
`mcpbundles tools` without `--server` lists **Hub meta-tools only** (~46).
Bundle tools (with hash suffixes like `-34a`) require `--server <slug>`.

Run `mcpbundles init` after CLI upgrades to refresh this skill.

## Discovery workflow

```bash
mcpbundles call discover_mcp_servers -- search="property"   # 1. find server slug + preview tools
mcpbundles tools --server uk-property-intelligence            # 2. list wire slugs (hash suffixes)
mcpbundles tools uk-property-find-address-34a --server uk-property-intelligence  # 3. full schema
mcpbundles call uk-property-find-address-34a --server uk-property-intelligence -- postcode="EC1A 1BB" house_number="42" street_or_building="Example Road"
```

Alternative schema lookup without `--server`:

```bash
mcpbundles call describe_tool -- tool_slug=uk-property-find-address-34a
# or: function_name=uk_property_find_address_34a
```

Load bundle-specific guidance:

```bash
mcpbundles call get_skill -- server_slug=uk-property-intelligence
```

## Arguments

```bash
mcpbundles call <tool> --server <slug> -- key=value limit:=5 tags:='["a","b"]'
```

- **Always use `--`** before key=value args when `--server` is set.
- **Numeric-looking string fields** (house numbers, IDs): pass as strings —
  `house_number="11"` not bare `house_number=11`. Or use `house_number:="11"`.
- **Typed numbers without schema fetch:** `limit:=10` (forces integer).
- **`--typed-args`** (optional): fetches `tools/list` once to coerce by schema.
  Avoid by default — adds latency. Use when validation errors persist.

**Local files (bytes upload tools):** pass `@file:` / `@./` on `mcpbundles call` —
you never base64-encode yourself. The daemon reads the file using your shell cwd.
Auto-fills `file_name` from the path when omitted. Do not use `exec` or shell base64.

```bash
mcpbundles call convert-to-markdown-XXX --server markitdown -- \
  content_base64=@file:./sample.pdf
# or shorthand: content_base64=@./sample.pdf
# or in -f args.json: {"content_base64": "@file:./sample.pdf"}
```

Max inline size 25 MB; use a URL when the tool supports it for larger files.
Use `--raw` on `call` when long tool **output** trips Rich formatting (not for uploads).

For complex/nested JSON, use `exec -f`:

```bash
mcpbundles exec -f /tmp/script.py    # Python: result = await tool_name(server="slug", ...)
```

## Multiline and special characters in `content`

Shell `content=$'...\n...'` and many parallel background `mcpbundles call` jobs are unreliable — content can arrive with literal `$` artifacts or empty CLI capture files.

- **Prefer `mcpbundles exec -f`** with a short Python script when `content` spans multiple lines, includes quotes, or you need several writes in one process.
- **Single sequential calls** for stress tests or bulk edits; do not fan out dozens of background CLI invocations against the same note.
- **JSON/array fields** — use `tags:='["a","b"]'` or exec; do not guess shell escaping for nested structures.

Example (Obsidian append with real newlines):

```python
# /tmp/obs_append.py — run: mcpbundles exec -f /tmp/obs_append.py
result = await obsidian_append_note(
    server="obsidian",
    filename="Projects/note.md",
    content="\n\n## Log entry\n- line one\n",
)
```

## Local desktop dev (mandatory PATH)

When developing with MCPBundles Desktop dev (`make desktop-dev-start` / `npm run dev:server`), terminal `mcpbundles` **must** use the repo proxy venv — the same binary the dev sidecar supervises. Homebrew and production Desktop PATH shims are stale shipped builds.

Before any `mcpbundles` command during local dev:

```bash
export PATH="$(make desktop-dev-cli-path):$PATH"
make desktop-dev-cli-check   # must pass; re-export if it fails
```

`make desktop-dev-start` prints the same export line. Do not use bare `mcpbundles` from `/opt/homebrew/bin` during local dev.

## Rules

- **Tool names have hash suffixes** — discover first via `discover_mcp_servers` or `tools --server`, never guess
- **`server=` in exec** — required for MCP server tools. Hub sandbox tools omit `server=`. `describe_tool`, `open_mcpbundles_app`, and nested `code_execution` are client-only — use `mcpbundles call`
- **Variables don't persist** between `exec` calls — one script per workflow
- **Multiple connections** — use `--as <name>` on every command

## When a call fails — recover, then heal the surface

CLI errors are input to the product, not just retry noise. Assume the next agent makes the same mistake.

### Same-run recovery (do this first)

1. **Stop guessing.** Do not swap param names blindly or retry the same invocation.
2. **Read the error.** Validation failures name the bad field and often suggest `get_tool_info` or `--typed-args`.
3. **Fetch schema once:**
   ```bash
   mcpbundles tools <tool-slug> --server <slug>
   mcpbundles call describe_tool -- tool_slug=<tool-slug>
   ```
4. **Retry with canonical param names** from the schema (or `--typed-args` if types keep failing).

**Postgres:** do not probe `information_schema` through `postgres-execute-*` to learn column names. Use `postgres_inspect_schema`, `postgres_list_tables`, or `postgres_get_ai_description` first, then write SQL. Growth pull scripts with known queries should use `growth/scripts/mcp_postgres.py::run_postgres_query`.

### Cross-run healing (when the mistake is systematic)

If the failure came from a natural agent mistake (wrong alias, misleading doc example, missing pagination field name, error that doesn't say what to do next):

| Lever | Where | Example |
|-------|--------|---------|
| Param alias | `PARAM_ALIASES` in `backend/app/tools/<provider>/config.py` | Gmail `query` → `q` |
| Actionable tool errors | `app.services.tool_error_formatter` + provider hints in `_PROVIDER_ERROR_HINTS` | Postgres "column does not exist" → call `postgres_inspect_schema` |
| Doc examples | Scoped `AGENTS.md` / `.skills/*/SKILL.md` | Fix copy-pasteable `mcpbundles call` shapes |
| Tool description / schema | Provider tool class `input_schema` | Name params the way upstream APIs name them; document pagination cursor keys |

We own the MCP catalog — if agents stumble on our CLI, **fix the tool or the error message**, don't normalize bad invocations in every script. Provider-wide patterns and Phase-5 smoke expectations live in `product/api-provider-authoring/AGENTS.md`.

After healing: add or extend a unit test (`test_param_aliases.py`, provider error-hint tests) and run one successful `mcpbundles call` to confirm the next agent gets a clean path.

## REST API Providers

Register any REST API with `connect_mcp_server` using `base_url` (use `url` for remote MCP).

```bash
mcpbundles call connect_mcp_server -- base_url="https://api.example.com/v1" api_key="sk-xxx" name="Example"
```

The tool name is `{connection-slug}-api-request` (shown in the connect response).

## Reference

See [references/argument-formats.md](references/argument-formats.md) and
[references/common-patterns.md](references/common-patterns.md).
