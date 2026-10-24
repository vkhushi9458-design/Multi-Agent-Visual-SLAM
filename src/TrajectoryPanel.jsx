
import { useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import {
  OrbitControls,
  Grid,
  Line,
  PerspectiveCamera,
} from "@react-three/drei";

/**
 * Smooth the visible camera marker without changing backend pose data.
 */
function SmoothCameraMarker({ position }) {
  const markerRef = useRef(null);
  const initializedRef = useRef(false);

  useFrame((_, delta) => {
    if (!markerRef.current) return;

    const marker = markerRef.current;

    const target = [
      Number(position[0]) || 0,
      Number(position[1]) || 0,
      Number(position[2]) || 0,
    ];

    // Start at the first available camera position.
    if (!initializedRef.current) {
      marker.position.set(...target);
      initializedRef.current = true;
      return;
    }

    // Frame-rate-independent exponential smoothing.
    const alpha = 1 - Math.exp(-5 * Math.min(delta, 0.1));

    marker.position.x += (target[0] - marker.position.x) * alpha;
    marker.position.y += (target[1] - marker.position.y) * alpha;
    marker.position.z += (target[2] - marker.position.z) * alpha;
  });

  return (
    <group ref={markerRef}>
      <mesh>
        <sphereGeometry args={[0.13, 24, 24]} />
        <meshStandardMaterial
          color="#22c55e"
          emissive="#166534"
          emissiveIntensity={0.7}
        />
      </mesh>

      <mesh position={[0, 0.28, 0]}>
        <coneGeometry args={[0.08, 0.28, 12]} />
        <meshStandardMaterial color="#86efac" />
      </mesh>
    </group>
  );
}

/**
 * Smooth the displayed path while retaining the original path samples.
 * This is visual smoothing, not backend pose correction.
 */
function smoothPath(points) {
  if (points.length < 3) return points;

  return points.map((point, i) => {
    // Keep endpoints unchanged.
    if (i === 0 || i === points.length - 1) {
      return point;
    }

    const start = Math.max(0, i - 2);
    const end = Math.min(points.length - 1, i + 2);
    const result = [0, 0, 0];
    let count = 0;

    for (let j = start; j <= end; j++) {
      for (let axis = 0; axis < 3; axis++) {
        result[axis] += points[j][axis];
      }
      count++;
    }

    return result.map((value) => value / count);
  });
}

function Scene({ points, position }) {
  const rawPathPoints = useMemo(() => {
    return points
      .filter(
        (point) =>
          Array.isArray(point) &&
          point.length >= 3 &&
          point
            .slice(0, 3)
            .every(
              (value) =>
                value !== null &&
                value !== undefined &&
                Number.isFinite(Number(value))
            )
      )
      .map((point) => [
        Number(point[0]),
        Number(point[1]),
        Number(point[2]),
      ]);
  }, [points]);

  const pathPoints = useMemo(
    () => smoothPath(rawPathPoints),
    [rawPathPoints]
  );

  const cameraPosition = useMemo(
    () => [
      Number(position?.[0]) || 0,
      Number(position?.[1]) || 0,
      Number(position?.[2]) || 0,
    ],
    [position]
  );

  const startPoint = pathPoints[0] ?? [0, 0, 0];

  return (
    <>
      <PerspectiveCamera
        makeDefault
        position={[6, 5, 8]}
        fov={50}
        near={0.01}
        far={2000}
      />

      <OrbitControls
        makeDefault
        target={[0, 0, 0]}
        enableDamping
        dampingFactor={0.08}
        minDistance={1}
        maxDistance={500}
      />

      <color attach="background" args={["#020617"]} />

      <ambientLight intensity={1.2} />

      <directionalLight
        position={[5, 8, 5]}
        intensity={2}
      />

      {/* Ground grid */}
      <Grid
        position={[0, -0.01, 0]}
        args={[40, 40]}
        cellSize={1}
        cellThickness={0.6}
        cellColor="#334155"
        sectionSize={5}
        sectionThickness={1.2}
        sectionColor="#64748b"
        fadeDistance={60}
        fadeStrength={1}
        infiniteGrid
      />

      {/* X, Y and Z axes */}
      <axesHelper args={[2]} />

      {/* Starting point */}
      {pathPoints.length > 0 && (
        <mesh position={startPoint}>
          <sphereGeometry args={[0.09, 16, 16]} />
          <meshStandardMaterial
            color="#38bdf8"
            emissive="#075985"
          />
        </mesh>
      )}

      {/* Smoothed historical trajectory */}
      {pathPoints.length > 1 && (
        <Line
          points={pathPoints}
          color="#38bdf8"
          lineWidth={3}
        />
      )}

      {/* Smoothed current camera marker */}
      <SmoothCameraMarker position={cameraPosition} />
    </>
  );
}

export default function TrajectoryPanel({ backendFrame }) {
  const [resetMessage, setResetMessage] = useState("");
  const [resetting, setResetting] = useState(false);

  const points = backendFrame?.trajectory?.points ?? [];
  const position = backendFrame?.trajectory?.position ?? [0, 0, 0];

  async function resetPath() {
    if (resetting) return;

    setResetting(true);
    setResetMessage("");

    try {
      const response = await fetch(
        "http://127.0.0.1:8000/api/reset",
        { method: "POST" }
      );

      if (!response.ok) {
        throw new Error("Reset request failed");
      }

      setResetMessage(
        "Path reset successfully. Move the camera to begin a new path."
      );
    } catch (error) {
      console.error("Trajectory reset failed:", error);

      setResetMessage(
        "Reset failed. Check that the backend is running."
      );
    } finally {
      setResetting(false);
    }
  }

  return (
    <section className="rounded-xl border border-slate-700 bg-slate-900 p-4 text-slate-100">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">
            3D Camera Trajectory
          </h2>

          <p className="text-xs text-slate-400">
            Smoothed relative path · Scale unknown · Drift possible
          </p>
        </div>

        <button
          type="button"
          onClick={resetPath}
          disabled={resetting}
          className="rounded-lg border border-slate-600 px-3 py-2 text-sm hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {resetting ? "Resetting..." : "Reset path"}
        </button>
      </div>

      <div className="relative h-[320px] overflow-hidden rounded-lg border border-slate-800 bg-slate-950 sm:h-[400px]">
        <Canvas
          dpr={[1, 2]}
          gl={{ antialias: true }}
          onCreated={({ gl }) => {
            gl.setClearColor("#020617");
          }}
        >
          <Scene points={points} position={position} />
        </Canvas>

        <div className="pointer-events-none absolute left-3 top-3 space-y-1 rounded-md bg-slate-950/80 p-2 text-xs">
          <p className="text-sky-400">
            ● Start / trajectory
          </p>
          <p className="text-green-400">
            ● Current camera
          </p>
        </div>

        <div className="pointer-events-none absolute bottom-3 right-3 rounded-md bg-slate-950/80 px-2 py-1 text-xs text-slate-400">
          Drag: rotate · Scroll: zoom · Right-drag: pan
        </div>

        {points.length === 0 && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <p className="rounded-lg bg-slate-950/90 px-4 py-3 text-center text-sm text-slate-300">
              Waiting for camera trajectory...
              <br />
              Move your camera to estimate motion.
            </p>
          </div>
        )}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-lg bg-slate-800 p-3">
          <p className="text-xs text-slate-400">
            Path samples
          </p>
          <p className="text-xl font-semibold">
            {points.length}
          </p>
        </div>

        <div className="rounded-lg bg-slate-800 p-3">
          <p className="text-xs text-slate-400">
            Relative X
          </p>
          <p className="text-xl font-semibold">
            {(Number(position?.[0]) || 0).toFixed(3)}
          </p>
        </div>

        <div className="rounded-lg bg-slate-800 p-3">
          <p className="text-xs text-slate-400">
            Relative Y
          </p>
          <p className="text-xl font-semibold">
            {(Number(position?.[1]) || 0).toFixed(3)}
          </p>
        </div>

        <div className="rounded-lg bg-slate-800 p-3">
          <p className="text-xs text-slate-400">
            Relative Z
          </p>
          <p className="text-xl font-semibold">
            {(Number(position?.[2]) || 0).toFixed(3)}
          </p>
        </div>
      </div>

      <p className="mt-3 text-xs text-slate-400">
        The green marker is smoothed over time, and the blue line
        is smoothed for display. Backend pose estimates remain
        unchanged. Coordinates are relative estimates, not metres.
        Monocular scale ambiguity and tracking drift may affect
        the trajectory.
      </p>

      {resetMessage && (
        <p className="mt-2 text-sm text-sky-300" role="status">
          {resetMessage}
        </p>
      )}
    </section>
  );
}
