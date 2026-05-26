from __future__ import annotations

from sports_video_pipeline.models import VideoArtifact


def publish(video: VideoArtifact) -> dict[str, str]:
    """TODO: Replace with YouTube Shorts/TikTok/IG publishing integrations."""
    return {
        "status": "stubbed",
        "title": video.title,
        "path": str(video.video_path),
    }
