import type { Metadata } from "next";
import Link from "next/link";
import { Inter, Sora } from "next/font/google";
import { SiteNav } from "@/components/SiteNav";
import { Button } from "@/components/ui/button";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
const sora = Sora({ subsets: ["latin"], weight: ["600", "700", "800"], variable: "--font-display", display: "swap" });

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
  verification: { google: "yFjM4JljT5O9TsZzViKrnFjVUmQbHlFSpKq1xezyhE8" },
};

function LogoMark() {
  return (
    <svg width="62%" height="62%" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 3 21 12 12 21 3 12Z" fill="#fff" fillOpacity="0.95" />
      <circle cx="12" cy="12" r="2.4" fill="var(--brand-700)" />
    </svg>
  );
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${sora.variable}`}>
      <body>
        <header className="site-header">
          <div className="site-header__inner">
            <Link href="/" className="brand">
              <span className="brand__mark"><LogoMark /></span>
              bizfinder<span className="brand__tld">.ie</span>
            </Link>
            <nav className="nav">
              <Link href="/for-business" aria-label="Enter as a business">
                <Button variant="solid" size="sm">Enter as business</Button>
              </Link>
            </nav>
          </div>
        </header>

        <SiteNav />

        {children}

        <footer className="site-footer">
          <div className="site-footer__inner">
            <Link href="/" className="brand" style={{ fontSize: "1.05rem" }}>
              <span className="brand__mark" style={{ width: 26, height: 26 }}><LogoMark /></span>
              bizfinder<span className="brand__tld">.ie</span>
            </Link>
            <span>The national Irish business directory · {new Date().getFullYear()}</span>
            <span style={{ display: "flex", gap: 16 }}>
              <Link href="/search">Search</Link>
              <Link href="/#counties">Counties</Link>
            </span>
          </div>
        </footer>
      </body>
    </html>
  );
}
