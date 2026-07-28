"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { Mic, MicOff, Video, VideoOff, Pause, Play, ArrowRight, X, Check, EyeOff, Activity, ChevronDown, Hand, Move } from "lucide-react";
import { pickRandomQuestions } from "../../lib/questions";

/* ==========================================================================
   FRAMELY — mock interview page (app/interview/page.tsx)

   Same token system as the landing page (DESIGN-framer.md). If you've
   already pulled these into a shared file (e.g. lib/design-tokens.js),
   delete this block and import from there instead — it's duplicated here
   so this page works as a standalone drop-in.

   VISION BACKEND: connects to server.py (FastAPI + interview_cv.py) over a
   WebSocket at NEXT_PUBLIC_VISION_WS_URL, defaulting to
   ws://localhost:8000/ws/session for local dev. Streams a JPEG frame every
   400ms while an answer is being recorded, and asks for a session summary
   right before showing the Complete screen. If that service isn't running,
   the UI still works — it just falls back to sample numbers and says so.
========================================================================== */

const colors = {
  primary: "#ffffff",
  onPrimary: "#000000",
  accentBlue: "#0099ff",
  ink: "#ffffff",
  inkMuted: "#999999",
  canvas: "#090909",
  surface1: "#141414",
  surface2: "#1c1c1c",
  hairline: "#262626",
  hairlineSoft: "#1a1a1a",
  gradientViolet: "#6a4cf5",
  success: "#22c55e",
  warn: "#ff7a3d",
};

const radius = { xs: 4, sm: 6, md: 10, lg: 15, xl: 20, xxl: 30, pill: 100, full: 9999 };

const type = {
  displayLG: { fontSize: "clamp(2rem, 4.2vw, 3rem)", fontWeight: 600, lineHeight: 1.0, letterSpacing: "-0.05em" },
  displayMD: { fontSize: "1.7rem", fontWeight: 600, lineHeight: 1.15, letterSpacing: "-0.03em" },
  headline: { fontSize: 18, fontWeight: 700, lineHeight: 1.25, letterSpacing: "-0.03em" },
  bodyLg: { fontSize: 17, fontWeight: 400, lineHeight: 1.4, letterSpacing: "-0.01em" },
  body: { fontSize: 15, fontWeight: 400, lineHeight: 1.4, letterSpacing: "-0.01em" },
  bodySm: { fontSize: 14, fontWeight: 500, lineHeight: 1.4, letterSpacing: "-0.01em" },
  caption: { fontSize: 13, fontWeight: 500, lineHeight: 1.2, letterSpacing: "-0.01em" },
  micro: { fontSize: 12, fontWeight: 400, lineHeight: 1.2, letterSpacing: "-0.01em" },
  button: { fontSize: 14, fontWeight: 500, lineHeight: 1.0, letterSpacing: "-0.01em" },
};

const feat = '"cv01" 1, "cv05" 1, "cv09" 1, "cv11" 1, "ss03" 1, "ss07" 1, "dlig" 1';
const featNum = feat + ', "tnum" 1';
const fontImport = `@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');`;

/* ---------------- Puter.js loader (speech-to-text, no API key) ----------------
   https://developer.puter.com/tutorials/free-unlimited-speech-to-text-api/
   Loads the SDK once and exposes window.puter.ai.speech2txt(blob). Note:
   the first call may pop up a free Puter sign-in for the end user — that's
   Puter's "user pays" model, not a bug. */
let puterLoadPromise = null;
function loadPuter() {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));
  if (window.puter) return Promise.resolve(window.puter);
  if (puterLoadPromise) return puterLoadPromise;
  puterLoadPromise = new Promise((resolve, reject) => {
    const existing = document.getElementById("puter-js-sdk");
    if (existing) {
      existing.addEventListener("load", () => resolve(window.puter));
      existing.addEventListener("error", () => reject(new Error("Failed to load Puter.js")));
      return;
    }
    const script = document.createElement("script");
    script.id = "puter-js-sdk";
    script.src = "https://js.puter.com/v2/";
    script.async = true;
    script.onload = () => resolve(window.puter);
    script.onerror = () => reject(new Error("Failed to load Puter.js"));
    document.body.appendChild(script);
  });
  return puterLoadPromise;
}

/* ---------------- buttons ---------------- */
// Mirrors the ButtonPrimary on the landing page — supports both <button>
// and (via href) Next.js <Link>. The interview page's "Back to home"
// button needs to be a real link, not a <button> that fires history.back.
function ButtonPrimary({ children, style = {}, disabled, href, ...rest }) {
  const sharedStyle = {
    backgroundColor: disabled ? colors.hairline : colors.primary,
    color: disabled ? colors.inkMuted : colors.onPrimary,
    ...type.button,
    borderRadius: radius.pill,
    padding: "12px 20px",
    border: "none",
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    cursor: disabled ? "not-allowed" : "pointer",
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
    <button
      className="framely-btn-primary framely-focus"
      disabled={disabled}
      style={sharedStyle}
      {...rest}
    >
      {children}
    </button>
  );
}

function ButtonSecondary({ children, style = {}, href, ...rest }) {
  const sharedStyle = {
    backgroundColor: colors.surface1,
    color: colors.ink,
    ...type.button,
    borderRadius: radius.pill,
    padding: "12px 20px",
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
    <button
      className="framely-btn-secondary framely-focus"
      style={sharedStyle}
      {...rest}
    >
      {children}
    </button>
  );
}

function IconButton({ active = true, onClick, children, danger = false, label }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className="framely-focus"
      style={{
        width: 44,
        height: 44,
        borderRadius: radius.full,
        backgroundColor: danger ? "#3a1414" : colors.surface1,
        color: danger ? "#ff6b6b" : active ? colors.ink : colors.inkMuted,
        border: "none",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}

function Chip({ children, tone = "neutral" }) {
  const color = tone === "good" ? colors.success : tone === "warn" ? colors.warn : colors.ink;
  return (
    <span
      style={{
        ...type.micro,
        backgroundColor: colors.surface2,
        color,
        padding: "5px 10px",
        borderRadius: radius.pill,
        fontFeatureSettings: featNum,
      }}
    >
      {children}
    </span>
  );
}

/* ---------------- waveform (cosmetic placeholder for live audio) ---------------- */
function Waveform({ active }) {
  const [bars, setBars] = useState(Array.from({ length: 24 }, () => 6));
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => {
      setBars((prev) => prev.map(() => 4 + Math.round(Math.random() * 22)));
    }, 220);
    return () => clearInterval(id);
  }, [active]);
  return (
    <div className="flex items-end gap-1" style={{ height: 28 }}>
      {bars.map((h, i) => (
        <span
          key={i}
          style={{
            width: 2.5,
            height: active ? h : 4,
            backgroundColor: active ? colors.ink : colors.hairline,
            borderRadius: 2,
            transition: "height 180ms ease",
          }}
        />
      ))}
    </div>
  );
}

function useElapsed(running) {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [running]);
  const reset = useCallback(() => setSeconds(0), []);
  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");
  return { seconds, label: `${mm}:${ss}`, reset };
}

function formatTimestamp(seconds) {
  if (seconds == null) return "—";
  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(Math.floor(seconds % 60)).padStart(2, "0");
  return `${mm}:${ss}`;
}

const ZONE_CHIP_LABELS = {
  mouth: "touching mouth/lips",
  chin: "touching chin",
  eyes: "touching eyes",
  head_hair: "touching hair/head",
};

// Icons only — the human-readable label comes from the server (ev.label),
// since Python already knows things like which zone a self-touch happened
// near and formats that text consistently for both the live feed and the
// final report.
const EVENT_ICONS = {
  looking_away: EyeOff,
  unstable_head_movement: Activity,
  self_touch: Hand,
  leaning: Move,
};

// Top-of-page session summary — a single at-a-glance panel of the headline
// metrics from the entire session, plus the count of flagged moments broken
// down by type. Renders nothing when no vision data is available so the
// existing friendly empty-state message below stays the show.
function OverallSummary({ deliverySummary }) {
  if (!deliverySummary) return null;

  const events = deliverySummary.events || [];
  const flagged = events.length;
  const recordedLabel = formatTimestamp(deliverySummary.duration_seconds);

  const eventCounts = {
    looking_away: 0,
    unstable_head_movement: 0,
    self_touch: 0,
    leaning: 0,
  };
  for (const e of events) {
    if (e.type in eventCounts) eventCounts[e.type] += 1;
  }

  // Headline stats. Each falls back to "—" if the vision model didn't supply
  // it (e.g. blink rate when no face was ever found, shoulders when the pose
  // model never got a read).
  const stats = [
    { label: "Eye contact", value: deliverySummary.eye_contact_percentage, suffix: "%", tone: deliverySummary.eye_contact_percentage >= 75 ? "good" : deliverySummary.eye_contact_percentage >= 55 ? "neutral" : "warn" },
    { label: "Smile", value: deliverySummary.smile_percentage, suffix: "%", tone: "neutral" },
    { label: "Hands visible", value: deliverySummary.hands_visible_percentage, suffix: "%", tone: deliverySummary.hands_visible_percentage >= 60 ? "good" : "warn" },
    { label: "Good framing", value: deliverySummary.good_framing_percentage, suffix: "%", tone: deliverySummary.good_framing_percentage >= 60 ? "good" : "warn" },
    { label: "Blink rate", value: deliverySummary.blink_rate_per_minute, suffix: "/min", tone: "neutral" },
    { label: "Recorded", value: recordedLabel, tone: "neutral", isText: true },
  ];

  return (
    <div style={{ backgroundColor: colors.surface1, borderRadius: radius.xl, padding: 28, marginTop: 32, textAlign: "left" }}>
      <div className="flex items-baseline justify-between">
        <div>
          <div style={{ ...type.caption, color: colors.inkMuted }}>Overall results</div>
          <h2 style={{ ...type.displayMD, marginTop: 4 }}>How you did, across the session</h2>
        </div>
        <span style={{ ...type.caption, color: colors.inkMuted, fontFeatureSettings: featNum }}>
          {flagged} flagged moment{flagged === 1 ? "" : "s"}
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-6">
        {stats.map((s, i) => (
          <div
            key={i}
            style={{
              backgroundColor: colors.surface2,
              borderRadius: radius.md,
              padding: "14px 16px",
            }}
          >
            <div style={{ ...type.caption, color: colors.inkMuted }}>{s.label}</div>
            <div
              style={{
                ...type.displayMD,
                fontSize: 28,
                marginTop: 4,
                fontFeatureSettings: featNum,
                color:
                  s.value == null
                    ? colors.inkMuted
                    : s.tone === "good"
                    ? colors.success
                    : s.tone === "warn"
                    ? colors.warn
                    : colors.ink,
              }}
            >
              {s.value == null ? "—" : s.value}
              {s.value != null && !s.isText && (
                <span style={{ color: colors.inkMuted, fontSize: 14, marginLeft: 2 }}>{s.suffix}</span>
              )}
            </div>
          </div>
        ))}
      </div>

      {flagged > 0 && (
        <div className="mt-5 pt-4" style={{ borderTop: `1px solid ${colors.hairline}` }}>
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            {[
              ["looking_away", "Look-aways", eventCounts.looking_away],
              ["unstable_head_movement", "Head jitter", eventCounts.unstable_head_movement],
              ["self_touch", "Self-touch", eventCounts.self_touch],
              ["leaning", "Leaning", eventCounts.leaning],
            ].map(([key, label, count]) => (
              <span key={key} className="flex items-center gap-2" style={{ ...type.bodySm, color: colors.inkMuted }}>
                <span style={{ width: 6, height: 6, borderRadius: radius.full, backgroundColor: count > 0 ? colors.warn : colors.hairline }} />
                {label}
                <span style={{ ...type.bodySm, color: colors.ink, fontFeatureSettings: featNum, fontWeight: 600 }}>{count}</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// A flagged moment (look-away, sustained head jitter, self-touch, or
// leaning), with its start/end timestamps relative to that question's
// recording, and — if the vision service captured one — the exact frame it
// happened on. Click a row to reveal that screenshot inline.
function EventTimeline({ events, expandedId, onToggle }) {
  if (!events || events.length === 0) {
    return <p style={{ ...type.body, color: colors.inkMuted }}>No flagged moments — clean run.</p>;
  }
  return (
    <div>
      {events.map((ev) => {
        const Icon = EVENT_ICONS[ev.type] || Activity;
        const label = ev.label || ev.type;
        const isOpen = expandedId === ev.id;
        return (
          <div key={ev.id} style={{ borderTop: `1px solid ${colors.hairlineSoft}` }}>
            <button
              onClick={() => onToggle(ev.id)}
              className="framely-focus w-full flex items-center justify-between py-3"
              style={{ background: "none", border: "none", cursor: "pointer", textAlign: "left" }}
            >
              <span className="flex items-center gap-2.5">
                <Icon size={15} color={colors.inkMuted} />
                <span style={{ ...type.bodySm }}>{label}</span>
              </span>
              <span className="flex items-center gap-3">
                <span style={{ ...type.caption, color: colors.inkMuted, fontFeatureSettings: featNum }}>
                  {formatTimestamp(ev.start_time)}–{formatTimestamp(ev.end_time)} · {ev.duration}s
                </span>
                {ev.screenshot_b64 && (
                  <ChevronDown size={15} color={colors.inkMuted} style={{ transform: isOpen ? "rotate(180deg)" : "none", transition: "transform 150ms ease" }} />
                )}
              </span>
            </button>
            {isOpen && ev.screenshot_b64 && (
              <div style={{ paddingBottom: 14 }}>
                <img
                  src={`data:image/jpeg;base64,${ev.screenshot_b64}`}
                  alt={`${label} at ${formatTimestamp(ev.start_time)}`}
                  style={{ width: "100%", maxWidth: 360, borderRadius: radius.md, border: `1px solid ${colors.hairline}` }}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function InterviewPage() {
  const [page, setPage] = useState("setup"); // 'setup' | 'active' | 'complete'
  const [qIndex, setQIndex] = useState(0);
  // Per-session randomized subset of the question pool. The lazy initializer
  // runs exactly once on mount, so the order is stable for the whole
  // interview — every qIndex increment advances through THIS set, not the
  // full pool.
  const [sessionQuestions] = useState(() => pickRandomQuestions());
  const [recording, setRecording] = useState(false);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [cameraError, setCameraError] = useState(null);

  const videoRef = useRef(null);
  const streamRef = useRef(null);

  // Setup and Active render separate <video> elements, so the DOM node
  // changes when you switch pages — a plain useRef only attaches the
  // stream once and loses it on remount. This callback ref reattaches
  // the already-acquired stream every time a new <video> node mounts.
  const attachVideo = useCallback((node) => {
    videoRef.current = node;
    if (node && streamRef.current) {
      node.srcObject = streamRef.current;
    }
  }, []);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);

  const [transcripts, setTranscripts] = useState({}); // { [qIndex]: text }
  const [transcribing, setTranscribing] = useState(false);
  const [transcribeError, setTranscribeError] = useState(null);

  const session = useElapsed(page === "active");
  const answer = useElapsed(recording);

  // warm up the speech-to-text SDK early so the first answer isn't delayed
  useEffect(() => {
    loadPuter().catch(() => {
      // surfaced later, at transcription time, if it still hasn't loaded
    });
  }, []);

  const VISION_WS_URL = process.env.NEXT_PUBLIC_VISION_WS_URL || "ws://localhost:8000/ws/session";

  const wsRef = useRef(null);
  const captureCanvasRef = useRef(null);
  const frameIntervalRef = useRef(null);

  const [liveMetrics, setLiveMetrics] = useState(null); // latest {type:"metrics", data:{...}} payload
  const [questionResults, setQuestionResults] = useState({}); // { [index]: questionSummary }
  const [deliverySummary, setDeliverySummary] = useState(null); // the "overall" object from get_summary
  // Mirror of deliverySummary for non-rendering access (timers, async helpers).
  const deliverySummaryRef = useRef(null);
  useEffect(() => { deliverySummaryRef.current = deliverySummary; }, [deliverySummary]);
  const [visionConnected, setVisionConnected] = useState(false);
  const [visionConnectFailed, setVisionConnectFailed] = useState(false); // WS handshake never opened — show empty state, don't try forever
  const [expandedEvent, setExpandedEvent] = useState(null);
  const [expandedQuestion, setExpandedQuestion] = useState(null);
  const [expandedQuestionEvent, setExpandedQuestionEvent] = useState(null); // separate from expandedEvent so per-question screenshots don't share state with the session-wide timeline
  const [visionError, setVisionError] = useState(null);

  // Opens the socket once the interview actually starts, and keeps it open
  // across every question so a single session-wide aggregate is available
  // at the end, alongside each individual question's own summary.
  //
  // The cleanup does NOT close the socket eagerly — closing it the moment
  // we leave "active" (e.g. while a final summary is still in flight) races
  // with the server's reply and we lose the overall metrics. Instead we set
  // a `keepOpenRef` flag the rest of the file flips to false once it has
  // received deliverySummary; the cleanup respects that and closes only
  // when it's safe.
  const keepOpenRef = useRef(true);
  useEffect(() => {
    if (page !== "active") return;

    setVisionError(null);
    setVisionConnectFailed(false);
    keepOpenRef.current = true;
    const ws = new WebSocket(VISION_WS_URL);
    ws.binaryType = "arraybuffer";
    wsRef.current = ws;

    // If the WS never opens within a few seconds, mark it failed so the UI
    // stops saying "waiting for face..." / "vision service not connected"
    // forever — the user gets a clean empty-state on the results page.
    const connectDeadline = setTimeout(() => {
      if (ws.readyState !== WebSocket.OPEN) {
        setVisionConnectFailed(true);
        setVisionConnected(false);
      }
    }, 5000);

    ws.onopen = () => {
      clearTimeout(connectDeadline);
      setVisionConnected(true);
    };
    ws.onclose = () => setVisionConnected(false);
    ws.onerror = () => setVisionConnected(false);
    ws.onmessage = (event) => {
      let msg;
      try { msg = JSON.parse(event.data); } catch { return; }
      if (msg.type === "metrics") {
        setLiveMetrics(msg.data);
      } else if (msg.type === "question_summary" && msg.data) {
        setQuestionResults((prev) => ({ ...prev, [msg.data.index]: msg.data }));
      } else if (msg.type === "summary" && msg.data?.overall) {
        setDeliverySummary(msg.data.overall);
        // Now that we have the session-wide aggregate, it's safe to let
        // the cleanup function close the socket on the next render.
        keepOpenRef.current = false;
      } else if (msg.type === "error") {
        // The vision service connected but failed to actually start (e.g.
        // a model failed to load server-side) — show the real reason
        // instead of a generic "not connected" message.
        setVisionError(msg.message);
      }
    };

    return () => {
      clearTimeout(connectDeadline);
      if (!keepOpenRef.current) {
        ws.close();
      }
    };
  }, [page]);

  // Grabs a frame off the live <video> element and sends it as a JPEG blob.
  // Runs on a timer rather than every animation frame — the vision model
  // doesn't need 30fps to produce useful metrics, and this keeps bandwidth
  // (and your server's CPU) reasonable. Only streams while actually
  // recording an answer, matching the existing recording state.
  useEffect(() => {
    if (!recording) {
      clearInterval(frameIntervalRef.current);
      return;
    }
    if (!captureCanvasRef.current) {
      captureCanvasRef.current = document.createElement("canvas");
    }
    const canvas = captureCanvasRef.current;
    const ctx = canvas.getContext("2d");

    frameIntervalRef.current = setInterval(() => {
      const video = videoRef.current;
      const ws = wsRef.current;
      if (!video || !ws || ws.readyState !== WebSocket.OPEN || video.videoWidth === 0) return;

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => blob && ws.send(blob), "image/jpeg", 0.7);
    }, 400); // ~2.5 frames/sec — plenty for gaze/posture/expression tracking

    return () => clearInterval(frameIntervalRef.current);
  }, [recording]);

  function requestDeliverySummary() {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "get_summary" }));
      return true;
    }
    return false;
  }

  // Awaits up to `timeoutMs` for deliverySummary to be set (the server's
  // reply to get_summary), polling via a ref so we don't re-render on every
  // tick. Used at the very end of the interview so we don't transition to
  // the complete page BEFORE the final scores are in state — the previous
  // race left users staring at "vision service isn't connected" with real
  // metrics arriving milliseconds after the page flipped.
  async function waitForDeliverySummary(timeoutMs = 4000) {
    if (deliverySummaryRef.current) return;
    return new Promise((resolve) => {
      const start = Date.now();
      const tick = () => {
        if (deliverySummaryRef.current || Date.now() - start > timeoutMs) return resolve();
        setTimeout(tick, 80);
      };
      tick();
    });
  }

  function sendStartQuestion(index) {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "start_question", index }));
    }
  }

  function sendEndQuestion(index) {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "end_question", index }));
    }
  }

  const [cameraStatus, setCameraStatus] = useState("checking"); // "checking" | "ready" | "blocked"
  const [micStatus, setMicStatus] = useState("checking");
  const [finalizing, setFinalizing] = useState(false); // true between finishAnswer() and the next render — prevents double-clicks racing into end_question

  // camera + mic acquisition — real getUserMedia, no backend needed.
  // Requests both together first (so the preview and audio stay in sync as
  // one MediaStream), but if that combined request fails, falls back to
  // testing video and audio separately — a combined getUserMedia rejects
  // as a single all-or-nothing error, so without this fallback there's no
  // way to tell "no camera" apart from "no microphone."
  useEffect(() => {
    let cancelled = false;

    async function initCamera() {
      setCameraStatus("checking");
      setMicStatus("checking");

      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
        setCameraError(null);
        setCameraStatus(stream.getVideoTracks().length > 0 ? "ready" : "blocked");
        setMicStatus(stream.getAudioTracks().length > 0 ? "ready" : "blocked");
        return;
      } catch {
        // combined request failed — fall through and test each independently
      }

      let videoOk = false;
      let audioOk = false;
      let partialStream = null;

      try {
        const videoStream = await navigator.mediaDevices.getUserMedia({ video: true });
        videoOk = true;
        partialStream = videoStream;
      } catch {
        videoOk = false;
      }

      try {
        const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        audioOk = true;
        if (partialStream) {
          audioStream.getAudioTracks().forEach((t) => partialStream.addTrack(t));
        } else {
          partialStream = audioStream;
        }
      } catch {
        audioOk = false;
      }

      if (cancelled) {
        partialStream?.getTracks().forEach((t) => t.stop());
        return;
      }

      setCameraStatus(videoOk ? "ready" : "blocked");
      setMicStatus(audioOk ? "ready" : "blocked");

      if (partialStream) {
        streamRef.current = partialStream;
        if (videoRef.current) videoRef.current.srcObject = partialStream;
      }

      if (!videoOk && !audioOk) {
        setCameraError("Camera and microphone access were blocked. Allow access in your browser's site settings, then reload.");
      } else if (!videoOk) {
        setCameraError("No camera detected (or access is blocked). Delivery scoring needs a camera to work.");
      } else if (!audioOk) {
        setCameraError("No microphone detected (or access is blocked). Your answers won't be transcribed without one.");
      } else {
        setCameraError(null);
      }
    }

    initCamera();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  // Real room-lighting check, sampled off the live video feed — replaces
  // what used to be a hardcoded `true` that never actually checked
  // anything. Same brightness convention as interview_cv.py's
  // LOW_LIGHT_BRIGHTNESS (grayscale mean out of 255), so "too dark" means
  // roughly the same thing on both ends.
  const [lightingStatus, setLightingStatus] = useState("checking"); // "checking" | "ready" | "blocked"
  const LOW_LIGHT_BRIGHTNESS = 110;

  useEffect(() => {
    if (cameraStatus !== "ready") {
      setLightingStatus("checking");
      return;
    }
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    let cancelled = false;

    function sample() {
      const video = videoRef.current;
      if (!video || video.videoWidth === 0) return;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
      let sum = 0;
      let count = 0;
      for (let i = 0; i < data.length; i += 40) {
        sum += (data[i] + data[i + 1] + data[i + 2]) / 3;
        count++;
      }
      if (!cancelled && count > 0) {
        setLightingStatus(sum / count < LOW_LIGHT_BRIGHTNESS ? "blocked" : "ready");
      }
    }

    sample();
    const id = setInterval(sample, 800);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [cameraStatus]);

  function toggleMic() {
    const track = streamRef.current?.getAudioTracks()?.[0];
    if (track) track.enabled = !track.enabled;
    setMicOn((v) => !v);
  }
  function toggleCam() {
    const track = streamRef.current?.getVideoTracks()?.[0];
    if (track) track.enabled = !track.enabled;
    setCamOn((v) => !v);
  }

  function startInterview() {
    setPage("active");
    setQIndex(0);
  }

  function startAnswer() {
    setTranscribeError(null);
    chunksRef.current = [];

    const audioTracks = streamRef.current?.getAudioTracks() || [];
    if (audioTracks.length && typeof MediaRecorder !== "undefined") {
      try {
        const audioStream = new MediaStream(audioTracks);
        const recorder = new MediaRecorder(audioStream);
        recorder.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
        };
        recorder.start();
        mediaRecorderRef.current = recorder;
      } catch (err) {
        mediaRecorderRef.current = null; // no audio track -> transcript will just stay empty
      }
    }

    setRecording(true);
    answer.reset();
    // The vision WebSocket connects once for the whole session (see the
    // useEffect keyed on `page === "active"` above). Flipping `recording`
    // to true here is what turns on the frame-capture interval that
    // actually streams frames to it.
    sendStartQuestion(qIndex);
  }

  async function transcribeCurrentAnswer() {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === "inactive") return;

    const blob = await new Promise((resolve) => {
      recorder.addEventListener("stop", () => resolve(new Blob(chunksRef.current, { type: "audio/webm" })), { once: true });
      recorder.stop();
    });
    mediaRecorderRef.current = null;

    if (!blob || blob.size === 0) return;

    setTranscribing(true);
    setTranscribeError(null);
    try {
      const puter = await loadPuter();
      const result = await puter.ai.speech2txt(blob);
      const text = (result && result.text) || (typeof result === "string" ? result : "");
      setTranscripts((prev) => ({ ...prev, [qIndex]: text || "(no speech detected)" }));
    } catch (err) {
      setTranscribeError("Transcription failed — " + (err?.message || "unknown error"));
    } finally {
      setTranscribing(false);
    }
  }

  async function finishAnswer() {
    if (finalizing) return; // guard against double-clicks while a previous answer is still being transcribed/closed
    setRecording(false);
    setFinalizing(true);
    try {
      sendEndQuestion(qIndex);
      await transcribeCurrentAnswer();
      if (qIndex < sessionQuestions.length - 1) {
        setQIndex((i) => i + 1);
      } else {
        // Ask for the session-wide summary, then WAIT for it to land in state
        // before flipping to the complete page. Without this wait, the React
        // cleanup tears down the WebSocket in the same commit as setPage, and
        // the server's reply arrives a tick too late — the user sees an
        // empty-state "vision service isn't connected" even though the
        // metrics are right behind it.
        requestDeliverySummary();
        await waitForDeliverySummary(4000);
        // If the WS is connected but we still don't have a summary, give the
        // server one more nudge — covers the case where the first get_summary
        // happened before end_question's response was processed.
        if (!deliverySummaryRef.current) requestDeliverySummary();
        await waitForDeliverySummary(2000);
        setPage("complete");
      }
    } finally {
      setFinalizing(false);
    }
  }

  function endInterviewEarly() {
    if (finalizing) return; // same guard — the End-interview button races with finishAnswer's teardown
    setRecording(false);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
    }
    sendEndQuestion(qIndex); // closes out whichever question was in progress, if any
    requestDeliverySummary();
    // Same race avoidance as finishAnswer: don't flip to the complete page
    // until deliverySummary is in state, or a generous timeout has passed.
    (async () => {
      await waitForDeliverySummary(4000);
      if (!deliverySummaryRef.current) {
        requestDeliverySummary();
        await waitForDeliverySummary(2000);
      }
      setPage("complete");
    })();
  }

  function practiceAgain() {
    setPage("setup");
    setQIndex(0);
    setRecording(false);
    setTranscripts({});
    setTranscribeError(null);
    setDeliverySummary(null);
    setQuestionResults({});
    setLiveMetrics(null);
    setVisionError(null);
    setExpandedEvent(null);
    setExpandedQuestion(null);
    setExpandedQuestionEvent(null);
    session.reset();
  }

  const currentQ = sessionQuestions[qIndex];

  return (
    <div style={{ backgroundColor: colors.canvas, color: colors.ink, fontFamily: "'Inter', sans-serif", fontFeatureSettings: feat }} className="min-h-screen w-full">
      <style>{`
        ${fontImport}
        * { box-sizing: border-box; }
        .framely-btn-primary { transition: filter 150ms ease, transform 100ms ease; }
        .framely-btn-primary:hover:not(:disabled) { filter: brightness(0.92); }
        .framely-btn-primary:active:not(:disabled) { transform: scale(0.96); }
        .framely-btn-secondary { transition: background-color 150ms ease, transform 100ms ease; }
        .framely-btn-secondary:hover { background-color: ${colors.surface2}; }
        .framely-focus:focus-visible { outline: none; box-shadow: 0 0 0 1px rgba(0,153,255,0.6), 0 0 0 4px rgba(0,153,255,0.15); }
        .framely-mirror { transform: scaleX(-1); }
        @keyframes framely-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
      `}</style>

      {/* ============ TOP BAR ============ */}
      <header className="flex items-center justify-between px-6" style={{ height: 64, borderBottom: `1px solid ${colors.hairlineSoft}` }}>
        <Link href="/" style={{ ...type.headline, fontSize: 16, textDecoration: "none", color: colors.ink }}>Framely</Link>
        {page === "active" && (
          <div className="flex items-center gap-2" style={{ ...type.caption, color: colors.inkMuted, fontFeatureSettings: featNum }}>
            <span style={{ width: 6, height: 6, borderRadius: radius.full, backgroundColor: colors.ink, animation: "framely-pulse 1.8s ease-in-out infinite" }} />
            Session {session.label}
          </div>
        )}
        {page === "active" ? (
          <ButtonSecondary style={{ padding: "9px 16px" }} onClick={endInterviewEarly} disabled={finalizing}>
            <X size={15} /> End interview
          </ButtonSecondary>
        ) : (
          <Link href="/" style={{ ...type.bodySm, color: colors.inkMuted, textDecoration: "none" }}>Exit</Link>
        )}
      </header>

      {/* ============ SETUP ============ */}
      {page === "setup" && (
        <section className="max-w-5xl mx-auto px-6 py-16">
          <div style={{ ...type.caption, color: colors.inkMuted, marginBottom: 12 }}>Before you start</div>
          <h1 style={{ ...type.displayLG, maxWidth: 640 }}>Let's check your camera and mic.</h1>
          <p style={{ ...type.bodyLg, color: colors.inkMuted, marginTop: 14, maxWidth: 520 }}>
            You'll get {sessionQuestions.length} behavioral questions. Answer each on camera — Framely scores delivery
            and content together once your backend is connected.
          </p>

          <div className="grid md:grid-cols-[1.3fr_1fr] gap-6 mt-12">
            <div style={{ backgroundColor: colors.surface1, borderRadius: radius.xl, padding: 16 }}>
              <div className="flex items-center gap-1.5 mb-3 px-1">
                {[0, 1, 2].map((i) => (
                  <span key={i} style={{ width: 8, height: 8, borderRadius: radius.full, backgroundColor: colors.hairline }} />
                ))}
              </div>
              <div className="relative" style={{ backgroundColor: colors.canvas, borderRadius: radius.lg, aspectRatio: "16 / 10", overflow: "hidden" }}>
                {cameraStatus === "blocked" ? (
                  <div className="absolute inset-0 flex items-center justify-center px-8 text-center" style={{ ...type.body, color: colors.inkMuted }}>
                    {cameraError || "No camera detected."}
                  </div>
                ) : (
                  <video ref={attachVideo} autoPlay muted playsInline className="framely-mirror w-full h-full object-cover" />
                )}
              </div>
            </div>

            <div style={{ backgroundColor: colors.surface1, borderRadius: radius.xl, padding: 24 }}>
              <div style={{ ...type.caption, color: colors.inkMuted, marginBottom: 16 }}>Checklist</div>
              {[
                { label: "Camera", status: cameraStatus, blockedText: "not detected" },
                { label: "Microphone", status: micStatus, blockedText: "not detected" },
                { label: "Room lighting", status: lightingStatus, blockedText: "too dark" },
              ].map((row, i) => (
                <div key={i} className="flex items-center justify-between py-3" style={{ borderTop: i > 0 ? `1px solid ${colors.hairlineSoft}` : "none" }}>
                  <span style={{ ...type.body }}>{row.label}</span>
                  {row.status === "ready" && (
                    <span className="flex items-center gap-1.5" style={{ ...type.caption, color: colors.success }}>
                      <Check size={14} /> ready
                    </span>
                  )}
                  {row.status === "blocked" && (
                    <span style={{ ...type.caption, color: colors.warn }}>{row.blockedText}</span>
                  )}
                  {row.status === "checking" && (
                    <span style={{ ...type.caption, color: colors.inkMuted }}>checking...</span>
                  )}
                </div>
              ))}

              <ButtonPrimary
                style={{ width: "100%", justifyContent: "center", marginTop: 24 }}
                disabled={cameraStatus !== "ready" || micStatus !== "ready"}
                onClick={startInterview}
              >
                Start interview <ArrowRight size={16} />
              </ButtonPrimary>
              <p style={{ ...type.micro, color: colors.inkMuted, marginTop: 10, textAlign: "center" }}>
                {sessionQuestions.length} questions · roughly {sessionQuestions.length * 2} minutes
              </p>
            </div>
          </div>
        </section>
      )}

      {/* ============ ACTIVE ============ */}
      {page === "active" && (
        <section className="max-w-6xl mx-auto px-6 py-10 grid md:grid-cols-[1.35fr_1fr] gap-6">
          {/* video column */}
          <div>
            <div style={{ backgroundColor: colors.surface1, borderRadius: radius.xl, padding: 16 }}>
              <div className="flex items-center gap-1.5 mb-3 px-1">
                {[0, 1, 2].map((i) => (
                  <span key={i} style={{ width: 8, height: 8, borderRadius: radius.full, backgroundColor: colors.hairline }} />
                ))}
              </div>
              <div className="relative" style={{ backgroundColor: colors.canvas, borderRadius: radius.lg, aspectRatio: "16 / 10", overflow: "hidden" }}>
                {cameraStatus === "blocked" ? (
                  <div className="absolute inset-0 flex items-center justify-center px-8 text-center" style={{ ...type.body, color: colors.inkMuted }}>
                    {cameraError || "No camera detected."}
                  </div>
                ) : (
                  <video ref={attachVideo} autoPlay muted playsInline className="framely-mirror w-full h-full object-cover" />
                )}

                {/* Mic-only failure during the active interview — the camera
                    still works, so render the video normally but show a
                    small overlay so the user knows their answers won't be
                    transcribed. */}
                {cameraStatus === "ready" && micStatus === "blocked" && (
                  <div className="absolute bottom-3 left-0 right-0 flex justify-center px-4">
                    <span style={{ ...type.micro, backgroundColor: colors.surface2, color: colors.warn, padding: "5px 10px", borderRadius: radius.pill }}>
                      Microphone blocked — answers won&apos;t be transcribed
                    </span>
                  </div>
                )}

                <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-4 py-3">
                  {recording ? (
                    <span className="flex items-center gap-1.5" style={{ ...type.micro, color: colors.ink, fontFeatureSettings: featNum }}>
                      <span style={{ width: 6, height: 6, borderRadius: radius.full, backgroundColor: "#ff5577", animation: "framely-pulse 1.4s ease-in-out infinite" }} />
                      REC {answer.label}
                    </span>
                  ) : (
                    <span style={{ ...type.micro, color: colors.inkMuted }}>Not recording</span>
                  )}
                  <span style={{ ...type.micro, color: colors.inkMuted }}>Question {qIndex + 1} of {sessionQuestions.length}</span>
                </div>

                {recording && (
                  <div className="absolute bottom-4 left-4 flex gap-2 flex-wrap max-w-[90%]">
                    {liveMetrics ? (
                      <>
                        {liveMetrics.face_found && (
                          <>
                            <Chip tone={liveMetrics.eye_contact_running_percentage > 75 ? "good" : "warn"}>
                              eye contact {liveMetrics.eye_contact_running_percentage}%
                            </Chip>
                            <Chip tone={liveMetrics.framing_label === "Good framing" ? "good" : "warn"}>
                              {liveMetrics.framing_label.toLowerCase()}
                            </Chip>
                            {liveMetrics.is_calibrating && (
                              <Chip tone="warn">calibrating {Math.round(liveMetrics.calibration_progress * 100)}%</Chip>
                            )}
                          </>
                        )}
                        {/* hand tracking doesn't need a face to be found, so these
                            show independently of the face_found chips above */}
                        <Chip tone={liveMetrics.hands_visible ? "good" : "neutral"}>
                          {liveMetrics.hands_visible ? "hands visible" : "hands not visible"}
                        </Chip>
                        {liveMetrics.self_touch_zone && (
                          <Chip tone="warn">{ZONE_CHIP_LABELS[liveMetrics.self_touch_zone] || "touching face"}</Chip>
                        )}
                      </>
                    ) : (
                      <Chip tone={visionError ? "warn" : visionConnected ? "warn" : "neutral"}>
                        {visionError ? visionError : visionConnected ? "waiting for face..." : "vision service not connected"}
                      </Chip>
                    )}
                  </div>
                )}
              </div>

              {/* controls */}
              <div className="flex items-center justify-between mt-4 px-1">
                <div className="flex items-center gap-3">
                  <IconButton active={micOn} onClick={toggleMic} label="Toggle microphone">
                    {micOn ? <Mic size={18} /> : <MicOff size={18} />}
                  </IconButton>
                  <IconButton active={camOn} onClick={toggleCam} label="Toggle camera">
                    {camOn ? <Video size={18} /> : <VideoOff size={18} />}
                  </IconButton>
                  <Waveform active={recording && micOn} />
                </div>

                {!recording ? (
                  <ButtonPrimary onClick={startAnswer} disabled={transcribing || finalizing}>
                    <Play size={15} /> Start answer
                  </ButtonPrimary>
                ) : (
                  <ButtonPrimary onClick={finishAnswer} disabled={finalizing}>
                    {qIndex < sessionQuestions.length - 1 ? "Next question" : "Finish interview"} <ArrowRight size={15} />
                  </ButtonPrimary>
                )}
              </div>
            </div>
          </div>

          {/* sidebar */}
          <div className="flex flex-col gap-6">
            <div style={{ backgroundColor: colors.surface1, borderRadius: radius.xl, padding: 24 }}>
              <span style={{ ...type.caption, color: colors.inkMuted }}>{currentQ.tag}</span>
              <p style={{ ...type.headline, fontSize: 20, marginTop: 10 }}>{currentQ.q}</p>
            </div>

            <div style={{ backgroundColor: colors.surface1, borderRadius: radius.xl, padding: 20 }}>
              <div style={{ ...type.caption, color: colors.inkMuted, marginBottom: 14 }}>Progress</div>
              {sessionQuestions.map((_item, i) => {
                const status = i < qIndex ? "done" : i === qIndex ? "current" : "upcoming";
                return (
                  <div
                    key={i}
                    className="flex items-center gap-3 py-2.5"
                    style={{ borderTop: i > 0 ? `1px solid ${colors.hairlineSoft}` : "none" }}
                  >
                    <span
                      style={{
                        width: 18, height: 18, borderRadius: radius.full, flexShrink: 0,
                        backgroundColor: status === "done" ? colors.success : status === "current" ? colors.ink : "transparent",
                        border: status === "upcoming" ? `1px solid ${colors.hairline}` : "none",
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}
                    >
                      {status === "done" && <Check size={11} color={colors.canvas} />}
                    </span>
                    <span style={{ ...type.bodySm, color: status === "upcoming" ? colors.inkMuted : colors.ink, fontWeight: status === "current" ? 600 : 500 }}>
                      Question {i + 1}
                    </span>
                  </div>
                );
              })}
            </div>

            <div style={{ backgroundColor: colors.surface1, borderRadius: radius.xl, padding: 20 }}>
              <div style={{ ...type.caption, color: colors.inkMuted, marginBottom: 10 }}>Transcript</div>
              {recording ? (
                <p style={{ ...type.body, color: colors.inkMuted }}>Recording — transcript appears once you finish this answer.</p>
              ) : transcribing ? (
                <p className="flex items-center gap-2" style={{ ...type.body, color: colors.inkMuted }}>
                  <span style={{ width: 6, height: 6, borderRadius: radius.full, backgroundColor: colors.ink, animation: "framely-pulse 1.2s ease-in-out infinite" }} />
                  Transcribing your answer…
                </p>
              ) : transcribeError ? (
                <p style={{ ...type.body, color: colors.warn }}>{transcribeError}</p>
              ) : transcripts[qIndex] ? (
                <p style={{ ...type.body, color: colors.ink }}>{transcripts[qIndex]}</p>
              ) : (
                <p style={{ ...type.body, color: colors.inkMuted }}>Press &ldquo;Start answer&rdquo; to begin.</p>
              )}
            </div>
          </div>
        </section>
      )}

      {/* ============ COMPLETE ============ */}
      {page === "complete" && (() => {
        // Breakdown of flagged events by type. Server-side events are
        // {looking_away, unstable_head_movement, self_touch, leaning}; we
        // count and total-duration each so the report actually tells the
        // user *what* kept getting flagged, not just a flat "12 total".
        const eventsByType = (events) => {
          const out = {};
          for (const e of events || []) {
            out[e.type] = out[e.type] || { count: 0, totalSeconds: 0 };
            out[e.type].count += 1;
            out[e.type].totalSeconds += e.duration || 0;
          }
          return out;
        };
        // Use the vision model's reported duration when we have it (sum of
        // actual question recording time, excluding the gaps while the
        // user sits between answers); fall back to wall-clock only as a
        // last resort.
        const recordedLabel = deliverySummary
          ? formatTimestamp(deliverySummary.duration_seconds)
          : session.label;
        const overall = eventsByType(deliverySummary?.events);

        return (
        <section className="max-w-3xl mx-auto px-6 py-20 text-center">
          <div style={{ ...type.caption, color: colors.inkMuted, marginBottom: 12 }}>Session complete</div>
          <h1 style={{ ...type.displayLG }}>Nice work. Here&apos;s how it looked.</h1>
          <p style={{ ...type.bodyLg, color: colors.inkMuted, marginTop: 12 }}>
            {deliverySummary
              ? "From the vision model, for this whole session."
              : visionError
              ? `Vision service error: ${visionError}`
              : visionConnected
              ? "Waiting on the final scores from the vision service..."
              : "Vision service isn't connected — connect it on port 8000 to see real scores."}
          </p>

          <OverallSummary deliverySummary={deliverySummary} />

          {/* Dedicated Look-aways panel. Pulled out of the broader Timeline
              because look-aways are the most actionable single metric — when
              a user asks "flag the moments where I looked away", they want
              them right here with timestamps + a clickable screenshot of
              the frame they happened on, not buried under other categories. */}
          {(() => {
            const lookAways = (deliverySummary?.events || []).filter((e) => e.type === "looking_away");
            if (lookAways.length === 0) return null;
            const totalSeconds = lookAways.reduce((sum, e) => sum + (e.duration || 0), 0);
            return (
              <div style={{ backgroundColor: colors.surface1, borderRadius: radius.xl, padding: 24, marginTop: 24, textAlign: "left" }}>
                <div className="flex items-baseline justify-between">
                  <div className="flex items-center gap-2">
                    <EyeOff size={16} color={colors.warn} />
                    <span style={{ ...type.headline, fontSize: 17 }}>Look-aways</span>
                  </div>
                  <span style={{ ...type.caption, color: colors.inkMuted, fontFeatureSettings: featNum }}>
                    {lookAways.length} moment{lookAways.length === 1 ? "" : "s"} · {Math.round(totalSeconds)}s total
                  </span>
                </div>
                <p style={{ ...type.body, color: colors.inkMuted, marginTop: 4, marginBottom: 12 }}>
                  Each one is a stretch where your gaze drifted off camera. Click a row to see the exact frame.
                </p>
                <div>
                  {lookAways.map((ev) => {
                    const isOpen = expandedEvent === ev.id;
                    return (
                      <div key={ev.id} style={{ borderTop: `1px solid ${colors.hairlineSoft}` }}>
                        <button
                          onClick={() => setExpandedEvent(expandedEvent === ev.id ? null : ev.id)}
                          className="framely-focus w-full flex items-center justify-between py-3"
                          style={{ background: "none", border: "none", cursor: "pointer", textAlign: "left" }}
                        >
                          <span className="flex items-center gap-2.5">
                            <span style={{ width: 8, height: 8, borderRadius: radius.full, backgroundColor: colors.warn, flexShrink: 0 }} />
                            <span style={{ ...type.bodySm }}>{ev.label || "Looked away"}</span>
                          </span>
                          <span className="flex items-center gap-3">
                            <span style={{ ...type.caption, color: colors.inkMuted, fontFeatureSettings: featNum }}>
                              {formatTimestamp(ev.start_time)}–{formatTimestamp(ev.end_time)} · {ev.duration}s
                            </span>
                            {ev.screenshot_b64 && (
                              <ChevronDown size={15} color={colors.inkMuted} style={{ transform: isOpen ? "rotate(180deg)" : "none", transition: "transform 150ms ease" }} />
                            )}
                          </span>
                        </button>
                        {isOpen && ev.screenshot_b64 && (
                          <div style={{ paddingBottom: 14 }}>
                            <img
                              src={`data:image/jpeg;base64,${ev.screenshot_b64}`}
                              alt={`Looked away at ${formatTimestamp(ev.start_time)}`}
                              style={{ width: "100%", maxWidth: 360, borderRadius: radius.md, border: `1px solid ${colors.hairline}` }}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          <div style={{ backgroundColor: colors.surface1, borderRadius: radius.xl, padding: 32, marginTop: 24, textAlign: "left" }}>
            <div className="flex items-center justify-between">
              <span style={{ ...type.caption, color: colors.inkMuted }}>Eye contact</span>
              <span style={{ ...type.caption, color: colors.inkMuted, fontFeatureSettings: featNum }}>
                {sessionQuestions.length} questions · {recordedLabel} recorded
              </span>
            </div>
            <div style={{ ...type.displayMD, fontSize: 44, marginTop: 8, marginBottom: 24, fontFeatureSettings: featNum }}>
              {deliverySummary ? deliverySummary.eye_contact_percentage : "—"}
              <span style={{ color: colors.inkMuted, fontSize: 20 }}>%</span>
            </div>

            {/* Expression: NOT a 0-100 bar. Nobody smiles for a whole
                interview, so "more" isn't "better" — this is a range check
                against a reasonable baseline, not a score. When no vision
                data is available, show — instead of inventing "typical
                amount of smiling (14%)." */}
            <div className="flex items-center justify-between mb-4 pb-4" style={{ borderBottom: `1px solid ${colors.hairline}` }}>
              <span style={{ ...type.bodySm, color: colors.inkMuted }}>Expression</span>
              <span style={{ ...type.bodySm, color: colors.ink, textAlign: "right" }}>
                {deliverySummary
                  ? deliverySummary.smile_label
                  : "—"}
                {deliverySummary && (
                  <span style={{ color: colors.inkMuted, fontFeatureSettings: featNum }}>
                    {" "}({deliverySummary.smile_percentage}% of the time)
                  </span>
                )}
              </span>
            </div>

            {/* Bars for the other measurable categories the vision model
                actually reports. Each one falls back to "—" when the
                vision service hasn't supplied data, instead of inventing
                numbers. */}
            {[
              ["Good framing", deliverySummary?.good_framing_percentage],
              ["Hands visible", deliverySummary?.hands_visible_percentage],
            ].map(([label, val], i) => (
              <div key={i} className="mb-4">
                <div className="flex justify-between mb-1.5" style={{ ...type.bodySm, color: colors.inkMuted }}>
                  <span>{label}</span>
                  <span style={{ color: colors.ink, fontFeatureSettings: featNum }}>
                    {val == null ? "—" : `${val}%`}
                  </span>
                </div>
                <div style={{ height: 4, backgroundColor: colors.hairline, borderRadius: radius.full }}>
                  <div style={{
                    height: 4, borderRadius: radius.full,
                    width: val == null ? 0 : `${val}%`,
                    backgroundColor: val != null && val < 60 ? colors.warn : colors.primary,
                    transition: "width 300ms ease",
                  }} />
                </div>
              </div>
            ))}

            {/* Lighting/shoulders: only meaningful when the pose model
                actually got a read, so we render them only when there's
                data — otherwise they'd sit at "—" and look like a missing
                field. */}
            {deliverySummary && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-5" style={{ borderTop: `1px solid ${colors.hairline}` }}>
                <div>
                  <div style={{ ...type.caption, color: colors.inkMuted }}>Blink rate</div>
                  <div style={{ ...type.bodySm, color: colors.ink, marginTop: 4, fontFeatureSettings: featNum }}>
                    {deliverySummary.blink_rate_per_minute}/min
                  </div>
                </div>
                <div>
                  <div style={{ ...type.caption, color: colors.inkMuted }}>Gesturing</div>
                  <div style={{ ...type.bodySm, color: colors.ink, marginTop: 4 }}>
                    {deliverySummary.gesture_level}
                  </div>
                </div>
                <div>
                  <div style={{ ...type.caption, color: colors.inkMuted }}>Self-touch moments</div>
                  <div style={{ ...type.bodySm, color: colors.ink, marginTop: 4, fontFeatureSettings: featNum }}>
                    {deliverySummary.self_touch_event_count}
                  </div>
                </div>
                {deliverySummary.level_shoulders_percentage != null && (
                  <div>
                    <div style={{ ...type.caption, color: colors.inkMuted }}>Shoulders level</div>
                    <div style={{ ...type.bodySm, color: colors.ink, marginTop: 4, fontFeatureSettings: featNum }}>
                      {deliverySummary.level_shoulders_percentage}%
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Per-type event breakdown — replaces the old "12 total"
                count with the actual kinds of moments that were flagged,
                so a user can tell at a glance whether they kept looking
                away vs. fidgeting vs. touching their face. */}
            {deliverySummary && Object.keys(overall).length > 0 && (
              <div className="mt-6 pt-5" style={{ borderTop: `1px solid ${colors.hairline}` }}>
                <div style={{ ...type.caption, color: colors.inkMuted, marginBottom: 10 }}>Flagged moments</div>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    ["looking_away", "Look-aways"],
                    ["unstable_head_movement", "Head jitter"],
                    ["self_touch", "Self-touch"],
                    ["leaning", "Leaning"],
                  ].map(([key, label]) => {
                    const stat = overall[key];
                    if (!stat) return null;
                    return (
                      <div key={key} className="flex items-baseline justify-between" style={{ padding: "6px 0" }}>
                        <span style={{ ...type.bodySm, color: colors.inkMuted }}>{label}</span>
                        <span style={{ ...type.bodySm, color: colors.ink, fontFeatureSettings: featNum }}>
                          {stat.count} · {Math.round(stat.totalSeconds)}s
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Server-side feedback lines (feedback_text in interview_cv.py)
              are already attached to summary.feedback — surface them so
              the user gets the model's natural-language read instead of
              just numbers. */}
          {deliverySummary?.feedback?.length > 0 && (
            <div style={{ backgroundColor: colors.surface1, borderRadius: radius.xl, padding: 24, marginTop: 24, textAlign: "left" }}>
              <div style={{ ...type.caption, color: colors.inkMuted, marginBottom: 10 }}>Notes from the model</div>
              {deliverySummary.feedback.map((line, i) => (
                <p key={i} style={{ ...type.body, color: colors.ink, marginBottom: i < deliverySummary.feedback.length - 1 ? 6 : 0 }}>
                  {line}
                </p>
              ))}
            </div>
          )}

          <p style={{ ...type.caption, color: colors.inkMuted, marginTop: 16, textAlign: "left" }}>
            Posture here is shoulder-level only (no back/hip data), and self-touch detection is proximity-based —
            it flags a hand lingering near your mouth, chin, eyes, or hair, but can&apos;t tell what you were actually
            doing. Answers below also aren&apos;t scored for content yet — that&apos;s your raw transcript, unscored.
          </p>

          {/* Every flagged look-away or sustained head-movement moment for
              the whole session, with a screenshot where one was captured.
              Uses its own expandedEvent* state so it doesn't share IDs
              with the per-question timelines below (event UUIDs are
              globally unique within a session, but clicking one in the
              per-question view was toggling the wrong panel). */}
          {deliverySummary?.events?.length > 0 && (
            <div style={{ backgroundColor: colors.surface1, borderRadius: radius.xl, padding: 24, marginTop: 24, textAlign: "left" }}>
              <div style={{ ...type.caption, color: colors.inkMuted, marginBottom: 4 }}>Timeline</div>
              <p style={{ ...type.body, color: colors.inkMuted, marginBottom: 8 }}>
                Click a moment to see the frame it happened on.
              </p>
              <EventTimeline
                events={deliverySummary.events}
                expandedId={expandedEvent}
                onToggle={(id) => setExpandedEvent(expandedEvent === id ? null : id)}
              />
            </div>
          )}

          {/* Per-question breakdown — each card keeps its own screenshot
              expansion state via expandedQuestionEvent so opening a
              per-question event doesn't open (or close) the session
              timeline's screenshot. */}
          {Object.keys(questionResults).length > 0 && (
            <div style={{ marginTop: 24, textAlign: "left" }}>
              <div style={{ ...type.caption, color: colors.inkMuted, marginBottom: 12 }}>By question</div>
              {sessionQuestions.map((q, i) => {
                const result = questionResults[i];
                if (!result) return null;
                const isOpen = expandedQuestion === i;
                const localExpanded = expandedQuestionEvent; // shared across per-question cards is fine here — only one card is open at a time
                return (
                  <div key={i} style={{ backgroundColor: colors.surface1, borderRadius: radius.xl, marginBottom: 10, overflow: "hidden" }}>
                    <button
                      onClick={() => setExpandedQuestion(isOpen ? null : i)}
                      className="framely-focus w-full flex items-center justify-between px-5 py-4"
                      style={{ background: "none", border: "none", cursor: "pointer", textAlign: "left" }}
                    >
                      <div>
                        <div style={{ ...type.bodySm }}>Question {i + 1}</div>
                        <div style={{ ...type.caption, color: colors.inkMuted, marginTop: 2 }}>{q.tag}</div>
                      </div>
                      <div className="flex items-center gap-4">
                        <span style={{ ...type.caption, color: colors.inkMuted, fontFeatureSettings: featNum }}>
                          eye contact {result.eye_contact_percentage}%
                        </span>
                        <ChevronDown size={16} color={colors.inkMuted} style={{ transform: isOpen ? "rotate(180deg)" : "none", transition: "transform 150ms ease" }} />
                      </div>
                    </button>
                    {isOpen && (
                      <div className="px-5 pb-5" style={{ borderTop: `1px solid ${colors.hairlineSoft}`, paddingTop: 16 }}>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
                          {[
                            ["Eye contact", `${result.eye_contact_percentage}%`],
                            ["Expression", result.smile_label],
                            ["Framing", `${result.good_framing_percentage}%`],
                            ["Blink rate", `${result.blink_rate_per_minute}/min`],
                            ["Hands visible", `${result.hands_visible_percentage}%`],
                            ["Gesturing", result.gesture_level],
                            ...(result.level_shoulders_percentage != null
                              ? [["Shoulders level", `${result.level_shoulders_percentage}%`]]
                              : []),
                          ].map(([label, val], j) => (
                            <div key={j}>
                              <div style={{ ...type.caption, color: colors.inkMuted }}>{label}</div>
                              <div style={{ ...type.bodySm, color: colors.ink, marginTop: 3 }}>{val}</div>
                            </div>
                          ))}
                        </div>
                        <EventTimeline
                          events={result.events}
                          expandedId={localExpanded}
                          onToggle={(id) => setExpandedQuestionEvent(localExpanded === id ? null : id)}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {Object.keys(transcripts).length > 0 && (
            <div style={{ textAlign: "left", marginTop: 24 }}>
              <div style={{ ...type.caption, color: colors.inkMuted, marginBottom: 12 }}>Your answers</div>
              {sessionQuestions.map((item, i) =>
                transcripts[i] ? (
                  <div key={i} style={{ backgroundColor: colors.surface1, borderRadius: radius.md, padding: 18, marginBottom: 10 }}>
                    <div style={{ ...type.caption, color: colors.inkMuted, marginBottom: 6 }}>{item.tag}</div>
                    <div style={{ ...type.bodySm, color: colors.inkMuted, marginBottom: 8, fontWeight: 600 }}>{item.q}</div>
                    <p style={{ ...type.body, color: colors.ink }}>{transcripts[i]}</p>
                  </div>
                ) : null
              )}
            </div>
          )}

          <div className="flex items-center justify-center gap-3 mt-10">
            <ButtonSecondary onClick={practiceAgain}>Practice again</ButtonSecondary>
            <ButtonPrimary href="/">Back to home <ArrowRight size={15} /></ButtonPrimary>
          </div>
        </section>
        );
      })()}
    </div>
  );
}