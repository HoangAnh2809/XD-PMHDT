from sqlalchemy import create_engine, event, text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, scoped_session
from sqlalchemy.pool import QueuePool, StaticPool
import os
import logging
from contextlib import contextmanager

logger = logging.getLogger(__name__)

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://evadmin:evadmin123@localhost:5432/ev_maintenance")

# Enhanced engine configuration for better performance
pool_size = int(os.getenv("DB_POOL_SIZE", "20"))
max_overflow = int(os.getenv("DB_MAX_OVERFLOW", "30"))

engine = create_engine(
    DATABASE_URL,
    poolclass=QueuePool,
    pool_size=pool_size,
    max_overflow=max_overflow,
    pool_pre_ping=True,     # Verify connections before use
    pool_recycle=3600,      # Recycle connections every hour
    echo=False,             # Set to True for SQL logging in development
    echo_pool=False,        # Set to True for connection pool logging
    connect_args={
        "application_name": "ev_maintenance"
    }
)

# Use scoped_session for thread safety
SessionLocal = scoped_session(sessionmaker(autocommit=False, autoflush=False, bind=engine))

Base = declarative_base()

# Connection event listeners for monitoring
@event.listens_for(engine, "connect")
def set_connection_settings(dbapi_connection, connection_record):
    """Set connection-specific settings"""
    if "postgresql" in DATABASE_URL:
        with dbapi_connection.cursor() as cursor:
            # Set connection-specific settings for PostgreSQL
            cursor.execute("SET statement_timeout = '30s'")
            cursor.execute("SET lock_timeout = '10s'")
            cursor.execute("SET idle_in_transaction_session_timeout = '60s'")

@event.listens_for(engine, "checkout")
def receive_checkout(dbapi_connection, connection_record, connection_proxy):
    """Log connection checkout"""
    logger.debug("Connection checked out from pool")

@event.listens_for(engine, "checkin")
def receive_checkin(dbapi_connection, connection_record):
    """Log connection checkin"""
    logger.debug("Connection checked in to pool")

def get_db():
    """Dependency to get database session with automatic cleanup"""
    db = SessionLocal()
    try:
        yield db
    except Exception as e:
        logger.error(f"Database session error: {e}")
        db.rollback()
        raise
    finally:
        db.close()

@contextmanager
def get_db_context():
    """Context manager for database operations"""
    db = SessionLocal()
    try:
        yield db
        db.commit()
    except Exception as e:
        logger.error(f"Database operation error: {e}")
        db.rollback()
        raise
    finally:
        db.close()

class DatabaseManager:
    """Enhanced database management with connection pooling and monitoring"""
    
    def __init__(self):
        self.engine = engine
        self.session_factory = SessionLocal
    
    def get_connection_pool_status(self):
        """Get connection pool status"""
        pool = self.engine.pool
        return {
            "pool_size": pool.size(),
            "checked_in": pool.checkedin(),
            "checked_out": pool.checkedout(),
            "overflow": pool.overflow(),
            "invalid": pool.invalid()
        }
    
    def health_check(self):
        """Perform database health check"""
        try:
            with self.engine.connect() as conn:
                result = conn.execute(text("SELECT 1 as health_check"))
                return {"status": "healthy", "response": result.scalar()}
        except Exception as e:
            logger.error(f"Database health check failed: {e}")
            return {"status": "unhealthy", "error": str(e)}
    
    def get_database_stats(self):
        """Get database statistics"""
        try:
            with self.engine.connect() as conn:
                # Get basic database info
                result = conn.execute(text("""
                    SELECT 
                        current_database() as database_name,
                        version() as version,
                        current_setting('max_connections') as max_connections,
                        current_setting('shared_buffers') as shared_buffers
                """))
                return dict(result.fetchone())
        except Exception as e:
            logger.error(f"Failed to get database stats: {e}")
            return {"error": str(e)}

# Global database manager
db_manager = DatabaseManager()

# Query optimization helpers
class QueryOptimizer:
    """Helper class for query optimization"""
    
    @staticmethod
    def add_pagination(query, page: int = 1, limit: int = 20, max_limit: int = 100):
        """Add pagination to query"""
        if limit > max_limit:
            limit = max_limit
        if page < 1:
            page = 1
        
        offset = (page - 1) * limit
        return query.offset(offset).limit(limit)
    
    @staticmethod
    def add_sorting(query, sort_by: str, sort_order: str = "asc"):
        """Add sorting to query"""
        if sort_order.lower() not in ["asc", "desc"]:
            sort_order = "asc"
        
        # Basic SQL injection protection
        if not sort_by.replace("_", "").replace("-", "").isalnum():
            raise ValueError("Invalid sort field")
        
        try:
            return query.order_by(getattr(query.column_descriptions[0]['entity'], sort_by).desc() if sort_order.lower() == "desc" else getattr(query.column_descriptions[0]['entity'], sort_by))
        except AttributeError:
            # Fallback to string-based ordering
            return query.order_by(text(f"{sort_by} {sort_order.upper()}"))

# Global query optimizer
query_optimizer = QueryOptimizer()
