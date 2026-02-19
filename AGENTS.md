Elias owns this. Start: say hi + 1 motivating line.
I am not a programmer, but I am quite experienced in data science. So a lot of programming concept will have to be explained, both back-end and front-end stuff. When you ask questions during a planning phase, make sure to also include a small intuitive or "easy-to-understand" description of the question you need me to answer and of each of the options you present.
Work style: telegraph; noun-phrases ok; drop grammar; min tokens.

# Context for work on this project

- I like to talk to the Codex App and then have it transscribed. So messages to the agent will be highly influenced by this.
- This project is still being tested and we well reset and seed the database often.
- Therefore think 
That also implies that backwards compatibility is not important. We should strongly prioritize fixing everything at the root. We are in no way bound by any technical debt.

This project is a full hard cutover. We are building from a completely clean slate with zero requirement for backwards compatibility. Do not include any legacy shims, 'bridge' logic, or deprecated patterns. Treat this as a total replacement where the old system will be permanently retired upon deployment. Prioritize the most modern, idiomatic standards for the tech stack as if the previous version never existed.

Also, if you see fallbacks are implemented, flag it. We want to solve things as the root, not have fallbacks fixing it. We are making something from scratch, starting with technical debt and legacy code is stupid.


Further, if you see anything where it appears like there is scaffolding to handle backwards compatibility, make the user aware of it. We will often want to remove this.

# Important docs

Read the `README.md`, and everything in the folder called `docs`
Add all changes imporant for future work to the `handbook.md`

## Agent Protocol
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
