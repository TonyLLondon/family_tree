# MCPBundles CLI Argument Formats

The `call` command supports several argument formats.

## Key=Value (Conservative Coercion)

Strings by default. Booleans (`true`/`false`) and `null` are coerced.
Bare integers like `11` stay strings — use `limit:=10` for typed numbers,
or quote values: `house_number="11"`. Pass `--typed-args` only when you
need schema-aware coercion (adds a `tools/list` round-trip).

```bash
mcpbundles call discover_mcp_servers -- search="CRM contacts" limit:=5
```

## Typed JSON with `:=`

Force a JSON type with `:=`:

```bash
mcpbundles call <tool-name> --server <slug> -- count:=42 active:=true tags:='["a","b"]'
```

## Full JSON String

Pass a single JSON object:

```bash
mcpbundles call <tool-name> --server <slug> -- '{"key": "value", "count": 42}'
```

## From File (`-f`)

```bash
mcpbundles call <tool-name> -f payload.json
```

## From Stdin

```bash
echo '{"key": "value"}' | mcpbundles call <tool-name> --stdin
```

## Local file → base64 (`@file:`)

Upload tools expect base64 on the MCP wire. The CLI reads a local file and
encodes it — no Python one-liner required. Works in `key=value`, `-f` JSON, and
`--stdin` JSON.

```bash
mcpbundles call <tool-name> --server <slug> -- content_base64=@file:./report.pdf
mcpbundles call <tool-name> --server <slug> -- content_base64=@./report.pdf
```

Relative paths resolve from your shell's current directory, including when
MCPBundles Desktop's sidecar daemon is running (the thin CLI reads the file
before forwarding the call).

When `file_name` is omitted, the CLI sets it from the file basename (e.g.
`report.pdf`). Override with an explicit `file_name=…` argument.

Max inline size: 25 MB. For larger files, use a public or presigned URL if the
tool supports URL mode.

## Separator

Always use `--` before arguments when using `--server` to prevent flags from
being misinterpreted:

```bash
mcpbundles call <tool-name> --server <slug> -- key=value another:=true
```
