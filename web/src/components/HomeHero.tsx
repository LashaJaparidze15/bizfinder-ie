"use client";

import { motion, type Variants } from "framer-motion";
import { Sparkles } from "lucide-react";
import { Icon } from "@/components/Icon";
import { WavesBackground } from "@/components/ui/waves-background";
import { TypewriterEffect } from "@/components/ui/typewriter-effect";
import { ExploreArea } from "@/components/ExploreArea";

type County = { slug: string; county: string; count: number };

const container: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1, delayChildren: 0.05 } },
};
const item: Variants = {
  hidden: { opacity: 0, y: 22 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] } },
};

export function HomeHero({ counties }: { counties: County[] }) {
  const totalBiz = counties.reduce((s, c) => s + (c.count ?? 0), 0);

  return (
    <section className="relative isolate overflow-hidden border-b border-border/60">
      <WavesBackground />
      {/* glow blobs */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-1/2 top-0 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-primary/[0.06] blur-[140px]" />
        <div className="absolute bottom-0 right-0 h-[360px] w-[360px] rounded-full bg-accent/[0.06] blur-[120px]" />
      </div>

      <motion.div
        variants={container}
        initial="hidden"
        animate="visible"
        className="relative z-10 mx-auto flex w-full max-w-5xl flex-col items-center px-5 pt-16 pb-12 text-center sm:pt-24 sm:pb-16"
      >
        <motion.span
          variants={item}
          className="mb-5 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-background/70 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-primary backdrop-blur"
        >
          <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
          Ireland&apos;s business directory
        </motion.span>

        {/* SEO h1 (the visible headline below is a decorative typewriter) */}
        <h1 className="sr-only">Find any Irish business — the national Irish business directory</h1>
        <motion.div
          variants={item}
          aria-hidden="true"
          className="mb-4"
          style={{ fontFamily: "var(--font-display)" }}
        >
          <TypewriterEffect
            words={[
              { text: "Find" },
              { text: "any" },
              { text: "Irish", className: "text-primary" },
              { text: "business", className: "text-primary" },
            ]}
            className="text-4xl tracking-tight sm:text-6xl"
            cursorClassName="bg-primary h-7 sm:h-12"
          />
        </motion.div>

        <motion.p variants={item} className="mb-8 max-w-xl text-base text-foreground/70 sm:text-lg">
          Search by name, type, town or phone number across all 26 counties — contact details,
          reviews and more.
        </motion.p>

        {/* Search */}
        <motion.div variants={item} className="search-shell w-full max-w-2xl text-left">
          <form className="search-form" action="/search" method="get">
            <span className="field">
              <span className="ico"><Icon name="search" /></span>
              <input name="q" placeholder="e.g. hotel, plumber, café" aria-label="Search term" />
            </span>
            <span className="field" style={{ flexBasis: 170 }}>
              <span className="ico"><Icon name="pin" /></span>
              <input name="county" placeholder="County (optional)" aria-label="County" />
            </span>
            <button type="submit">Search</button>
          </form>
          <form className="search-form" action="/search" method="get">
            <span className="field">
              <span className="ico"><Icon name="phone" /></span>
              <input name="phone" placeholder="Reverse lookup: who owns this number?" aria-label="Phone number" />
            </span>
            <button type="submit" className="btn-ghost">Look up</button>
          </form>
        </motion.div>

        {/* Stats */}
        {counties.length > 0 && (
          <motion.div variants={item} className="mt-7 flex flex-wrap items-center justify-center gap-x-9 gap-y-4">
            <Stat value={totalBiz.toLocaleString()} label="Businesses listed" />
            <Stat value={String(counties.length)} label="Counties covered" />
            <Stat value="Free" label="To search, always" />
          </motion.div>
        )}

        {/* Explore your area (geolocation → popular nearby categories) */}
        <motion.div variants={item} className="mt-8 flex w-full justify-center">
          <ExploreArea />
        </motion.div>
      </motion.div>
    </section>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="text-center">
      <div
        className="text-2xl font-extrabold tracking-tight text-foreground"
        style={{ fontFamily: "var(--font-display)" }}
      >
        {value}
      </div>
      <div className="text-xs text-foreground/55">{label}</div>
    </div>
  );
}
