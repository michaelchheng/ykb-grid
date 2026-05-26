from __future__ import annotations

from pathlib import Path

from sports_video_pipeline.models import ScriptDraft, Voiceover


def create_voiceover(script: ScriptDraft, output_dir: Path) -> Voiceover:
    """TODO: Replace with ElevenLabs (or provider) synthesis."""
    output_dir.mkdir(parents=True, exist_ok=True)
    audio_path = output_dir / "voiceover_placeholder.txt"
    audio_path.write_text("\\n".join(script.lines), encoding="utf-8")
    return Voiceover(audio_path=audio_path, duration_seconds=60.0)
