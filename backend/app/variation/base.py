"""Base classes for variation modules."""
from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Any, Dict, Iterable, Mapping


@dataclass(frozen=True)
class ModuleParameter:
    """Metadata describing an exposed parameter for the UI."""

    name: str
    type: str
    minimum: float | None = None
    maximum: float | None = None
    default: Any | None = None


class VariationModule(ABC):
    """Interface implemented by generation modules."""

    @property
    @abstractmethod
    def name(self) -> str:
        """Human friendly module name."""

    @abstractmethod
    def describe_parameters(self) -> Iterable[ModuleParameter]:
        """Return the parameters configurable from the client UI."""

    @abstractmethod
    def generate(
        self,
        midi_bytes: bytes,
        chords: Iterable[Mapping[str, Any]] | None,
        parameters: Mapping[str, Any],
    ) -> bytes:
        """Generate a MIDI file based on input data and parameters."""
