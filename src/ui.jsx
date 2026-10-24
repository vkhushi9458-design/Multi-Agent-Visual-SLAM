import {
  Camera,
  Target,
  Compass,
  Layers,
  Map as MapIcon,
  CheckCircle2,
  Link2,
} from "lucide-react";

export const Panel = ({ icon: I, title, aside, children, className = "" }) => (
  <section
    className={`rounded-2xl border border-line bg-panel/80 p-4 backdrop-blur ${className}`}
  >
    <header className="mb-3 flex items-center justify-between">
      <h2 className="flex items-center gap-2 text-[15px] font-semibold text-slate-200">
        {I && <I size={18} className="text-blue-400" />}
        {title}
      </h2>
      {aside && <span className="text-xs text-muted">{aside}</span>}
    </header>
    {children}
  </section>
);

const tones = {
  green: "bg-green-500/10 text-green-400",
  blue: "bg-blue-500/10 text-blue-400",
  violet: "bg-violet-500/10 text-violet-400",
};
export const Stat = ({ icon: I, tone, label, value, sub }) => (
  <div className="flex items-center gap-4 rounded-2xl border border-line bg-panel/80 p-4 transition hover:border-blue-500/40">
    <div
      className={`grid h-14 w-14 place-items-center rounded-full ${tones[tone]}`}
    >
      <I size={24} />
    </div>
    <div>
      <div className="text-sm font-medium text-slate-300">{label}</div>
      <div className="text-2xl font-bold leading-tight tabular-nums">
        {value}
      </div>
      <div className="text-xs text-muted">{sub}</div>
    </div>
  </div>
);

const badge = {
  offline: ["Offline", "text-slate-400 border-slate-600"],
  detecting: ["Detecting", "text-amber-400 border-amber-500 blink"],
  active: ["Active", "text-green-400 border-green-500"],
};
export const AgentCard = ({ a }) => (
  <div
    className={`rounded-xl border bg-[#08112a] p-4 transition ${a.status === "active" ? "border-line" : "border-line opacity-70"}`}
  >
    <div className="mb-3 flex items-center justify-between">
      <span className="flex items-center gap-3 font-semibold">
        <span
          className="relative h-3 w-3 rounded-full"
          style={{ background: a.color, color: a.color }}
        >
          {a.status === "active" && <i className="ring" />}
        </span>
        Agent {a.id}
        <span className="text-xs font-normal text-muted">{a.type}</span>
      </span>
      <span
        className={`rounded-md border px-2 py-0.5 text-[11px] font-semibold ${badge[a.status][1]}`}
      >
        {badge[a.status][0]}
      </span>
    </div>
    <div className="space-y-2 text-xs">
      <div className="grid grid-cols-[90px_1fr_36px] items-center gap-3">
        <span className="text-muted">Health</span>
        <div className="h-2 overflow-hidden rounded bg-[#12203f]">
          <div
            className="h-full rounded bg-gradient-to-r from-green-500 to-emerald-300 transition-all duration-700"
            style={{ width: a.health + "%" }}
          />
        </div>
        <span className="text-right tabular-nums">
          {a.health ? a.health + "%" : "–"}
        </span>
      </div>
      <div className="flex justify-between">
        <span className="text-muted">Pose (x, y, θ)</span>
        <span className="tabular-nums">{a.pose.join(", ")}</span>
      </div>
      <div className="flex justify-between">
        <span className="text-muted">Map points</span>
        <span className="tabular-nums">{a.points || "–"}</span>
      </div>
    </div>
  </div>
);

export const Log = ({ log }) =>
  log.length === 0 ? (
    <p className="py-6 text-center text-sm text-muted">
      Fusion events will appear here once mapping starts.
    </p>
  ) : (
    <div className="divide-y divide-line">
      {log.map((l) => (
        <div
          key={l.t + l.title}
          className="rise grid grid-cols-[32px_64px_1fr] items-center gap-3 py-2.5"
        >
          <span className="grid h-8 w-8 place-items-center rounded-full bg-green-500/10 text-green-400">
            {l.title.includes("aligned") ? (
              <Link2 size={15} />
            ) : (
              <CheckCircle2 size={15} />
            )}
          </span>
          <time className="text-xs tabular-nums text-muted">{l.t}</time>
          <div>
            <div className="text-sm font-medium">{l.title}</div>
            <div className="text-xs text-muted">{l.sub}</div>
          </div>
        </div>
      ))}
    </div>
  );

const STEPS = [
  [Camera, "Webcam", "Video frames"],
  [Target, "Feature detection", "Corners & keypoints"],
  [Compass, "Pose estimation", "Camera motion"],
  [Layers, "Map fusion", "Multi-agent alignment"],
  [MapIcon, "Global map", "Shared landmarks"],
];
const IDX = { idle: -1, detecting: 1, mapping: 3, fused: 4 };
export const Pipeline = ({ phase }) => {
  const cur = IDX[phase];
  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-start">
      {STEPS.map(([I, n, s], i) => (
        <div key={n} className="flex flex-1 items-start">
          <div className="flex flex-1 flex-col items-center gap-1 text-center">
            <div
              className={`grid h-16 w-20 place-items-center rounded-xl border transition-all duration-500 ${i <= cur ? "border-blue-500 bg-blue-500/15 text-blue-300" : "border-line bg-[#0b1a3a] text-slate-500"} ${i === cur ? "glow" : ""}`}
            >
              <I size={24} />
            </div>
            <strong className="mt-1 text-sm">{n}</strong>
            <span className="text-xs text-muted">{s}</span>
          </div>
          {i < STEPS.length - 1 && (
            <div
              className={`mt-8 hidden h-0.5 w-8 shrink-0 md:block ${i < cur ? "flow" : "bg-line"}`}
            />
          )}
        </div>
      ))}
    </div>
  );
};
