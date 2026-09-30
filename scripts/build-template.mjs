// One-off: turns the Canva SVG export into the static card background.
// Strips everything the generator draws itself (edition, name, role/company,
// date, sample photo) and writes design/template.svg. Rasterise it with:
//   pnpm build:bg
// Canva regenerates ids on every export, so elements are matched by position.
import fs from "node:fs";

const [src = "Copy of SPEAKER ANNOUNCEMENT (2).svg", out = "design/template.svg"] = process.argv.slice(2);
const svg = fs.readFileSync(src, "utf8");

// Minimal tag tree: [{ tag, open, start, end, children }]
const root = { children: [] };
const stack = [root];
const re = /<(\/?)([a-zA-Z]+)\b[^>]*?(\/?)>/g;
let m;
while ((m = re.exec(svg))) {
  const [text, closing, tag, selfClosing] = m;
  if (closing) {
    const node = stack.pop();
    node.end = m.index + text.length;
    continue;
  }
  const node = { tag, open: text, start: m.index, end: m.index + text.length, children: [] };
  stack.at(-1).children.push(node);
  if (!selfClosing) stack.push(node);
}

const top = root.children[0].children;
const inner = (n) => svg.slice(n.start, n.end);
const remove = [];
// Logo lockup (icon + wordmark) is scaled about its top-left corner.
const LOGO = { scale: 0.8, x: 28.636719, y: 126.027344 };
const logo = [];

for (const n of top) {
  if (n.tag === "path" && n.open.includes('fill="#ffffff"')) logo.push(n);
  if (n.tag !== "g") continue;
  // The logo icon is a lone white path inside a clip group.
  if (n.children.length === 1 && n.children[0].tag === "path" && n.children[0].open.includes('fill="#ffffff"')) logo.push(n);
  const s = inner(n);
  // Edition ("LAS VEGAS 2026"), name and role/company blocks are offset groups.
  if (/^<g transform="matrix\(1, 0, 0, 1, (0, 201|28, 387|28, 540)\)"/.test(n.open)) remove.push(n);
  // Date glyphs sit on the bottom bar baseline.
  else if (n.open.startsWith('<g fill="#e3efff"') && /translate\([\d.]+, 781\.\d+\)/.test(s)) remove.push(n);
  // Sample photo: the 400x400 image inside the hexagon group.
  else if (n.open.includes("398, 66")) {
    const hex = n.children[0].children;
    const photo = hex.find((c) => /<image[^>]*width="400"/.test(inner(c)));
    if (!photo) throw new Error("photo group not found");
    remove.push(photo);
  }
}
if (remove.length < 5) throw new Error(`expected to strip at least 5 groups, found ${remove.length}`);

if (logo.length < 10) throw new Error(`expected the logo paths, found ${logo.length}`);

const edits = remove.map((n) => ({ start: n.start, end: n.end, text: "" }));
const { scale, x, y } = LOGO;
edits.push({
  start: Math.min(...logo.map((n) => n.start)),
  end: Math.min(...logo.map((n) => n.start)),
  text: `<g transform="translate(${x} ${y}) scale(${scale}) translate(${-x} ${-y})">`,
});
edits.push({ start: Math.max(...logo.map((n) => n.end)), end: Math.max(...logo.map((n) => n.end)), text: "</g>" });

let result = svg;
for (const e of edits.sort((a, b) => b.start - a.start)) result = result.slice(0, e.start) + e.text + result.slice(e.end);
fs.writeFileSync(out, result);
console.log(`scaled ${logo.length} logo nodes, stripped ${remove.length} groups -> ${out} (${(result.length / 1e6).toFixed(2)} MB)`);
