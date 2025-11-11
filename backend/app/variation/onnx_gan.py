"""ONNX-backed groove generator variation module."""
from __future__ import annotations

from pathlib import Path
from typing import Iterable, Mapping, Sequence

import numpy as np
import onnxruntime as ort

from .. import midi
from .base import ModuleParameter, VariationModule


class SimpleGanGrooveModule(VariationModule):
    """Lightweight ONNX groove generator running fully offline."""

    def __init__(self) -> None:
        models_dir = Path(__file__).resolve().parents[2] / "models"
        model_path = models_dir / "simple_gan.onnx"
        if not model_path.exists():
            raise FileNotFoundError(
                "Missing simple_gan.onnx model. Ensure the offline models directory is bundled."
            )
        self._session = ort.InferenceSession(str(model_path), providers=["CPUExecutionProvider"])

    @property
    def name(self) -> str:
        return "Offline GAN Groove"

    def describe_parameters(self) -> Iterable[ModuleParameter]:
        return (
            ModuleParameter(name="seed", type="int", minimum=0, maximum=2**31 - 1, default=7),
            ModuleParameter(name="length", type="int", minimum=8, maximum=128, default=32),
            ModuleParameter(name="temperature", type="float", minimum=0.1, maximum=2.5, default=1.0),
        )

    def generate(
        self,
        midi_bytes: bytes,
        chords: Iterable[Mapping[str, object]] | None,
        parameters: Mapping[str, object],
    ) -> bytes:
        seed = int(parameters.get("seed", 7))
        length = int(parameters.get("length", 32))
        temperature = float(parameters.get("temperature", 1.0))

        latent = _sample_latent(seed, temperature)
        outputs = self._session.run(["notes"], {"latent": latent})[0]
        note_sequence = _render_notes(outputs[0], chords, length)

        source_midi = midi.load_midi(midi_bytes)
        return midi.build_midi_from_notes(note_sequence, ticks_per_beat=source_midi.ticks_per_beat)


def _sample_latent(seed: int, temperature: float) -> np.ndarray:
    rng = np.random.default_rng(seed)
    latent = rng.standard_normal((1, 16), dtype=np.float32)
    return latent * float(temperature)


def _render_notes(
    activations: Sequence[float],
    chords: Iterable[Mapping[str, object]] | None,
    length: int,
) -> list[int]:
    chord_list = list(chords or [])
    default_chord = {"pitches": (0, 4, 7)}
    notes: list[int] = []
    for step in range(length):
        activation = float(activations[step % len(activations)])
        normalized = (np.tanh(activation) + 1.0) / 2.0
        chord_info = chord_list[step % len(chord_list)] if chord_list else default_chord
        base_pitch = _resolve_base_pitch(chord_info.get("pitches"))
        span = 12
        note_value = int(round(base_pitch + normalized * span))
        notes.append(int(max(36, min(96, note_value))))
    return notes


def _resolve_base_pitch(pitches: object) -> int:
    if not isinstance(pitches, (tuple, list)) or not pitches:
        return 60
    pitch_classes = [int(p) % 12 for p in pitches]
    root = min(pitch_classes)
    return 60 + root
