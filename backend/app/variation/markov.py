"""Markov-chain based melodic variation module."""
from __future__ import annotations

import random
from collections import defaultdict, deque
from typing import Dict, Iterable, List, Mapping, Sequence, Tuple

from .. import midi
from .base import ModuleParameter, VariationModule


class MarkovMelodyModule(VariationModule):
    """Simple order-N Markov chain melody generator."""

    @property
    def name(self) -> str:
        return "Markov Chain (Melody)"

    def describe_parameters(self) -> Iterable[ModuleParameter]:
        return (
            ModuleParameter(name="state_size", type="int", minimum=1, maximum=4, default=2),
            ModuleParameter(name="length", type="int", minimum=8, maximum=128, default=32),
            ModuleParameter(name="seed", type="int", minimum=0, maximum=2**31 - 1, default=42),
        )

    def generate(
        self,
        midi_bytes: bytes,
        chords: Iterable[Mapping[str, object]] | None,
        parameters: Mapping[str, object],
    ) -> bytes:
        source = midi.load_midi(midi_bytes)
        sequence = midi.extract_note_sequence(source)
        if len(sequence) < 4:
            raise ValueError("Input MIDI is too short to build a Markov model")

        state_size = int(parameters.get("state_size", 2))
        length = int(parameters.get("length", 32))
        seed = int(parameters.get("seed", 42))
        rng = random.Random(seed)

        model = _build_model(sequence, state_size)
        generated = _sample_notes(model, sequence[:state_size], length, rng)
        return midi.build_midi_from_notes(generated, ticks_per_beat=source.ticks_per_beat)


def _build_model(sequence: Sequence[int], state_size: int) -> Dict[Tuple[int, ...], List[int]]:
    transitions: Dict[Tuple[int, ...], List[int]] = defaultdict(list)
    window = deque(maxlen=state_size)

    for note in sequence:
        if len(window) == state_size:
            transitions[tuple(window)].append(note)
        window.append(note)

    return transitions


def _sample_notes(
    model: Dict[Tuple[int, ...], List[int]],
    seed_state: Sequence[int],
    length: int,
    rng: random.Random,
) -> List[int]:
    state = deque(seed_state, maxlen=len(seed_state))
    output = list(seed_state)

    while len(output) < length:
        options = model.get(tuple(state))
        if not options:
            # Restart using a random known state to keep output going.
            state = deque(rng.choice(list(model.keys())), maxlen=len(state))
            output.extend(state)
            continue
        next_note = rng.choice(options)
        output.append(next_note)
        state.append(next_note)
    return output[:length]
