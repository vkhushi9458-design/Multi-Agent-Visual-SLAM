import { useEffect, useRef } from "react";
import { Camera, Play, Square } from "lucide-react";

export default function Webcam({
  video,
  running,
  kp,
  phase,
  showPoints,
  onStart,
  onStop,
  error,
}) {
  const ref = useRef(null);
  useEffect(() => {
    const c = ref.current,
      g = c.getContext("2d");
    let raf;
    const loop = () => {
      g.fillStyle = "#050a16";
      g.fillRect(0, 0, c.width, c.height);
      const v = video.current;
      if (running && v && v.readyState >= 2) {
        g.save();
        g.translate(c.width, 0);
        g.scale(-1, 1);
        g.drawImage(v, 0, 0, c.width, c.height);
        g.restore();
        if (showPoints) {
          g.fillStyle = "#22c55e";
          for (const [x, y] of kp.current)
            g.fillRect((1 - x) * c.width - 2, y * c.height - 2, 4, 4);
        }
      }
      raf = requestAnimationFrame(loop);
    };
    loop();
    return () => cancelAnimationFrame(raf);
  }, [running, showPoints]);

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-line bg-[#050a16]">
      <canvas ref={ref} width={960} height={540} className="h-full w-full" />
      {running && (
        <>
          {phase === "detecting" && <div className="scan-line" />}
          {[
            "left-3 top-3 border-l-2 border-t-2",
            "right-3 top-3 border-r-2 border-t-2",
            "left-3 bottom-3 border-l-2 border-b-2",
            "right-3 bottom-3 border-r-2 border-b-2",
          ].map((c) => (
            <span
              key={c}
              className={`absolute h-6 w-6 border-green-400 ${c}`}
            />
          ))}
          <span className="absolute left-5 top-5 flex items-center gap-2 rounded-full bg-black/50 px-3 py-1 text-xs font-medium">
            <i className="blink h-2 w-2 rounded-full bg-red-500" />
            LIVE
          </span>
          <button
            onClick={onStop}
            className="absolute bottom-4 right-4 flex items-center gap-2 rounded-lg bg-red-500/90 px-4 py-2 text-sm font-semibold transition hover:bg-red-500"
          >
            <Square size={14} fill="currentColor" />
            Stop camera
          </button>
        </>
      )}
      {!running && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center">
          <div className="grid h-14 w-14 place-items-center rounded-full bg-blue-500/10 text-blue-400">
            <Camera size={26} />
          </div>
          <p className="max-w-sm text-sm text-muted">
            {error ||
              "Start the camera to detect agents and begin building the map."}
          </p>
          <button
            onClick={onStart}
            className="glow flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold transition hover:bg-blue-500"
          >
            <Play size={14} fill="currentColor" />
            {error ? "Try again" : "Start camera"}
          </button>
        </div>
      )}
    </div>
  );
}
