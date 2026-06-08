import type { Metadata } from "next";
import "./globals.css";

// Tolerate SITE_URL set without a protocol (e.g. "foo.vercel.app") — new URL() would otherwise throw.
const rawSite = process.env.SITE_URL || "http://localhost:3000";
const siteUrl = /^https?:\/\//.test(rawSite) ? rawSite : `https://${rawSite}`;

export const metadata: Metadata = {
  title: {
    default: "bizfinder.ie — Find Irish businesses",
    template: "%s — bizfinder.ie",
  },
  description:
    "Search Irish businesses by name, type, location or phone number. The national business directory.",
  metadataBase: new URL(siteUrl),
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="container" style={{ paddingBottom: 0 }}>
          <a href="/" style={{ fontWeight: 700, fontSize: 20, color: "#1a1a1a" }}>
            bizfinder<span style={{ color: "#0b6" }}>.ie</span>
          </a>
        </header>
        {children}
      </body>
    </html>
  );
}
