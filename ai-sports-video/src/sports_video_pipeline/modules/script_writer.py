from __future__ import annotations

from sports_video_pipeline.models import ScriptDraft, Topic


def write_script(topic: Topic, duration_seconds: int) -> ScriptDraft:
    """TODO: Replace with stats-grounded LLM script generation."""
    lines = [
        topic.hook,
        f"Today: {topic.title}",
        "Context: his burst and rim pressure were elite.",
        "Counterfactual: sustained peak could reshape East playoff history.",
        "Verdict: legacy jumps multiple tiers with health.",
    ]
    return ScriptDraft(title=topic.title, lines=lines)
