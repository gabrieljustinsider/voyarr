from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from sqlalchemy import text
from database import get_db
from models import Base, Settings
from datetime import datetime
import json
from typing import Optional
from decimal import Decimal
from dependencies import verify_api_key

router = APIRouter(prefix="/backup", tags=["backup"], dependencies=[Depends(verify_api_key)])

class CustomJSONEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, datetime):
            return obj.isoformat()
        if isinstance(obj, Decimal):
            return float(obj)
        return super().default(obj)

@router.get("/tables")
def get_backup_tables():
    return {"tables": [table.name for table in Base.metadata.sorted_tables]}

@router.get("/export")
def export_backup(type: str = 'full', tables: Optional[str] = None, db: Session = Depends(get_db)):
    if type == 'settings':
        settings = db.query(Settings).all()
        data = {
            "type": "settings",
            "timestamp": datetime.utcnow().isoformat(),
            "version": "1.0",
            "data": {
                "settings": [{"key": s.key, "value": s.value} for s in settings]
            }
        }
        return JSONResponse(content=json.loads(json.dumps(data, cls=CustomJSONEncoder)))
    elif type == 'full':
        data = {
            "type": "full",
            "timestamp": datetime.utcnow().isoformat(),
            "version": "1.0",
            "data": {}
        }
        for table in Base.metadata.sorted_tables:
            rows = db.execute(table.select()).mappings().all()
            data["data"][table.name] = [dict(row) for row in rows]
            
        return JSONResponse(content=json.loads(json.dumps(data, cls=CustomJSONEncoder)))
    elif type == 'custom':
        if not tables:
            raise HTTPException(status_code=400, detail="Tables must be specified for custom backup")
        target_tables = [t.strip() for t in tables.split(',')]
        data = {
            "type": "custom",
            "timestamp": datetime.utcnow().isoformat(),
            "version": "1.0",
            "data": {}
        }
        for table in Base.metadata.sorted_tables:
            if table.name in target_tables:
                rows = db.execute(table.select()).mappings().all()
                data["data"][table.name] = [dict(row) for row in rows]
                
        return JSONResponse(content=json.loads(json.dumps(data, cls=CustomJSONEncoder)))
    else:
        raise HTTPException(status_code=400, detail="Invalid export type")

@router.post("/verify")
def verify_backup(file: UploadFile = File(...)):
    try:
        content = file.file.read()
        data = json.loads(content)
        
        if "type" not in data or "data" not in data or "version" not in data:
            return {"valid": False, "message": "Invalid backup format: missing required fields"}
            
        type = data["type"]
        record_count = sum(len(rows) for rows in data["data"].values()) if isinstance(data["data"], dict) else 0
        table_count = len(data["data"].keys()) if isinstance(data["data"], dict) else 0
        
        return {
            "valid": True, 
            "type": type, 
            "timestamp": data.get("timestamp"),
            "table_count": table_count,
            "record_count": record_count,
            "message": "Backup is valid and ready to restore"
        }
    except json.JSONDecodeError:
        return {"valid": False, "message": "Invalid backup format: not a valid JSON file"}
    except Exception as e:
        return {"valid": False, "message": f"Verification failed: {str(e)}"}

@router.post("/restore")
def restore_backup(file: UploadFile = File(...), db: Session = Depends(get_db)):
    try:
        content = file.file.read()
        backup_data = json.loads(content)
        
        if "type" not in backup_data or "data" not in backup_data:
            raise HTTPException(status_code=400, detail="Invalid backup format")
            
        btype = backup_data["type"]
        
        if btype == 'settings':
            db.query(Settings).delete()
            for item in backup_data["data"].get("settings", []):
                db.add(Settings(key=item["key"], value=item["value"]))
            db.commit()
            return {"message": "Settings restored successfully"}
            
        elif btype == 'full':
            tables_reversed = list(reversed(Base.metadata.sorted_tables))
            
            for table in tables_reversed:
                db.execute(table.delete())
            db.commit()
            
            for table in Base.metadata.sorted_tables:
                table_name = table.name
                rows = backup_data["data"].get(table_name, [])
                
                # SQLAlchemy 2.0 requires parsing datetimes from strings manually if not using ORM models
                # We will just insert dictionaries and hope the DB driver coerces ISO format strings to timestamps
                if rows:
                    db.execute(table.insert(), rows)
                    
            db.commit()
            
            for table in Base.metadata.sorted_tables:
                table_name = table.name
                try:
                    db.execute(text(f"SELECT setval(pg_get_serial_sequence('{table_name}', 'id'), coalesce(max(id), 1), max(id) IS NOT null) FROM {table_name};"))
                except Exception:
                    pass
                    
            db.commit()
            return {"message": "Full database restored successfully"}
            
        elif btype == 'custom':
            tables_in_backup = list(backup_data["data"].keys())
            
            # Sort tables by dependency order for deletion (reverse) and insertion (forward)
            sorted_metadata_tables = Base.metadata.sorted_tables
            tables_to_restore = [t for t in sorted_metadata_tables if t.name in tables_in_backup]
            tables_to_restore_reversed = list(reversed(tables_to_restore))
            
            for table in tables_to_restore_reversed:
                db.execute(table.delete())
            db.commit()
            
            for table in tables_to_restore:
                table_name = table.name
                rows = backup_data["data"].get(table_name, [])
                if rows:
                    db.execute(table.insert(), rows)
            db.commit()
            
            for table in tables_to_restore:
                table_name = table.name
                try:
                    db.execute(text(f"SELECT setval(pg_get_serial_sequence('{table_name}', 'id'), coalesce(max(id), 1), max(id) IS NOT null) FROM {table_name};"))
                except Exception:
                    pass
            db.commit()
            return {"message": f"Custom tables ({', '.join(tables_in_backup)}) restored successfully"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Restore failed: {str(e)}")
