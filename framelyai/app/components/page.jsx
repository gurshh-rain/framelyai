"use client";

import React, { useEffect, useRef } from "react";

/*
  ShapesWordmark — recreates the op.al footer treatment: the wordmark
  itself is invisible except where soft, drifting shapes happen to be
  passing behind it, so the letters flicker in and out of visibility as
  the shapes move through them.

  How: an SVG <mask> whose content is literally a <text> element (white
  text on a black rect). Anything drawn inside a <g mask="url(#...)"> only
  shows through where that text is white — i.e. only inside the letterforms.
  The shapes drifting inside that group are what you actually see.
*/

const VIEWBOX_W = 1200;
const VIEWBOX_H = 260;
const BLOB_COUNT = 26;

function makeBlob(i) {
  return {
    x: Math.random() * VIEWBOX_W,
    y: Math.random() * VIEWBOX_H,
    r: 26 + Math.random() * 46,
    vx: (Math.random() - 0.5) * 0.5,
    vy: (Math.random() - 0.5) * 0.3,
    opacity: 0.5 + Math.random() * 0.5,
  };
}

export default function ShapesWordmark({ text = "framely.", height = 220 }) {
  const groupRef = useRef(null);
  const blobsRef = useRef(Array.from({ length: BLOB_COUNT }, (_, i) => makeBlob(i)));
  const circleRefs = useRef([]);

  useEffect(() => {
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced) return; // leave the blobs at their static initial spots

    let raf;
    function tick() {
      blobsRef.current.forEach((b, i) => {
        b.x += b.vx;
        b.y += b.vy;

        if (b.x < -b.r) b.x = VIEWBOX_W + b.r;
        if (b.x > VIEWBOX_W + b.r) b.x = -b.r;
        if (b.y < -b.r) b.y = VIEWBOX_H + b.r;
        if (b.y > VIEWBOX_H + b.r) b.y = -b.r;

        const el = circleRefs.current[i];
        if (el) {
          el.setAttribute("cx", b.x.toFixed(1));
          el.setAttribute("cy", b.y.toFixed(1));
        }
      });
      raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div style={{ width: "100%", height, display: "flex", alignItems: "center", justifyContent: "center" }} aria-hidden="true">
      <svg viewBox={`0 0 ${VIEWBOX_W} ${VIEWBOX_H}`} width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
        <defs>
          <filter id="wordmark-blur" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="14" />
          </filter>
          <mask id="wordmark-text-mask">
            <rect x="0" y="0" width={VIEWBOX_W} height={VIEWBOX_H} fill="black" />
            <text
              x={VIEWBOX_W / 2}
              y={VIEWBOX_H / 2 + 48}
              textAnchor="middle"
              fontFamily="Inter, sans-serif"
              fontWeight="700"
              fontSize="140"
              letterSpacing="-4"
              fill="white"
            >
              {text}
            </text>
          </mask>
        </defs>

        <g ref={groupRef} mask="url(#wordmark-text-mask)" filter="url(#wordmark-blur)">
          {blobsRef.current.map((b, i) => (
            <circle
              key={i}
              ref={(el) => (circleRefs.current[i] = el)}
              cx={b.x}
              cy={b.y}
              r={b.r}
              fill="#ffffff"
              fillOpacity={b.opacity}
            />
          ))}
        </g>
      </svg>
    </div>
  );
}