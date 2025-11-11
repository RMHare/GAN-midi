import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';

const DEFAULT_BACKEND = 'http://127.0.0.1:8000';
const NOTE_OPTIONS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const CHORD_QUALITIES = {
  maj: { label: 'Major', suffix: '', intervals: [0, 4, 7] },
  min: { label: 'Minor', suffix: 'm', intervals: [0, 3, 7] },
  dom7: { label: 'Dominant 7', suffix: '7', intervals: [0, 4, 7, 10] },
  maj7: { label: 'Major 7', suffix: 'maj7', intervals: [0, 4, 7, 11] },
  min7: { label: 'Minor 7', suffix: 'm7', intervals: [0, 3, 7, 10] },
  sus2: { label: 'Sus2', suffix: 'sus2', intervals: [0, 2, 7] },
  sus4: { label: 'Sus4', suffix: 'sus4', intervals: [0, 5, 7] }
};

function App() {
  const [modules, setModules] = useState([]);
  const [selectedModule, setSelectedModule] = useState('');
  const [moduleParameters, setModuleParameters] = useState({});
  const [file, setFile] = useState(null);
  const [detectedChords, setDetectedChords] = useState([]);
  const [useCustomChords, setUseCustomChords] = useState(false);
  const [customChords, setCustomChords] = useState(() => [createCustomChordTemplate()]);
  const [status, setStatus] = useState('Ready');
  const [generatedUrl, setGeneratedUrl] = useState(null);

  const backendBaseUrl = useMemo(() => {
    if (window.api?.backendUrl) {
      return window.api.backendUrl;
    }
    return DEFAULT_BACKEND;
  }, []);

  useEffect(() => {
    async function loadModules() {
      try {
        const response = await axios.get(`${backendBaseUrl}/modules`);
        setModules(response.data);
        if (response.data.length) {
          const first = response.data[0];
          setSelectedModule(first.name);
          setModuleParameters(extractDefaults(first.parameters));
        }
      } catch (error) {
        console.error('Failed to load modules', error);
        setStatus('Unable to reach backend. Ensure the Python server is running.');
      }
    }
    loadModules();
  }, [backendBaseUrl]);

  useEffect(() => () => {
    if (generatedUrl) {
      URL.revokeObjectURL(generatedUrl);
    }
  }, [generatedUrl]);

  const selectedModuleMeta = useMemo(
    () => modules.find((module) => module.name === selectedModule),
    [modules, selectedModule]
  );

  const activeChords = useMemo(
    () => (useCustomChords ? buildCustomChordTimeline(customChords) : detectedChords),
    [useCustomChords, customChords, detectedChords]
  );

  const applyFile = useCallback((picked) => {
    if (!picked) {
      return;
    }
    setFile(picked);
    setDetectedChords([]);
    setUseCustomChords(false);
    setGeneratedUrl(null);
    setStatus(`Loaded ${picked.name}`);
  }, []);

  const clearFile = useCallback(() => {
    setFile(null);
    setDetectedChords([]);
    setUseCustomChords(false);
    setGeneratedUrl(null);
    setStatus('Ready');
  }, []);

  const handleCustomChordChange = (id, patch) => {
    setCustomChords((previous) =>
      previous.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry))
    );
  };

  const handleAddCustomChord = () => {
    setCustomChords((previous) => [...previous, createCustomChordTemplate(previous)]);
  };

  const handleRemoveCustomChord = (id) => {
    setCustomChords((previous) => {
      if (previous.length <= 1) {
        return previous;
      }
      return previous.filter((entry) => entry.id !== id);
    });
  };

  const handleParameterChange = (parameter, rawValue) => {
    const { minimum, maximum, type, default: fallback } = parameter;
    let parsed = type === 'int' ? Number.parseInt(rawValue, 10) : Number.parseFloat(rawValue);
    if (Number.isNaN(parsed)) {
      parsed = fallback ?? (type === 'int' ? 0 : 0);
    }
    parsed = clamp(parsed, minimum, maximum);
    setModuleParameters((previous) => ({
      ...previous,
      [parameter.name]: parsed
    }));
  };

  const analyzeFile = async () => {
    if (!file) {
      setStatus('Select a MIDI file first.');
      return;
    }
    setStatus('Analyzing chords…');
    const formData = new FormData();
    formData.append('file', file);
    try {
      const response = await axios.post(`${backendBaseUrl}/analyze-chords`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setDetectedChords(response.data.chords ?? []);
      setUseCustomChords(false);
      setStatus('Chord detection complete.');
    } catch (error) {
      console.error(error);
      setStatus('Chord detection failed. Check the backend logs.');
    }
  };

  const generateVariation = async () => {
    if (!file) {
      setStatus('Select a MIDI file first.');
      return;
    }
    if (!selectedModule) {
      setStatus('No module selected.');
      return;
    }

    setStatus('Generating variation…');
    const payload = new FormData();
    payload.append('file', file);
    payload.append('parameters', JSON.stringify(moduleParameters));
    if (activeChords.length) {
      payload.append('chords', JSON.stringify(activeChords));
    }

    try {
      const response = await axios.post(`${backendBaseUrl}/generate`, payload, {
        params: { module: selectedModule },
        headers: { 'Content-Type': 'multipart/form-data' },
        responseType: 'blob'
      });
      const blob = new Blob([response.data], { type: 'audio/midi' });
      if (generatedUrl) {
        URL.revokeObjectURL(generatedUrl);
      }
      const url = URL.createObjectURL(blob);
      setGeneratedUrl(url);
      setStatus('Variation ready!');
    } catch (error) {
      console.error(error);
      const detail = error.response?.data?.detail ?? 'See backend logs for details.';
      setStatus(`Generation failed: ${detail}`);
    }
  };

  return (
    <div className="app-shell">
      <header>
        <h1>GAN MIDI Studio</h1>
        <p className="status">{status}</p>
      </header>
      <main>
        <section className="panel">
          <h2>1. Input MIDI</h2>
          <FileDropZone file={file} onFileSelected={applyFile} onClear={clearFile} />
          <button type="button" onClick={analyzeFile} disabled={!file}>
            Analyze Chords
          </button>
        </section>
        <section className="panel">
          <h2>2. Select Module</h2>
          <select value={selectedModule} onChange={(event) => {
            const moduleName = event.target.value;
            setSelectedModule(moduleName);
            const meta = modules.find((module) => module.name === moduleName);
            setModuleParameters(extractDefaults(meta?.parameters ?? []));
          }}>
            {modules.map((module) => (
              <option key={module.name} value={module.name}>
                {module.name}
              </option>
            ))}
          </select>
          {selectedModuleMeta && (
            <div className="parameters">
              {selectedModuleMeta.parameters.map((parameter) => (
                <label key={parameter.name}>
                  <span>{parameter.name}</span>
                  <input
                    type="number"
                    min={parameter.minimum}
                    max={parameter.maximum}
                    step={parameter.type === 'float' ? '0.1' : '1'}
                    value={moduleParameters[parameter.name] ?? ''}
                    onChange={(event) => handleParameterChange(parameter, event.target.value)}
                  />
                </label>
              ))}
            </div>
          )}
        </section>
        <section className="panel">
          <h2>3. Generate</h2>
          <button type="button" onClick={generateVariation} disabled={!file || !selectedModule}>
            Generate Variation
          </button>
          {generatedUrl && (
            <a className="download" href={generatedUrl} download="variation.mid">
              Download variation.mid
            </a>
          )}
        </section>
        <section className="panel chords">
          <h2>Chord Progression</h2>
          <div className="chord-toggle">
            <label>
              <input
                type="radio"
                name="chord-source"
                checked={!useCustomChords}
                onChange={() => setUseCustomChords(false)}
              />
              Use detected chords
            </label>
            <label>
              <input
                type="radio"
                name="chord-source"
                checked={useCustomChords}
                onChange={() => setUseCustomChords(true)}
              />
              Craft custom progression
            </label>
          </div>
          {useCustomChords ? (
            <ChordBuilder
              entries={customChords}
              onEntryChange={handleCustomChordChange}
              onAddEntry={handleAddCustomChord}
              onRemoveEntry={handleRemoveCustomChord}
            />
          ) : (
            <p className="hint">
              Drop a MIDI file and analyze it to pull out chords automatically.
            </p>
          )}
          <ChordList
            chords={activeChords}
            emptyMessage={
              useCustomChords
                ? 'Add at least one chord step to build a progression.'
                : 'No chords detected yet.'
            }
          />
        </section>
      </main>
    </div>
  );
}

function ChordBuilder({ entries, onEntryChange, onAddEntry, onRemoveEntry }) {
  return (
    <div className="chord-builder">
      <div className="chord-builder-header">
        <h3>Custom progression</h3>
        <button type="button" onClick={onAddEntry}>
          Add Step
        </button>
      </div>
      <ul className="chord-builder-list">
        {entries.map((entry, index) => (
          <li key={entry.id}>
            <span className="step-label">Step {index + 1}</span>
            <select
              value={entry.root}
              onChange={(event) => onEntryChange(entry.id, { root: event.target.value })}
            >
              {NOTE_OPTIONS.map((note) => (
                <option key={note} value={note}>
                  {note}
                </option>
              ))}
            </select>
            <select
              value={entry.quality}
              onChange={(event) => onEntryChange(entry.id, { quality: event.target.value })}
            >
              {Object.entries(CHORD_QUALITIES).map(([key, quality]) => (
                <option key={key} value={key}>
                  {quality.label}
                </option>
              ))}
            </select>
            <label className="length-field">
              Beats
              <input
                type="number"
                min="1"
                max="32"
                step="1"
                value={entry.length}
                onChange={(event) =>
                  onEntryChange(entry.id, {
                    length: Math.max(1, Number.parseInt(event.target.value, 10) || 1)
                  })
                }
              />
            </label>
            <button
              type="button"
              className="remove"
              onClick={() => onRemoveEntry(entry.id)}
              disabled={entries.length === 1}
            >
              Remove
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ChordList({ chords, emptyMessage }) {
  if (!chords.length) {
    return <p className="hint">{emptyMessage}</p>;
  }
  return (
    <ul className="chord-list">
      {chords.map((chord, index) => (
        <li key={`${chord.time}-${index}`}>
          <strong>{formatTime(chord.time)}</strong>
          <span>{chord.name || 'N.C.'}</span>
        </li>
      ))}
    </ul>
  );
}

function extractDefaults(parameters = []) {
  const defaults = {};
  for (const parameter of parameters) {
    if (parameter.default !== undefined) {
      defaults[parameter.name] = parameter.default;
    }
  }
  return defaults;
}

function formatTime(seconds) {
  const time = Number(seconds) || 0;
  return `${time.toFixed(2)}s`;
}

function clamp(value, minimum, maximum) {
  let next = value;
  if (typeof minimum === 'number') {
    next = Math.max(minimum, next);
  }
  if (typeof maximum === 'number') {
    next = Math.min(maximum, next);
  }
  return next;
}

function buildCustomChordTimeline(entries) {
  const secondsPerBeat = 0.5; // Assume 120 BPM for preview timing.
  let elapsedBeats = 0;
  return entries.map((entry) => {
    const quality = CHORD_QUALITIES[entry.quality] ?? CHORD_QUALITIES.maj;
    const rootIndex = NOTE_OPTIONS.indexOf(entry.root);
    const normalizedRoot = rootIndex >= 0 ? rootIndex : 0;
    const time = elapsedBeats * secondsPerBeat;
    const name = `${entry.root}${quality.suffix}`;
    const pitches = quality.intervals.map((interval) => (normalizedRoot + interval) % 12);
    const beats = Math.max(1, Number(entry.length) || 1);
    elapsedBeats += beats;
    return {
      time,
      name,
      pitches
    };
  });
}

function createCustomChordTemplate(previous = []) {
  const last = previous[previous.length - 1];
  return {
    id: `chord-${Math.random().toString(36).slice(2, 10)}`,
    root: last?.root ?? 'C',
    quality: last?.quality ?? 'maj',
    length: last?.length ?? 4
  };
}

function FileDropZone({ file, onFileSelected, onClear }) {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef(null);
  const openFileDialog = () => {
    inputRef.current?.click();
  };
  const handleDrop = (event) => {
    event.preventDefault();
    setIsDragging(false);
    const dropped = event.dataTransfer?.files?.[0];
    if (dropped) {
      onFileSelected(dropped);
    }
  };
  const handleDragOver = (event) => {
    event.preventDefault();
    setIsDragging(true);
  };
  const handleDragLeave = (event) => {
    event.preventDefault();
    setIsDragging(false);
  };
  return (
    <div
      className={`drop-zone${isDragging ? ' is-dragging' : ''}`}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onClick={openFileDialog}
      role="presentation"
    >
      <input
        ref={inputRef}
        type="file"
        accept=".mid,.midi"
        hidden
        onChange={(event) => {
          const picked = event.target.files?.[0];
          if (picked) {
            onFileSelected(picked);
          }
          if (event.target) {
            event.target.value = '';
          }
        }}
      />
      <div className="drop-zone-inner">
        <strong>{file ? file.name : 'Drop MIDI file here'}</strong>
        <small>Click to browse or drag a .mid/.midi file.</small>
        <div className="drop-zone-actions">
          <button type="button" className="browse-button" onClick={(event) => {
            event.stopPropagation();
            openFileDialog();
          }}>
            Browse
          </button>
          {file && (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onClear();
              }}
              className="clear-button"
            >
              Remove
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
