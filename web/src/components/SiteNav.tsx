"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, LayoutGrid, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type Item = { name: string; url: string; icon: LucideIcon };

const items: Item[] = [
  { name: "Home", url: "/", icon: Home },
  { name: "Browse", url: "/#counties", icon: LayoutGrid },
];

// Vertical pill nav on large screens (left edge), floating bottom bar on smaller.
export function SiteNav() {
  const pathname = usePathname();
  const activeName = pathname === "/" ? "Home" : "";

  return (
    <>
      {/* Desktop: vertical, left edge */}
      <nav className="fixed left-5 top-1/2 z-50 hidden -translate-y-1/2 flex-col gap-1 rounded-2xl border border-border bg-background/70 p-2 shadow-lg backdrop-blur-lg xl:flex">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = activeName === item.name;
          return (
            <Link
              key={item.name}
              href={item.url}
              className={cn(
                "relative flex w-[68px] flex-col items-center gap-1 rounded-xl px-3 py-3 text-xs font-semibold transition-colors",
                "text-foreground/70 hover:text-primary",
                isActive && "bg-primary/5 text-primary"
              )}
            >
              <Icon size={20} strokeWidth={2.2} aria-hidden="true" />
              <span>{item.name}</span>
              {isActive && (
                <span className="absolute -right-[7px] top-1/2 h-7 w-1 -translate-y-1/2 rounded-l-full bg-primary">
                  <span className="absolute -left-2 -top-1 h-9 w-5 rounded-full bg-primary/20 blur-md" />
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Mobile / tablet: floating bottom pill */}
      <nav className="fixed bottom-0 left-1/2 z-50 mb-5 flex -translate-x-1/2 items-center gap-2 rounded-full border border-border bg-background/70 px-2 py-1 shadow-lg backdrop-blur-lg xl:hidden">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = activeName === item.name;
          return (
            <Link
              key={item.name}
              href={item.url}
              className={cn(
                "relative flex items-center gap-2 rounded-full px-5 py-2 text-sm font-semibold transition-colors",
                "text-foreground/70 hover:text-primary",
                isActive && "bg-primary/5 text-primary"
              )}
            >
              <Icon size={18} strokeWidth={2.4} aria-hidden="true" />
              <span>{item.name}</span>
              {isActive && (
                <span className="absolute -top-[7px] left-1/2 h-1 w-7 -translate-x-1/2 rounded-b-full bg-primary">
                  <span className="absolute -top-2 -left-1 h-5 w-9 rounded-full bg-primary/20 blur-md" />
                </span>
              )}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
