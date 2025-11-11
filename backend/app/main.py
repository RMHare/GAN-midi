"""FastAPI application for the GAN MIDI backend."""
from __future__ import annotations

import json
from typing import Any, Dict, List

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.responses import Response

from . import midi
from .variation import VariationRegistry

app = FastAPI(title="GAN MIDI Backend", version="0.1.0")
registry = VariationRegistry("backend.app.variation")


@app.get("/modules")
def list_modules() -> List[Dict[str, Any]]:
    """Return all available variation modules and their parameters."""

    modules = []
    for module in registry.all():
        modules.append(
            {
                "name": module.name,
                "parameters": [param.__dict__ for param in module.describe_parameters()],
            }
        )
    return modules


@app.post("/analyze-chords")
async def analyze_chords(file: UploadFile = File(...)) -> Dict[str, Any]:
    data = await file.read()
    try:
        midi_file = midi.load_midi(data)
    except Exception as exc:  # pragma: no cover - protects against corrupt files
        raise HTTPException(status_code=400, detail=f"Invalid MIDI file: {exc}") from exc

    chords = midi.detect_chords(midi_file)
    return {
        "chords": [
            {
                "time": chord.time,
                "name": chord.name,
                "pitches": chord.pitches,
            }
            for chord in chords
        ]
    }


@app.post("/generate")
async def generate_variation(
    module: str,
    file: UploadFile = File(...),
    parameters: str | None = None,
    chords: str | None = None,
) -> Response:
    try:
        implementation = registry.get(module)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=f"Unknown module '{module}'") from exc

    try:
        data = await file.read()
        config = json.loads(parameters) if parameters else {}
        chord_progression = json.loads(chords) if chords else None
        output = implementation.generate(data, chord_progression, config)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return Response(content=output, media_type="audio/midi")
