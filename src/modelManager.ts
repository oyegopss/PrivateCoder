import { ModelManager as RAModelManager, ModelCategory, EventBus } from '@runanywhere/web';
import { TextGeneration } from '@runanywhere/web-llamacpp';
import { getPreferredLanguageModelId, initSDK } from './runanywhere';

type LanguageModel = ReturnType<typeof RAModelManager.getLoadedModel>;

export type LoadPhase =
  | 'sdk-init'
  | 'downloading'
  | 'loading-model'
  | 'ready'
  | 'error';

export type LoadProgress = {
  phase: LoadPhase;
  /** 0–1 download fraction; only meaningful during 'downloading' phase */
  downloadProgress: number;
};

type ProgressListener = (p: LoadProgress) => void;

let modelInstance: LanguageModel | null = null;
let modelPromise: Promise<LanguageModel> | null = null;
let warmupStarted = false;

const listeners = new Set<ProgressListener>();
let currentProgress: LoadProgress = { phase: 'sdk-init', downloadProgress: 0 };

function emit(p: LoadProgress) {
  currentProgress = p;
  listeners.forEach((fn) => fn(p));
}

/** Subscribe to loading progress updates. Returns an unsubscribe function. */
export function onProgress(fn: ProgressListener): () => void {
  fn(currentProgress);
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/**
 * Globally initialize and return the loaded Language model.
 * Ensures the model is loaded only once across the entire app.
 */
export async function getModel(): Promise<LanguageModel> {
  if (modelInstance) return modelInstance;
  if (modelPromise) return modelPromise;

  modelPromise = (async () => {
    const t0 = performance.now();
    const elapsed = () => `${((performance.now() - t0) / 1000).toFixed(1)}s`;
    console.log('[ModelManager] getModel() start');

    // Phase 1: SDK + LlamaCPP backend init
    emit({ phase: 'sdk-init', downloadProgress: 0 });
    await initSDK();
    console.log(`[ModelManager] SDK init done (${elapsed()})`);

    // Phase 2: Check if already loaded (e.g. HMR / re-render)
    let model = RAModelManager.getLoadedModel(ModelCategory.Language);
    if (model) {
      modelInstance = model;
      emit({ phase: 'ready', downloadProgress: 1 });
      console.log(`[ModelManager] Model was already loaded (${elapsed()})`);
      return modelInstance;
    }

    // Phase 3: Select model
    const allModels = RAModelManager.getModels();
    const languageModels = allModels.filter((m) => m.modality === ModelCategory.Language);
    if (languageModels.length === 0) {
      emit({ phase: 'error', downloadProgress: 0 });
      throw new Error('No language models available.');
    }

    const preferredModelId = getPreferredLanguageModelId();
    const selected = preferredModelId
      ? (languageModels.find((m) => m.id === preferredModelId) ?? languageModels[0])
      : languageModels[0];

    // Phase 4: Download only if not already cached in OPFS
    const needsDownload = selected.status !== 'downloaded' && selected.status !== 'loaded';
    if (needsDownload) {
      emit({ phase: 'downloading', downloadProgress: 0 });
      console.log('[ModelManager] Downloading model:', selected.id);

      const unsub = EventBus.shared.on('model.downloadProgress', (evt: { modelId: string; progress?: number }) => {
        if (evt.modelId === selected.id) {
          emit({ phase: 'downloading', downloadProgress: evt.progress ?? 0 });
        }
      });

      await RAModelManager.downloadModel(selected.id);
      unsub();
      emit({ phase: 'downloading', downloadProgress: 1 });
      console.log(`[ModelManager] Download done (${elapsed()})`);
    } else {
      console.log(`[ModelManager] Model already cached, skipping download (${elapsed()})`);
    }

    // Phase 5: Load into WASM
    emit({ phase: 'loading-model', downloadProgress: 1 });
    console.log('[ModelManager] Loading model into WASM:', selected.id);

    const ok = await RAModelManager.loadModel(selected.id);
    if (!ok) {
      emit({ phase: 'error', downloadProgress: 0 });
      throw new Error('Failed to load language model.');
    }

    model = RAModelManager.getLoadedModel(ModelCategory.Language) ?? selected;
    modelInstance = model;
    emit({ phase: 'ready', downloadProgress: 1 });
    console.log(`[ModelManager] Model ready: ${modelInstance?.id ?? '(unknown)'} (${elapsed()} total)`);

    // Phase 6: Fire-and-forget warmup — precompiles WebGPU kernels
    if (!warmupStarted) {
      warmupStarted = true;
      void TextGeneration.generate('Warmup', { maxTokens: 1, temperature: 0 }).catch((err) => {
        console.warn('[ModelManager] Warmup skipped:', err);
      });
    }

    return modelInstance;
  })();

  return modelPromise;
}

/** Fire-and-forget preload. Call as early as possible (e.g. main.tsx). */
export function preloadModel(): void {
  getModel().catch((err) => {
    console.error('[ModelManager] Preload failed:', err);
  });
}
