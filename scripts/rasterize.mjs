// Renders design/template.svg to public/card-bg.png at 2x (2700x2160) with headless Chrome.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const chrome = process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const html = path.resolve("design/.template.html");
fs.writeFileSync(
  html,
  '<!doctype html><style>html,body{margin:0}img{display:block;width:1350px;height:1080px}</style><img src="template.svg">',
);
try {
  execFileSync(chrome, [
    "--headless=new",
    "--hide-scrollbars",
    "--force-device-scale-factor=2",
    "--window-size=1350,1080",
    `--screenshot=${path.resolve("public/card-bg.png")}`,
    `file://${html}`,
  ]);
} finally {
  fs.rmSync(html);
}
console.log("wrote public/card-bg.png");
