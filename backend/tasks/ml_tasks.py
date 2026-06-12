import logging
import os

from celery_app import celery_app
from db_utils import get_db_session
from models import LibraryEntry
from typing import Any, cast

logger = logging.getLogger(__name__)


@celery_app.task(bind=True, name="tasks.ml_tasks.cluster_faces_task")  # type: ignore
def cluster_faces_task(self: Any, library_entry_id: int, frame_skip: int = 30) -> dict[str, Any] | None:
    """
    Extract frames from a video, detect and encode faces,
    and cluster them to identify unique performers.
    """
    import cv2  # type: ignore
    import face_recognition  # type: ignore
    from sklearn.cluster import DBSCAN  # type: ignore

    with get_db_session() as db:
        entry = (
            db.query(LibraryEntry).filter(LibraryEntry.id == library_entry_id).first()
        )
        if not entry or not entry.file_path:  # type: ignore
            logger.error(f"Entry {library_entry_id} not found or missing file path.")
            return

        video_path = str(entry.file_path)

    logger.info(f"Starting facial clustering for {video_path}")

    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        logger.error(f"Cannot open video {video_path}")
        return

    encodings: list[Any] = []
    timestamps: list[float] = []
    face_crops: list[Any] = []

    fps = cap.get(cv2.CAP_PROP_FPS)
    if not fps or fps != fps:  # Check for NaN/Zero
        fps = 30.0

    frame_count = 0
    try:
        while True:
            ret, frame = cap.read()
            if not ret:
                break

            # Process every Nth frame based on frame_skip (e.g., 1 frame per second if frame_skip == fps)
            if frame_count % frame_skip == 0:
                # Convert OpenCV BGR to RGB
                rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)

                face_locations: list[Any] = face_recognition.face_locations(rgb_frame)  # type: ignore
                if face_locations:
                    face_encodings: list[Any] = face_recognition.face_encodings(  # type: ignore
                        rgb_frame, face_locations
                    )
                    for location, encoding in zip(face_locations, face_encodings):  # type: ignore
                        encodings.append(encoding)
                        timestamps.append(round(frame_count / fps, 2))

                        # Crop face
                        top, right, bottom, left = location
                        h, w, _ = frame.shape
                        # Expand bounding box slightly for a better portrait crop
                        top = max(0, int(top) - 30)
                        bottom = min(h, int(bottom) + 30)
                        left = max(0, int(left) - 30)
                        right = min(w, int(right) + 30)
                        
                        # PERFORMANCE: Compress face crop immediately in RAM to prevent memory leaks on huge videos
                        cropped = frame[top:bottom, left:right]
                        success, encoded_img = cv2.imencode('.jpg', cropped)
                        if success:
                            face_crops.append(encoded_img)
                        else:
                            face_crops.append(None)

            frame_count += 1
    finally:
        cap.release()

    if not encodings:
        logger.info(f"No faces found in {video_path}")
        return {}

    # Cluster faces using DBSCAN (eps=0.5 is standard for face_recognition distance)
    dbscan = DBSCAN(eps=0.5, min_samples=3, metric="euclidean")
    dbscan.fit(encodings)  # type: ignore

    faces_dir = os.path.join(os.path.dirname(video_path), f".faces_{library_entry_id}")
    os.makedirs(faces_dir, exist_ok=True)

    cluster_results: dict[str, Any] = {}
    for label in set(dbscan.labels_):
        if label == -1:
            continue  # Skip unclustered noise

        cluster_timestamps = [
            timestamps[i] for i, lbl in enumerate(dbscan.labels_) if lbl == label
        ]
        person_name = f"Person_{label}"
        cluster_results[person_name] = cluster_timestamps

        # Save the first matching face as the thumbnail representative
        first_idx = next(i for i, lbl in enumerate(dbscan.labels_) if lbl == label)
        encoded_face = face_crops[first_idx]
        if encoded_face is not None:
            thumb_path = os.path.join(faces_dir, f"{person_name}.jpg")
            with open(thumb_path, "wb") as f:
                f.write(encoded_face.tobytes())

    logger.info(f"Clustered {len(cluster_results)} unique faces for {video_path}")

    # Save the output to the database
    with get_db_session() as db:
        entry_update = (
            db.query(LibraryEntry).filter(LibraryEntry.id == library_entry_id).first()
        )
        if entry_update:
            # Create a copy to ensure SQLAlchemy detects the change to the JSON column
            meta = dict(cast(dict[str, Any], entry_update.entry_metadata) or {})
            meta["facial_clusters"] = cluster_results
            entry_update.entry_metadata = meta  # type: ignore
            entry_update.has_facial_clusters = len(cluster_results) > 0  # type: ignore
            db.commit()

    return cluster_results
