import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Guest Card Generator · Merkle Science Meet",
  description: "Create your “I’m going to Merkle Science Meet” card to share.",
};

export const viewport: Viewport = { themeColor: "#020a4a" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
