from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from ..models import Base
from .config import settings


engine = create_engine(settings.DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Note: Base.metadata.create_all is called from main.py lifespan
