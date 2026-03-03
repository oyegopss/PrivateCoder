import { useEffect, useState, useCallback } from 'react';
import { ModelManager, ModelCategory } from '@runanywhere/web';
import { TextGeneration } from '@runanywhere/web-llamacpp';
import { initSDK } from './runanywhere';
import { useModelLoader } from './hooks/useModelLoader';

export function App() {
  const [sdkReady, setSdkReady] = useState(false);
  const [sdkError, setSdkError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [code, setCode] = useState('');
  const [output, setOutput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  // Track whether the LLM is fully ready for use.
  const [modelReady, setModelReady] = useState<boolean>(() =>
    !!ModelManager.getLoadedModel(ModelCategory.Language),
  );

  // Load and track the default LLM model using the documented Web SDK pattern.
  const loader = useModelLoader(ModelCategory.Language);

  useEffect(() => {
    let cancelled = false;

    async function setup() {
      try {
        setSdkError(null);
        await initSDK();
        if (cancelled) return;
        setSdkReady(true);
      } catch (err) {
        if (!cancelled) {
          setSdkError(err instanceof Error ? err.message : String(err));
        }
      } finally {
        if (!cancelled) {
          // no-op
        }
      }
    }

    void setup();

    return () => {
      cancelled = true;
    };
  }, []);

  // After SDK is initialized, automatically download and load the default LLM model.
  useEffect(() => {
    if (!sdkReady) return;

    let cancelled = false;

    console.log('Model initialization started');

    (async () => {
      try {
        const ok = await loader.ensure();
        if (!cancelled && ok) {
          console.log('Model ready');
          setModelReady(true);
        }
      } catch (err) {
        if (!cancelled) {
          console.error('Model initialization failed', err);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [sdkReady, loader.ensure]);

  const runGeneration = useCallback(
    async (mode: 'explain' | 'refactor') => {
      const snippet = code.trim();
      if (!snippet || !modelReady || isGenerating) return;

      setIsGenerating(true);
      setError(null);
      setOutput('');

      const prompt =
        mode === 'explain'
          ? `You are a senior software engineer. Explain clearly what this code does and any potential issues:\n\n${snippet}`
          : `You are a senior software engineer. Refactor this code for clarity and best practices, and return only the refactored code:\n\n${snippet}`;

      try {
        const result = await TextGeneration.generate(prompt, {
          maxTokens: 120,
          temperature: 0.2,
        });
        setOutput(result.text ?? '');
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setIsGenerating(false);
      }
    },
    [code, isGenerating, modelReady],
  );

  const buttonsDisabled = !modelReady || !code.trim() || isGenerating;

  if (sdkError && !sdkReady) {
    return (
      <div className="app-loading">
        <h2>PrivateCoder Error</h2>
        <p className="error-text">{sdkError}</p>
      </div>
    );
  }

  if (!sdkReady) {
    return (
      <div className="app-loading">
        <div className="spinner" />
        <h2>PrivateCoder — 100% On-Device AI Code Assistant</h2>
        <p>Initializing on-device engine…</p>
      </div>
    );
  }

  const activeModel =
    ModelManager.getLoadedModel(ModelCategory.Language) ??
    ModelManager.getModels().find((m) => m.modality === ModelCategory.Language) ??
    null;

  return (
    <div className="app">
      <header className="app-header">
        <h1>PrivateCoder — 100% On-Device AI Code Assistant</h1>
      </header>

      <main className="coder-main">
        <section className="coder-status">
          <span className="coder-status-label">
            {modelReady ? 'Model ready' : 'Model not ready'}
          </span>
          {activeModel && (
            <span className="coder-status-model">
              Using model: <strong>{activeModel.name ?? activeModel.id}</strong>
            </span>
          )}
        </section>

        <section className="coder-input-section">
          <label className="coder-label" htmlFor="code-input">
            Code
          </label>
          <textarea
            id="code-input"
            className="coder-textarea"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Paste or type your code here..."
          />
        </section>

        <section className="coder-actions">
          <button
            className="btn btn-primary"
            type="button"
            disabled={buttonsDisabled}
            onClick={() => void runGeneration('explain')}
          >
            {isGenerating ? 'Explaining…' : 'Explain Code'}
          </button>
          <button
            className="btn"
            type="button"
            disabled={buttonsDisabled}
            onClick={() => void runGeneration('refactor')}
          >
            {isGenerating ? 'Refactoring…' : 'Refactor Code'}
          </button>
        </section>

        <section className="coder-output-section">
          <div className="coder-output-header">
            <span>Output</span>
            {isGenerating && <span className="coder-output-loading">Thinking…</span>}
          </div>
          <div className="coder-output">
            {output ? <pre>{output}</pre> : <span className="text-muted">Results will appear here.</span>}
          </div>
          {error && <p className="error-text">{error}</p>}
        </section>
      </main>
    </div>
  );
}
