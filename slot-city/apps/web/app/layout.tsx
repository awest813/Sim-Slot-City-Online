import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Slot City 🎰 — The Social Casino",
  description: "A free-to-play isometric social casino browser game. Virtual chips only.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
