
import { useEffect, useRef } from "react";

const W = 900;
const H = 500;
const N = 90;

const furniture = [
  [40, 40, 90, 30],
  [330, 36, 80, 40],
  [60, 200, 40, 90],
  [380, 210, 140, 60],
  [700, 150, 40, 120],
  [180, 400, 120, 50],
  [560, 420, 150, 36],
];

let s = 7;

const rnd = () => {
  s = (s * 16807) % 2147483647;
  return s / 2147483647;
};

const marks = Array.from({ length: N }, (_, i) => ({
  x: 30 + rnd() * (W - 60),
  y: 30 + rnd() * (H - 60),
  shared: i % 3 === 0,
}));

const paths = [
  (t) => [
    260 + 170 * Math.cos(t),
    260 + 120 * Math.sin(t * 1.2),
  ],
  (t) => [
    520 + 200 * Math.sin(t * 0.8),
    170 + 90 * Math.cos(t * 1.6),
  ],
  (t) => [
    660 + 120 * Math.cos(t * 1.1 + 1),
    330 + 110 * Math.sin(t + 2),
  ],
];

export default function MapCanvas({
  agents = [],
  progress = 0,
  phase = "idle",
  showTrails = true,
  backendFrame = null,
}) {
  const ref = useRef(null);
  const P = useRef({});

  P.current = {
    agents,
    progress,
    phase,
    showTrails,
    backendFrame,
  };

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;

    const g = canvas.getContext("2d");
    if (!g) return;

    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    const trails = [[], [], []];
    let raf;
    let t = 0;

    const draw = () => {
      const {
        agents,
        progress,
        showTrails,
        backendFrame,
      } = P.current;

      g.clearRect(0, 0, W, H);

      // Background
      g.fillStyle = "#070d1a";
      g.fillRect(0, 0, W, H);

      // Border
      g.strokeStyle = "#2a3a5c";
      g.lineWidth = 3;
      g.strokeRect(4, 4, W - 8, H - 8);

      // Illustrative map furniture
      g.fillStyle = "#16233d";
      furniture.forEach((f) => g.fillRect(...f));

      // Illustrative local and shared landmarks
      const shown = Math.floor(
        Math.max(0, Math.min(1, progress)) * N
      );
      const vis = marks.slice(0, shown);

      if (progress > 0.5) {
        g.strokeStyle = `rgba(251,191,36,${
          (progress - 0.5) * 0.5
        })`;
        g.lineWidth = 1;

        const shared = vis.filter((m) => m.shared);

        shared.forEach((m, i) => {
          if (shared.length < 2) return;

          const other = shared[(i + 3) % shared.length];

          g.beginPath();
          g.moveTo(m.x, m.y);
          g.lineTo(other.x, other.y);
          g.stroke();
        });
      }

      vis.forEach((m, i) => {
        g.fillStyle = m.shared ? "#fbbf24" : "#38bdf8";

        g.beginPath();
        g.arc(m.x, m.y, m.shared ? 3.5 : 2.5, 0, Math.PI * 2);
        g.fill();

        const age = shown - i;

        if (age < 6) {
          g.strokeStyle = g.fillStyle;
          g.globalAlpha = 1 - age / 6;
          g.beginPath();
          g.arc(
            m.x,
            m.y,
            4 + age * 3,
            0,
            Math.PI * 2
          );
          g.stroke();
          g.globalAlpha = 1;
        }
      });

      // Real 2D camera feature points from FastAPI
      const points = Array.isArray(backendFrame?.feature_points)
        ? backendFrame.feature_points
        : [];

      const frameWidth = Number(backendFrame?.width);
      const frameHeight = Number(backendFrame?.height);

      if (frameWidth > 0 && frameHeight > 0) {
        g.fillStyle = "#4ade80";

        points.forEach((point) => {
          const px = Array.isArray(point)
            ? point[0]
            : point?.x;

          const py = Array.isArray(point)
            ? point[1]
            : point?.y;

          if (
            !Number.isFinite(px) ||
            !Number.isFinite(py)
          ) {
            return;
          }

          const x = (px / frameWidth) * W;
          const y = (py / frameHeight) * H;

          g.beginPath();
          g.arc(x, y, 2, 0, Math.PI * 2);
          g.fill();
        });
      }

      // Match corresponding points from previous and current frames
      const matches = Array.isArray(backendFrame?.matched_points)
        ? backendFrame.matched_points
        : [];

      if (frameWidth > 0 && frameHeight > 0) {
        g.save();
        g.strokeStyle = "rgba(244, 114, 182, 0.45)";
        g.lineWidth = 1;

        matches.forEach((match) => {
          const previous = match?.previous;
          const current = match?.current;

          if (
            !previous ||
            !current ||
            !Number.isFinite(previous.x) ||
            !Number.isFinite(previous.y) ||
            !Number.isFinite(current.x) ||
            !Number.isFinite(current.y)
          ) {
            return;
          }

          const x1 = (previous.x / frameWidth) * W;
          const y1 = (previous.y / frameHeight) * H;
          const x2 = (current.x / frameWidth) * W;
          const y2 = (current.y / frameHeight) * H;

          g.beginPath();
          g.moveTo(x1, y1);
          g.lineTo(x2, y2);
          g.stroke();
        });

        g.restore();
      }

      // Illustrative agent movement (not estimated camera poses)
      agents.forEach((a, i) => {
        if (a.status !== "active") {
          if (trails[i]) trails[i].length = 0;
          return;
        }

        const getPath = paths[i];
        if (!getPath) return;

        const [x, y] = getPath(t);
        const tr = trails[i];

        tr.push([x, y]);
        if (tr.length > 160) tr.shift();

        if (tr.length > 2) {
          const [px, py] = tr[tr.length - 2];
          const heading = Math.atan2(y - py, x - px);

          g.fillStyle = `${a.color}22`;
          g.beginPath();
          g.moveTo(x, y);
          g.arc(
            x,
            y,
            70,
            heading - 0.5,
            heading + 0.5
          );
          g.closePath();
          g.fill();
        }

        if (showTrails) {
          g.strokeStyle = a.color;
          g.lineWidth = 2.5;
          g.setLineDash([8, 6]);
          g.beginPath();

          tr.forEach(([u, v], k) => {
            if (k) g.lineTo(u, v);
            else g.moveTo(u, v);
          });

          g.stroke();
          g.setLineDash([]);
        }

        g.fillStyle = a.color;
        g.beginPath();
        g.arc(x, y, 7, 0, Math.PI * 2);
        g.fill();

        g.fillStyle = "#0b1426";
        g.fillRect(x - 28, y - 32, 56, 20);

        g.strokeStyle = a.color;
        g.lineWidth = 1;
        g.strokeRect(x - 28, y - 32, 56, 20);

        g.fillStyle = "#fff";
        g.font = "600 12px Inter, sans-serif";
        g.textAlign = "center";
        g.fillText(`Agent ${a.id}`, x, y - 18);
      });

      if (!reduce) t += 0.012;

      raf = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div className="relative">
      <canvas
        ref={ref}
        width={W}
        height={H}
        className="h-auto w-full rounded-xl border border-line"
        aria-label="Collaborative map with camera features and feature matches"
      />

      {phase === "idle" && (
        <div className="absolute inset-0 grid place-items-center rounded-xl bg-bg/70 text-sm text-muted">
          Start the camera to build the map
        </div>
      )}

      <div className="absolute bottom-3 left-3 flex flex-wrap gap-3 rounded-lg bg-slate-950/80 px-3 py-2 text-xs text-white">
        <span>
          <span className="mr-1 inline-block h-2 w-2 rounded-full bg-green-400" />
          Camera features
        </span>

        <span>
          <span className="mr-1 inline-block h-2 w-2 rounded-full bg-pink-400" />
          Feature matches
        </span>

        <span>
          <span className="mr-1 inline-block h-2 w-2 rounded-full bg-sky-400" />
          Local landmarks
        </span>

        <span>
          <span className="mr-1 inline-block h-2 w-2 rounded-full bg-amber-400" />
          Shared landmarks
        </span>
      </div>
    </div>
  );
}
