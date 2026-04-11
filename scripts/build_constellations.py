#!/usr/bin/env python3
"""
Build constellation JSON from source images (static or animated webp/gif).

Pipeline per frame:
  1. rembg silhouette -> resampled cyclic edge points
  2. mediapipe FaceLandmarker -> eye/eyebrow/nose/lip landmarks (stable topology)

Output JSON shape (always frame-array, single image -> 1 frame):
  {
    name, source, model, aspect, fps, animated, generated,
    edge:     { lines: [[i,j],...] },                # stable topology
    interior: { lines: [[i,j],...] },                # stable topology
    frames:   [{ edge: [{x,y},...], interior: [{x,y},...] }, ...]
  }

Usage:
  constellations/.venv/bin/python scripts/build_constellations.py [name.ext] [--model MODEL] [--fps N]
"""

import argparse
import io
import json
import os
import sys
import time
from datetime import datetime
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageOps
from rembg import new_session, remove

import mediapipe as mp
from mediapipe.tasks.python import vision, BaseOptions
from mediapipe.tasks.python.vision import FaceLandmarksConnections as FLC

ROOT = Path(__file__).resolve().parent.parent
SOURCE_DIR = ROOT / "constellations" / "source"
PREVIEW_DIR = ROOT / "constellations" / "preview"
DEBUG_DIR = ROOT / "constellations" / "debug"
OUT_DIR = ROOT / "src" / "data" / "constellations"
FACE_MODEL = Path(os.path.expanduser("~/.constellations_cache/face_landmarker.task"))

# --- Tunables -------------------------------------------------------------
TARGET_WIDTH = 1024
ALPHA_THRESHOLD = 128
MASK_BLUR = 2
MORPH_CLOSE_KERNEL = 11   # close gaps in mask (head bites, hair edges)
MORPH_CLOSE_ITER = 2
EDGE_POINTS_TARGET = 180
DEFAULT_FPS = 12

# Canny-based detail layer (clothing seams, cap brim, jersey letters, hair, etc.)
# These are interior feature points distributed along strong intensity edges inside the mask.
DETAIL_POINTS_TARGET = 220
DETAIL_MIN_DIST_PX = 12
CANNY_LOW = 50
CANNY_HIGH = 140
DETAIL_NEIGHBOR_K = 1

# Mediapipe contour sets used as facial feature stars (eye/brow/nose/lip + face oval + iris).
# FACE_OVAL is included since rembg silhouette of cropped/face-only images may miss subtle
# jaw/cheek curve (also fine when redundant — adds density right where it counts).
FEATURE_CONTOUR_NAMES = [
    "FACE_LANDMARKS_FACE_OVAL",
    "FACE_LANDMARKS_LEFT_EYE",
    "FACE_LANDMARKS_RIGHT_EYE",
    "FACE_LANDMARKS_LEFT_EYEBROW",
    "FACE_LANDMARKS_RIGHT_EYEBROW",
    "FACE_LANDMARKS_NOSE",
    "FACE_LANDMARKS_LIPS",
    "FACE_LANDMARKS_LEFT_IRIS",
    "FACE_LANDMARKS_RIGHT_IRIS",
]
# -------------------------------------------------------------------------


def build_face_topology(include_tesselation_fill: bool = True):
    """Returns (mp_indices, local_lines): the global mediapipe landmark indices
    we keep, plus their connections remapped to local indices.

    With tesselation fill, all 468 mesh vertices are added as fill points (no extra lines),
    so face features look like a dense star cluster instead of hollow outline rings.
    """
    used = set()
    raw_edges = []
    for name in FEATURE_CONTOUR_NAMES:
        for c in getattr(FLC, name):
            used.add(c.start)
            used.add(c.end)
            raw_edges.append((c.start, c.end))
    if include_tesselation_fill:
        for c in FLC.FACE_LANDMARKS_TESSELATION:
            used.add(c.start)
            used.add(c.end)
    sorted_used = sorted(used)
    remap = {orig: i for i, orig in enumerate(sorted_used)}
    edges = [[remap[a], remap[b]] for a, b in raw_edges]
    return sorted_used, edges


def arc_length_resample(points: np.ndarray, n: int) -> np.ndarray:
    if len(points) < 2:
        return np.tile(points[0:1], (n, 1))
    closed = np.vstack([points, points[:1]])
    diffs = np.diff(closed, axis=0)
    seg_len = np.hypot(diffs[:, 0], diffs[:, 1])
    cum = np.concatenate([[0], np.cumsum(seg_len)])
    total = cum[-1]
    if total == 0:
        return np.tile(points[0:1], (n, 1))
    targets = np.linspace(0, total, n, endpoint=False)
    idx = np.searchsorted(cum, targets, side="right")
    idx = np.clip(idx, 1, len(cum) - 1)
    prev = closed[idx - 1]
    nxt = closed[idx]
    seg_t = (targets - cum[idx - 1]) / np.maximum(seg_len[idx - 1], 1e-9)
    return prev + (nxt - prev) * seg_t[:, None]


def extract_silhouette_points(rgba: np.ndarray, n_target: int):
    H, W = rgba.shape[:2]
    alpha = rgba[:, :, 3]
    blurred = cv2.GaussianBlur(alpha, (MASK_BLUR * 2 + 1, MASK_BLUR * 2 + 1), 0)
    _, binmask = cv2.threshold(blurred, ALPHA_THRESHOLD, 255, cv2.THRESH_BINARY)
    kernel = cv2.getStructuringElement(
        cv2.MORPH_ELLIPSE, (MORPH_CLOSE_KERNEL, MORPH_CLOSE_KERNEL)
    )
    binmask = cv2.morphologyEx(
        binmask, cv2.MORPH_CLOSE, kernel, iterations=MORPH_CLOSE_ITER
    )

    contours, _ = cv2.findContours(binmask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    if not contours:
        return None, binmask
    largest = max(contours, key=cv2.contourArea)
    pts = largest[:, 0, :].astype(np.float32)
    return arc_length_resample(pts, n_target), binmask


def detect_face_landmarks(rgb: np.ndarray, landmarker, mp_indices):
    mp_img = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)
    result = landmarker.detect(mp_img)
    if not result.face_landmarks:
        return None
    lms = result.face_landmarks[0]
    return np.array([[lms[i].x, lms[i].y] for i in mp_indices], dtype=np.float32)


def detect_face_bbox_cv(rgb: np.ndarray):
    """OpenCV Haar fallback face detector. Returns (x, y, w, h) of largest face or None.
    Tries frontal first, then left profile, then mirrored (right profile)."""
    gray = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY)
    gray = cv2.equalizeHist(gray)
    cascade_dir = cv2.data.haarcascades
    candidates = []
    for xml in ["haarcascade_frontalface_default.xml", "haarcascade_profileface.xml"]:
        cascade = cv2.CascadeClassifier(os.path.join(cascade_dir, xml))
        faces = cascade.detectMultiScale(
            gray, scaleFactor=1.1, minNeighbors=4, minSize=(40, 40)
        )
        for f in faces:
            candidates.append(tuple(int(v) for v in f))
    # Try mirrored for right-facing profile
    cascade = cv2.CascadeClassifier(
        os.path.join(cascade_dir, "haarcascade_profileface.xml")
    )
    flipped = cv2.flip(gray, 1)
    faces = cascade.detectMultiScale(
        flipped, scaleFactor=1.1, minNeighbors=4, minSize=(40, 40)
    )
    for x, y, w, h in faces:
        candidates.append((int(gray.shape[1] - x - w), int(y), int(w), int(h)))
    if not candidates:
        return None
    return max(candidates, key=lambda f: f[2] * f[3])


def extract_detail_edge_pixels(rgb: np.ndarray, mask: np.ndarray) -> np.ndarray:
    """Canny edge map inside the silhouette mask. Returns Nx2 array of (x, y) edge pixels."""
    gray = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY)
    gray = cv2.bilateralFilter(gray, 5, 50, 50)
    edges = cv2.Canny(gray, CANNY_LOW, CANNY_HIGH)
    eroded = cv2.erode(mask, np.ones((5, 5), np.uint8), iterations=2)
    edges = cv2.bitwise_and(edges, eroded)
    ys, xs = np.where(edges > 0)
    if len(xs) == 0:
        return np.empty((0, 2), dtype=np.float32)
    return np.column_stack([xs, ys]).astype(np.float32)


def poisson_sample(points: np.ndarray, n_target: int, min_dist: float, seed: int = 42) -> np.ndarray:
    """Greedy poisson-disk sampling: pick points spaced by at least `min_dist`, max `n_target`."""
    if len(points) == 0:
        return points
    rng = np.random.default_rng(seed)
    order = rng.permutation(len(points))
    selected = []
    min_d2 = min_dist * min_dist
    for idx in order:
        p = points[idx]
        too_close = False
        for s in selected:
            dx = p[0] - s[0]
            dy = p[1] - s[1]
            if dx * dx + dy * dy < min_d2:
                too_close = True
                break
        if not too_close:
            selected.append(p)
            if len(selected) >= n_target:
                break
    return np.array(selected, dtype=np.float32)


def knn_lines(points: np.ndarray, k: int):
    """k-nearest-neighbor edge set; returns list of [a, b] index pairs (deduped)."""
    n = len(points)
    if n < 2:
        return []
    d2 = np.sum((points[:, None, :] - points[None, :, :]) ** 2, axis=-1)
    np.fill_diagonal(d2, np.inf)
    pairs = set()
    for i in range(n):
        for j in np.argsort(d2[i])[:k]:
            a, b = (i, int(j)) if i < int(j) else (int(j), i)
            pairs.add((a, b))
    return [list(p) for p in pairs]


def snap_to_nearest(targets: np.ndarray, source: np.ndarray) -> np.ndarray:
    """For each target point, return the nearest point in source. Falls back to target if source empty."""
    if len(source) == 0:
        return targets.copy()
    out = np.empty_like(targets)
    for i, t in enumerate(targets):
        dx = source[:, 0] - t[0]
        dy = source[:, 1] - t[1]
        d2 = dx * dx + dy * dy
        out[i] = source[int(np.argmin(d2))]
    return out


def crop_around_face(rgb: np.ndarray, bbox, padding: float = 2.5):
    """Crop image to a square region around the face bbox, expanded by `padding` × bbox."""
    x, y, w, h = bbox
    cx, cy = x + w / 2, y + h / 2
    side = max(w, h) * padding
    H, W = rgb.shape[:2]
    x0 = max(0, int(cx - side / 2))
    y0 = max(0, int(cy - side / 2))
    x1 = min(W, int(cx + side / 2))
    y1 = min(H, int(cy + side / 2))
    return rgb[y0:y1, x0:x1].copy()


def normalize_pixel(pts: np.ndarray, W: int, H: int, aspect: float) -> np.ndarray:
    out = np.empty_like(pts, dtype=np.float32)
    out[:, 0] = ((pts[:, 0] / W) * 2 - 1) * aspect
    out[:, 1] = -(((pts[:, 1] / H) * 2 - 1))
    return out


def normalize_unit(pts: np.ndarray, aspect: float) -> np.ndarray:
    """Mediapipe landmarks are already in [0,1]."""
    out = np.empty_like(pts, dtype=np.float32)
    out[:, 0] = (pts[:, 0] * 2 - 1) * aspect
    out[:, 1] = -((pts[:, 1] * 2 - 1))
    return out


def pts_to_json(arr):
    return [{"x": round(float(p[0]), 4), "y": round(float(p[1]), 4)} for p in arr]


def cyclic_lines(n: int):
    return [[i, (i + 1) % n] for i in range(n)]


def render_preview_svg(j: dict) -> str:
    aspect = j["aspect"]
    W = 500
    H = round(W / aspect)
    frame0 = j["frames"][0]
    edge_lines = j["edge"]["lines"]
    interior_lines = j["interior"]["lines"]
    detail_lines = j.get("detail", {}).get("lines", [])

    def proj(p):
        return (((p["x"] / aspect) + 1) / 2 * W, (1 - (p["y"] + 1) / 2) * H)

    parts = [
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" style="background:#050508">'
    ]
    # detail lines (warm tone, drawn first so other layers sit on top)
    for a, b in detail_lines:
        pa, pb = proj(frame0["detail"][a]), proj(frame0["detail"][b])
        parts.append(
            f'<line x1="{pa[0]:.1f}" y1="{pa[1]:.1f}" x2="{pb[0]:.1f}" y2="{pb[1]:.1f}" stroke="#ffb070" stroke-width="0.35" stroke-opacity="0.4"/>'
        )
    for a, b in edge_lines:
        pa, pb = proj(frame0["edge"][a]), proj(frame0["edge"][b])
        parts.append(
            f'<line x1="{pa[0]:.1f}" y1="{pa[1]:.1f}" x2="{pb[0]:.1f}" y2="{pb[1]:.1f}" stroke="#4ecdc4" stroke-width="0.5" stroke-opacity="0.5"/>'
        )
    for a, b in interior_lines:
        pa, pb = proj(frame0["interior"][a]), proj(frame0["interior"][b])
        parts.append(
            f'<line x1="{pa[0]:.1f}" y1="{pa[1]:.1f}" x2="{pb[0]:.1f}" y2="{pb[1]:.1f}" stroke="#bce0ff" stroke-width="0.4" stroke-opacity="0.55"/>'
        )
    # detail star points
    for p in frame0.get("detail", []):
        pp = proj(p)
        parts.append(f'<circle cx="{pp[0]:.1f}" cy="{pp[1]:.1f}" r="0.9" fill="#ffd2a0"/>')
    for p in frame0["edge"]:
        pp = proj(p)
        parts.append(f'<circle cx="{pp[0]:.1f}" cy="{pp[1]:.1f}" r="1.5" fill="#fff"/>')
    for p in frame0["interior"]:
        pp = proj(p)
        parts.append(
            f'<circle cx="{pp[0]:.1f}" cy="{pp[1]:.1f}" r="1.2" fill="#cfe6ff"/>'
        )
    n_detail = len(frame0.get("detail", []))
    label = f'{j["name"]} · {len(j["frames"])} frame(s) · edge {len(frame0["edge"])} · interior {len(frame0["interior"])} · detail {n_detail} · {j["model"]}'
    parts.append(
        f'<text x="6" y="{H - 6}" fill="#4ecdc4" font-family="monospace" font-size="8" opacity="0.6">{label}</text>'
    )
    parts.append("</svg>")
    return "\n".join(parts)


def process_frame(rgba_frame: np.ndarray, session, landmarker, mp_indices, anchor_detail_px=None, name_dbg=None, save_debug=False, alpha_matting=False):
    """One frame: rembg -> silhouette -> landmarks -> canny detail.
    Returns (edge_norm, interior_norm, detail_norm, detail_edge_pixels, aspect, mask).
    If anchor_detail_px is given (Nx2 in pixel coords from frame 0), each anchor is snapped
    to the nearest canny edge in this frame, preserving topology across frames.
    """
    # rembg accepts numpy directly and returns RGBA numpy
    if alpha_matting:
        rgba = remove(
            rgba_frame,
            session=session,
            alpha_matting=True,
            alpha_matting_foreground_threshold=240,
            alpha_matting_background_threshold=15,
            alpha_matting_erode_size=3,
        )
    else:
        rgba = remove(rgba_frame, session=session)

    H_full, W_full = rgba.shape[:2]
    if W_full > TARGET_WIDTH:
        scale = TARGET_WIDTH / W_full
        rgba = cv2.resize(rgba, (TARGET_WIDTH, round(H_full * scale)), interpolation=cv2.INTER_AREA)
    H, W = rgba.shape[:2]
    aspect = W / H

    edge_px, mask = extract_silhouette_points(rgba, EDGE_POINTS_TARGET)
    if edge_px is None:
        return None, None, None, None, aspect, mask
    edge_norm = normalize_pixel(edge_px, W, H, aspect)

    rgb = rgba[:, :, :3].copy()
    face_unit = detect_face_landmarks(rgb, landmarker, mp_indices)
    if face_unit is None:
        interior_norm = None
    else:
        interior_norm = normalize_unit(face_unit, aspect)

    # Canny detail layer
    edge_pixels = extract_detail_edge_pixels(rgb, mask)
    if anchor_detail_px is None:
        # First frame: poisson-sample fresh detail points
        detail_px = poisson_sample(edge_pixels, DETAIL_POINTS_TARGET, DETAIL_MIN_DIST_PX)
    else:
        # Subsequent frame: snap each anchor to nearest canny edge in this frame
        detail_px = snap_to_nearest(anchor_detail_px, edge_pixels)
    detail_norm = normalize_pixel(detail_px, W, H, aspect) if len(detail_px) else np.empty((0, 2), dtype=np.float32)

    if save_debug and name_dbg:
        cv2.imwrite(str(DEBUG_DIR / f"{name_dbg}_mask.png"), mask)
        debug_canny = cv2.bitwise_and(
            cv2.Canny(cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY), CANNY_LOW, CANNY_HIGH),
            cv2.erode(mask, np.ones((5, 5), np.uint8), iterations=2),
        )
        cv2.imwrite(str(DEBUG_DIR / f"{name_dbg}_canny.png"), debug_canny)
    return edge_norm, interior_norm, detail_norm, detail_px, aspect, mask


def process(src: Path, model: str, fps: int, alpha_matting: bool = False):
    name = src.stem
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    PREVIEW_DIR.mkdir(parents=True, exist_ok=True)
    DEBUG_DIR.mkdir(parents=True, exist_ok=True)

    im = Image.open(src)
    # Only treat WEBP/GIF as potentially animated. JPEG/MPO/PNG are always single-frame
    # even though PIL may report n_frames>1 for MPO (those are thumbnail/stereo pairs).
    is_anim = getattr(im, "is_animated", False) and im.format in ("WEBP", "GIF")
    n_frames = im.n_frames if is_anim else 1
    # Apply EXIF orientation for static images. Skip for animated (would collapse to 1 frame).
    if not is_anim:
        im = ImageOps.exif_transpose(im)
    print(f"\n=> {src.name}  (format: {im.format}, model: {model}, frames: {n_frames}, fps: {fps})", flush=True)

    mp_indices, interior_lines = build_face_topology()
    print(f"   face topology: {len(mp_indices)} pts, {len(interior_lines)} connections")

    print("   loading rembg session...", flush=True)
    t_session = time.time()
    session = new_session(model)
    print(f"   rembg ready ({(time.time() - t_session) * 1000:.0f}ms)")

    print("   loading mediapipe FaceLandmarker...", flush=True)
    t_face = time.time()
    opts = vision.FaceLandmarkerOptions(
        base_options=BaseOptions(model_asset_path=str(FACE_MODEL)),
        num_faces=1,
    )
    landmarker = vision.FaceLandmarker.create_from_options(opts)
    print(f"   mediapipe ready ({(time.time() - t_face) * 1000:.0f}ms)")

    # ----- Pass 1: rembg + extract per-frame rgba, edge_pixels (canny inside mask) -----
    # We collect per-frame data first so we can sample detail anchors from the union of
    # canny edges across ALL frames (covers latter-frame content like new wall area).
    pass1: list = []  # list of dicts: {rgba, edge_pixels, mask}
    t0 = time.time()

    for fi in range(n_frames):
        if is_anim:
            im.seek(fi)
        # Resize: downscale very large inputs (rembg slow), upscale tiny inputs (more detail)
        frame_pil = im.convert("RGB")
        max_dim = max(frame_pil.size)
        target_max = None
        if max_dim > 1600:
            target_max = 1600
        elif max_dim < 800:
            target_max = 1024  # upscale small sources for richer canny detail + better face landmarks
        if target_max is not None:
            scale = target_max / max_dim
            new_size = (round(frame_pil.size[0] * scale), round(frame_pil.size[1] * scale))
            frame_pil = frame_pil.resize(new_size, Image.LANCZOS)
        frame_rgb = np.array(frame_pil)

        # cv2 face fallback crop (silhouette-only if no face)
        pre_lms = detect_face_landmarks(frame_rgb, landmarker, mp_indices)
        if pre_lms is None:
            bbox = detect_face_bbox_cv(frame_rgb)
            if bbox is not None:
                cropped = crop_around_face(frame_rgb, bbox, padding=2.6)
                cropped_lms = detect_face_landmarks(cropped, landmarker, mp_indices)
                if cropped_lms is not None:
                    print(
                        f"   frame {fi+1}/{n_frames}: cv2 fallback at {bbox} → mediapipe ok on crop {cropped.shape[1]}x{cropped.shape[0]}",
                        flush=True,
                    )
                    frame_rgb = cropped
                else:
                    print(
                        f"   frame {fi+1}/{n_frames}: cv2 found face but mediapipe still failed — silhouette only",
                        flush=True,
                    )

        # Run rembg + extract edge pixel set (the slow part)
        if alpha_matting:
            rgba = remove(
                frame_rgb,
                session=session,
                alpha_matting=True,
                alpha_matting_foreground_threshold=240,
                alpha_matting_background_threshold=15,
                alpha_matting_erode_size=3,
            )
        else:
            rgba = remove(frame_rgb, session=session)

        H_full, W_full = rgba.shape[:2]
        if W_full > TARGET_WIDTH:
            scale = TARGET_WIDTH / W_full
            rgba = cv2.resize(rgba, (TARGET_WIDTH, round(H_full * scale)), interpolation=cv2.INTER_AREA)
        H, W = rgba.shape[:2]

        # Build mask once, store mask + edge pixel set for canny detail
        alpha = rgba[:, :, 3]
        blurred = cv2.GaussianBlur(alpha, (MASK_BLUR * 2 + 1, MASK_BLUR * 2 + 1), 0)
        _, binmask = cv2.threshold(blurred, ALPHA_THRESHOLD, 255, cv2.THRESH_BINARY)
        kernel = cv2.getStructuringElement(
            cv2.MORPH_ELLIPSE, (MORPH_CLOSE_KERNEL, MORPH_CLOSE_KERNEL)
        )
        binmask = cv2.morphologyEx(binmask, cv2.MORPH_CLOSE, kernel, iterations=MORPH_CLOSE_ITER)

        rgb = rgba[:, :, :3].copy()
        edge_pixels = extract_detail_edge_pixels(rgb, binmask)

        if fi == 0:
            cv2.imwrite(str(DEBUG_DIR / f"{name}_mask.png"), binmask)
            debug_canny = cv2.bitwise_and(
                cv2.Canny(cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY), CANNY_LOW, CANNY_HIGH),
                cv2.erode(binmask, np.ones((5, 5), np.uint8), iterations=2),
            )
            cv2.imwrite(str(DEBUG_DIR / f"{name}_canny.png"), debug_canny)

        pass1.append({
            "rgba": rgba,
            "rgb": rgb,
            "mask": binmask,
            "edge_pixels": edge_pixels,
            "W": W,
            "H": H,
        })
        if (fi + 1) % 5 == 0 or fi == n_frames - 1:
            elapsed = time.time() - t0
            print(f"   pass1 {fi+1}/{n_frames}  ({elapsed:.1f}s, {elapsed / (fi+1) * 1000:.0f}ms/frame)", flush=True)

    if not pass1:
        print(f"   no usable frames", file=sys.stderr)
        landmarker.close()
        return

    # ----- Sample detail anchors from UNION of all frames' canny edges -----
    edge_lists = [p["edge_pixels"] for p in pass1 if len(p["edge_pixels"])]
    if edge_lists:
        union_edges = np.vstack(edge_lists)
        anchor_detail_px = poisson_sample(union_edges, DETAIL_POINTS_TARGET, DETAIL_MIN_DIST_PX)
    else:
        anchor_detail_px = np.empty((0, 2), dtype=np.float32)
    print(f"   detail anchors from union: {len(anchor_detail_px)} points (poisson-sampled)")

    # ----- Pass 2: extract silhouette + landmarks + snapped detail per frame -----
    frames_data = []
    aspect = None
    last_interior = None
    detail_lines: list = []

    for fi, p in enumerate(pass1):
        rgba = p["rgba"]
        rgb = p["rgb"]
        mask = p["mask"]
        edge_pixels = p["edge_pixels"]
        W, H = p["W"], p["H"]
        frame_aspect = W / H

        # Silhouette outline
        contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
        if not contours:
            print(f"   frame {fi+1}: silhouette missing — dup prev")
            if frames_data:
                frames_data.append(frames_data[-1])
            continue
        largest = max(contours, key=cv2.contourArea)
        edge_pts_px = arc_length_resample(largest[:, 0, :].astype(np.float32), EDGE_POINTS_TARGET)
        edge_norm = normalize_pixel(edge_pts_px, W, H, frame_aspect)

        # Mediapipe face landmarks (now includes TESSELATION fill)
        face_unit = detect_face_landmarks(rgb, landmarker, mp_indices)
        if face_unit is None:
            interior_norm = (
                last_interior
                if last_interior is not None
                else np.zeros((len(mp_indices), 2), dtype=np.float32)
            )
        else:
            interior_norm = normalize_unit(face_unit, frame_aspect)
            last_interior = interior_norm

        # Snap union anchors to this frame's canny edges
        if len(anchor_detail_px) and len(edge_pixels):
            detail_px = snap_to_nearest(anchor_detail_px, edge_pixels)
        else:
            detail_px = anchor_detail_px.copy() if len(anchor_detail_px) else np.empty((0, 2), dtype=np.float32)
        detail_norm = normalize_pixel(detail_px, W, H, frame_aspect) if len(detail_px) else np.empty((0, 2), dtype=np.float32)

        if aspect is None:
            aspect = frame_aspect
        if fi == 0:
            detail_lines = knn_lines(detail_norm, DETAIL_NEIGHBOR_K) if len(detail_norm) >= 2 else []
            print(f"   detail layer: {len(detail_norm)} points, {len(detail_lines)} lines")

        frames_data.append({
            "edge": pts_to_json(edge_norm),
            "interior": pts_to_json(interior_norm),
            "detail": pts_to_json(detail_norm),
        })
        if (fi + 1) % 5 == 0 or fi == n_frames - 1:
            elapsed = time.time() - t0
            print(f"   pass2 {fi+1}/{n_frames}  ({elapsed:.1f}s)", flush=True)

    if not frames_data:
        print(f"   no usable frames in {src.name}", file=sys.stderr)
        landmarker.close()
        return

    edge_lines = cyclic_lines(EDGE_POINTS_TARGET)

    result = {
        "name": name,
        "source": src.name,
        "generated": datetime.utcnow().isoformat() + "Z",
        "model": model,
        "aspect": round(aspect or 1.0, 4),
        "fps": fps,
        "animated": is_anim,
        "edge": {"lines": edge_lines},
        "interior": {"lines": interior_lines},
        "detail": {"lines": detail_lines},
        "frames": frames_data,
    }

    out_path = OUT_DIR / f"{name}.json"
    out_path.write_text(json.dumps(result))
    print(f"   wrote {out_path.relative_to(ROOT)} ({out_path.stat().st_size} B)")

    svg_path = PREVIEW_DIR / f"{name}.svg"
    svg_path.write_text(render_preview_svg(result))
    print(f"   wrote {svg_path.relative_to(ROOT)}")

    landmarker.close()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("name", nargs="?", help="file name in constellations/source/")
    parser.add_argument(
        "--model",
        default="birefnet-portrait",
        help="rembg model (default: birefnet-portrait)",
    )
    parser.add_argument("--fps", type=int, default=DEFAULT_FPS, help="playback fps")
    parser.add_argument(
        "--alpha-matting",
        action="store_true",
        help="enable rembg alpha matting (slow, refines mask edges)",
    )
    args = parser.parse_args()

    if not FACE_MODEL.exists():
        print(f"Missing face landmarker model at {FACE_MODEL}", file=sys.stderr)
        print(
            "Download:\n  mkdir -p ~/.constellations_cache && curl -sSL -o ~/.constellations_cache/face_landmarker.task https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
            file=sys.stderr,
        )
        sys.exit(1)

    if args.name:
        files = [SOURCE_DIR / args.name]
    else:
        files = sorted(
            p
            for p in SOURCE_DIR.iterdir()
            if p.suffix.lower() in (".jpg", ".jpeg", ".png", ".webp", ".gif")
        )

    if not files:
        print(f"No source images found in {SOURCE_DIR}", file=sys.stderr)
        sys.exit(1)

    for f in files:
        if not f.exists():
            print(f"missing: {f}", file=sys.stderr)
            continue
        process(f, args.model, args.fps, alpha_matting=args.alpha_matting)


if __name__ == "__main__":
    main()
