"use client";

import React, { useState } from "react";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, Plus, Minus } from "lucide-react";
import { useUser } from "../lib/supabase/useUser";
import { createClient } from "../lib/supabase/client";
import ShapesWordmark from "./_components/ShapesWordmark";
import { QUESTIONS } from "../lib/questions";

/* ==========================================================================
   FRAMELY — built against DESIGN-framer.md
   Every color/type/radius/spacing value below is pulled directly from the
   spec's token tables. Referenced inline as { tokens.* } in comments so it's
   traceable back to the source doc.
========================================================================== */

const colors = {
  primary: "#ffffff",          // {colors.primary}
  onPrimary: "#000000",        // {colors.on-primary}
  accentBlue: "#0099ff",       // {colors.accent-blue}
  ink: "#ffffff",              // {colors.ink}
  inkMuted: "#999999",         // {colors.ink-muted}
  canvas: "#090909",           // {colors.canvas}
  surface1: "#141414",         // {colors.surface-1}
  surface2: "#1c1c1c",         // {colors.surface-2}
  hairline: "#262626",         // {colors.hairline}
  hairlineSoft: "#1a1a1a",     // {colors.hairline-soft}
  gradientMagenta: "#d44df0",
  gradientViolet: "#6a4cf5",
  gradientOrange: "#ff7a3d",
  gradientCoral: "#ff5577",
  success: "#22c55e",
};

const radius = {
  xs: 4, sm: 6, md: 10, lg: 15, xl: 20, xxl: 30, pill: 100, full: 9999,
};

const space = {
  hair: 1, xxs: 4, xs: 8, sm: 12, md: 15, lg: 20, xl: 30, xxl: 40, section: 96,
};

// {typography.*} — GT Walsheim unavailable, substituted with Inter per the
// spec's own fallback note (600–700 weight, tracking preserved as %-of-size).
const type = {
  displayXXL: { fontSize: "clamp(2.6rem, 8vw, 6.875rem)", fontWeight: 600, lineHeight: 0.85, letterSpacing: "-0.05em" },
  displayXL: { fontSize: "clamp(2.3rem, 6.5vw, 5.3125rem)", fontWeight: 600, lineHeight: 0.95, letterSpacing: "-0.05em" },
  displayLG: { fontSize: "clamp(2rem, 4.6vw, 3.875rem)", fontWeight: 600, lineHeight: 1.0, letterSpacing: "-0.05em" },
  displayMD: { fontSize: "2rem", fontWeight: 600, lineHeight: 1.13, letterSpacing: "-0.03em" },
  headline: { fontSize: 22, fontWeight: 700, lineHeight: 1.2, letterSpacing: "-0.036em" },
  subhead: { fontSize: 24, fontWeight: 400, lineHeight: 1.3, letterSpacing: "-0.0004em" },
  bodyLg: { fontSize: 18, fontWeight: 400, lineHeight: 1.3, letterSpacing: "-0.01em" },
  body: { fontSize: 15, fontWeight: 400, lineHeight: 1.3, letterSpacing: "-0.01em" },
  bodySm: { fontSize: 14, fontWeight: 500, lineHeight: 1.4, letterSpacing: "-0.01em" },
  caption: { fontSize: 13, fontWeight: 500, lineHeight: 1.2, letterSpacing: "-0.01em" },
  micro: { fontSize: 12, fontWeight: 400, lineHeight: 1.2, letterSpacing: "-0.01em" },
  button: { fontSize: 14, fontWeight: 500, lineHeight: 1.0, letterSpacing: "-0.01em" },
};

const feat = '"cv01" 1, "cv05" 1, "cv09" 1, "cv11" 1, "ss03" 1, "ss07" 1, "dlig" 1';
const featNum = feat + ', "tnum" 1';

const fontImport = `@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');`;

/* ---------------- buttons — {components.button-*} ---------------- */
function ButtonPrimary({ children, style = {}, href, ...rest }: { children: React.ReactNode; style?: React.CSSProperties; href?: string; [key: string]: unknown }) {
  const sharedStyle = {
    backgroundColor: colors.primary,
    color: colors.onPrimary,
    ...type.button,
    borderRadius: radius.pill,
    padding: "10px 15px",
    border: "none",
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    cursor: "pointer",
    textDecoration: "none",
    ...style,
  };
  if (href) {
    return (
      <Link href={href} className="framely-btn-primary framely-focus" style={sharedStyle}>
        {children}
      </Link>
    );
  }
  return (
    <button className="framely-btn-primary framely-focus" style={sharedStyle} {...rest}>
      {children}
    </button>
  );
}

function ButtonSecondary({ children, style = {}, href, ...rest }: { children: React.ReactNode; style?: React.CSSProperties; href?: string; [key: string]: unknown }) {
  const sharedStyle = {
    backgroundColor: colors.surface1,
    color: colors.ink,
    ...type.button,
    borderRadius: radius.pill,
    padding: "10px 15px",
    border: "none",
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    cursor: "pointer",
    textDecoration: "none",
    ...style,
  };
  if (href) {
    return (
      <Link href={href} className="framely-btn-secondary framely-focus" style={sharedStyle}>
        {children}
      </Link>
    );
  }
  return (
    <button className="framely-btn-secondary framely-focus" style={sharedStyle} {...rest}>
      {children}
    </button>
  );
}

/* ---------------- product mockup tile — {components.product-mockup-tile} ---------------- */
function MockupTile({ children, style = {}, chrome = true, className = "" }: { children: React.ReactNode; style?: React.CSSProperties; chrome?: boolean; className?: string }) {
  return (
    <div
      className={className}
      style={{
        backgroundColor: colors.surface1,
        borderRadius: radius.xl,
        padding: 16,
        boxShadow: "inset 0 0.5px 0 rgba(255,255,255,0.10), 0 10px 30px rgba(0,0,0,0.25)",
        ...style,
      }}
    >
      {chrome && (
        <div className="flex items-center gap-1.5 mb-3 px-1">
          {[colors.hairline, colors.hairline, colors.hairline].map((cCol, i) => (
            <span key={i} style={{ width: 8, height: 8, borderRadius: radius.full, backgroundColor: cCol }} />
          ))}
        </div>
      )}
      {children}
    </div>
  );
}

/* ---------------- gradient spotlight card — {components.gradient-spotlight-card*} ---------------- */
function SpotlightCard({ variant = "violet", children, style = {} }: { variant?: "violet" | "magenta" | "orange" | "coral"; children: React.ReactNode; style?: React.CSSProperties }) {
  const bg =
    variant === "magenta" ? colors.gradientMagenta :
    variant === "orange" ? colors.gradientOrange :
    variant === "coral" ? colors.gradientCoral :
    colors.gradientViolet;
  return (
    <div
      style={{
        background: `radial-gradient(120% 140% at 20% 15%, rgba(255,255,255,0.22), transparent 55%), ${bg}`,
        color: colors.ink,
        borderRadius: radius.xxl,
        padding: 32,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/* ---------------- pricing-tab style pill switcher, repurposed for signals ---------------- */
function PillTab({ active, children, ...rest }: { active: boolean; children: React.ReactNode; [key: string]: unknown }) {
  return (
    <button
      className="framely-focus"
      style={{
        backgroundColor: active ? colors.surface2 : colors.canvas,
        color: active ? colors.ink : colors.inkMuted,
        ...type.button,
        borderRadius: radius.pill,
        padding: "8px 14px",
        border: `1px solid ${active ? "transparent" : colors.hairline}`,
        cursor: "pointer",
        whiteSpace: "nowrap",
      }}
      {...rest}
    >
      {children}
    </button>
  );
}

const SIGNALS = [
  { key: "eyes", label: "Eye contact", metrics: [["Camera engagement", "87%"], ["Longest look-away", "4.2s"], ["Gaze stability", "steady"]] },
  { key: "posture", label: "Posture", metrics: [["Upright posture", "91%"], ["Forward lean spikes", "2"], ["Shoulder symmetry", "balanced"]] },
  { key: "gestures", label: "Gestures", metrics: [["Hands visible", "94%"], ["Self-touch gestures", "3"], ["Gesture pace", "natural"]] },
  { key: "expression", label: "Expression", metrics: [["Expressiveness range", "moderate–high"], ["Smile timing", "on-topic"], ["Jaw tension", "low"]] },
  { key: "answer", label: "Answer content", metrics: [["STAR structure", "complete"], ["Filler words", "4"], ["Answer length", "1m 42s"]] },
];

const FAQS = [
  { q: "How does Framely score my answers?", a: "Two passes: a pose/gaze model reads eye contact, posture, gestures, and expression at 30fps, and a separate language pass checks your transcript for structure, relevance, and filler words. Both feed into one report." },
  { q: "Is my video stored?", a: "Sessions are kept so you can review past reports and track change over time. You can delete any session, or your whole account, at any point." },
  { q: "Do I need special equipment?", a: "No, a laptop webcam and a normal room light is enough. Framely calibrates to your setup in the first few seconds of a session." },
];

export default function FramelyLanding() {
  const [activeSignal, setActiveSignal] = useState(0);
  const [openFaq, setOpenFaq] = useState(0);
  const active = SIGNALS[activeSignal];
  const { user, loading: userLoading } = useUser();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
  }

  return (
    <div style={{ backgroundColor: colors.canvas, color: colors.ink, fontFamily: "'Inter', sans-serif", fontFeatureSettings: feat }} className="min-h-screen w-full">
      <style>{`
        ${fontImport}
        * { box-sizing: border-box; }
        .framely-btn-primary { transition: filter 150ms ease, transform 100ms ease; }
        .framely-btn-primary:hover { filter: brightness(0.92); }
        .framely-btn-primary:active { transform: scale(0.96); }
        .framely-btn-secondary { transition: background-color 150ms ease, transform 100ms ease; }
        .framely-btn-secondary:hover { background-color: ${colors.surface2}; }
        .framely-btn-secondary:active { transform: scale(0.96); }
        .framely-link { color: ${colors.accentBlue}; text-decoration: none; }
        .framely-link:hover { text-decoration: underline; }
        .framely-nav-link { color: ${colors.inkMuted}; text-decoration: none; transition: color 150ms ease; }
        .framely-nav-link:hover { color: ${colors.ink}; }
        .framely-focus:focus-visible { outline: none; box-shadow: 0 0 0 1px rgba(0,153,255,0.6), 0 0 0 4px rgba(0,153,255,0.15); }
        .framely-row:hover { background-color: ${colors.surface1}; }
        .framely-card { transition: background-color 150ms ease; }
      `}</style>

      {/* ============ TOP NAV, components.top-nav ============ */}
      <header className="sticky top-0 z-30" style={{ backgroundColor: colors.canvas, borderBottom: `1px solid ${colors.hairlineSoft}` }}>
        <div className="max-w-6xl mx-auto px-6 flex items-center justify-between" style={{ height: 64 }}>
          <span style={{ ...type.headline, fontSize: 18 }} aria-label="Framely" role="img">
            {/* Plain img so the existing /public/framelyai_logo.png asset renders directly */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/framelyai_logo.png" alt="Framely" style={{ height: 24, width: "auto", display: "block" }} />
          </span>
          <nav className="hidden md:flex items-center gap-8" style={{ ...type.bodySm, fontWeight: 500 }}>
            <a href="#product" className="framely-nav-link">Product</a>
            <a href="#how" className="framely-nav-link">How it works</a>
            <a href="#library" className="framely-nav-link">Question bank</a>
            <a href="#faq" className="framely-nav-link">FAQ</a>
          </nav>
          <div className="flex items-center gap-3">
            {!userLoading && user ? (
              <>
                <span className="hidden sm:inline" style={{ ...type.bodySm, color: colors.inkMuted }}>
                  {user.email}
                </span>
                <ButtonSecondary className="hidden sm:inline-flex" onClick={handleSignOut}>Sign out</ButtonSecondary>
              </>
            ) : (
              <ButtonSecondary href="/login" className="hidden sm:inline-flex">Sign in</ButtonSecondary>
            )}
            <ButtonPrimary href="/interview">Start practicing</ButtonPrimary>
          </div>
        </div>
      </header>

      {/* ============ HERO ============ */}
      <section className="max-w-6xl mx-auto px-6 pt-20 pb-16 md:pt-28">
        <div style={{ ...type.caption, color: colors.inkMuted, marginBottom: 20 }}>Mock interview scoring</div>
        <h1 style={{ ...type.displayXXL, maxWidth: 900 }}>
          What you said.
          <br />
          How it landed.
        </h1>
        <p style={{ ...type.bodyLg, color: colors.inkMuted, maxWidth: 520, marginTop: 28 }}>
          Framely scores your mock interview answers twice: once for structure and clarity, once for eye
          contact, posture, gestures, and expression, and hands you both in a single report.
        </p>
        <div className="flex flex-wrap items-center gap-3 mt-9">
          <ButtonPrimary href="/interview" style={{ padding: "13px 22px", fontSize: 15 }}>
            Start a mock interview <ArrowRight size={16} />
          </ButtonPrimary>
          <ButtonSecondary style={{ padding: "13px 22px", fontSize: 15 }}>
            See how it's scored
          </ButtonSecondary>
        </div>

        {/* hero mockup tile */}
        <MockupTile className="mt-16" style={{ padding: 16 }}>
          <div className="grid md:grid-cols-[1.3fr_1fr] gap-3">
            <div
              className="relative"
              style={{ backgroundColor: colors.canvas, borderRadius: radius.lg, aspectRatio: "16 / 10", overflow: "hidden" }}
            >
              <video
                src="/hero_vid.mp4"
                autoPlay
                loop
                muted
                playsInline
                aria-hidden="true"
                style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
              />
              <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-4 py-3" style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.55), transparent)" }}>
                <span style={{ ...type.micro, color: colors.ink }}>Q3 · &ldquo;tell me about a conflict&rdquo;</span>
                <span style={{ ...type.micro, color: colors.success }}>● live</span>
              </div>
              <div className="absolute bottom-4 left-4 right-4 flex gap-2">
                <span style={{ ...type.micro, backgroundColor: colors.surface2, padding: "5px 10px", borderRadius: radius.pill, backdropFilter: "blur(6px)" }}>
                  eye contact <b style={{ color: colors.ink }}>87%</b>
                </span>
                <span style={{ ...type.micro, backgroundColor: colors.surface2, padding: "5px 10px", borderRadius: radius.pill, backdropFilter: "blur(6px)" }}>
                  posture <b style={{ color: colors.ink }}>upright</b>
                </span>
              </div>
            </div>
            <div style={{ backgroundColor: colors.canvas, borderRadius: radius.lg, padding: 20 }}>
              <div style={{ ...type.caption, color: colors.inkMuted, marginBottom: 10 }}>Transcript</div>
              <p style={{ ...type.body, color: colors.ink, fontFeatureSettings: feat }}>
                &ldquo;...so I proposed we split the sprint into two workstreams so neither of us was blocked...&rdquo;
              </p>
              <div className="flex gap-2 mt-4">
                <span style={{ ...type.micro, color: colors.success }}>STAR complete</span>
                <span style={{ ...type.micro, color: colors.inkMuted }}>· filler ×4</span>
              </div>
            </div>
          </div>
        </MockupTile>
      </section>

      {/* ============ STAT STRIP — {components.feature-row} ============ */}
      <section style={{ borderTop: `1px solid ${colors.hairlineSoft}`, borderBottom: `1px solid ${colors.hairlineSoft}` }}>
        <div className="max-w-6xl mx-auto px-6 py-8 grid grid-cols-2 md:grid-cols-4 gap-6">
          {[["5", "signals scored per answer"], ["30fps", "pose & gaze sampling"], ["0", "extra hardware needed"], ["1", "webcam and a question bank"]].map(([n, l], i) => (
            <div key={i}>
              <div style={{ ...type.displayMD, fontSize: 26, fontFeatureSettings: featNum }}>{n}</div>
              <div style={{ ...type.caption, color: colors.inkMuted, marginTop: 4 }}>{l}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ============ WHAT FRAMELY SCORES — card grid + one spotlight ============ */}
      <section id="product" className="max-w-6xl mx-auto px-6 py-24">
        <div style={{ ...type.caption, color: colors.inkMuted, marginBottom: 16 }}>What Framely scores</div>
        <h2 style={{ ...type.displayLG, maxWidth: 620 }}>Delivery and content, in the same report.</h2>

        <div className="grid md:grid-cols-2 gap-5 mt-14">
          {[
            { h: "Eye contact", b: "How much of your answer you spend looking at the camera, and where your gaze drifts under pressure." },
            { h: "Posture", b: "Upright versus slouched, leaning in versus retreating, held or drifting through the answer." },
            { h: "Gestures", b: "Hands visible and purposeful versus hidden below frame, plus self-touch habits that read as nerves." },
            { h: "Expression", b: "Whether your face matches your words, and how that shifts across a harder question." },
          ].map((card, i) => (
            <div key={i} className="framely-card" style={{ backgroundColor: colors.surface1, borderRadius: radius.xl, padding: 24 }}>
              <div style={{ ...type.displayMD, fontSize: 22 }}>{card.h}</div>
              <p style={{ ...type.body, color: colors.inkMuted, marginTop: 10 }}>{card.b}</p>
            </div>
          ))}

          {/* the one gradient spotlight card in this grid */}
          <SpotlightCard variant="violet" style={{ gridColumn: "1 / -1" }}>
            <div style={{ ...type.caption, opacity: 0.85, marginBottom: 10 }}>Answer content</div>
            <div style={{ ...type.subhead, maxWidth: 560 }}>
              The score that ties it together: structure, relevance, and filler words, checked against what you actually said.
            </div>
            <div className="flex flex-wrap gap-2 mt-6">
              <span style={{ ...type.micro, backgroundColor: "rgba(0,0,0,0.25)", padding: "6px 12px", borderRadius: radius.pill }}>STAR structure: complete</span>
              <span style={{ ...type.micro, backgroundColor: "rgba(0,0,0,0.25)", padding: "6px 12px", borderRadius: radius.pill }}>filler words: 4</span>
              <span style={{ ...type.micro, backgroundColor: "rgba(0,0,0,0.25)", padding: "6px 12px", borderRadius: radius.pill }}>length: 1m 42s</span>
            </div>
          </SpotlightCard>
        </div>
      </section>

      {/* ============ HOW IT WORKS, signal switcher with looping demo video ============ */}
      <section id="how" style={{ borderTop: `1px solid ${colors.hairlineSoft}` }}>
        <div className="max-w-6xl mx-auto px-6 py-24">
          <div style={{ ...type.caption, color: colors.inkMuted, marginBottom: 16 }}>How it works</div>
          <h2 style={{ ...type.displayLG, maxWidth: 620 }}>Pick a signal, see the exact numbers.</h2>

          <div className="grid md:grid-cols-[1.1fr_1fr] gap-6 mt-10 items-stretch">
            <div
              className="relative"
              style={{
                backgroundColor: colors.canvas,
                borderRadius: radius.xl,
                overflow: "hidden",
                aspectRatio: "16 / 10",
                minHeight: 280,
                boxShadow: "inset 0 0.5px 0 rgba(255,255,255,0.10), 0 10px 30px rgba(0,0,0,0.25)",
              }}
            >
              <video
                src="/framelyai_vid.mp4"
                autoPlay
                loop
                muted
                playsInline
                aria-hidden="true"
                style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
              />
              <div
                className="absolute bottom-3 left-3 right-3 flex items-center justify-between"
                style={{ background: "linear-gradient(to top, rgba(0,0,0,0.55), transparent)", padding: "12px 12px 4px", marginBottom: -4 }}
              >
                <span style={{ ...type.micro, color: colors.ink }}>Live demo</span>
                <span style={{ ...type.micro, color: colors.success }}>● recording</span>
              </div>
            </div>

            <div className="flex flex-col gap-6">
              <div className="flex flex-wrap gap-2">
                {SIGNALS.map((s, i) => (
                  <PillTab key={s.key} active={i === activeSignal} onClick={() => setActiveSignal(i)}>
                    {s.label}
                  </PillTab>
                ))}
              </div>

              <MockupTile chrome={false} style={{ padding: 28, flex: 1 }}>
                <div className="grid sm:grid-cols-3 gap-6">
                  {active.metrics.map(([label, val], i) => (
                    <div key={i} style={{ borderTop: `1px solid ${colors.hairline}`, paddingTop: 12 }}>
                      <div style={{ ...type.caption, color: colors.inkMuted }}>{label}</div>
                      <div style={{ ...type.displayMD, fontSize: 24, marginTop: 6, fontFeatureSettings: featNum }}>{val}</div>
                    </div>
                  ))}
                </div>
              </MockupTile>
            </div>
          </div>
        </div>
      </section>

      {/* ============ REPORT MOCK ============ */}
      <section style={{ borderTop: `1px solid ${colors.hairlineSoft}` }}>
        <div className="max-w-6xl mx-auto px-6 py-24 grid md:grid-cols-2 gap-14 items-center">
          <div>
            <div style={{ ...type.caption, color: colors.inkMuted, marginBottom: 16 }}>The report</div>
            <h2 style={{ ...type.displayLG }}>Not a grade. A map of the answer.</h2>
            <p style={{ ...type.bodyLg, color: colors.inkMuted, marginTop: 18, maxWidth: 460 }}>
              Every session breaks down by category and by moment, so &ldquo;work on eye contact&rdquo; becomes
              &ldquo;you looked away for six seconds right when you started the result.&rdquo;
            </p>
            <div style={{ backgroundColor: colors.surface1, borderRadius: radius.md, padding: 24, marginTop: 24 }}>
              <div style={{ ...type.caption, color: colors.inkMuted, marginBottom: 8 }}>A note on scoring</div>
              <p style={{ ...type.body, color: colors.inkMuted }}>
                Your first session sets a personal baseline before anything gets scored. Natural eye contact
                varies person to person, and Framely calibrates to you, not a universal average.
              </p>
            </div>
          </div>

          <MockupTile style={{ padding: 28 }}>
            <div className="flex items-center justify-between">
              <span style={{ ...type.caption, color: colors.inkMuted }}>Session score</span>
              <span style={{ ...type.caption, color: colors.inkMuted, fontFeatureSettings: featNum }}>Q3 · 2m 14s</span>
            </div>
            <div style={{ ...type.displayMD, fontSize: 44, marginTop: 8, marginBottom: 20, fontFeatureSettings: featNum }}>
              85<span style={{ color: colors.inkMuted, fontSize: 20 }}>/100</span>
            </div>
            {[["Eye contact",87],["Posture",91],["Gestures",76],["Expression",88],["Answer content",82]].map(([label,val],i)=>(
              <div key={i} className="mb-4">
                <div className="flex justify-between mb-1.5" style={{ ...type.bodySm, color: colors.inkMuted }}>
                  <span>{label}</span><span style={{ color: colors.ink, fontFeatureSettings: featNum }}>{val}</span>
                </div>
                <div style={{ height: 4, backgroundColor: colors.hairline, borderRadius: radius.full }}>
                  <div style={{ height: 4, borderRadius: radius.full, width: `${val}%`, backgroundColor: (val as number) < 80 ? colors.gradientOrange : colors.primary }} />
                </div>
              </div>
            ))}
          </MockupTile>
        </div>
      </section>

      {/* ============ QUESTION BANK — {components.comparison-row} ============ */}
      <section id="library" className="max-w-6xl mx-auto px-6 py-24">
        <div style={{ ...type.caption, color: colors.inkMuted, marginBottom: 16 }}>Question bank</div>
        <h2 style={{ ...type.displayLG, maxWidth: 560 }}>Practice on the questions that actually get asked.</h2>

        <div className="mt-12" style={{ borderTop: `1px solid ${colors.hairlineSoft}` }}>
          {QUESTIONS.map((item, i) => (
            <a
              key={i}
              href="#"
              className="framely-row framely-focus flex items-center justify-between gap-6 px-3 py-5"
              style={{ borderBottom: `1px solid ${colors.hairlineSoft}`, textDecoration: "none", color: colors.ink, borderRadius: radius.xs }}
            >
              <span style={{ ...type.body, fontFeatureSettings: feat }}>{item.q}</span>
              <div className="flex items-center gap-5 shrink-0">
                <span style={{ ...type.bodySm, color: colors.inkMuted, whiteSpace: "nowrap" }}>{item.tag}</span>
                <ArrowUpRight size={16} color={colors.inkMuted} />
              </div>
            </a>
          ))}
        </div>
      </section>

      {/* ============ FAQ — {components.faq-row} ============ */}
      <section id="faq" style={{ borderTop: `1px solid ${colors.hairlineSoft}` }}>
        <div className="max-w-6xl mx-auto px-6 py-24">
          <div style={{ ...type.caption, color: colors.inkMuted, marginBottom: 16 }}>FAQ</div>
          <h2 style={{ ...type.displayLG, marginBottom: 14 }}>Questions, answered.</h2>

          <div className="mt-10">
            {FAQS.map((item, i) => {
              const isOpen = openFaq === i;
              return (
                <div key={i} style={{ backgroundColor: colors.canvas, borderRadius: radius.md, padding: 24, borderBottom: i < FAQS.length - 1 ? `1px solid ${colors.hairlineSoft}` : "none" }}>
                  <button
                    className="framely-focus w-full flex items-center justify-between text-left"
                    onClick={() => setOpenFaq(isOpen ? -1 : i)}
                    style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}
                  >
                    <span style={{ ...type.headline, fontSize: 17 }}>{item.q}</span>
                    {isOpen ? <Minus size={18} color={colors.inkMuted} /> : <Plus size={18} color={colors.inkMuted} />}
                  </button>
                  {isOpen && <p style={{ ...type.body, color: colors.inkMuted, marginTop: 14, maxWidth: 640 }}>{item.a}</p>}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ============ CTA — second spotlight card ============ */}
      <section className="max-w-6xl mx-auto px-6 py-24">
        <SpotlightCard variant="magenta" style={{ textAlign: "center", padding: "56px 32px" }}>
          <h2 style={{ ...type.displayLG, fontSize: "clamp(2rem, 4vw, 3rem)" }}>Your next interview has a camera in the room.</h2>
          <p style={{ ...type.bodyLg, opacity: 0.9, marginTop: 12 }}>Get comfortable with the one that's actually paying attention.</p>
          <ButtonPrimary href="/interview" style={{ padding: "13px 24px", fontSize: 15, marginTop: 28 }}>
            Start practicing, it's free <ArrowRight size={16} />
          </ButtonPrimary>
        </SpotlightCard>
      </section>

      {/* ============ FOOTER — {components.footer} ============ */}
      <footer style={{ backgroundColor: colors.canvas, borderTop: `1px solid ${colors.hairlineSoft}`, padding: "64px 32px" }}>
        <div className="max-w-6xl mx-auto grid md:grid-cols-[1.2fr_1fr_1fr_1fr_1fr] gap-10">
          <div>
            <div style={{ ...type.headline, fontSize: 18 }}>Framely</div>
            <p style={{ ...type.caption, color: colors.inkMuted, marginTop: 10, maxWidth: 200 }}>
              Practice how you look, not just what you say.
            </p>
          </div>
          {[
            { h: "Product", items: ["Delivery scoring", "Content scoring", "Question bank"] },
            { h: "Company", items: ["About", "Blog", "Contact"] },
            { h: "Resources", items: ["FAQ", "Guides"] },
            { h: "Legal", items: ["Privacy", "Terms"] },
          ].map((col, i) => (
            <div key={i}>
              <div style={{ ...type.caption, color: colors.ink, marginBottom: 14 }}>{col.h}</div>
              <ul className="space-y-2.5">
                {col.items.map((it, j) => (
                  <li key={j}><a href="#" className="framely-nav-link" style={{ ...type.caption }}>{it}</a></li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="max-w-6xl mx-auto" style={{ borderTop: `1px solid ${colors.hairlineSoft}`, marginTop: 48, paddingTop: 24, ...type.micro, color: colors.inkMuted }}>
          © 2026 Framely.
        </div>
        <ShapesWordmark text="framely." />
      </footer>
    </div>
  );
}