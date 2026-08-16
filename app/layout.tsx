import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "cursor-projekt · Tasks",
  description: "A minimal full-stack task manager demo running on Next.js.",
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
