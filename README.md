# GAN MIDI Studio

A full-stack desktop prototype for generating MIDI variations offline. The project combines a Python FastAPI backend with modular generators, a local ONNX groove model, and an Electron + React front-end that can be packaged into native installers.

## Project Layout

```text
backend/
├── app/
│   ├── main.py            # FastAPI entry-point
│   ├── midi.py            # MIDI parsing utilities
│   └── variation/
│       ├── base.py        # Module abstraction
│       ├── manager.py     # Dynamic module discovery
│       ├── markov.py      # Markov melody generator
│       └── onnx_gan.py    # Offline ONNX groove generator
├── models/
│   └── simple_gan.onnx    # Bundled lightweight ONNX model
├── package_backend.sh     # PyInstaller helper script
└── run_app.py             # Production backend launcher

frontend/
├── electron/              # Electron main & preload scripts
├── src/                   # React UI source
├── index.html             # Vite entrypoint
└── package.json           # Electron/Vite configuration
```

## Backend

### Running in development

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt
uvicorn backend.app.main:app --reload
```

The OpenAPI explorer lives at <http://127.0.0.1:8000/docs>.

### Available generators

| Module name             | Description                                             |
| ----------------------- | ------------------------------------------------------- |
| Markov Chain (Melody)   | Order-N Markov model trained on the uploaded MIDI file. |
| Offline GAN Groove      | Runs an embedded ONNX model to sketch groove patterns.  |

The ONNX generator consumes the model stored at `backend/models/simple_gan.onnx`. Replace this file with a project-specific export to swap in a new offline model.

### Packaging the backend into a standalone binary

```bash
cd backend
pip install pyinstaller
./package_backend.sh
```

The resulting binary is placed inside `backend/dist/backend-service[.exe]`. This artifact is automatically picked up by the Electron builder configuration.

## Front-end Desktop App

### Installing dependencies & running the app

```bash
cd frontend
npm install
npm run dev
```

The command launches both the Vite dev server and Electron shell. The UI supports:

1. Dropping or browsing for a MIDI file via the built-in drag-and-drop zone for chord detection.
2. Choosing any discovered generator and customising its parameters.
3. Crafting a chord progression manually with a built-in editor or reusing the detected chords.
4. Requesting a new variation and downloading the returned `variation.mid` without leaving the desktop application.

### Building installers (Windows `.exe`, macOS `.dmg`, Linux `.AppImage`)

First ensure the packaged backend binary exists (`backend/package_backend.sh`). Then run:

```bash
cd frontend
npm install
npm run dist
```

Electron Builder bundles the React production build, offline ONNX models, and (if present) the PyInstaller backend executable into platform-specific installers located in `frontend/dist/`.

## Replacing the Offline Model

1. Train or fine-tune a model using PyTorch or TensorFlow.
2. Export it to ONNX (`.onnx`).
3. Drop the exported file into `backend/models/` (keeping the `simple_gan.onnx` filename or updating `onnx_gan.py` accordingly).
4. Rebuild the backend package and desktop installers.

## Testing

*Backend:* `python -m compileall backend`

*Front-end lint (optional):* `npm run lint` inside `frontend/`.

## Next Steps

- Expand the ONNX groove model with a musically interesting architecture.
- Stream live audio playback of the generated MIDI within the desktop shell.
- Integrate visualisation of the generated piano-roll inside the Electron app.
