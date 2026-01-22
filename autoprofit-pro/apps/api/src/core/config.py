from functools import lru_cache
from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql://autoprofit_user:change_me@postgres:5432/autoprofit"
    REDIS_URL: str = "redis://redis:6379"
    JWT_SECRET: str = "change_me_jwt_secret"
    ENVIRONMENT: str = "production"

    BACKEND_CORS_ORIGINS: List[str] = ["*"]
    ALLOWED_HOSTS: List[str] = ["*"]

    class Config:
        env_file = ".env"
        case_sensitive = True


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
