
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

import base64
import binascii
import cv2
import numpy as np
import threading


app = FastAPI(
    title="Multi-Agent Visual SLAM API",
    version="1.6.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class FrameRequest(BaseModel):
    image: str


lock = threading.Lock()

# Detect more candidate features for matching.
orb = cv2.ORB_create(
    nfeatures=1500,
    scaleFactor=1.2,
    nlevels=8,
    edgeThreshold=19,
    fastThreshold=12,
)

# KNN matching allows ambiguous matches to be filtered.
matcher = cv2.BFMatcher(cv2.NORM_HAMMING, crossCheck=False)

RATIO_TEST = 0.75
RANSAC_THRESHOLD = 1.5
MIN_GOOD_MATCHES = 8
MIN_ACCEPTED_INLIERS = 15
MIN_ACCEPTED_INLIER_RATIO = 0.15

previous_keypoints = None
previous_descriptors = None
previous_size = None

# Relative monocular pose: translation scale is unknown.
camera_position = np.zeros(3, dtype=np.float64)
camera_orientation = np.eye(3, dtype=np.float64)
trajectory = [[0.0, 0.0, 0.0]]


def reset_state():
    global previous_keypoints, previous_descriptors, previous_size
    global camera_position, camera_orientation, trajectory

    previous_keypoints = None
    previous_descriptors = None
    previous_size = None

    camera_position = np.zeros(3, dtype=np.float64)
    camera_orientation = np.eye(3, dtype=np.float64)
    trajectory = [[0.0, 0.0, 0.0]]


def pose_to_list(matrix):
    return np.asarray(matrix, dtype=float).tolist()


def current_trajectory():
    return {
        "position": [
            round(float(value), 5)
            for value in camera_position
        ],
        "points": [
            [round(float(value), 5) for value in point]
            for point in trajectory
        ],
        "scale": "unknown",
        "label": "Estimated relative trajectory (scale unknown)",
    }


def unavailable_motion(
    reason="Waiting for a previous frame",
    raw_matches=0,
    filtered_matches=0,
):
    return {
        "status": "unavailable",
        "reason": reason,
        "inliers": 0,
        "inlier_ratio": 0.0,
        "quality": "unavailable",
        "accepted": False,
        "rotation": None,
        "translation_direction": None,
        "raw_matches": int(raw_matches),
        "filtered_matches": int(filtered_matches),
    }


def make_camera_matrix(width, height):
    # Approximation only. Replace with calibrated camera intrinsics
    # for better geometric accuracy.
    focal_length = float(max(width, height))

    return np.array(
        [
            [focal_length, 0.0, width / 2.0],
            [0.0, focal_length, height / 2.0],
            [0.0, 0.0, 1.0],
        ],
        dtype=np.float64,
    )


def ratio_test_matches(previous_descriptors, current_descriptors):
    if previous_descriptors is None or current_descriptors is None:
        return [], 0

    if len(previous_descriptors) < 2 or len(current_descriptors) < 2:
        return [], 0

    knn_matches = matcher.knnMatch(
        previous_descriptors,
        current_descriptors,
        k=2,
    )

    raw_count = len(knn_matches)
    good_matches = []

    for pair in knn_matches:
        if len(pair) < 2:
            continue

        best, second = pair

        if best.distance < RATIO_TEST * second.distance:
            good_matches.append(best)

    # Keep only the best match for each current-frame feature.
    # This reduces multiple previous features matching one location.
    best_for_train = {}

    for match in good_matches:
        existing = best_for_train.get(match.trainIdx)

        if existing is None or match.distance < existing.distance:
            best_for_train[match.trainIdx] = match

    filtered = sorted(
        best_for_train.values(),
        key=lambda match: match.distance,
    )

    return filtered, raw_count


@app.get("/api/health")
def health():
    return {
        "status": "healthy",
        "backend": "FastAPI",
        "slam_engine": "ORB_KNN_RANSAC_visual_odometry",
        "version": "1.6.0",
    }


@app.post("/api/reset")
def reset_trajectory():
    with lock:
        reset_state()
        trajectory_data = current_trajectory()

    return {
        "status": "reset",
        "message": "Camera trajectory reset",
        "trajectory": trajectory_data,
    }


@app.post("/api/frame")
def process_frame(request: FrameRequest):
    global previous_keypoints, previous_descriptors, previous_size
    global camera_position, camera_orientation, trajectory

    try:
        encoded = request.image.split(",", 1)[-1]
        image_bytes = base64.b64decode(encoded, validate=True)

        image_array = np.frombuffer(image_bytes, dtype=np.uint8)
        frame = cv2.imdecode(image_array, cv2.IMREAD_COLOR)

        if frame is None:
            return {
                "error": "Could not decode image",
                "features_detected": 0,
                "matches_detected": 0,
                "feature_points": [],
                "matched_points": [],
                "image_width": 0,
                "image_height": 0,
                "motion": unavailable_motion("Could not decode image"),
                "trajectory": current_trajectory(),
            }

        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        height, width = gray.shape

        keypoints, descriptors = orb.detectAndCompute(gray, None)

        keypoints = keypoints or []

        feature_points = [
            [
                round(float(point.pt[0]), 2),
                round(float(point.pt[1]), 2),
            ]
            for point in keypoints[:300]
        ]

        matched_points = []
        raw_matches_count = 0
        filtered_matches_count = 0

        motion = unavailable_motion()

        with lock:
            same_size = previous_size == (width, height)

            can_match = (
                previous_descriptors is not None
                and descriptors is not None
                and len(previous_descriptors) >= 2
                and len(descriptors) >= 2
                and same_size
            )

            if can_match:
                matches, raw_matches_count = ratio_test_matches(
                    previous_descriptors,
                    descriptors,
                )

                filtered_matches_count = len(matches)

                if filtered_matches_count >= MIN_GOOD_MATCHES:
                    previous_points = np.float32([
                        previous_keypoints[match.queryIdx].pt
                        for match in matches
                    ]).reshape(-1, 2)

                    current_points = np.float32([
                        keypoints[match.trainIdx].pt
                        for match in matches
                    ]).reshape(-1, 2)

                    camera_matrix = make_camera_matrix(width, height)

                    essential, ransac_mask = cv2.findEssentialMat(
                        previous_points,
                        current_points,
                        camera_matrix,
                        method=cv2.RANSAC,
                        prob=0.999,
                        threshold=RANSAC_THRESHOLD,
                    )

                    if (
                        essential is not None
                        and ransac_mask is not None
                        and ransac_mask.size == len(matches)
                    ):
                        # OpenCV can return multiple stacked 3x3 solutions.
                        essential = np.asarray(essential, dtype=np.float64)

                        if essential.shape != (3, 3):
                            if (
                                essential.ndim == 2
                                and essential.shape[1] == 3
                                and essential.shape[0] >= 3
                            ):
                                essential = essential[:3, :]
                            else:
                                essential = None

                    if essential is not None and ransac_mask is not None:
                        inliers, rotation, translation, pose_mask = (
                            cv2.recoverPose(
                                essential,
                                previous_points,
                                current_points,
                                camera_matrix,
                                mask=ransac_mask.copy(),
                            )
                        )

                        pose_flags = pose_mask.reshape(-1).astype(bool)

                        for index, match in enumerate(matches):
                            matched_points.append({
                                "previous": [
                                    float(previous_points[index][0]),
                                    float(previous_points[index][1]),
                                ],
                                "current": [
                                    float(current_points[index][0]),
                                    float(current_points[index][1]),
                                ],
                                "distance": float(match.distance),
                                "inlier": bool(pose_flags[index]),
                            })

                        inlier_ratio = (
                            float(inliers)
                            / max(filtered_matches_count, 1)
                        )

                        # Heuristic labels, not calibrated accuracy scores.
                        if inliers >= 50 and inlier_ratio >= 0.35:
                            quality = "high"
                        elif inliers >= 25 and inlier_ratio >= 0.15:
                            quality = "medium"
                        else:
                            quality = "low"

                        accepted = (
                            inliers >= MIN_ACCEPTED_INLIERS
                            and inlier_ratio >= MIN_ACCEPTED_INLIER_RATIO
                        )

                        translation_direction = [
                            round(float(value), 5)
                            for value in translation.reshape(3)
                        ]

                        if accepted:
                            # Relative translation has unknown monocular scale.
                            displacement = -rotation.T @ translation.reshape(3)

                            world_displacement = (
                                camera_orientation @ displacement
                            )

                            camera_position = (
                                camera_position + world_displacement
                            )

                            camera_orientation = (
                                camera_orientation @ rotation.T
                            )

                            trajectory.append(
                                camera_position.astype(float).tolist()
                            )

                            motion = {
                                "status": "success",
                                "reason": (
                                    "Relative motion accepted by quality filter"
                                ),
                                "inliers": int(inliers),
                                "inlier_ratio": round(inlier_ratio, 3),
                                "quality": quality,
                                "accepted": True,
                                "rotation": pose_to_list(rotation),
                                "translation_direction": translation_direction,
                                "raw_matches": int(raw_matches_count),
                                "filtered_matches": int(filtered_matches_count),
                            }
                        else:
                            motion = {
                                "status": "low_quality",
                                "reason": (
                                    "Motion rejected: too few reliable inliers"
                                ),
                                "inliers": int(inliers),
                                "inlier_ratio": round(inlier_ratio, 3),
                                "quality": "low",
                                "accepted": False,
                                "rotation": pose_to_list(rotation),
                                "translation_direction": translation_direction,
                                "raw_matches": int(raw_matches_count),
                                "filtered_matches": int(filtered_matches_count),
                            }
                    else:
                        motion = unavailable_motion(
                            "Essential matrix estimation failed",
                            raw_matches_count,
                            filtered_matches_count,
                        )
                else:
                    motion = unavailable_motion(
                        "Not enough reliable matches after ratio filtering",
                        raw_matches_count,
                        filtered_matches_count,
                    )
            elif previous_descriptors is not None and not same_size:
                motion = unavailable_motion(
                    "Frame size changed; waiting for matching frame sizes",
                )
            else:
                motion = unavailable_motion(
                    "Waiting for a previous frame",
                )

            # Save this frame for comparison with the next frame.
            previous_keypoints = keypoints
            previous_descriptors = descriptors
            previous_size = (width, height)

            trajectory_data = current_trajectory()

        return {
            "features_detected": len(keypoints),
            "matches_detected": int(filtered_matches_count),
            "raw_matches_detected": int(raw_matches_count),
            "filtered_matches_detected": int(filtered_matches_count),
            "feature_points": feature_points,
            "matched_points": matched_points,
            "image_width": width,
            "image_height": height,
            "motion": motion,
            "trajectory": trajectory_data,
        }

    except (
        ValueError,
        binascii.Error,
        cv2.error,
        np.linalg.LinAlgError,
    ) as exc:
        with lock:
            trajectory_data = current_trajectory()

        return {
            "error": str(exc),
            "features_detected": 0,
            "matches_detected": 0,
            "raw_matches_detected": 0,
            "filtered_matches_detected": 0,
            "feature_points": [],
            "matched_points": [],
            "image_width": 0,
            "image_height": 0,
            "motion": unavailable_motion("Frame processing failed"),
            "trajectory": trajectory_data,
        }
