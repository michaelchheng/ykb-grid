from __future__ import annotations

from pathlib import Path

from sports_video_pipeline.models import ScriptDraft, VideoArtifact, Voiceover


def assemble_video(script: ScriptDraft, voiceover: Voiceover, assets: list[Path], output_dir: Path) -> VideoArtifact:
    """TODO: Replace with MoviePy/Remotion assembly pipeline."""
    output_dir.mkdir(parents=True, exist_ok=True)
    video_path = output_dir / "video_placeholder.txt"
    payload = [
        f"TITLE: {script.title}",
        f"VOICE: {voiceover.audio_path}",
        f"ASSETS: {', '.join(str(a) for a in assets)}",
    ]
    video_path.write_text("\\n".join(payload), encoding="utf-8")
    return VideoArtifact(video_path=video_path, title=script.title)
