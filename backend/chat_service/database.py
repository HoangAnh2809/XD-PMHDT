"""
Database configuration for chat service
"""
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import os

# Database URL - use environment variable or default
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "sqlite:///./chat_service.db"  # Use SQLite for local development
)

# Create SQLAlchemy engine with connection health checks to avoid using closed
# connections. Pool settings are configurable via env vars for dev vs prod.
pool_size = int(os.getenv("DB_POOL_SIZE", "5"))
max_overflow = int(os.getenv("DB_MAX_OVERFLOW", "10"))
engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,
    pool_size=pool_size,
    max_overflow=max_overflow,
)

# Create SessionLocal class
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Create Base class for models
Base = declarative_base()


def get_db():
    """
    Dependency function to get database session
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
