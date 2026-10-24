Multi-Agent Visual SLAM — Dashboard
React + Vite + Tailwind CSS.

npm install
npm run dev     # http://localhost:5173
npm run build   # production build in dist/
How it works
Click Start camera (header or webcam panel).
The scene is scanned; Agents A, B and C are detected one by one and become Active.
Corner features are detected live from your webcam frames and drawn on the feed.
The shared map fills with landmarks, maps get aligned, and the pipeline shows Map ready.
Stop camera resets everything.
Structure
src/hooks.js – camera control, corner detection, agent/mapping sequence
src/Webcam.jsx, src/MapCanvas.jsx – canvas views
src/ui.jsx – panels, stat cards, agent cards, log, pipeline
src/App.jsx – layout and pages




# Multi-Agent Visual SLAM

A visual Simultaneous Localization and Mapping (SLAM) project with a FastAPI backend and frontend interface.

## Backend

The backend uses Python, FastAPI, OpenCV, ORB feature matching, and RANSAC-based visual odometry.

### Run the backend

From the project root directory, run:

```bash
python -m uvicorn app.main:app --reload --app-dir backend --host 127.0.0.1 --port 8000
```

### API Documentation

Once the backend is running, open:

http://127.0.0.1:8000/docs

### API Endpoints

- `GET /api/health` — Backend health information
- `POST /api/reset` — Reset mapping state
- `POST /api/frame` — Process an image frame
- `GET /api/map` — Retrieve map and trajectory data

## Technologies

- Python
- FastAPI
- OpenCV
- ORB feature detection and matching
- RANSAC-based visual odometry

## Team

Multi-Agent Visual SLAM project contributors.

