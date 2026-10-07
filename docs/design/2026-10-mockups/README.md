# October 2026 mockups, as HTML

The 22 PNG mockups (`originals/`, compressed copies of `~/Desktop/Salif/Projects/Ntizo/mockps`) rebuilt as static HTML with the same layout, sizes, colours, copy and data. This is the reference the app is built to.

- Open `index.html`. "Comparar" shows each PNG and its HTML side by side at the same size.
- `shared.css` holds the measured tokens and the console shell. `admin/admin.css` holds the admin shell (deeper navy, "Admin" under the logo). `client/public.css` holds the public header.
- Every photo and avatar in `assets/` is cropped from the mockups (`tools/crop.py`).
- `tools/compare.py` puts a mockup's app area beside a render for review.

The generator drew the shell at slightly different scales from one PNG to the next (the top bar is 62–91px tall). Each page matches its own PNG; the app uses one scale for all of them, Reservas' (`provider/reservas.html`).
