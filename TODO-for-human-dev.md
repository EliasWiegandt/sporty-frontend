(for the developer. Codex and agents: you can ignore this file)

# TODO

BEFORE LAUNCH

- Ethnicity should only have the options chosen in the YAML (which should end up in the supabase database)

- Prøv gemini lite eller lignende til at researche med. Eller måske gpt-4.5-nano :-)

- must have goals and preferences should optionally be able to be turned into a filtering mechanism (need to have three types, rather than two)

- Fix "    # Aliases normalize legacy/non-canonical inputs to canonical value ids."
- Need mechanism for exploring results more - also filtering sports somehow, if there are sports the user is uninterested in. Or alternatively sports they want to dive deeper into and find out more about.

-I found one root issue behind this: adult saved premium runs can reload from DB by id, but child saved runs currently cannot; they depend on session cache. So if you want this to work for saved child runs too, we should fix that at the same time.

-             alias_map = {
                "hip_width_cm": "pelvic_bone_width_cm",
                "pelvic_bone_width_cm": "hip_width_cm",
            }
- Results PDF export needs to be fixed

- "label": row.get("intake_label") or row.get("label"),

- And we also need to fix a mobile version
- Have Codex look once more at the compliance parts - what legals things should we fix

- must have goals and preferences should optionally be able to be turned into a filtering mechanism (need to have three types, rather than two)

- SCALE UP SPORTS, INJURIES, GOALS AND PREFERENCES

AFTER LAUNCH
- improve graphics on child forecast chart
    - Don't use red for negative on child projections
    - Switch colors to better palette on child forecast

- Prefill not working again




- Archive old render projects / remove them.
- Find a good way to do tests of all of this.


