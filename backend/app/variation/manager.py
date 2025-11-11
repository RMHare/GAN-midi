"""Module discovery utilities."""
from __future__ import annotations

from importlib import import_module
from pkgutil import iter_modules
from types import ModuleType
from typing import Dict, Iterable, List, Type

from .base import VariationModule


class VariationRegistry:
    """Discovers and caches available variation modules."""

    def __init__(self, package: str) -> None:
        self._package = package
        self._modules: Dict[str, VariationModule] = {}

    def all(self) -> Iterable[VariationModule]:
        if not self._modules:
            self._discover()
        return self._modules.values()

    def get(self, name: str) -> VariationModule:
        if not self._modules:
            self._discover()
        return self._modules[name]

    def _discover(self) -> None:
        package_module = import_module(self._package)
        for info in iter_modules(package_module.__path__, package_module.__name__ + "."):
            module = import_module(info.name)
            for attr in vars(module).values():
                if isinstance(attr, type) and issubclass(attr, VariationModule) and attr is not VariationModule:
                    instance = attr()
                    self._modules[instance.name] = instance
