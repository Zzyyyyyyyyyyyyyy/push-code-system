import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Code System · Push",
  description:
    "Per-customer rotating-code attribution system. Standalone demo of the Push code closed loop — no DB required.",
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
