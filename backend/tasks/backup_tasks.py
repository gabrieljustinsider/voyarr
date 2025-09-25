import os
import json
from datetime import datetime
from celery import shared_task
from models import Base
from routers.backup import CustomJSONEncoder
from utils import get_primary_root
from db_utils import get_db_session


@shared_task
def automated_backup():
    with get_db_session() as db:
        try:
            data = {
                "type": "full",
                "timestamp": datetime.utcnow().isoformat(),
                "version": "1.0",
                "data": {},
            }
            for table in Base.metadata.sorted_tables:
                rows = db.execute(table.select()).mappings().all()
                data["data"][table.name] = [dict(row) for row in rows]
                
            # If the dedicated backup folder volume is mounted, write there.
            # Otherwise, fallback to the backups folder inside the primary media root.
            if os.path.exists("/app/backups"):
                backup_dir = "/app/backups"
            else:
                primary_root = get_primary_root()
                backup_dir = os.path.join(primary_root, "backups")
                
            os.makedirs(backup_dir, exist_ok=True)

            filename = f"voyarr_backup_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.json"
            filepath = os.path.join(backup_dir, filename)

            with open(filepath, "w") as f:
                json.dump(data, f, cls=CustomJSONEncoder)

            try:
                from services.notification_service import NotificationService
                NotificationService.notify_global(
                    db,
                    "task_completed",
                    "Automated Backup Successful",
                    f"Successfully created automated backup file '{filename}'."
                )
            except Exception as notif_err:
                print(f"Error sending backup completion notification: {notif_err}")

        except Exception as e:
            print(f"Automated backup failed: {str(e)}")
            try:
                from services.notification_service import NotificationService
                NotificationService.notify_global(
                    db,
                    "task_completed",
                    "Automated Backup Failed",
                    f"Automated backup task failed: {str(e)}"
                )
            except Exception as notif_err:
                print(f"Error sending backup failure notification: {notif_err}")
