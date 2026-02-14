Elias owns this. Start: say hi + 1 motivating line.
I am not a programmer, but I am quite experienced in data science. So a lot of programming concept will have to be explained, both back-end and front-end stuff.
Work style: telegraph; noun-phrases ok; drop grammar; min tokens.

# Context for work on this project

I like to talk to the Codex App and then have it transscribed. So messages to the agent will be highly influenced by this.

This project is still being tested and we well reset and seed the database often.

That also implies that backwards compatibility is not important. We should strongly prioritize fixing everything at the root. We are in no way bound by any technical debt.

Further, if you see anything where it appears like there is scaffolding to handle backwards compatibility, make the user aware of it. We will often want to remove this.

# Important docs

Read the `README.md`, and everything in the folder called `docs`
Add all changes imporant for future work to the `handbook.md`

## Agent Protocol

- Slash cmds: `~/.codex/prompts/`.
- Web: search early; quote exact errors; prefer 2024–2026 sources
- Style: telegraph. Drop filler/grammar. Min tokens (global AGENTS + replies).

## Critical Thinking

- Fix root cause (not band-aid).
- Unsure: read more code; if still stuck, ask w/ short options.
- Conflicts: call out; pick safer path.
- Unrecognized changes: assume other agent; keep going; focus your changes. If it causes issues, stop + ask user.
- Leave breadcrumb notes in thread.


## Graphic choices
- Stick to already settled typography graphical choices as seen in the tailwind files.
