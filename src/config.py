from pydantic_settings import BaseSettings, SettingsConfigDict
from pathlib import Path

_ENV_FILE = Path(__file__).parent.parent / ".env"


class Settings(BaseSettings):
    gemini_api_key: str
    browserbase_api_key: str
    browserbase_project_id: str
    anthropic_api_key: str | None = None

    model_config = SettingsConfigDict(
        env_file=str(_ENV_FILE),
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",  # ignore chroma keys and any other .env extras
    )


settings = Settings()
