"use client";

import React, { useState } from "react";
import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { createClient } from "../../lib/supabase/client";

/* Same token set as the landing page (DESIGN-framer.md) — copy these into a
   shared lib/design-tokens.js if you haven't already, to avoid drift. */
const colors = {
  primary: "#ffffff",
  onPrimary: "#000000",
  ink: "#ffffff",
  inkMuted: "#999999",
  canvas: "#090909",
  surface1: "#141414",
  surface2: "#1c1c1c",
  hairline: "#262626",
  hairlineSoft: "#1a1a1a",
  success: "#22c55e",
  warn: "#ff7a3d",
};
const radius = { xs: 4, sm: 6, md: 10, lg: 15, xl: 20, pill: 100 };
const type = {
  displayLG: { fontSize: "clamp(2rem, 4.2vw, 3rem)", fontWeight: 600, lineHeight: 1.0, letterSpacing: "-0.05em" },
  headline: { fontSize: 18, fontWeight: 700, lineHeight: 1.25, letterSpacing: "-0.03em" },
  body: { fontSize: 15, fontWeight: 400, lineHeight: 1.4, letterSpacing: "-0.01em" },
  bodySm: { fontSize: 14, fontWeight: 500, lineHeight: 1.4, letterSpacing: "-0.01em" },
  caption: { fontSize: 13, fontWeight: 500, lineHeight: 1.2, letterSpacing: "-0.01em" },
  button: { fontSize: 14, fontWeight: 500, lineHeight: 1.0, letterSpacing: "-0.01em" },
};
const fontImport = `@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');`;

function ButtonPrimary({ children, style = {}, disabled, ...rest }) {
  return (
    <button
      className="framely-focus"
      disabled={disabled}
      style={{
        backgroundColor: disabled ? colors.hairline : colors.primary,
        color: disabled ? colors.inkMuted : colors.onPrimary,
        ...type.button,
        borderRadius: radius.pill,
        padding: "12px 20px",
        border: "none",
        width: "100%",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        cursor: disabled ? "not-allowed" : "pointer",
        transition: "filter 150ms ease",
        ...style,
      }}
      {...rest}
    >
      {children}
    </button>
  );
}

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 18 18">
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.9C16.64 14.2 17.64 11.94 17.64 9.2z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.26c-.8.54-1.83.86-3.06.86-2.35 0-4.34-1.59-5.05-3.72H.98v2.33A9 9 0 0 0 9 18z" />
      <path fill="#FBBC05" d="M3.95 10.7A5.4 5.4 0 0 1 3.67 9c0-.59.1-1.17.28-1.7V4.97H.98A9 9 0 0 0 0 9c0 1.45.35 2.83.98 4.03l2.97-2.33z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.51.46 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .98 4.97l2.97 2.33C4.66 5.17 6.65 3.58 9 3.58z" />
    </svg>
  );
}

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("idle"); // idle | sending | sent | error
  const [errorMsg, setErrorMsg] = useState("");

  async function sendMagicLink(e) {
    e.preventDefault();
    if (!email) return;
    setStatus("sending");
    setErrorMsg("");

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setStatus("error");
      setErrorMsg(error.message);
    } else {
      setStatus("sent");
    }
  }

  async function signInWithGoogle() {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    // Browser navigates away to Google here — nothing else to do.
  }

  return (
    <div style={{ backgroundColor: colors.canvas, color: colors.ink, fontFamily: "'Inter', sans-serif" }} className="min-h-screen w-full flex flex-col">
      <style>{`
        ${fontImport}
        * { box-sizing: border-box; }
        .framely-focus:focus-visible { outline: none; box-shadow: 0 0 0 1px rgba(0,153,255,0.6), 0 0 0 4px rgba(0,153,255,0.15); }
        .framely-input:focus { outline: none; border-color: #3a3a3a; }
        .framely-google-btn { transition: background-color 150ms ease; }
        .framely-google-btn:hover { background-color: ${colors.surface2}; }
      `}</style>

      <header className="px-6 py-6">
        <Link href="/" style={{ ...type.headline, fontSize: 16, textDecoration: "none", color: colors.ink }}>Framely</Link>
      </header>

      <div className="flex-1 flex items-center justify-center px-6 pb-16">
        <div style={{ width: "100%", maxWidth: 380 }}>
          <div style={{ ...type.caption, color: colors.inkMuted, marginBottom: 10 }}>Welcome back</div>
          <h1 style={{ ...type.displayLG, fontSize: "clamp(1.8rem, 4vw, 2.4rem)" }}>Sign in to Framely.</h1>
          <p style={{ ...type.body, color: colors.inkMuted, marginTop: 10 }}>
            No password to remember — we'll email you a link.
          </p>

          {status === "sent" ? (
            <div style={{ backgroundColor: colors.surface1, borderRadius: radius.lg, padding: 20, marginTop: 28 }}>
              <div className="flex items-center gap-2" style={{ color: colors.success }}>
                <Check size={16} />
                <span style={{ ...type.bodySm }}>Check your inbox</span>
              </div>
              <p style={{ ...type.body, color: colors.inkMuted, marginTop: 8 }}>
                We sent a sign-in link to <span style={{ color: colors.ink }}>{email}</span>. Open it on this
                device to finish signing in.
              </p>
            </div>
          ) : (
            <form onSubmit={sendMagicLink} className="mt-8">
              <label style={{ ...type.caption, color: colors.inkMuted, display: "block", marginBottom: 8 }}>Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="framely-input"
                style={{
                  width: "100%",
                  backgroundColor: colors.surface1,
                  color: colors.ink,
                  border: `1px solid ${colors.hairline}`,
                  borderRadius: radius.md,
                  padding: "12px 14px",
                  ...type.body,
                }}
              />
              {status === "error" && (
                <p style={{ ...type.caption, color: colors.warn, marginTop: 8 }}>{errorMsg}</p>
              )}
              <ButtonPrimary type="submit" disabled={status === "sending"} style={{ marginTop: 14 }}>
                {status === "sending" ? "Sending..." : <>Send magic link <ArrowRight size={15} /></>}
              </ButtonPrimary>
            </form>
          )}

          <div className="flex items-center gap-3 my-6">
            <div style={{ flex: 1, height: 1, backgroundColor: colors.hairlineSoft }} />
            <span style={{ ...type.caption, color: colors.inkMuted }}>or</span>
            <div style={{ flex: 1, height: 1, backgroundColor: colors.hairlineSoft }} />
          </div>

          <button
            onClick={signInWithGoogle}
            className="framely-google-btn framely-focus"
            style={{
              width: "100%",
              backgroundColor: colors.surface1,
              color: colors.ink,
              ...type.button,
              borderRadius: radius.pill,
              padding: "12px 20px",
              border: "none",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
              cursor: "pointer",
            }}
          >
            <GoogleIcon /> Continue with Google
          </button>

          <p style={{ ...type.caption, color: colors.inkMuted, marginTop: 24, textAlign: "center" }}>
            <Link href="/" className="framely-nav-link" style={{ color: colors.inkMuted, textDecoration: "none" }}>
              ← Back to home
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}