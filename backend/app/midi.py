"""Utility helpers for working with MIDI data using mido."""
from __future__ import annotations

from dataclasses import dataclass
from io import BytesIO
from typing import Dict, Iterable, List, Sequence, Set, Tuple

import mido


NOTE_NAMES = [
    "C",
    "C#",
    "D",
    "D#",
    "E",
    "F",
    "F#",
    "G",
    "G#",
    "A",
    "A#",
    "B",
]


@dataclass
class ChordEvent:
    time: float
    name: str
    pitches: Tuple[int, ...]


def load_midi(data: bytes) -> mido.MidiFile:
    """Create a :class:`MidiFile` from raw bytes."""

    buffer = BytesIO(data)
    return mido.MidiFile(file=buffer)


def _find_tempo(midi: mido.MidiFile) -> int:
    for track in midi.tracks:
        time = 0
        for message in track:
            time += message.time
            if message.type == "set_tempo":
                return message.tempo
    return mido.bpm2tempo(120)


def _normalize_pitch_set(pitches: Set[int]) -> Tuple[int, ...]:
    return tuple(sorted({p % 12 for p in pitches}))


def _chord_name_from_pitch_classes(pitches: Set[int]) -> str:
    if not pitches:
        return "N.C."
    pcs = _normalize_pitch_set(pitches)
    for root in pcs:
        intervals = sorted((p - root) % 12 for p in pcs)
        triad = tuple(intervals[:3])
        if triad == (0, 3, 7):
            return f"{NOTE_NAMES[root]}m"
        if triad == (0, 4, 7):
            return NOTE_NAMES[root]
        if triad == (0, 4, 7, 11):
            return f"{NOTE_NAMES[root]}maj7"
        if triad == (0, 3, 7, 10):
            return f"{NOTE_NAMES[root]}m7"
    return "+".join(NOTE_NAMES[p] for p in pcs)


def detect_chords(midi: mido.MidiFile) -> List[ChordEvent]:
    """Return a naive chord progression derived from the MIDI file."""

    tempo = _find_tempo(midi)
    merged = mido.merge_tracks(midi.tracks)

    timeline: Dict[int, Set[int]] = {}
    absolute_ticks = 0
    for message in merged:
        absolute_ticks += message.time
        if message.type == "note_on" and message.velocity > 0:
            beat = round(absolute_ticks / midi.ticks_per_beat)
            timeline.setdefault(beat, set()).add(message.note)

    events: List[ChordEvent] = []
    for beat in sorted(timeline.keys()):
        time_seconds = beat * (tempo / 1_000_000.0)
        pitches = timeline[beat]
        name = _chord_name_from_pitch_classes(pitches)
        events.append(ChordEvent(time=time_seconds, name=name, pitches=_normalize_pitch_set(pitches)))
    return events


def extract_note_sequence(midi: mido.MidiFile) -> List[int]:
    """Return a flattened list of note-on values in order of appearance."""

    merged = mido.merge_tracks(midi.tracks)
    notes: List[int] = []
    for message in merged:
        if message.type == "note_on" and message.velocity > 0:
            notes.append(message.note)
    return notes


def build_midi_from_notes(notes: Sequence[int], *, ticks_per_beat: int = 480) -> bytes:
    """Create a simple monophonic MIDI from the provided note sequence."""

    midi = mido.MidiFile(ticks_per_beat=ticks_per_beat)
    track = mido.MidiTrack()
    midi.tracks.append(track)

    note_length = ticks_per_beat  # quarter note
    for note in notes:
        track.append(mido.Message("note_on", note=int(note), velocity=90, time=0))
        track.append(mido.Message("note_off", note=int(note), velocity=0, time=note_length))

    buffer = BytesIO()
    midi.save(file=buffer)
    return buffer.getvalue()
