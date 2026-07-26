"""
Framely — vision backend.

Wraps interview_cv.py's SessionVision in a WebSocket endpoint so the
Next.js app can stream webcam frames from the browser and get live +
per-question + session-wide delivery metrics back.

Run locally:
    pip install fastapi "uvicorn[standard]" opencv-python mediapipe numpy
    uvicorn server:app --reload --port 8000

Protocol on /ws/session:
  Client -> server:
    - binary message: one JPEG-encoded frame (only meaningful while a
      question is active — see start_question below)
    - text message, JSON:
        {"type": "start_question", "index": 0}
          Opens a new QuestionTracker. Frames sent after this are scored
          against it. Calibration happens automatically on the very first
          question's frames if it hasn't run yet this session.
        {"type": "end_question", "index": 0}
          Closes the current QuestionTracker and returns its full summary
          (including its own event log) immediately.
        {"type": "get_summary"}
          Returns the session-wide aggregate: every finished question's
          summary, an overall weighted summary, and the flat list of every
          event across the whole session — each with a screenshot attached.

  Server -> client, all JSON:
    {"type": "metrics", "data": {...}}          after every frame
    {"type": "question_summary", "data": {...}} in reply to end_question
    {"type": "summary", "data": {...}}          in reply to get_summary
"""

import base64
import json
from contextlib import asynccontextmanager

import cv2 as cv
import numpy as np
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from interview_cv import SessionVision, feedback_text


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Forces MediaPipe to load (and, on first run, download) its model
    # files right now, at server startup — instead of silently on
    # someone's first WebSocket connection. If this fails, you'll see the
    # real traceback in THIS terminal immediately, instead of a vague
    # "vision service not connected" message in the browser with no clue why.
    try:
        SessionVision()
        print("[framely-vision] models loaded OK.")
    except Exception as e:
        print("[framely-vision] FAILED to load vision models on startup:", repr(e))
        print("[framely-vision] Most common cause on macOS: MediaPipe can't verify the")
        print("[framely-vision] SSL certificate to download its model files. Fix with:")
        print('[framely-vision]   open "/Applications/Python 3.X/Install Certificates.command"')
        print("[framely-vision] or: pip install --upgrade certifi && export SSL_CERT_FILE=$(python3 -m certifi)")
        raise
    yield


app = FastAPI(lifespan=lifespan)

# Restrict this to your actual frontend origin(s) before deploying anywhere
# real — "*" is fine for local development only.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)


def decode_jpeg(raw: bytes):
    arr = np.frombuffer(raw, dtype=np.uint8)
    return cv.imdecode(arr, cv.IMREAD_COLOR)  # None if decoding failed — just skip that frame


def encode_jpeg_b64(frame, quality=60) -> str:
    ok, buf = cv.imencode(".jpg", frame, [cv.IMWRITE_JPEG_QUALITY, quality])
    if not ok:
        return None
    return base64.b64encode(buf.tobytes()).decode("ascii")


def attach_screenshots(events, screenshots: dict):
    for e in events:
        e["screenshot_b64"] = screenshots.get(e["id"])
    return events


@app.websocket("/ws/session")
async def session_socket(websocket: WebSocket):
    await websocket.accept()

    try:
        session = SessionVision()
    except Exception as e:
        # This should be rare if the startup check above already passed —
        # but if it ever does fail here, the frontend gets a real reason
        # instead of a socket that just goes dead with no explanation.
        await websocket.send_json({"type": "error", "message": f"Vision service failed to start: {e}"})
        await websocket.close(code=1011)
        return

    # event id -> base64 JPEG, captured at the moment each event started.
    # Kept for the lifetime of the connection; nothing here persists past
    # session end unless you add that yourself (see the disconnect handler).
    screenshots = {}

    try:
        while True:
            message = await websocket.receive()

            if "bytes" in message and message["bytes"] is not None:
                frame = decode_jpeg(message["bytes"])
                if frame is None:
                    continue

                metrics = session.process_frame(frame)

                # Any event that just started gets a screenshot of the
                # exact frame that triggered it, captured right here since
                # this is the layer that actually holds the raw frame.
                for delta in metrics.get("events", []):
                    if delta.get("status") == "started":
                        screenshots[delta["id"]] = encode_jpeg_b64(frame)

                await websocket.send_json({"type": "metrics", "data": metrics})

            elif "text" in message and message["text"] is not None:
                try:
                    control = json.loads(message["text"])
                except json.JSONDecodeError:
                    continue

                msg_type = control.get("type")

                if msg_type == "start_question":
                    session.start_question(control.get("index", 0))

                elif msg_type == "end_question":
                    summary = session.end_question()
                    if summary is not None:
                        summary["events"] = attach_screenshots(summary["events"], screenshots)
                        summary["feedback"] = feedback_text(summary)
                    await websocket.send_json({"type": "question_summary", "data": summary})

                elif msg_type == "get_summary":
                    result = session.overall_summary()
                    if result["overall"] is not None:
                        result["overall"]["events"] = attach_screenshots(list(result["events"]), screenshots)
                        result["overall"]["feedback"] = feedback_text(result["overall"])
                        for q in result["questions"]:
                            q["events"] = attach_screenshots(q["events"], screenshots)
                    await websocket.send_json({"type": "summary", "data": result})

    except WebSocketDisconnect:
        # Session ended without an explicit get_summary — nothing to send
        # back at this point, but this is where you'd persist the summary
        # server-side (e.g. write to your DB) if you want a record even for
        # interviews that weren't finished cleanly.
        result = session.overall_summary()
        print("session ended:", result["overall"])