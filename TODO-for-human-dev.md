# Remember this (for Developer, Codex and agents: you can ignore it)

### more detailed matching

- monkey index
  everything like that - the stranger the better. Need to research these.

# For later

- Adjust website so we only sell in the US and in EU
- Make better image-generator
- generate alt-text for images of sports
- use session when I am enriching with goals, prefernces and injuries. So all in one big session.
- Add sources to all research generation
- hook up Stripe
- hook up playwright stuff and start getting critiques of front-end look and user flows
- Figure out great ways to test it.
- instead of one big specs-dict, I probably need something better in the table on optimal bodies...

# Short term plan

Jeg skal have den simpleste løsning op og køre
Den hvor folk bare indtaster sportsgrene de har dyrket selv
Der skal lige en eller anden form for hierarki på
Men det må gå med det.

Så kan alt det andet komme på selv, senere

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
