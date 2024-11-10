from datetime import datetime
from database import SessionLocal
from models import Settings

class OffPeakService:
    @staticmethod
    def is_off_peak() -> bool:
        """
        Checks if the current time falls within the configured off-peak hours (e.g., '01:00-06:00').
        """
        db = SessionLocal()
        try:
            setting = db.query(Settings).filter(Settings.key == "off_peak_hours").first()
            if not setting or not setting.value:
                return True # If no restriction is configured, we assume it's always allowed
                
            hours = setting.value.split("-")
            if len(hours) != 2:
                return True
                
            start_hour = int(hours[0].split(":")[0])
            end_hour = int(hours[1].split(":")[0])
            current_hour = datetime.now().hour
            
            if start_hour <= end_hour: return start_hour <= current_hour < end_hour
            else: return current_hour >= start_hour or current_hour < end_hour
        finally:
            db.close()