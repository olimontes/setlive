from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    DATABASE_URL: str
    JWT_SECRET: str
    SPOTIFY_CLIENT_ID: str | None = None
    SPOTIFY_CLIENT_SECRET: str | None = None

    class Config:
        env_file = ".env"

settings = Settings()

