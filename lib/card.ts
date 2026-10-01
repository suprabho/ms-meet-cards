// Draws the guest card. All coordinates are in the design's 1350x1080 space
// (the Canva export's viewBox units x 4/3); `scale` multiplies the output size.

export const CARD_W = 1350;
export const CARD_H = 1080;

const INK = "#e3efff";
const FONT = "Bozon";

// Photo hexagon (runs off the right edge of the card).
const HEX: [number, number][] = [
  [1286.79, 158.82],
  [821.57, 158.82],
  [588.96, 561.68],
  [821.57, 964.54],
  [1286.79, 964.54],
  [1519.4, 561.68],
];
// Visible part of the hexagon: the photo is cover-fitted to this box.
const PHOTO = { x: 588.96, y: 158.82, w: CARD_W - 588.96, h: 964.54 - 158.82 };

// Placeholder silhouette, centred in the visible part of the hexagon.
const SILHOUETTE = { x: 1000, headY: 470, headR: 118, shoulderY: 650, shoulderW: 520, color: "rgba(0, 20, 160, 0.22)" };

const INTRO = { text: "I’m speaking at", x: 38.18, y: 126.17, size: 55.97 };
// The logo lockup is drawn at 80% of the Canva size, scaled about its top-left
// corner (38.18, 168.04); the edition follows it.
const EDITION = { x: 89.74, y: 378.75, size: 45.07, maxWidth: 530 };
const NAME = { x: 38.18, lastBaseline: 676.24, size: 86.65, lineHeight: 73.22, maxWidth: 470, maxLines: 3, minSize: 44 };
const ROLE = { x: 38.18, y: 773.08, size: 53.3, lineHeight: 62, maxWidth: 470, maxLines: 3, minSize: 34, companyGap: 11 };
const UNDERLINE = { inset: 6, offset: 18, height: 4 };
const DATE = { x: 47.94, y: 1038.4, size: 37.18, weight: 400, maxWidth: 700 };

export type CardPhoto = {
  image: CanvasImageSource;
  width: number;
  height: number;
  /** 1 = cover fit. */
  zoom: number;
  /** Offset of the image centre from the photo box centre, in card units. */
  x: number;
  y: number;
};

export type CardData = {
  edition: string;
  date: string;
  name: string;
  role: string;
  company: string;
  photo: CardPhoto | null;
};

/** Keeps the photo covering the whole box; returns the clamped offset. */
export function clampPhoto(p: Pick<CardPhoto, "width" | "height" | "zoom" | "x" | "y">) {
  const s = Math.max(PHOTO.w / p.width, PHOTO.h / p.height) * p.zoom;
  const mx = (p.width * s - PHOTO.w) / 2;
  const my = (p.height * s - PHOTO.h) / 2;
  return { x: Math.min(mx, Math.max(-mx, p.x)), y: Math.min(my, Math.max(-my, p.y)), scale: s };
}

export function isOverPhoto(x: number, y: number) {
  return x >= PHOTO.x && y >= PHOTO.y && y <= PHOTO.y + PHOTO.h;
}

const font = (weight: number, size: number) => `${weight} ${size}px ${FONT}`;

/** Largest size <= `size` at which `text` fits in `maxWidth`. */
function fitSize(ctx: CanvasRenderingContext2D, text: string, weight: number, size: number, maxWidth: number) {
  ctx.font = font(weight, size);
  const w = ctx.measureText(text).width;
  return w > maxWidth ? (size * maxWidth) / w : size;
}

/** Greedy wrap. Words may also break after a hyphen ("Smith-" / "Jones"). */
function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  const lines: string[] = [];
  for (const word of text.trim().split(/\s+/)) {
    word.split(/(?<=-)(?=.)/).forEach((part, i) => {
      const last = lines.at(-1);
      const joined = last === undefined ? part : last + (i ? "" : " ") + part;
      if (last !== undefined && ctx.measureText(joined).width <= maxWidth) lines[lines.length - 1] = joined;
      else lines.push(part);
    });
  }
  return lines;
}

function drawName(ctx: CanvasRenderingContext2D, name: string) {
  // Shrink until the name wraps into the allowed number of lines, none overflowing.
  let size = NAME.size;
  let lines: string[] = [];
  for (; ; size -= 2) {
    ctx.font = font(800, size);
    lines = wrap(ctx, name, NAME.maxWidth);
    const fits = lines.length <= NAME.maxLines && lines.every((l) => ctx.measureText(l).width <= NAME.maxWidth);
    if (fits || size <= NAME.minSize) break;
  }
  lines = lines.slice(0, NAME.maxLines);
  const lh = NAME.lineHeight * (size / NAME.size);
  lines.forEach((line, i) => ctx.fillText(line, NAME.x, NAME.lastBaseline - (lines.length - 1 - i) * lh, NAME.maxWidth));
}

function drawRole(ctx: CanvasRenderingContext2D, role: string, company: string) {
  // "Role at Company": role in regular, company in bold, wrapped word by word.
  const words = (t: string) => t.split(/\s+/).filter(Boolean);
  const tokens = [
    ...words(role).map((text) => ({ text, weight: 400, gap: 0 })),
    ...(role && company ? [{ text: "at", weight: 400, gap: 0 }] : []),
    // The design sets the company in its own text box, slightly apart from "at".
    ...words(company).map((text, i) => ({ text, weight: 700, gap: role && i === 0 ? ROLE.companyGap : 0 })),
  ];
  if (!tokens.length) return;

  type Placed = { text: string; weight: number; x: number; line: number };
  const layout = (size: number) => {
    ctx.font = font(400, size);
    const space = ctx.measureText(" ").width;
    const placed: Placed[] = [];
    let x = 0;
    let line = 0;
    let widest = 0;
    for (const t of tokens) {
      ctx.font = font(t.weight, size);
      const w = ctx.measureText(t.text).width;
      let start = x ? x + space + (t.gap * size) / ROLE.size : 0;
      if (x && start + w > ROLE.maxWidth) (line++, (start = 0));
      placed.push({ text: t.text, weight: t.weight, x: start, line });
      x = start + w;
      widest = Math.max(widest, x);
    }
    return { placed, lines: line + 1, widest };
  };

  let size = ROLE.size;
  let l = layout(size);
  while ((l.lines > ROLE.maxLines || l.widest > ROLE.maxWidth) && size > ROLE.minSize) l = layout((size -= 2));

  const lh = ROLE.lineHeight * (size / ROLE.size);
  for (const t of l.placed) {
    if (t.line >= ROLE.maxLines) break;
    ctx.font = font(t.weight, size);
    ctx.fillText(t.text, ROLE.x + t.x, ROLE.y + t.line * lh, ROLE.maxWidth);
  }

  const x0 = ROLE.x + UNDERLINE.inset;
  const x1 = ROLE.x + Math.min(l.widest, ROLE.maxWidth);
  const y = ROLE.y + (Math.min(l.lines, ROLE.maxLines) - 1) * lh + UNDERLINE.offset;
  const g = ctx.createLinearGradient(x0, 0, x1, 0);
  g.addColorStop(0, "#ffffff");
  g.addColorStop(1, "#0047ab");
  ctx.save();
  ctx.globalAlpha = 0.43;
  ctx.fillStyle = g;
  ctx.fillRect(x0, y, x1 - x0, UNDERLINE.height);
  ctx.restore();
}

/** Generic head-and-shoulders outline shown in the hexagon until a photo is added. */
function drawSilhouette(ctx: CanvasRenderingContext2D) {
  const S = SILHOUETTE;
  ctx.save();
  ctx.beginPath();
  HEX.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
  ctx.closePath();
  ctx.clip();
  ctx.fillStyle = S.color;
  ctx.beginPath();
  ctx.arc(S.x, S.headY, S.headR, 0, Math.PI * 2);
  ctx.fill();
  // Shoulders: a wide rounded dome that runs off the bottom of the hexagon.
  ctx.beginPath();
  ctx.moveTo(S.x - S.shoulderW / 2, PHOTO.y + PHOTO.h);
  ctx.bezierCurveTo(S.x - S.shoulderW / 2, S.shoulderY + 70, S.x - S.shoulderW / 4, S.shoulderY, S.x, S.shoulderY);
  ctx.bezierCurveTo(S.x + S.shoulderW / 4, S.shoulderY, S.x + S.shoulderW / 2, S.shoulderY + 70, S.x + S.shoulderW / 2, PHOTO.y + PHOTO.h);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

export function drawCard(
  canvas: HTMLCanvasElement,
  background: CanvasImageSource,
  data: CardData,
  { scale = 1, placeholders = false } = {},
) {
  canvas.width = CARD_W * scale;
  canvas.height = CARD_H * scale;
  const ctx = canvas.getContext("2d")!;
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.imageSmoothingQuality = "high";
  ctx.fontKerning = "none"; // the Canva design is set without kerning
  ctx.drawImage(background, 0, 0, CARD_W, CARD_H);

  if (data.photo) {
    const { image, width, height } = data.photo;
    const { x, y, scale: s } = clampPhoto(data.photo);
    ctx.save();
    ctx.beginPath();
    HEX.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
    ctx.closePath();
    ctx.clip();
    const cx = PHOTO.x + PHOTO.w / 2 + x;
    const cy = PHOTO.y + PHOTO.h / 2 + y;
    ctx.drawImage(image, cx - (width * s) / 2, cy - (height * s) / 2, width * s, height * s);
    ctx.restore();
  } else if (placeholders) {
    drawSilhouette(ctx);
  }

  ctx.fillStyle = INK;
  ctx.textBaseline = "alphabetic";

  ctx.font = font(400, INTRO.size);
  ctx.fillText(INTRO.text, INTRO.x, INTRO.y);

  const edition = data.edition.toUpperCase();
  ctx.font = font(800, fitSize(ctx, edition, 800, EDITION.size, EDITION.maxWidth));
  ctx.fillText(edition, EDITION.x, EDITION.y);

  const date = data.date.toUpperCase();
  ctx.font = font(DATE.weight, fitSize(ctx, date, DATE.weight, DATE.size, DATE.maxWidth));
  ctx.fillText(date, DATE.x, DATE.y);

  const name = data.name.trim() || (placeholders ? "Your Name" : "");
  if (name) drawName(ctx, name);

  const role = data.role.trim();
  const company = data.company.trim();
  if (role || company) drawRole(ctx, role, company);
  else if (placeholders) drawRole(ctx, "Role", "Company");
}
