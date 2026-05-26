from sports_video_pipeline.modules.topic_generator import generate_topic


def test_generate_topic_smoke() -> None:
    topic = generate_topic("NBA")
    assert topic.title
