"""
Framely — vision-side session tracker (eye contact, engagement, framing,
self-touch, basic posture).

v4 adds:
  - MediaPipe Hands: detects fingertips lingering near the mouth/chin, eyes,
    or hair/head — the common nervous self-touch gestures (nail-biting,
    chin-stroking, eye-rubbing, hair-touching). This is proximity, not
    intent — it can't tell "biting a nail" from "resting a knuckle near
    your lip," so it's labeled honestly as "touched X," not "bit nails."
  - Hands-visible % and a gesture-level read (minimal / natural / high),
    normalized by face width so someone sitting closer to the camera
    doesn't automatically register as "gesturing more."
  - MediaPipe Pose (shoulders only, lightest model complexity): sustained
    one-sided leaning gets flagged the same way head jitter already is.
    This is a coarse proxy, not real posture analysis (no back/hip data),
    but it's a real signal where there was none before.

Everything routes through the same Event system as before (timestamps,
screenshot capture in server.py), so no protocol changes were needed there.
"""

import math
import uuid
from collections import deque
from dataclasses import dataclass, field
from timeit import default_timer as timer

import cv2 as cv
import mediapipe as mp


# ---------------------------------------------------------------------------
# Landmark indices
# ---------------------------------------------------------------------------
# Face (MediaPipe FaceMesh, refine_landmarks=True for iris points)
NOSE_TIP = 4
FOREHEAD = 10
CHIN = 152

RIGHT_EYE = dict(outer=33, inner=133, upper=159, lower=145, iris=468)
LEFT_EYE = dict(outer=263, inner=362, upper=386, lower=374, iris=473)

MOUTH = dict(left=61, right=291, top=0, bottom=17)

# Hands (MediaPipe Hands, 21-point model per hand)
WRIST = 0
FINGERTIP_IDS = [4, 8, 12, 16, 20]  # thumb, index, middle, ring, pinky tips

# Pose (MediaPipe Pose, only using the two shoulder points)
LEFT_SHOULDER = 11
RIGHT_SHOULDER = 12

# ---------------------------------------------------------------------------
# Tunable constants
# ---------------------------------------------------------------------------
BLINK_EAR_THRESHOLD = 0.15
CALIBRATION_TARGET_SAMPLES = 40
CALIBRATION_MAX_SECONDS = 20.0
CALIBRATION_BAND_K = 3.0

GAZE_SMOOTHING_SECONDS = 2.0
STABILITY_WINDOW_SECONDS = 6.0
NOD_WINDOW_SECONDS = 2.0
NOD_MOVEMENT_THRESHOLD = 40

MIN_LOOKING_AWAY_EVENT_SECONDS = 1.5
MIN_JITTER_EVENT_SECONDS = 3.0
MIN_SELF_TOUCH_EVENT_SECONDS = 1.0   # brief taps don't count; lingering does
MIN_LEAN_EVENT_SECONDS = 3.0

SMILE_RATIO_THRESHOLD = 2.25
SMILE_RANGE_LOW_PCT = 8.0
SMILE_RANGE_HIGH_PCT = 25.0

FRAME_TOO_CLOSE_RATIO = 0.45
FRAME_TOO_FAR_RATIO = 0.15
LOW_LIGHT_BRIGHTNESS = 110

TOUCH_RADIUS_RATIO = 0.22            # face-widths — how close counts as "touching"
GESTURE_SPEED_WINDOW_SECONDS = 4.0    # window for the live gesture-level read
GESTURE_LOW_THRESHOLD = 0.15          # face-widths/sec — below this = minimal gesturing
GESTURE_HIGH_THRESHOLD = 0.6          # above this = high gesturing
LEAN_TILT_THRESHOLD = 0.12            # shoulder-height difference / shoulder width

# All of the thresholds above are starting points, not measured values —
# tune them once you've watched this against a few real sessions. Face-mesh
# and hand-tracking accuracy also both degrade at the ~2.5fps this currently
# streams at; nod detection in particular is best-effort (see the note in
# QuestionTracker._detect_nod).


def _dist(a, b):
    return math.dist(a, b)


def _midpoint(a, b):
    return ((a[0] + b[0]) / 2, (a[1] + b[1]) / 2)


def _new_id():
    return uuid.uuid4().hex[:10]


def _prune_older_than(dq, now, window_seconds):
    while dq and (now - dq[0][0]) > window_seconds:
        dq.popleft()


def _std(values):
    if not values:
        return 0.0
    mean = sum(values) / len(values)
    return math.sqrt(sum((v - mean) ** 2 for v in values) / len(values))


# ---------------------------------------------------------------------------
# Model wrappers
# ---------------------------------------------------------------------------
class FaceMeshDetector:
    def __init__(self, max_faces=1, min_detection_confidence=0.5, min_tracking_confidence=0.5):
        self.mp_face_mesh = mp.solutions.face_mesh
        self.face_mesh = self.mp_face_mesh.FaceMesh(
            static_image_mode=False,
            max_num_faces=max_faces,
            refine_landmarks=True,
            min_detection_confidence=min_detection_confidence,
            min_tracking_confidence=min_tracking_confidence,
        )
        self.results = None

    def process(self, frame):
        rgb = cv.cvtColor(frame, cv.COLOR_BGR2RGB)
        self.results = self.face_mesh.process(rgb)

    def get_landmarks(self, frame, face_index=0):
        if not self.results or not self.results.multi_face_landmarks:
            return {}
        if face_index >= len(self.results.multi_face_landmarks):
            return {}
        h, w = frame.shape[:2]
        face = self.results.multi_face_landmarks[face_index]
        return {i: (int(lm.x * w), int(lm.y * h)) for i, lm in enumerate(face.landmark)}


class HandTracker:
    def __init__(self, max_hands=2, min_detection_confidence=0.5, min_tracking_confidence=0.5):
        self.mp_hands = mp.solutions.hands
        self.hands = self.mp_hands.Hands(
            static_image_mode=False,
            max_num_hands=max_hands,
            min_detection_confidence=min_detection_confidence,
            min_tracking_confidence=min_tracking_confidence,
        )
        self.results = None

    def process(self, frame):
        rgb = cv.cvtColor(frame, cv.COLOR_BGR2RGB)
        self.results = self.hands.process(rgb)

    def get_hands(self, frame):
        """Returns a list of {landmark_id: (x, y)} dicts, one per detected hand."""
        if not self.results or not self.results.multi_hand_landmarks:
            return []
        h, w = frame.shape[:2]
        return [
            {i: (int(lm.x * w), int(lm.y * h)) for i, lm in enumerate(hand.landmark)}
            for hand in self.results.multi_hand_landmarks
        ]


class PoseTracker:
    def __init__(self, min_detection_confidence=0.5, min_tracking_confidence=0.5):
        self.mp_pose = mp.solutions.pose
        self.pose = self.mp_pose.Pose(
            model_complexity=0,  # lightest model — only need shoulder position, not full-body detail
            min_detection_confidence=min_detection_confidence,
            min_tracking_confidence=min_tracking_confidence,
        )
        self.results = None

    def process(self, frame):
        rgb = cv.cvtColor(frame, cv.COLOR_BGR2RGB)
        self.results = self.pose.process(rgb)

    def get_shoulders(self, frame):
        if not self.results or not self.results.pose_landmarks:
            return None
        h, w = frame.shape[:2]
        lm = self.results.pose_landmarks.landmark
        left, right = lm[LEFT_SHOULDER], lm[RIGHT_SHOULDER]
        if left.visibility < 0.5 or right.visibility < 0.5:
            return None
        return {
            "left": (left.x * w, left.y * h),
            "right": (right.x * w, right.y * h),
        }


# ---------------------------------------------------------------------------
# Pure geometry helpers
# ---------------------------------------------------------------------------
def eye_aspect_ratio(lm, eye):
    height = _dist(lm[eye["upper"]], lm[eye["lower"]])
    width = _dist(lm[eye["outer"]], lm[eye["inner"]])
    return height / width if width else 0.0


def eye_gaze_ratios(lm, eye):
    width = _dist(lm[eye["outer"]], lm[eye["inner"]])
    height = _dist(lm[eye["upper"]], lm[eye["lower"]])
    if width == 0 or height == 0:
        return None, None
    ratio_x = _dist(lm[eye["outer"]], lm[eye["iris"]]) / width
    ratio_y = _dist(lm[eye["upper"]], lm[eye["iris"]]) / height
    return ratio_x, ratio_y


def head_turn_ratios(lm):
    left_dist = _dist(lm[NOSE_TIP], lm[RIGHT_EYE["outer"]])
    right_dist = _dist(lm[NOSE_TIP], lm[LEFT_EYE["outer"]])
    yaw_ratio = left_dist / right_dist if right_dist else 1.0

    up_dist = _dist(lm[NOSE_TIP], lm[FOREHEAD])
    down_dist = _dist(lm[NOSE_TIP], lm[CHIN])
    pitch_ratio = up_dist / down_dist if down_dist else 1.0

    return yaw_ratio, pitch_ratio


def mouth_smile_ratio(lm):
    width = _dist(lm[MOUTH["left"]], lm[MOUTH["right"]])
    height = _dist(lm[MOUTH["top"]], lm[MOUTH["bottom"]])
    return (width / height) if height else 0.0


def face_width_px(lm):
    return _dist(lm[RIGHT_EYE["outer"]], lm[LEFT_EYE["outer"]])


def face_width_ratio(lm, frame_width):
    w = face_width_px(lm)
    return w / frame_width if frame_width else 0.0


def frame_brightness(frame):
    gray = cv.cvtColor(frame, cv.COLOR_BGR2GRAY)
    return cv.mean(gray)[0]


def smile_label(pct):
    if pct < SMILE_RANGE_LOW_PCT:
        return "rarely smiled"
    elif pct > SMILE_RANGE_HIGH_PCT:
        return "smiled frequently"
    return "typical amount of smiling"


def gesture_level_label(avg_speed):
    if avg_speed < GESTURE_LOW_THRESHOLD:
        return "Minimal gesturing"
    elif avg_speed < GESTURE_HIGH_THRESHOLD:
        return "Natural gesturing"
    return "High gesturing"


def detect_self_touch_zone(face_lm, hands_lm):
    """Which face zone (if any) a fingertip is currently close enough to
    count as "touching." Returns the single closest zone name, or None."""
    if not face_lm or not hands_lm:
        return None

    fw = face_width_px(face_lm)
    if fw == 0:
        return None
    touch_radius = fw * TOUCH_RADIUS_RATIO

    forehead = face_lm[FOREHEAD]
    chin = face_lm[CHIN]
    face_height = _dist(forehead, chin)
    hairline_estimate = (forehead[0], forehead[1] - face_height * 0.35)

    zones = [
        ("mouth", _midpoint(face_lm[MOUTH["top"]], face_lm[MOUTH["bottom"]])),
        ("chin", chin),
        ("eyes", face_lm[RIGHT_EYE["outer"]]),
        ("eyes", face_lm[LEFT_EYE["outer"]]),
        ("head_hair", hairline_estimate),
    ]

    best_zone, best_dist = None, touch_radius
    for hand in hands_lm:
        for tip_id in FINGERTIP_IDS:
            tip = hand.get(tip_id)
            if tip is None:
                continue
            for zone_name, zone_point in zones:
                d = _dist(tip, zone_point)
                if d < best_dist:
                    best_dist = d
                    best_zone = zone_name
    return best_zone


def shoulder_tilt_ratio(shoulders):
    dx = shoulders["right"][0] - shoulders["left"][0]
    dy = shoulders["right"][1] - shoulders["left"][1]
    width = math.hypot(dx, dy)
    return abs(dy) / width if width else 0.0


ZONE_LABELS = {
    "mouth": "Touched mouth/lips",
    "chin": "Touched chin",
    "eyes": "Touched eyes",
    "head_hair": "Touched hair/head",
}
EVENT_TYPE_LABELS = {
    "looking_away": "Looked away",
    "unstable_head_movement": "Unstable head movement",
    "leaning": "Leaning to one side",
}


def event_label(event_type, meta):
    if event_type == "self_touch":
        return ZONE_LABELS.get((meta or {}).get("zone"), "Touched face/head")
    return EVENT_TYPE_LABELS.get(event_type, event_type)


# ---------------------------------------------------------------------------
# Calibration
# ---------------------------------------------------------------------------
@dataclass
class Baseline:
    mean: float
    band: float

    def contains(self, value):
        return (self.mean - self.band) <= value <= (self.mean + self.band)


class GazeCalibrator:
    """Shared across every question in a session — calibrates once, using
    whichever question happens to go first, then stays fixed after that."""

    def __init__(self, target_samples=CALIBRATION_TARGET_SAMPLES, band_k=CALIBRATION_BAND_K,
                 max_seconds=CALIBRATION_MAX_SECONDS):
        self.target_samples = target_samples
        self.band_k = band_k
        self.max_seconds = max_seconds
        self._samples = {"ratio_x": [], "ratio_y": [], "yaw": [], "pitch": []}
        self._first_sample_time = None
        self.baselines = None

    @property
    def is_done(self):
        return self.baselines is not None

    def add_sample(self, ratio_x, ratio_y, yaw_ratio, pitch_ratio, t):
        if self._first_sample_time is None:
            self._first_sample_time = t
        self._samples["ratio_x"].append(ratio_x)
        self._samples["ratio_y"].append(ratio_y)
        self._samples["yaw"].append(yaw_ratio)
        self._samples["pitch"].append(pitch_ratio)

        enough = len(self._samples["ratio_x"]) >= self.target_samples
        timed_out = (t - self._first_sample_time) >= self.max_seconds
        if enough or timed_out:
            self._finalize({"ratio_x": 0.03, "ratio_y": 0.03, "yaw": 0.08, "pitch": 0.08})

    def _finalize(self, min_band_overrides):
        baselines = {}
        for key, values in self._samples.items():
            if not values:
                baselines[key] = Baseline(mean=1.0, band=0.5)
                continue
            mean = sum(values) / len(values)
            variance = sum((v - mean) ** 2 for v in values) / len(values)
            std = math.sqrt(variance)
            band = max(self.band_k * std, min_band_overrides.get(key, 0.05))
            baselines[key] = Baseline(mean=mean, band=band)
        self.baselines = baselines

    @property
    def progress(self):
        done = len(self._samples["ratio_x"])
        return min(done / self.target_samples, 1.0)


# ---------------------------------------------------------------------------
# Events
# ---------------------------------------------------------------------------
@dataclass
class Event:
    id: str
    type: str  # "looking_away" | "unstable_head_movement" | "self_touch" | "leaning"
    start_time: float
    end_time: float = None
    meta: dict = field(default_factory=dict)

    def duration(self):
        if self.end_time is None:
            return None
        return self.end_time - self.start_time

    def duration_at_least(self, seconds):
        d = self.duration()
        return d is not None and d >= seconds

    def to_dict(self):
        d = self.duration()
        return {
            "id": self.id,
            "type": self.type,
            "label": event_label(self.type, self.meta),
            "meta": self.meta,
            "start_time": round(self.start_time, 1),
            "end_time": round(self.end_time, 1) if self.end_time is not None else None,
            "duration": round(d, 1) if d is not None else None,
            "screenshot_b64": None,  # filled in by server.py, which holds the raw frames
        }


# ---------------------------------------------------------------------------
# Per-question tracker
# ---------------------------------------------------------------------------
class QuestionTracker:
    def __init__(self, index, calibrator):
        self.index = index
        self.calibrator = calibrator
        self.start_time = timer()

        self._gaze_history = deque()
        self._yaw_history = deque()
        self._pitch_history = deque()
        self._nose_history = deque()
        self._gesture_speed_history = deque()

        self.last_looking_state = True
        self.was_blinking = False

        self.total_frames = 0
        self.looking_frames = 0
        self.blink_count = 0
        self.nod_count = 0
        self.smiling_frames = 0
        self.good_framing_frames = 0
        self.poor_lighting_frames = 0
        self.brightness_sum = 0.0
        self.hands_visible_frames = 0
        self.level_shoulder_frames = 0
        self.shoulder_frames_seen = 0
        self._cumulative_gesture_distance = 0.0  # in face-widths
        self._gesture_active_seconds = 0.0

        self._prev_hand_center = None
        self._prev_hand_time = None

        self.events = []
        self._open_looking_away = None
        self._open_jitter = None
        self._jitter_streak_start = None
        self._open_self_touch = None
        self._open_lean = None
        self._lean_streak_start = None

    def now(self):
        return timer() - self.start_time

    def update(self, frame, face_lm, hands_lm, shoulders):
        t = self.now()
        h, w = frame.shape[:2]
        self.total_frames += 1
        new_events = []

        brightness = frame_brightness(frame)
        self.brightness_sum += brightness
        is_dark = brightness < LOW_LIGHT_BRIGHTNESS
        if is_dark:
            self.poor_lighting_frames += 1

        # --- hands: visibility, self-touch, gesture level (independent of face detection) ---
        if hands_lm:
            self.hands_visible_frames += 1
            wrists = [hand[WRIST] for hand in hands_lm if WRIST in hand]
            if wrists:
                cx = sum(p[0] for p in wrists) / len(wrists)
                cy = sum(p[1] for p in wrists) / len(wrists)
                if self._prev_hand_center is not None and face_lm:
                    fw = face_width_px(face_lm)
                    dt = max(t - self._prev_hand_time, 1e-3)
                    if fw > 0:
                        dist_norm = math.hypot(cx - self._prev_hand_center[0], cy - self._prev_hand_center[1]) / fw
                        speed = dist_norm / dt
                        self._cumulative_gesture_distance += dist_norm
                        self._gesture_active_seconds += dt
                        self._gesture_speed_history.append((t, speed))
                        _prune_older_than(self._gesture_speed_history, t, GESTURE_SPEED_WINDOW_SECONDS)
                self._prev_hand_center = (cx, cy)
                self._prev_hand_time = t
        else:
            self._prev_hand_center = None
            self._prev_hand_time = None

        touched_zone = detect_self_touch_zone(face_lm, hands_lm)
        self._update_self_touch(touched_zone, t, new_events)

        # --- shoulders / basic posture (independent of face detection too) ---
        if shoulders:
            self.shoulder_frames_seen += 1
            tilt = shoulder_tilt_ratio(shoulders)
            is_level = tilt < LEAN_TILT_THRESHOLD
            if is_level:
                self.level_shoulder_frames += 1
            self._update_lean(is_level, t, new_events)

        if not face_lm:
            return {
                "face_found": False,
                "timestamp": round(t, 1),
                "is_dark": is_dark,
                "hands_visible": bool(hands_lm),
                "self_touch_zone": touched_zone,
                "events": new_events,
            }

        ear = (eye_aspect_ratio(face_lm, RIGHT_EYE) + eye_aspect_ratio(face_lm, LEFT_EYE)) / 2
        is_blinking = ear < BLINK_EAR_THRESHOLD
        if is_blinking and not self.was_blinking:
            self.blink_count += 1
        self.was_blinking = is_blinking

        is_looking = self.last_looking_state
        if not is_blinking:
            rx_r, ry_r = eye_gaze_ratios(face_lm, RIGHT_EYE)
            rx_l, ry_l = eye_gaze_ratios(face_lm, LEFT_EYE)
            if None not in (rx_r, ry_r, rx_l, ry_l):
                ratio_x = (rx_r + rx_l) / 2
                ratio_y = (ry_r + ry_l) / 2
                yaw_ratio, pitch_ratio = head_turn_ratios(face_lm)

                if not self.calibrator.is_done:
                    self.calibrator.add_sample(ratio_x, ratio_y, yaw_ratio, pitch_ratio, t)
                    is_looking = True
                else:
                    b = self.calibrator.baselines
                    is_looking = (
                        b["ratio_x"].contains(ratio_x)
                        and b["ratio_y"].contains(ratio_y)
                        and b["yaw"].contains(yaw_ratio)
                        and b["pitch"].contains(pitch_ratio)
                    )
                    self._yaw_history.append((t, yaw_ratio))
                    self._pitch_history.append((t, pitch_ratio))
                    _prune_older_than(self._yaw_history, t, STABILITY_WINDOW_SECONDS)
                    _prune_older_than(self._pitch_history, t, STABILITY_WINDOW_SECONDS)

                self._gaze_history.append((t, is_looking))
                _prune_older_than(self._gaze_history, t, GAZE_SMOOTHING_SECONDS)
                self.last_looking_state = is_looking

        if self._gaze_history:
            votes = sum(1 for _, v in self._gaze_history if v)
            smoothed_is_looking = votes >= (len(self._gaze_history) / 2)
        else:
            smoothed_is_looking = is_looking

        if smoothed_is_looking:
            self.looking_frames += 1

        self._update_looking_away(smoothed_is_looking, t, new_events)

        nod_detected = self._detect_nod(face_lm, t)

        is_smiling = mouth_smile_ratio(face_lm) > SMILE_RATIO_THRESHOLD
        if is_smiling:
            self.smiling_frames += 1

        width_ratio = face_width_ratio(face_lm, w)
        if width_ratio > FRAME_TOO_CLOSE_RATIO:
            framing_label = "Move back"
        elif width_ratio < FRAME_TOO_FAR_RATIO:
            framing_label = "Move closer"
        else:
            framing_label = "Good framing"
            self.good_framing_frames += 1

        stability = self._stability_label()
        self._update_jitter(stability, t, new_events)

        return {
            "face_found": True,
            "timestamp": round(t, 1),
            "is_looking": smoothed_is_looking,
            "is_blinking": is_blinking,
            "is_calibrating": not self.calibrator.is_done,
            "calibration_progress": self.calibrator.progress,
            "eye_contact_running_percentage": round(100 * self.looking_frames / max(self.total_frames, 1), 1),
            "nod_detected": nod_detected,
            "is_smiling": is_smiling,
            "framing_label": framing_label,
            "is_dark": is_dark,
            "head_stability": stability,
            "hands_visible": bool(hands_lm),
            "self_touch_zone": touched_zone,
            "gesture_level": self._live_gesture_level(),
            "events": new_events,
        }

    # --- event bookkeeping helpers -----------------------------------
    def _update_looking_away(self, smoothed_is_looking, t, new_events):
        if not smoothed_is_looking and self._open_looking_away is None:
            ev = Event(id=_new_id(), type="looking_away", start_time=t)
            self._open_looking_away = ev
            new_events.append({"id": ev.id, "type": ev.type, "label": event_label(ev.type, {}), "status": "started", "start_time": round(t, 1)})
        elif smoothed_is_looking and self._open_looking_away is not None:
            ev = self._open_looking_away
            ev.end_time = t
            self._open_looking_away = None
            if ev.duration_at_least(MIN_LOOKING_AWAY_EVENT_SECONDS):
                self.events.append(ev)
                new_events.append(self._ended_delta(ev))

    def _update_jitter(self, stability, t, new_events):
        if stability == "Frequent movement":
            if self._jitter_streak_start is None:
                self._jitter_streak_start = t
            elif self._open_jitter is None and (t - self._jitter_streak_start) >= MIN_JITTER_EVENT_SECONDS:
                ev = Event(id=_new_id(), type="unstable_head_movement", start_time=self._jitter_streak_start)
                self._open_jitter = ev
                new_events.append({"id": ev.id, "type": ev.type, "label": event_label(ev.type, {}), "status": "started", "start_time": round(ev.start_time, 1)})
        else:
            self._jitter_streak_start = None
            if self._open_jitter is not None:
                ev = self._open_jitter
                ev.end_time = t
                self.events.append(ev)
                new_events.append(self._ended_delta(ev))
                self._open_jitter = None

    def _update_self_touch(self, touched_zone, t, new_events):
        if touched_zone is not None:
            if self._open_self_touch is None:
                ev = Event(id=_new_id(), type="self_touch", start_time=t, meta={"zone": touched_zone})
                self._open_self_touch = ev
                new_events.append({"id": ev.id, "type": ev.type, "label": event_label(ev.type, ev.meta), "status": "started", "start_time": round(t, 1)})
            elif self._open_self_touch.meta.get("zone") != touched_zone:
                self._close_self_touch(t, new_events)
                ev = Event(id=_new_id(), type="self_touch", start_time=t, meta={"zone": touched_zone})
                self._open_self_touch = ev
                new_events.append({"id": ev.id, "type": ev.type, "label": event_label(ev.type, ev.meta), "status": "started", "start_time": round(t, 1)})
        elif self._open_self_touch is not None:
            self._close_self_touch(t, new_events)

    def _close_self_touch(self, t, new_events):
        ev = self._open_self_touch
        ev.end_time = t
        if ev.duration_at_least(MIN_SELF_TOUCH_EVENT_SECONDS):
            self.events.append(ev)
            new_events.append(self._ended_delta(ev))
        self._open_self_touch = None

    def _update_lean(self, is_level, t, new_events):
        if not is_level:
            if self._lean_streak_start is None:
                self._lean_streak_start = t
            elif self._open_lean is None and (t - self._lean_streak_start) >= MIN_LEAN_EVENT_SECONDS:
                ev = Event(id=_new_id(), type="leaning", start_time=self._lean_streak_start)
                self._open_lean = ev
                new_events.append({"id": ev.id, "type": ev.type, "label": event_label(ev.type, {}), "status": "started", "start_time": round(ev.start_time, 1)})
        else:
            self._lean_streak_start = None
            if self._open_lean is not None:
                ev = self._open_lean
                ev.end_time = t
                self.events.append(ev)
                new_events.append(self._ended_delta(ev))
                self._open_lean = None

    def _ended_delta(self, ev):
        return {
            "id": ev.id, "type": ev.type, "label": event_label(ev.type, ev.meta), "status": "ended",
            "start_time": round(ev.start_time, 1), "end_time": round(ev.end_time, 1),
            "duration": round(ev.duration(), 1),
        }

    def _detect_nod(self, lm, t):
        nose_y = lm[NOSE_TIP][1]
        self._nose_history.append((t, nose_y))
        _prune_older_than(self._nose_history, t, NOD_WINDOW_SECONDS)
        if len(self._nose_history) < 4:
            return False
        ys = [y for _, y in self._nose_history]
        if (max(ys) - min(ys)) > NOD_MOVEMENT_THRESHOLD:
            self._nose_history.clear()
            self.nod_count += 1
            return True
        return False

    def _stability_label(self):
        if len(self._yaw_history) < 4:
            return "Calibrating"
        movement = _std([v for _, v in self._yaw_history]) + _std([v for _, v in self._pitch_history])
        if movement < 0.04:
            return "Steady"
        elif movement < 0.09:
            return "Some movement"
        return "Frequent movement"

    def _live_gesture_level(self):
        if not self._gesture_speed_history:
            return "Calibrating"
        avg = sum(v for _, v in self._gesture_speed_history) / len(self._gesture_speed_history)
        return gesture_level_label(avg)

    def finalize(self):
        """Force-close any event still open when the question's recording ends."""
        t = self.now()
        if self._open_looking_away is not None:
            ev = self._open_looking_away
            ev.end_time = t
            if ev.duration_at_least(MIN_LOOKING_AWAY_EVENT_SECONDS):
                self.events.append(ev)
            self._open_looking_away = None
        if self._open_jitter is not None:
            ev = self._open_jitter
            ev.end_time = t
            self.events.append(ev)
            self._open_jitter = None
        if self._open_self_touch is not None:
            ev = self._open_self_touch
            ev.end_time = t
            if ev.duration_at_least(MIN_SELF_TOUCH_EVENT_SECONDS):
                self.events.append(ev)
            self._open_self_touch = None
        if self._open_lean is not None:
            ev = self._open_lean
            ev.end_time = t
            self.events.append(ev)
            self._open_lean = None

    def summary(self):
        elapsed = self.now()
        minutes = max(elapsed / 60, 1e-6)
        frames = max(self.total_frames, 1)
        smile_pct = round(100 * self.smiling_frames / frames, 1)
        avg_gesture_speed = (
            self._cumulative_gesture_distance / self._gesture_active_seconds
            if self._gesture_active_seconds > 0 else 0.0
        )

        return {
            "index": self.index,
            "duration_seconds": round(elapsed, 1),
            "eye_contact_percentage": round(100 * self.looking_frames / frames, 1),
            "blink_count": self.blink_count,
            "blink_rate_per_minute": round(self.blink_count / minutes, 1),
            "head_nod_count": self.nod_count,
            "smile_percentage": smile_pct,
            "smile_label": smile_label(smile_pct),
            "good_framing_percentage": round(100 * self.good_framing_frames / frames, 1),
            "poor_lighting_percentage": round(100 * self.poor_lighting_frames / frames, 1),
            "average_brightness": round(self.brightness_sum / frames, 1),
            "hands_visible_percentage": round(100 * self.hands_visible_frames / frames, 1),
            "gesture_level": gesture_level_label(avg_gesture_speed),
            "level_shoulders_percentage": (
                round(100 * self.level_shoulder_frames / self.shoulder_frames_seen, 1)
                if self.shoulder_frames_seen else None
            ),
            "events": [e.to_dict() for e in sorted(self.events, key=lambda e: e.start_time)],
        }


# ---------------------------------------------------------------------------
# Session orchestrator — one per WebSocket connection (see server.py)
# ---------------------------------------------------------------------------
class SessionVision:
    def __init__(self):
        self.face_detector = FaceMeshDetector()
        self.hand_tracker = HandTracker()
        self.pose_tracker = PoseTracker()
        self.calibrator = GazeCalibrator()
        self.finished_questions = []
        self.current = None

    def start_question(self, index):
        if self.current is not None:
            self.end_question()
        self.current = QuestionTracker(index, self.calibrator)

    def end_question(self):
        if self.current is None:
            return None
        self.current.finalize()
        summary = self.current.summary()
        self.finished_questions.append(summary)
        self.current = None
        return summary

    def process_frame(self, frame):
        self.face_detector.process(frame)
        self.hand_tracker.process(frame)
        self.pose_tracker.process(frame)

        face_lm = self.face_detector.get_landmarks(frame)
        hands_lm = self.hand_tracker.get_hands(frame)
        shoulders = self.pose_tracker.get_shoulders(frame)

        if self.current is None:
            return {"face_found": False, "no_active_question": True, "events": []}
        return self.current.update(frame, face_lm, hands_lm, shoulders)

    def overall_summary(self):
        questions = list(self.finished_questions)
        if self.current is not None:
            questions = questions + [self.current.summary()]
        if not questions:
            return {"questions": [], "overall": None, "events": []}

        total_duration = sum(q["duration_seconds"] for q in questions) or 1e-6

        def weighted(key):
            return round(sum(q[key] * q["duration_seconds"] for q in questions) / total_duration, 1)

        def weighted_optional(key):
            vals = [(q[key], q["duration_seconds"]) for q in questions if q.get(key) is not None]
            if not vals:
                return None
            total = sum(d for _, d in vals) or 1e-6
            return round(sum(v * d for v, d in vals) / total, 1)

        total_blinks = sum(q["blink_count"] for q in questions)
        total_nods = sum(q["head_nod_count"] for q in questions)
        smile_pct = weighted("smile_percentage")
        all_events = [e for q in questions for e in q["events"]]
        self_touch_events = [e for e in all_events if e["type"] == "self_touch"]

        overall = {
            "duration_seconds": round(total_duration, 1),
            "eye_contact_percentage": weighted("eye_contact_percentage"),
            "smile_percentage": smile_pct,
            "smile_label": smile_label(smile_pct),
            "good_framing_percentage": weighted("good_framing_percentage"),
            "poor_lighting_percentage": weighted("poor_lighting_percentage"),
            "blink_count": total_blinks,
            "blink_rate_per_minute": round(total_blinks / max(total_duration / 60, 1e-6), 1),
            "head_nod_count": total_nods,
            "hands_visible_percentage": weighted("hands_visible_percentage"),
            "gesture_level": questions[-1]["gesture_level"],
            "level_shoulders_percentage": weighted_optional("level_shoulders_percentage"),
            "self_touch_event_count": len(self_touch_events),
        }
        return {"questions": questions, "overall": overall, "events": all_events}


def feedback_text(summary):
    lines = []

    ec = summary["eye_contact_percentage"]
    if ec >= 80:
        lines.append(f"Eye contact: strong, {ec}% of the time.")
    elif ec >= 55:
        lines.append(f"Eye contact: moderate, {ec}% — some noticeable look-aways.")
    else:
        lines.append(f"Eye contact: low, {ec}%.")

    lines.append(f"Expression: {summary['smile_label']} ({summary['smile_percentage']}% of the time).")
    lines.append(f"Blink rate: {summary['blink_rate_per_minute']}/min (typical resting rate is roughly 15-20/min).")
    lines.append(f"Hands visible {summary['hands_visible_percentage']}% of the time — {summary['gesture_level'].lower()}.")

    if summary.get("level_shoulders_percentage") is not None:
        lines.append(f"Shoulders level {summary['level_shoulders_percentage']}% of the time.")

    events = summary.get("events", [])
    away = [e for e in events if e["type"] == "looking_away"]
    jitter = [e for e in events if e["type"] == "unstable_head_movement"]
    touches = [e for e in events if e["type"] == "self_touch"]
    leans = [e for e in events if e["type"] == "leaning"]

    if away:
        lines.append(f"{len(away)} moment(s) of looking away, {round(sum(e['duration'] for e in away), 1)}s total.")
    if jitter:
        lines.append(f"{len(jitter)} stretch(es) of unstable head movement.")
    if touches:
        zones = sorted({e["label"] for e in touches})
        lines.append(f"{len(touches)} self-touch moment(s): {', '.join(zones)}.")
    if leans:
        lines.append(f"{len(leans)} stretch(es) of leaning to one side.")

    if summary["good_framing_percentage"] < 60:
        lines.append("Framing: frequently too close or too far from the camera.")
    if summary["poor_lighting_percentage"] > 25:
        lines.append("Lighting: often too dark — try facing a light source instead of having it behind you.")

    return lines


def draw_overlay(frame, metrics):
    lines = []
    if not metrics.get("face_found"):
        lines.append(("No face detected", (0, 0, 255)))
    else:
        if metrics.get("is_calibrating"):
            pct = int(metrics["calibration_progress"] * 100)
            lines.append((f"Calibrating... ({pct}%)", (255, 255, 0)))
        elif metrics.get("is_blinking"):
            lines.append(("Eye contact: Blinking", (255, 255, 0)))
        else:
            status = "Looking" if metrics.get("is_looking") else "Looking Away"
            color = (0, 255, 0) if metrics.get("is_looking") else (0, 0, 255)
            lines.append((f"Eye contact: {status}", color))
        lines.append((f"Framing: {metrics.get('framing_label')}", (0, 255, 0) if metrics.get("framing_label") == "Good framing" else (0, 165, 255)))
        lines.append((f"Head movement: {metrics.get('head_stability')}", (200, 200, 200)))

    if metrics.get("self_touch_zone"):
        lines.append((f"Touching: {metrics['self_touch_zone']}", (0, 165, 255)))
    lines.append((f"Hands visible: {metrics.get('hands_visible')}", (200, 200, 200)))

    for i, (text, color) in enumerate(lines):
        cv.putText(frame, text, (20, 40 + i * 32), cv.FONT_HERSHEY_SIMPLEX, 0.7, color, 2)


def main():
    """Standalone local demo — opens your webcam directly, single question."""
    capture = cv.VideoCapture(0)
    session = SessionVision()
    session.start_question(0)

    while True:
        success, frame = capture.read()
        if not success:
            break
        frame = cv.flip(frame, 1)
        metrics = session.process_frame(frame)
        draw_overlay(frame, metrics)
        cv.imshow("Framely", frame)
        if cv.waitKey(1) & 0xFF == ord("q"):
            break

    capture.release()
    cv.destroyAllWindows()

    session.end_question()
    result = session.overall_summary()
    print(result["overall"])
    print()
    for line in feedback_text(result["overall"]):
        print("-", line)
    print()
    print(f"{len(result['events'])} event(s) logged.")


if __name__ == "__main__":
    main()