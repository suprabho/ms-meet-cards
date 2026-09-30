export type EventInfo = {
  slug: string;
  /** Shown under the logo, e.g. "LAS VEGAS 2026". */
  edition: string;
  /** Shown in the bottom bar, e.g. "TUESDAY, OCTOBER 6". */
  date: string;
};

// Used when no sheet is configured, or the sheet can't be read.
const FALLBACK: EventInfo[] = [{ slug: "las-vegas-2026", edition: "LAS VEGAS 2026", date: "TUESDAY, OCTOBER 6" }];

const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

/** Accepts a normal share/edit link or a "Publish to web" CSV link. */
function csvUrl(sheetUrl: string): string {
  if (sheetUrl.includes("/spreadsheets/d/e/")) return sheetUrl;
  const id = sheetUrl.match(/\/spreadsheets\/d\/([\w-]+)/)?.[1];
  if (!id) return sheetUrl;
  const gid = sheetUrl.match(/[#&?]gid=(\d+)/)?.[1] ?? "0";
  return `https://docs.google.com/spreadsheets/d/${id}/export?format=csv&gid=${gid}`;
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') (cell += '"'), i++;
      else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") row.push(cell), (cell = "");
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell), rows.push(row), (row = []), (cell = "");
    } else cell += c;
  }
  if (cell || row.length) row.push(cell), rows.push(row);
  return rows;
}

/**
 * Reads events from the sheet. Expected header row: `edition`, `date`, and
 * optionally `slug` and `active`. The first active row is the default event.
 */
export async function getEvents(): Promise<EventInfo[]> {
  const sheetUrl = process.env.EVENTS_SHEET_URL;
  if (!sheetUrl) return FALLBACK;
  try {
    const res = await fetch(csvUrl(sheetUrl), { next: { revalidate: 60 } });
    const text = await res.text();
    // A sheet that isn't link-shared answers with an HTML sign-in page.
    if (!res.ok || text.trimStart().startsWith("<")) throw new Error(`sheet not readable (HTTP ${res.status})`);

    const [header, ...rows] = parseCsv(text);
    const col = (name: string) => header.findIndex((h) => h.trim().toLowerCase() === name);
    const [iEdition, iDate, iSlug, iActive] = [col("edition"), col("date"), col("slug"), col("active")];
    if (iEdition < 0 || iDate < 0) throw new Error('sheet needs "edition" and "date" columns');

    const events = rows
      .filter((r) => r[iEdition]?.trim())
      .filter((r) => iActive < 0 || !/^(false|no|0|n)$/i.test(r[iActive]?.trim() ?? ""))
      .map((r) => {
        const edition = r[iEdition].trim();
        return { edition, date: r[iDate]?.trim() ?? "", slug: (iSlug >= 0 && r[iSlug]?.trim()) || slugify(edition) };
      });
    if (!events.length) throw new Error("sheet has no active rows");
    return events;
  } catch (err) {
    console.error("[events] falling back to defaults:", err);
    return FALLBACK;
  }
}
