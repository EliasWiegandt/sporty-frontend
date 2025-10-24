## Makefile — Sporty Frontend

.PHONY: snap clean-snap run-frontend build-frontend dev-frontend clean

# Take screenshots of the running local dev site into ./screenshots
snap:
	bash scripts/snap_frontend.sh http://127.0.0.1:8787 screenshots

clean-snap:
	rm -rf screenshots

build-frontend:
	npm run build

dev-frontend:
	npm run dev

clean:
	rm -rf dist

run-frontend: clean build-frontend
	wrangler dev
