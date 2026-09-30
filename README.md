# Merkle Science Meet — guest card generator

Guests enter their name, role and company, add a photo, and download an
"I'm speaking at Merkle Science Meet" card (1350 × 1080, or 2700 × 2160 at 2x).
The card is drawn on a canvas in the browser; photos are never uploaded.

```bash
pnpm install
pnpm dev        # http://localhost:3500
```

## Fonts and deploying

The card uses Bozon (Regular, Bold, Extra Bold). The font files are licensed,
so they are not in this repo: put `Bozon-Regular.otf`, `Bozon-Bold.otf` and
`Bozon-ExtraBold.otf` in `public/fonts/` before running or deploying. The
Canva source export is kept out of the repo for the same reason.

Pushing to `main` deploys to production through
`.github/workflows/deploy.yml`. It needs the `VERCEL_TOKEN`, `VERCEL_ORG_ID`
and `VERCEL_PROJECT_ID` repo secrets. Since the fonts are git-ignored, the
workflow copies them from the live site (or from the `FONTS_BASE_URL` repo
variable) and stops if they are missing.

To deploy by hand from a machine that has the fonts:

```bash
vercel deploy --prod
```

## Updating the edition and date (Google Sheet)

The edition (under the logo) and the date (bottom bar) come from a Google Sheet.

1. Create a sheet with this header row:

   | edition        | date               | active | slug (optional) |
   | -------------- | ------------------ | ------ | --------------- |
   | Las Vegas 2026 | Tuesday, October 6 | TRUE   |                 |

   Format the `date` column as **Plain text** so Sheets doesn't reformat it.
   Both values are upper-cased on the card.
2. Share → General access → **Anyone with the link: Viewer**.
3. Set `EVENTS_SHEET_URL` to the sheet's normal browser URL (`.env.local`
   locally, an environment variable on the host).

Edits show up within about a minute. The first active row is the default
event; with several active rows guests get an event picker, and
`/?event=<slug>` links straight to one (slug defaults to the edition,
e.g. `las-vegas-2026`). Set `active` to `FALSE` to hide a row. If the sheet
is missing or unreadable the defaults in `lib/events.ts` are used.

## Updating the design

The static artwork is `public/card-bg.png`, built from the Canva SVG export
with the sample text and photo stripped out:

```bash
pnpm build:bg   # needs Google Chrome; reads "Copy of SPEAKER ANNOUNCEMENT (2).svg"
```

Text positions, sizes and the photo hexagon live at the top of `lib/card.ts`.
If the layout moves in Canva, update those and the match patterns in
`scripts/build-template.mjs`.
