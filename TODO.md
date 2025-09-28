# Remember this (for Developer, Codex and agents: you can ignore it)

- headers are different on website, need to fix this.
- Adjust website so we only sell in the US and in EU
- Make better image-generator
- Make api v1 (why do we do this? - learn it)
- generate alt-text for images of sports
- check if image already exists before generating
- rename "roles" in Supabase database to "subcategories" (or something like that) and use that consistently
- think about renaming optimal_bodies to something else
- add a test-user that is seeded automatically.

# ADD Microsoft Playwright MCP:

launch this in a terminal:
npx @playwright/mcp@latest \
 --allowed-hosts=localhost,127.0.0.1 \
 --enable-screenshots \
 --enable-pdf \
 --enable-tracing \
 --cwd "$PWD"

Edit (or create) ~/.codex/config.toml and add:
[mcp_servers.playwright]
command = "npx"
args = [
"@playwright/mcp@latest",
"--allowed-hosts=localhost,127.0.0.1",
"--enable-screenshots",
"--enable-pdf",
"--enable-tracing"
]
