"use client";

import React, { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Check, AlertCircle } from "lucide-react";
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

function ButtonPrimary({ children, style = {}, disabled, ...rest }: { children: React.ReactNode; style?: React.CSSProperties; disabled?: boolean; [key: string]: unknown }) {
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

const MIN_PASSWORD_LENGTH = 6;

// Set to true once Google OAuth is enabled in the Supabase dashboard
// (Authentication → Providers → Google). Until then, the "Continue with
// Google" button is hidden — clicking it would just bounce Supabase back
// with an "provider not enabled" error.
const GOOGLE_SIGN_IN_ENABLED = false;

// Maps raw Supabase error messages to copy that's easier to act on. The
// library returns generic strings ("Invalid login credentials", "Email not
// confirmed") — for the common ones we rewrite to something with next steps.
function friendlyAuthError(raw: string): string {
  const m = (raw || "").toLowerCase();
  if (m.includes("invalid login credentials")) return "Incorrect email or password.";
  if (m.includes("email not confirmed")) return "Please confirm your email first — check your inbox for the link we sent.";
  if (m.includes("user already registered")) return "That email already has an account. Try logging in instead.";
  if (m.includes("password")) return raw; // already specific (too short, etc.)
  if (m.includes("rate limit") || m.includes("email rate")) return "Too many attempts. Wait a minute and try again.";
  if (m.includes("network") || m.includes("fetch")) return "Couldn't reach the auth server. Check your connection.";
  return raw || "Something went wrong. Try again.";
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/interview";

  const [mode, setMode] = useState("login"); // 'login' | 'signup'
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [status, setStatus] = useState("idle"); // idle | submitting | error | check-email
  const [errorMsg, setErrorMsg] = useState("");
  const [notice, setNotice] = useState(""); // e.g. "already registered, switched you to login"

  function switchMode(next: "login" | "signup") {
    setMode(next);
    setPassword("");
    setConfirmPassword("");
    setErrorMsg("");
    setStatus("idle");
    // notice (e.g. "this email already has an account") is left visible
    // across the switch so the person sees why they landed on Log in.
  }

  async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("submitting");
    setErrorMsg("");
    setNotice("");

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({ email, password });

      if (error) {
        setStatus("error");
        setErrorMsg(friendlyAuthError(error.message));
        return;
      }
      router.push(next);
    } catch (err) {
      // Catches network failures, JSON parse errors, and anything else
      // signInWithPassword might throw that isn't returned as `error`.
      // Without this, the button would stay stuck on "Signing in..." forever.
      setStatus("error");
      setErrorMsg(
        err instanceof Error && err.message
          ? `Something went wrong: ${err.message}`
          : "Couldn't reach the auth server. Check your connection and try again."
      );
    }
  }

  async function handleSignUp(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrorMsg("");
    setNotice("");

    if (password.length < MIN_PASSWORD_LENGTH) {
      setStatus("error");
      setErrorMsg(`Password needs to be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    if (password !== confirmPassword) {
      setStatus("error");
      setErrorMsg("Passwords don't match.");
      return;
    }

    setStatus("submitting");
    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
      });

      if (error) {
        // With email confirmations OFF, Supabase returns a hard error for a
        // duplicate email instead of the obfuscated-user trick below.
        if (error.message.toLowerCase().includes("already registered")) {
          setNotice("This email already has an account — log in instead.");
          switchMode("login");
          return;
        }
        setStatus("error");
        setErrorMsg(friendlyAuthError(error.message));
        return;
      }

      // With email confirmations ON, signing up with an email that's already
      // registered doesn't error — Supabase returns a fake user object with
      // an empty `identities` array instead, specifically so this endpoint
      // can't be used to enumerate real accounts. That empty array is the
      // one reliable signal that this email is already taken.
      const alreadyRegistered = data?.user && Array.isArray(data.user.identities) && data.user.identities.length === 0;
      if (alreadyRegistered) {
        setNotice("This email already has an account — log in instead.");
        switchMode("login");
        return;
      }

      if (data.session) {
        // Email confirmations are OFF, so signUp already returned a live session.
        router.push(next);
        return;
      }

      // Normal path: new account created, confirmation email on its way.
      setStatus("check-email");
    } catch (err) {
      setStatus("error");
      setErrorMsg(
        err instanceof Error && err.message
          ? `Something went wrong: ${err.message}`
          : "Couldn't reach the auth server. Check your connection and try again."
      );
    }
  }

  async function resendConfirmation() {
    if (!email) return;
    setStatus("submitting");
    setErrorMsg("");
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.resend({
        type: "signup",
        email,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
      });
      if (error) {
        setStatus("error");
        setErrorMsg(friendlyAuthError(error.message));
        return;
      }
      setStatus("check-email");
    } catch (err) {
      setStatus("error");
      setErrorMsg(
        err instanceof Error && err.message
          ? `Something went wrong: ${err.message}`
          : "Couldn't reach the auth server. Check your connection and try again."
      );
    }
  }

  async function signInWithGoogle() {
    try {
      const supabase = createClient();
      await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
      });
    } catch (err) {
      setStatus("error");
      setErrorMsg(
        err instanceof Error && err.message
          ? `Google sign-in failed: ${err.message}`
          : "Google sign-in isn't available right now."
      );
    }
  }

  const isSignUp = mode === "signup";

  return (
    <div style={{ backgroundColor: colors.canvas, color: colors.ink, fontFamily: "'Inter', sans-serif" }} className="min-h-screen w-full flex flex-col">
      <style>{`
        ${fontImport}
        * { box-sizing: border-box; }
        .framely-focus:focus-visible { outline: none; box-shadow: 0 0 0 1px rgba(0,153,255,0.6), 0 0 0 4px rgba(0,153,255,0.15); }
        .framely-input:focus { outline: none; border-color: #3a3a3a; }
        .framely-google-btn { transition: background-color 150ms ease; }
        .framely-google-btn:hover { background-color: ${colors.surface2}; }
        .framely-mode-tab { transition: background-color 150ms ease, color 150ms ease; }
      `}</style>

      <header className="px-6 py-6">
        <Link href="/" style={{ ...type.headline, fontSize: 16, textDecoration: "none", color: colors.ink }}>Framely</Link>
      </header>

      <div className="flex-1 flex items-center justify-center px-6 pb-16">
        <div style={{ width: "100%", maxWidth: 380 }}>
          <div style={{ ...type.caption, color: colors.inkMuted, marginBottom: 10 }}>
            {isSignUp ? "Get started" : "Welcome back"}
          </div>
          <h1 style={{ ...type.displayLG, fontSize: "clamp(1.8rem, 4vw, 2.4rem)" }}>
            {isSignUp ? "Create your account." : "Sign in to Framely."}
          </h1>

          {/* Log in / Sign up switcher */}
          <div
            className="flex mt-6"
            style={{ backgroundColor: colors.surface1, borderRadius: radius.pill, padding: 4 }}
          >
            {[
              { key: "login" as const, label: "Log in" },
              { key: "signup" as const, label: "Sign up" },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => switchMode(tab.key)}
                className="framely-mode-tab framely-focus"
                style={{
                  flex: 1,
                  backgroundColor: mode === tab.key ? colors.surface2 : "transparent",
                  color: mode === tab.key ? colors.ink : colors.inkMuted,
                  ...type.button,
                  borderRadius: radius.pill,
                  padding: "9px 0",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {notice && status !== "check-email" && (
            <div className="flex items-start gap-2" style={{ ...type.caption, color: colors.warn, marginTop: 16 }}>
              <AlertCircle size={14} style={{ marginTop: 1, flexShrink: 0 }} />
              <span>{notice}</span>
            </div>
          )}

          {status === "check-email" ? (
            <div style={{ backgroundColor: colors.surface1, borderRadius: radius.lg, padding: 20, marginTop: 24 }}>
              <div className="flex items-center gap-2" style={{ color: colors.success }}>
                <Check size={16} />
                <span style={{ ...type.bodySm }}>Check your inbox</span>
              </div>
              <p style={{ ...type.body, color: colors.inkMuted, marginTop: 8 }}>
                We sent a confirmation link to <span style={{ color: colors.ink }}>{email}</span>. Open it on
                this device to finish creating your account.
              </p>
            </div>
          ) : (
            <form onSubmit={isSignUp ? handleSignUp : handleLogin} className="mt-6">
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

              <label style={{ ...type.caption, color: colors.inkMuted, display: "block", margin: "16px 0 8px" }}>Password</label>
              <input
                type="password"
                required
                minLength={MIN_PASSWORD_LENGTH}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={isSignUp ? `At least ${MIN_PASSWORD_LENGTH} characters` : "••••••••"}
                autoComplete={isSignUp ? "new-password" : "current-password"}
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

              {isSignUp && (
                <>
                  <label style={{ ...type.caption, color: colors.inkMuted, display: "block", margin: "16px 0 8px" }}>Confirm password</label>
                  <input
                    type="password"
                    required
                    minLength={MIN_PASSWORD_LENGTH}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="new-password"
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
                </>
              )}

              {status === "error" && (
                <div style={{ marginTop: 10 }}>
                  <p style={{ ...type.caption, color: colors.warn, margin: 0 }}>{errorMsg}</p>
                  {!isSignUp && errorMsg.toLowerCase().includes("confirm your email") && (
                    <button
                      type="button"
                      onClick={resendConfirmation}
                      className="framely-focus"
                      style={{
                        ...type.caption,
                        background: "transparent",
                        border: "none",
                        color: colors.ink,
                        textDecoration: "underline",
                        cursor: "pointer",
                        padding: 0,
                        marginTop: 6,
                      }}
                    >
                      Resend confirmation email
                    </button>
                  )}
                </div>
              )}

              <ButtonPrimary type="submit" disabled={status === "submitting"} style={{ marginTop: 18 }}>
                {status === "submitting"
                  ? isSignUp ? "Creating account..." : "Signing in..."
                  : <>{isSignUp ? "Create account" : "Sign in"} <ArrowRight size={15} /></>}
              </ButtonPrimary>
            </form>
          )}

          {GOOGLE_SIGN_IN_ENABLED && status !== "check-email" && (
            <>
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
            </>
          )}

          <p style={{ ...type.caption, color: colors.inkMuted, marginTop: 24, textAlign: "center" }}>
            <Link href="/" style={{ color: colors.inkMuted, textDecoration: "none" }}>
              ← Back to home
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

// useSearchParams() requires a Suspense boundary in the App Router, so the
// actual page and its logic live in LoginForm above and this default export
// just wraps it.
export default function LoginPage() {
  return (
    <Suspense fallback={<div style={{ backgroundColor: colors.canvas, minHeight: "100vh" }} />}>
      <LoginForm />
    </Suspense>
  );
}