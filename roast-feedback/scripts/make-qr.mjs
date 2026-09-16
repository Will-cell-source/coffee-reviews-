// npm run qr  ->  writes the sticker SVG into ./qr
// Encodes your own URL directly. No QR service, no subscription, no redirect
// that can die and take every sticker in the building with it.
import QRCode from "qrcode";
import { mkdir, writeFile } from "node:fs/promises";

const SITE = process.env.SITE_URL || "https://taste.yourroastery.co";
await mkdir("qr", { recursive: true });

{
  const url = SITE;
  const svg = await QRCode.toString(url, {
    type: "svg",
    errorCorrectionLevel: "H",
    margin: 2,
    color: { dark: "#232a1e", light: "#ffffff" },
  });
  await writeFile("qr/sticker.svg", svg);
  console.log(`qr/sticker.svg  ->  ${url}`);
}

console.log("\nPrint at 10cm square minimum. Test on an old phone before laminating.");
