import type { Metadata, Viewport } from "next";
import { Fraunces, Archivo } from "next/font/google";
import "./globals.css";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
});

const archivo = Archivo({
  subsets: ["latin"],
  variable: "--font-archivo",
});

export const metadata: Metadata = {
  title: "Tasting notes",
  // Makes Add to Home Screen behave like an app rather than a browser tab.
  manifest: "/manifest.json",
  appleWebApp: { capable: true, title: "Tasting", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#e8eae1",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${fraunces.variable} ${archivo.variable}`}>
      <body>{children}</body>
    </html>
  );
}
