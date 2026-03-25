# MCPBundles CLI Argument Formats

The `call` command supports several argument formats.

## Key=Value (Auto-Coerced)

Strings by default. Booleans and numbers are auto-coerced when the tool schema
declares them.

```bash
mcpbundles call search_tools -- query="CRM contacts" limit:=5
```

## Typed JSON with `:=`

Force a JSON type with `:=`:

```bash
mcpbundles call <tool-name> --bundle <slug> -- count:=42 active:=true tags:='["a","b"]'
```

## Full JSON String

Pass a single JSON object:

```bash
mcpbundles call <tool-name> --bundle <slug> -- '{"key": "value", "count": 42}'
```

## From File (`-f`)

```bash
mcpbundles call <tool-name> -f payload.json
```

## From Stdin

```bash
echo '{"key": "value"}' | mcpbundles call <tool-name> --stdin
```

## Separator

Always use `--` before arguments when using `--bundle` to prevent flags from
being misinterpreted:

```bash
mcpbundles call <tool-name> --bundle <slug> -- key=value another:=true
```
