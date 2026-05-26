from __future__ import annotations

from pathlib import Path

from dotenv import load_dotenv
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


load_dotenv()


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    openai_api_key: str = Field(default="", alias="OPENAI_API_KEY")
    elevenlabs_api_key: str = Field(default="", alias="ELEVENLABS_API_KEY")
    sports_data_api_key: str = Field(default="", alias="SPORTS_DATA_API_KEY")
    output_dir: Path = Field(default=Path("./output"), alias="OUTPUT_DIR")
    default_league: str = Field(default="NBA", alias="DEFAULT_LEAGUE")
    default_duration_seconds: int = Field(default=60, alias="DEFAULT_DURATION_SECONDS")


def get_settings() -> Settings:
    return Settings()
