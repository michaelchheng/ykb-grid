from __future__ import annotations

from pathlib import Path

from sports_video_pipeline.models import Topic


def fetch_assets(topic: Topic, output_dir: Path) -> list[Path]:
    """TODO: Replace with licensed/public-domain image and clip retrieval."""
    output_dir.mkdir(parents=True, exist_ok=True)
    placeholder = output_dir / "assets_placeholder.txt"
    placeholder.write_text(f"Assets for: {topic.title}", encoding="utf-8")
    return [placeholder]
