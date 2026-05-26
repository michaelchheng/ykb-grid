from __future__ import annotations

from rich import print
import typer

from sports_video_pipeline.config import get_settings
from sports_video_pipeline.modules.asset_fetcher import fetch_assets
from sports_video_pipeline.modules.publisher import publish
from sports_video_pipeline.modules.script_writer import write_script
from sports_video_pipeline.modules.topic_generator import generate_topic
from sports_video_pipeline.modules.video_assembler import assemble_video
from sports_video_pipeline.modules.voiceover import create_voiceover

app = typer.Typer(help="AI sports short-video pipeline")


@app.command()
def check() -> None:
    s = get_settings()
    print(f"[cyan]League:[/cyan] {s.default_league}")
    print(f"[cyan]Output:[/cyan] {s.output_dir}")


@app.command()
def topic(league: str = typer.Option("NBA", help="League")) -> None:
    t = generate_topic(league)
    print(t)


@app.command()
def script(title: str = typer.Argument(...), duration: int = 60) -> None:
    from sports_video_pipeline.models import Topic

    s = write_script(Topic(title=title, hook="Generated hook"), duration)
    print(s)


@app.command()
def run(
    league: str = typer.Option("NBA", help="League"),
    duration: int = typer.Option(60, help="Video length in seconds"),
) -> None:
    settings = get_settings()
    output_dir = settings.output_dir

    t = generate_topic(league)
    s = write_script(t, duration)
    v = create_voiceover(s, output_dir)
    a = fetch_assets(t, output_dir)
    artifact = assemble_video(s, v, a, output_dir)
    result = publish(artifact)

    print("[green]Pipeline complete[/green]")
    print(result)


if __name__ == "__main__":
    app()
