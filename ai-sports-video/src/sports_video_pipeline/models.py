from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path


@dataclass(slots=True)
class Topic:
    title: str
    hook: str


@dataclass(slots=True)
class ScriptDraft:
    title: str
    lines: list[str]


@dataclass(slots=True)
class Voiceover:
    audio_path: Path
    duration_seconds: float


@dataclass(slots=True)
class VideoArtifact:
    video_path: Path
    title: str
