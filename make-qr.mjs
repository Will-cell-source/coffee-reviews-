// npm run qr  ->  writes one SVG per station into ./qr
// Encodes your own URL directly. No QR service, no subscription, no redirect
// that can die and take every sticker in the building with it.
import QRCode from "qrcode";
import { mkdir, writeFile } from "node:fs/promises";

const SITE = process.env.SITE_URL || "https://taste.yourroastery.co";
const STATIONS = ["espresso", "cupping", "brew"];

await mkdir("qr", { recursive: true });

for (const s of STATIONS) {
  const url = `${SITE}/s/${s}`;
  const svg = await QRCode.toString(url, {
    type: "svg",
    errorCorrectionLevel: "H",
    margin: 2,
    color: { dark: "#232a1e", light: "#ffffff" },
  });
  await writeFile(`qr/${s}.svg`, svg);
  console.log(`qr/${s}.svg  ->  ${url}`);
}

console.log("\nPrint at 10cm square minimum. Test on an old phone before laminating.");
