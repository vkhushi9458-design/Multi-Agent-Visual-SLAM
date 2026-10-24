
import { useEffect, useState } from "react";
import BackendStatus from "./BackendStatus.jsx";
import TrajectoryPanel from "./TrajectoryPanel.jsx";
import {
  Home,
  Video,
  Map as MapIcon,
  Users,
  BarChart3,
  Settings,
  Play,
  Square,
  Activity,
  Gauge,
  Target,
  Link2,
  Layers,
  Maximize,
  Minimize,
} from "lucide-react";

import { useCamera, useMission } from "./hooks.js";
import MapCanvas from "./MapCanvas.jsx";
import Webcam from "./Webcam.jsx";
import { Panel, Stat, AgentCard, Log, Pipeline } from "./ui.jsx";

const NAV = [
  ["Overview", Home],
  ["Live Camera", Video],
  ["Collaborative Map", MapIcon],
  ["Agents", Users],
  ["Evaluation", BarChart3],
  ["Settings", Settings],
];

const STATE = {
  idle: ["Standby", "bg-slate-500"],
  detecting: ["Detecting agents", "bg-amber-400 blink"],
  mapping: ["Building map", "bg-blue-400 blink"],
  fused: ["Map ready", "bg-green-400"],
};

const TRACK = {
  idle: "STANDBY",
  detecting: "SCANNING",
  mapping: "MAPPING",
  fused: "MAP READY",
};

const Legend = () => (
  <div className="flex flex-col gap-3 rounded-xl border border-line p-4 text-xs">
    {[
      ["#3b82f6", "Agent A (Webcam)"],
      ["#22c55e", "Agent B (Virtual)"],
      ["#a855f7", "Agent C (Virtual)"],
    ].map(([color, name]) => (
      <div key={name} className="flex items-center gap-3">
        <i
          className="h-[3px] w-6 rounded"
          style={{ background: color }}
        />
        {name}
      </div>
    ))}

    <div className="flex items-center gap-3">
      <i className="h-2.5 w-2.5 rounded-full bg-amber-400" />
      Shared landmark
    </div>

    <div className="flex items-center gap-3">
      <i className="h-2.5 w-2.5 rounded-full bg-sky-400" />
      Local landmark
    </div>
  </div>
);

const Toggle = ({ label, on, set }) => (
  <button
    type="button"
    onClick={() => set(!on)}
    role="switch"
    aria-checked={on}
    className="flex w-full items-center justify-between rounded-xl border border-line px-4 py-3 text-sm hover:border-blue-500/40"
  >
    {label}

    <span
      className={`h-6 w-11 rounded-full p-0.5 transition ${
        on ? "bg-blue-600" : "bg-slate-700"
      }`}
    >
      <span
        className={`block h-5 w-5 rounded-full bg-white transition-transform ${
          on ? "translate-x-5" : ""
        }`}
      />
    </span>
  </button>
);

function Spark({ data }) {
  const max = Math.max(1, ...data);

  const points = data
    .map((value, index) => {
      const x = (index / 39) * 300;
      const y = 60 - (value / max) * 56;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg viewBox="0 0 300 64" className="h-20 w-full">
      <polyline
        points={points || "0,60 300,60"}
        fill="none"
        stroke="#3b82f6"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function MotionPanel({ motion }) {
  const available =
    motion?.status === "success" && motion?.accepted !== false;

  const lowQuality = motion?.status === "low_quality";
  const rotation = motion?.rotation;
  const translation = motion?.translation_direction;

  const qualityTone =
    motion?.quality === "high"
      ? "green"
      : motion?.quality === "medium"
        ? "blue"
        : "violet";

  return (
    <Panel
      icon={Activity}
      title="Camera Motion Estimation"
      aside={
        available
          ? "Motion accepted"
          : lowQuality
            ? "Low-quality motion rejected"
            : "Estimate unavailable"
      }
    >
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Stat
          icon={Activity}
          tone={available ? "green" : "violet"}
          label="Motion status"
          value={motion?.status ?? "waiting"}
          sub={
            motion?.reason ??
            "Start the camera to receive motion estimates"
          }
        />

        <Stat
          icon={Target}
          tone="blue"
          label="Pose inliers"
          value={motion?.inliers ?? 0}
          sub="Matches retained during pose recovery"
        />

        <Stat
          icon={Target}
          tone={qualityTone}
          label="Motion quality"
          value={
            motion?.quality
              ? motion.quality.toUpperCase()
              : "WAITING"
          }
          sub={
            motion?.inlier_ratio != null
              ? `${(motion.inlier_ratio * 100).toFixed(1)}% inlier ratio`
              : "Waiting for a pose estimate"
          }
        />
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div className="min-w-0 rounded-xl border border-line p-4">
          <h3 className="mb-3 text-sm font-semibold">
            Relative Rotation Matrix
          </h3>

          {rotation ? (
            <pre className="overflow-x-auto whitespace-pre text-xs leading-6 text-muted">
              {rotation
                .map((row) =>
                  row
                    .map((value) => Number(value).toFixed(3))
                    .join("   ")
                )
                .join("\n")}
            </pre>
          ) : (
            <p className="text-sm text-muted">
              Rotation will appear when a valid estimate is available.
            </p>
          )}
        </div>

        <div className="min-w-0 rounded-xl border border-line p-4">
          <h3 className="mb-3 text-sm font-semibold">
            Translation Direction
          </h3>

          {translation ? (
            <div className="space-y-2 text-sm text-muted">
              <p>
                X: {Number(translation[0]).toFixed(4)}
              </p>
              <p>
                Y: {Number(translation[1]).toFixed(4)}
              </p>
              <p>
                Z: {Number(translation[2]).toFixed(4)}
              </p>

              <p className="mt-3 text-xs">
                Relative direction only. This is not distance in metres.
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted">
              Translation direction will appear when available.
            </p>
          )}
        </div>
      </div>

      {!available && (
        <p className="mt-4 rounded-lg border border-line p-3 text-xs text-muted">
          {motion?.reason ??
            "Point the camera at a detailed scene and move it slowly."}
          {" "}
          Weak estimates are not added to the trajectory.
        </p>
      )}

      <p className="mt-3 text-xs text-muted">
        Quality is a heuristic based on inlier count and ratio, not a
        calibrated accuracy score. Filtering reduces some bad updates
        but does not eliminate drift.
      </p>
    </Panel>
  );
}

export default function App() {
  const [page, setPage] = useState("Overview");
  const [sens, setSens] = useState(5);
  const [showPoints, setShowPoints] = useState(true);
  const [showTrails, setShowTrails] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(
    Boolean(document.fullscreenElement)
  );

  const [backendFrame, setBackendFrame] = useState(null);
  const [frameError, setFrameError] = useState("");

  const cam = useCamera();

  const m = useMission(
    cam.videoRef,
    cam.running,
    sens,
    backendFrame
  );

  const online = m.agents.filter(
    (agent) => agent.status === "active"
  ).length;

  const pct = Math.round(m.progress * 100);
  const [label, dot] = STATE[m.phase];

  const motion = backendFrame?.motion;

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };

    document.addEventListener(
      "fullscreenchange",
      handleFullscreenChange
    );

    return () => {
      document.removeEventListener(
        "fullscreenchange",
        handleFullscreenChange
      );
    };
  }, []);

  // Send webcam frames to FastAPI twice per second.
  useEffect(() => {
    if (!cam.running) {
      setBackendFrame(null);
      setFrameError("");
      return;
    }

    let busy = false;
    let cancelled = false;

    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");

    const sendFrame = async () => {
      const video = cam.videoRef.current;

      if (
        cancelled ||
        busy ||
        !context ||
        !video ||
        video.readyState < 2 ||
        !video.videoWidth
      ) {
        return;
      }

      busy = true;

      try {
        const width = Math.min(video.videoWidth, 640);
        const height = Math.round(
          video.videoHeight * (width / video.videoWidth)
        );

        canvas.width = width;
        canvas.height = height;

        context.drawImage(video, 0, 0, width, height);

        const image = canvas.toDataURL("image/jpeg", 0.7);

        const response = await fetch(
          "http://127.0.0.1:8000/api/frame",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ image }),
          }
        );

        if (!response.ok) {
          throw new Error(
            `Backend returned HTTP ${response.status}`
          );
        }

        const result = await response.json();

        if (!cancelled) {
          setBackendFrame(result);
          setFrameError(result.error ?? "");
        }
      } catch (error) {
        if (!cancelled) {
          setFrameError(
            error.message || "Frame processing failed"
          );
        }
      } finally {
        busy = false;
      }
    };

    sendFrame();

    const timer = setInterval(sendFrame, 500);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [cam.running, cam.videoRef]);

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (error) {
      console.error("Fullscreen error:", error);
    }
  };

  const webcam = (
    <Webcam
      video={cam.videoRef}
      running={cam.running}
      kp={m.kp}
      phase={m.phase}
      showPoints={showPoints}
      onStart={cam.start}
      onStop={cam.stop}
      error={cam.error}
    />
  );

  const map = (
    <Panel
      icon={MapIcon}
      title="Collaborative map"
      aside={
        m.phase === "idle"
          ? "Waiting for camera"
          : `${pct}% complete`
      }
    >
      <div className="grid gap-4 lg:grid-cols-[1fr_190px] lg:items-center">
        <MapCanvas
          agents={m.agents}
          progress={m.progress}
          phase={m.phase}
          showTrails={showTrails}
          backendFrame={backendFrame}
        />

        <Legend />
      </div>

      <div className="mt-3 h-1.5 overflow-hidden rounded bg-[#12203f]">
        <div
          className="h-full rounded bg-gradient-to-r from-blue-500 to-green-400 transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
    </Panel>
  );

  const agentList = m.agents.map((agent) => (
    <AgentCard key={agent.id} a={agent} />
  ));

  return (
    <div className="grid min-h-screen grid-cols-1 md:grid-cols-[220px_1fr] md:grid-rows-[auto_1fr]">
      <video
        ref={cam.videoRef}
        className="hidden"
        playsInline
        muted
      />

      {/* Header */}
      <header className="flex flex-wrap items-center gap-4 border-b border-line px-6 py-4 md:col-span-2">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 bg-[conic-gradient(from_30deg,#3b82f6,#22c55e,#3b82f6)] [clip-path:polygon(50%_0,100%_100%,0_100%)]" />

          <div>
            <h1 className="text-xl font-bold tracking-wide md:text-2xl">
              Multi-Agent Visual SLAM
            </h1>

            <p className="text-sm text-muted">
              Collaborative mapping &amp; spatial intelligence
            </p>
          </div>
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 rounded-full border border-line bg-panel px-4 py-2 text-sm">
            <i className={`h-2.5 w-2.5 rounded-full ${dot}`} />
            {label}
          </div>

          <button
            type="button"
            onClick={toggleFullscreen}
            title={
              isFullscreen ? "Exit fullscreen" : "Enter fullscreen"
            }
            aria-label={
              isFullscreen ? "Exit fullscreen" : "Enter fullscreen"
            }
            className="flex items-center gap-2 rounded-lg border border-line bg-panel px-3 py-2 text-sm font-medium transition hover:border-blue-500 hover:bg-blue-600 hover:text-white"
          >
            {isFullscreen ? (
              <Minimize size={17} />
            ) : (
              <Maximize size={17} />
            )}

            <span className="hidden sm:inline">
              {isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
            </span>
          </button>

          <button
            type="button"
            onClick={cam.running ? cam.stop : cam.start}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition ${
              cam.running
                ? "bg-red-500/90 hover:bg-red-500"
                : "bg-blue-600 hover:bg-blue-500"
            }`}
          >
            {cam.running ? (
              <>
                <Square size={14} fill="currentColor" />
                Stop camera
              </>
            ) : (
              <>
                <Play size={14} fill="currentColor" />
                Start camera
              </>
            )}
          </button>
        </div>
      </header>

      {/* Sidebar */}
      <aside className="border-line p-3 md:border-r md:p-4">
        <nav className="flex gap-1.5 overflow-x-auto md:flex-col">
          {NAV.map(([name, Icon]) => (
            <button
              type="button"
              key={name}
              onClick={() => setPage(name)}
              className={`flex shrink-0 items-center gap-3 rounded-lg px-4 py-3 text-left text-sm transition ${
                page === name
                  ? "bg-blue-600 text-white"
                  : "text-slate-300 hover:bg-[#0f1c38]"
              }`}
            >
              <Icon size={19} />
              {name}
            </button>
          ))}
        </nav>
      </aside>

      {/* Main content */}
      <main className="flex min-w-0 min-h-0 flex-col gap-5 overflow-y-auto p-4 md:p-6">
        {/* Overview */}
        {page === "Overview" && (
          <>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <Stat
                icon={Users}
                tone="green"
                label="Active agents"
                value={`${online} / 3`}
                sub={
                  online === 3
                    ? "All agents online"
                    : "Waiting for detection"
                }
              />

              <Stat
                icon={Target}
                tone="blue"
                label="Tracked features"
                value={m.features.toLocaleString()}
                sub="Visual features detected"
              />

              <Stat
                icon={Gauge}
                tone="violet"
                label="Camera FPS"
                value={m.fps}
                sub="Frames per second"
              />

              <Stat
                icon={Activity}
                tone="green"
                label="Tracking status"
                value={TRACK[m.phase]}
                sub={
                  m.phase === "idle"
                    ? "Camera is off"
                    : "Camera is on"
                }
              />
            </div>

            <div className="grid gap-5 xl:grid-cols-[2fr_1fr]">
              {map}

              <Panel
                icon={Users}
                title="Agent status"
                className="flex flex-col gap-3 xl:row-span-2"
              >
                <div className="flex flex-col gap-3">
                  {agentList}
                </div>
              </Panel>

              <div className="grid gap-5 lg:grid-cols-2">
                <Panel
                  icon={Video}
                  title="Live webcam feed"
                  aside="Feature tracking"
                >
                  {webcam}
                </Panel>

                <Panel icon={Link2} title="Map fusion log">
                  <Log log={m.log} />
                </Panel>
              </div>
            </div>

            <Panel icon={Layers} title="System pipeline">
              <Pipeline phase={m.phase} />
            </Panel>
          </>
        )}

        {/* Live Camera */}
        {page === "Live Camera" && (
          <Panel
            icon={Video}
            title="Live camera"
            aside={`${m.features} features • ${m.fps} FPS`}
          >
            <div className="mx-auto max-w-4xl">
              {webcam}
            </div>
          </Panel>
        )}

        {/* Collaborative Map */}
        {page === "Collaborative Map" && map}

        {/* Agents */}
        {page === "Agents" && (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {agentList}
          </div>
        )}

        {/* Evaluation */}
        {page === "Evaluation" && (
          <>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <Stat
                icon={Gauge}
                tone="violet"
                label="Processing FPS"
                value={m.fps}
                sub="Frames analysed per second"
              />

              <Stat
                icon={Target}
                tone="blue"
                label="Features per frame"
                value={m.features}
                sub="Current frame"
              />

              <Stat
                icon={Target}
                tone="green"
                label="Backend features"
                value={m.backendFeatures}
                sub="Features from FastAPI"
              />

              <Stat
                icon={Link2}
                tone="violet"
                label="Backend matches"
                value={m.backendMatches}
                sub="Matches between consecutive frames"
              />

              <Stat
                icon={MapIcon}
                tone="green"
                label="Map completeness"
                value={`${pct}%`}
                sub="Simulated shared map progress"
              />

              <Stat
                icon={Activity}
                tone="green"
                label="Session time"
                value={`${m.tick}s`}
                sub="Since camera start"
              />
            </div>

            <MotionPanel motion={motion} />

            <TrajectoryPanel backendFrame={backendFrame} />

            <Panel
              icon={BarChart3}
              title="Feature count over time"
              aside="Last 40 seconds"
            >
              <Spark data={m.hist} />
            </Panel>
          </>
        )}

        {/* Settings */}
        {page === "Settings" && (
          <Panel icon={Settings} title="Settings">
            <div className="max-w-xl space-y-3">
              <BackendStatus />

              <div className="rounded-xl border border-line p-4">
                <h3 className="font-medium">
                  Live Backend Processing
                </h3>

                {frameError ? (
                  <p className="mt-2 text-sm text-red-400">
                    Frame error: {frameError}
                  </p>
                ) : backendFrame ? (
                  <div className="mt-2 space-y-1 text-sm text-muted">
                    <p>
                      Frame status:{" "}
                      {backendFrame.error
                        ? "Error"
                        : "Receiving frames"}
                    </p>

                    <p>
                      Image size:{" "}
                      {backendFrame.image_width ?? "—"} ×{" "}
                      {backendFrame.image_height ?? "—"}
                    </p>

                    <p>
                      Backend features:{" "}
                      {backendFrame.features_detected ?? 0}
                    </p>

                    <p>
                      Backend matches:{" "}
                      {backendFrame.matches_detected ?? 0}
                    </p>

                    <p>
                      Motion status:{" "}
                      {backendFrame.motion?.status ?? "not provided"}
                    </p>

                    <p>
                      Motion quality:{" "}
                      {backendFrame.motion?.quality ?? "unavailable"}
                    </p>

                    <p>
                      Pose inliers:{" "}
                      {backendFrame.motion?.inliers ?? 0}
                    </p>

                    {backendFrame.motion?.reason && (
                      <p>
                        Motion details:{" "}
                        {backendFrame.motion.reason}
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="mt-2 text-sm text-muted">
                    {cam.running
                      ? "Waiting for webcam frames..."
                      : "Start the camera to send frames to FastAPI."}
                  </p>
                )}
              </div>

              <div className="rounded-xl border border-line px-4 py-3 text-sm">
                <div className="mb-2 flex justify-between">
                  <label htmlFor="s">
                    Detection sensitivity
                  </label>

                  <span className="tabular-nums text-muted">
                    {sens} / 10
                  </span>
                </div>

                <input
                  id="s"
                  type="range"
                  min="1"
                  max="10"
                  value={sens}
                  onChange={(event) =>
                    setSens(Number(event.target.value))
                  }
                  className="w-full accent-blue-500"
                />
              </div>

              <Toggle
                label="Show feature points on camera"
                on={showPoints}
                set={setShowPoints}
              />

              <Toggle
                label="Show agent trajectories on map"
                on={showTrails}
                set={setShowTrails}
              />
            </div>
          </Panel>
        )}
      </main>
    </div>
  );
}
