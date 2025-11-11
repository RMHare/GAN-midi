"""Entry point to launch the FastAPI backend without reload."""

import os

import uvicorn


def main():
    """Start the Uvicorn server using environment defaults."""
    port = int(os.environ.get("PORT", "8000"))
    uvicorn.run(
        "backend.app.main:app",
        host="127.0.0.1",
        port=port,
        reload=False,
        log_level="info",
    )


if __name__ == "__main__":  # pragma: no cover - CLI entry
    main()
