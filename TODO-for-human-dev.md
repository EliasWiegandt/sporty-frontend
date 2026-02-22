(for the developer. Codex and agents: you can ignore this file)

# TODO
- Add vendor contracts
- Have Codex look once more at the compliance parts - what legals things should we fix
- Decide on how we handle non-identifiability. Maybe remove birthdays?
- Finalize terms of service
- Finalize privacy notice
- Stripe tax stuff
- Talk pricing with GPT (tax inclusive, EUR vs. USD price)

- Add more context to generation of data, texts and images.
- iterate on prompts, yep, all of them

- And we also need to fix a mobile version

- Fix that traits data appear to be still prefilled even after consent withdrawn for test.paid
- improve graphics on child forecast chart
- Review the quick results page
- Review the premium analysis results page
- Find a good way to do tests of all of this.

Vendor contracts
Pull vendor legal docs from each portal (Supabase, Cloudflare, Render, GitHub).
Save in one folder structure (vendor/<name>/<date>/).
Fill DPA status + SCC/TIA status row-by-row.
Mark unknowns as pending with due date.
Add renewal dates + owner (you).
Se vendor-contracts.md
