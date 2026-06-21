from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    mongodb_uri: str
    mongodb_db_name: str
    jwt_secret: str
    jwt_access_ttl_minutes: int
    jwt_refresh_ttl_days: int
    gmail_user: str
    gmail_app_password: str
    google_vision_api_key: str
    cors_allowed_origins: str

    @property
    def cors_origins_list(self) -> List[str]:
        return [origin.strip() for origin in self.cors_allowed_origins.split(",")]

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "ignore"


settings = Settings()
