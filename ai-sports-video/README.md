# AI Sports Video Pipeline

Starter workspace for generating short sports videos from topic -> script -> voice -> assets -> assemble -> publish.

## Quick start

1. Create env and install:
   - `python -m venv .venv`
   - `source .venv/bin/activate`
   - `pip install -e .`
2. Copy env:
   - `cp .env.example .env`
3. Run CLI:
   - `sports-video run --league NBA --duration 60`

## Commands

- `sports-video run` - run full pipeline (stubbed)
- `sports-video topic` - generate one topic
- `sports-video script` - generate script from topic
- `sports-video check` - verify config and paths

## Notes

- This scaffold uses placeholders in modules. Replace stub internals with real API integrations.
- Media assets in this starter are placeholders and should be replaced with licensed assets before publishing.
