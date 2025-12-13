## Makefile — Sporty Frontend

.PHONY: snap clean-snap run-frontend build-frontend dev-frontend clean

# Take screenshots of the running local dev site into ./screenshots
snap:
	bash scripts/snap_frontend.sh http://127.0.0.1:8787 screenshots
	node scripts/snap_intake_flow.js http://127.0.0.1:8787 screenshots

clean-snap:
	rm -rf screenshots

build-frontend:
	npm run build

dev-frontend:
	npm run dev

clean:
	rm -rf dist

run-frontend: build-frontend
	MINIFLARE_CF_FETCH=false wrangler dev --local
