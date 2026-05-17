import os
import json
from datetime import datetime
from celery import shared_task
from database import SessionLocal
from models import Base
from routers.backup import CustomJSONEncoder
from utils import get_primary_root


@shared_task
def automated_backup():
    db = SessionLocal()
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
            
        primary_root = get_primary_root()
        backup_dir = os.path.join(primary_root, "backups")
        os.makedirs(backup_dir, exist_ok=True)

        filename = f"voyarr_backup_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.json"
        filepath = os.path.join(backup_dir, filename)

        with open(filepath, "w") as f:
            json.dump(data, f, cls=CustomJSONEncoder)

    except Exception as e:
        print(f"Automated backup failed: {str(e)}")
    finally:
        db.close()
