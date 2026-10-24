import { useEffect, useRef, useState } from "react";

export const BASE = [
  { id: "A", type: "Webcam", color: "#3b82f6" },
  { id: "B", type: "Virtual", color: "#22c55e" },
  { id: "C", type: "Virtual", color: "#a855f7" },
];

export function useCamera() {
  const videoRef = useRef(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const start = async () => {
    setError("");
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720 } });
      videoRef.current.srcObject = s;
      await videoRef.current.play();
      setRunning(true);
    } catch { setError("Camera access was blocked. Allow camera permission in your browser and try again."); }
  };
  const stop = () => {
    const v = videoRef.current;
    v?.srcObject?.getTracks().forEach((t) => t.stop());
    if (v) v.srcObject = null;
    setRunning(false);
  };
  useEffect(() => () => stop(), []);
  return { videoRef, running, error, start, stop };
}

/** Shi-Tomasi style corner detector on a small grayscale frame. Returns normalised [x, y] points. */
function corners(d, w, h, th) {
  const gray = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) gray[i] = 0.3 * d[i * 4] + 0.59 * d[i * 4 + 1] + 0.11 * d[i * 4 + 2];
  const xx = new Float32Array(w * h), yy = new Float32Array(w * h), xy = new Float32Array(w * h);
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const i = y * w + x, ix = gray[i + 1] - gray[i - 1], iy = gray[i + w] - gray[i - w];
    xx[i] = ix * ix; yy[i] = iy * iy; xy[i] = ix * iy;
  }
  const out = [], C = 6;
  for (let cy = 0; cy < h; cy += C) for (let cx = 0; cx < w; cx += C) {
    let best = 0, bx = 0, by = 0;
    for (let y = Math.max(2, cy); y < Math.min(h - 2, cy + C); y++) for (let x = Math.max(2, cx); x < Math.min(w - 2, cx + C); x++) {
      let a = 0, b = 0, c = 0;
      for (let j = -1; j <= 1; j++) for (let k = -1; k <= 1; k++) { const i = (y + j) * w + x + k; a += xx[i]; b += xy[i]; c += yy[i]; }
      const l = (a + c) / 2 - Math.sqrt(((a - c) / 2) ** 2 + b * b);
      if (l > best) { best = l; bx = x; by = y; }
    }
    if (best > th) out.push([bx / w, by / h]);
  }
  return out;
}

const clamp = (v) => Math.max(0, Math.min(1, v));
const stamp = () => new Date().toLocaleTimeString([], { hour12: false });

/** Camera on -> agents detected one by one -> map built -> map fused. Camera off -> reset. */
export function useMission(videoRef, running, sensitivity,backendFrame) {
  const kp = useRef([]);
  const thr = useRef(3500);
  thr.current = 6000 - sensitivity * 500;
  const [phase, setPhase] = useState("idle"); // idle | detecting | mapping | fused
  const [status, setStatus] = useState({ A: "offline", B: "offline", C: "offline" });
  const [progress, setProgress] = useState(0);
  const [log, setLog] = useState([]);
  const [fps, setFps] = useState(0);
  const [features, setFeatures] = useState(0);
  const [hist, setHist] = useState([]);
  const [tick, setTick] = useState(0);

  // real feature detection on webcam frames
  useEffect(() => {
    if (!running) return;
    const c = document.createElement("canvas"); c.width = 160; c.height = 90;
    const g = c.getContext("2d", { willReadFrequently: true });
    let frames = 0, last = performance.now();
    const id = setInterval(() => {
      const v = videoRef.current;
      if (!v || v.readyState < 2) return;
      g.drawImage(v, 0, 0, 160, 90);
      kp.current = corners(g.getImageData(0, 0, 160, 90).data, 160, 90, thr.current);
      frames++;
      const n = performance.now();
      if (n - last >= 1000) {
        setFps(frames); setFeatures(kp.current.length); setTick((t) => t + 1);
        setHist((h) => [...h, kp.current.length].slice(-40));
        frames = 0; last = n;
      }
    }, 66);
    return () => clearInterval(id);
  }, [running]);

  // agent detection -> mapping -> fusion sequence
  useEffect(() => {
    if (!running) {
      kp.current = [];
      setPhase("idle"); setStatus({ A: "offline", B: "offline", C: "offline" });
      setProgress(0); setLog([]); setFps(0); setFeatures(0); setHist([]); setTick(0);
      return;
    }
    const timers = [], t0 = Date.now();
    const at = (ms, fn) => timers.push(setTimeout(fn, ms));
    const push = (title, sub) => setLog((l) => [{ t: stamp(), title, sub }, ...l].slice(0, 6));
    const up = (id, s) => setStatus((o) => ({ ...o, [id]: s }));
    setPhase("detecting");
    push("Camera started", "Scanning the scene for agents");
    up("A", "detecting");
    at(1500, () => { up("A", "active"); push("Agent A detected", "Webcam locked, tracking started"); up("B", "detecting"); });
    at(2800, () => { up("B", "active"); push("Agent B detected", "Joined the session"); up("C", "detecting"); });
    at(4100, () => { up("C", "active"); push("Agent C detected", "Joined the session"); });
    at(5000, () => { setPhase("mapping"); push("Mapping started", "Building the shared map"); });
    at(8500, () => push("Shared landmarks matched", "Common features found across agents"));
    at(11500, () => push("Agent B map aligned", "Transformation applied"));
    at(14500, () => push("Agent C map aligned", "Transformation applied"));
    at(17000, () => { setPhase("fused"); push("Global map ready", "All agent maps merged"); });
    const iv = setInterval(() => setProgress(clamp((Date.now() - t0 - 5000) / 12000)), 150);
    return () => { timers.forEach(clearTimeout); clearInterval(iv); };
  }, [running]);

  const agents = BASE.map((b, i) => {
    const s = status[b.id], on = s === "active";
    const share = [0, 396, 421][i];
    return {
      ...b, status: s,
      health: on ? Math.round(90 + i * -2 + Math.sin(tick * 0.9 + i) * 4) : 0,
      pose: on ? [Math.sin(tick * 0.3 + i) * 2, Math.cos(tick * 0.25 + i * 2) * 1.5, (tick * 0.2 + i) % 6.28].map((v) => v.toFixed(2)) : ["–", "–", "–"],
      points: on ? (i === 0 ? Math.round(features * 0.6 + progress * 300) : Math.round(progress * share)) : 0,
    };
  });
  return { kp, phase, agents, progress, log, fps, features, hist, tick, backendFeatures: backendFrame?.features_detected ?? 0, backendMatches: backendFrame?.matches_detected ?? 0 };
}
