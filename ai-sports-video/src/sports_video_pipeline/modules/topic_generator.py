from __future__ import annotations

from sports_video_pipeline.models import Topic


def generate_topic(league: str) -> Topic:
    """TODO: Replace with LLM-driven topic ranking by virality."""
    return Topic(
        title=f"What if prime Derrick Rose stayed healthy? ({league})",
        hook="A single injury changed a decade of basketball.",
    )
