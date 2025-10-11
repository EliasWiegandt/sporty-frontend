# Remember this (for Developer, Codex and agents: you can ignore it)

### more detailed matching

- monkey index
  everything like that - the stranger the better. Need to research these.

# For later

- add generation of injuries at risk and injuries that are likely for each sport subcategory
- add generation of goals that can be succeeded with each sport
- add preference tagging to each sport
- add logging of past sports data. What will i use this for? carry-over: if you are good at one sports, you might be good at others. Or in reverse, you can exclude them if you want to from the search-results.
- Adjust website so we only sell in the US and in EU
- Make better image-generator
- generate alt-text for images of sports
- Codex in Frontend do not use "explored, read, search" but seem to use commands for it. Ask why. Seems like they should both do the same.

# Ad Microsoft Playwright MCP later, description below. First needed when we move into design phase

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
