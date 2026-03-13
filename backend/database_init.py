import os
import logging
from sqlalchemy import text
from db_utils import get_db_session

logger = logging.getLogger(__name__)

def initialize_database():
    """Reads and executes init.sql to build the database schema if empty."""
    # Locate init.sql in the same directory as this script
    sql_file_path = os.path.join(os.path.dirname(__file__), "init.sql")
    
    if not os.path.exists(sql_file_path):
        logger.error(f"Database migration file not found at {sql_file_path}")
        return

    with get_db_session() as db:
        try:
            # Check if the main 'providers' table exists to avoid wiping data
            result = db.execute(text("SELECT to_regclass('public.providers');")).scalar()
            if result is not None:
                logger.info("Database schema already exists. Skipping auto-migration.")
                return

            logger.info("Empty database detected. Running initial schema migrations...")
            with open(sql_file_path, 'r') as file:
                sql_commands = file.read()
            
            # Execute the raw SQL commands
            db.execute(text(sql_commands))
            db.commit()
            logger.info("Database schema created successfully!")
            
        except Exception as e:
            db.rollback()
            logger.error(f"Failed to initialize database: {e}")

if __name__ == "__main__":
    initialize_database()