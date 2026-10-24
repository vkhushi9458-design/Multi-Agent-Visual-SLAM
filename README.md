# Multi-Agent Visual SLAM — Dashboard
React + Vite + Tailwind CSS.

```bash
npm install
npm run dev     # http://localhost:5173
npm run build   # production build in dist/
```

## How it works
1. Click **Start camera** (header or webcam panel).
2. The scene is scanned; Agents A, B and C are detected one by one and become **Active**.
3. Corner features are detected live from your webcam frames and drawn on the feed.
4. The shared map fills with landmarks, maps get aligned, and the pipeline shows **Map ready**.
5. **Stop camera** resets everything.

## Structure
- `src/hooks.js` – camera control, corner detection, agent/mapping sequence
- `src/Webcam.jsx`, `src/MapCanvas.jsx` – canvas views
- `src/ui.jsx` – panels, stat cards, agent cards, log, pipeline
- `src/App.jsx` – layout and pages
