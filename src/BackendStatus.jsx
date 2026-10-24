
import { useEffect, useState } from "react";

export default function BackendStatus() {
  const [status, setStatus] = useState("Checking...");
  const [details, setDetails] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    fetch("http://127.0.0.1:8000/api/health", {
      signal: controller.signal,
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        return response.json();
      })
      .then((data) => {
        setStatus("Connected");
        setDetails(
          `Backend: ${data.backend} | SLAM: ${data.slam_engine}`
        );
      })
      .catch((error) => {
        if (error.name === "AbortError") return;
        setStatus("Disconnected");
        setDetails("Check whether the FastAPI server is running.");
      });

    return () => controller.abort();
  }, []);

  const connected = status === "Connected";

  return (
    <div className="rounded-xl border border-line p-4">
      <div className="flex items-center gap-2">
        <span
          className={`h-2.5 w-2.5 rounded-full ${
            connected ? "bg-green-400" : "bg-amber-400"
          }`}
        />
        <span className="font-medium">API Status: {status}</span>
      </div>
      <p className="mt-2 text-sm text-muted">{details}</p>
    </div>
  );
}
