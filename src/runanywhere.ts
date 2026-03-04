/**
 * RunAnywhere SDK initialization and model catalog.
 *
 * initSDK()     — core SDK + LlamaCPP backend + model catalog + VLM worker.
 *                 This is the fast path needed for Language models.
 * initONNX()    — lazily registers the ONNX backend (sherpa-onnx — STT/TTS/VAD).
 *                 Only called when voice features are used.
 */

import {
  RunAnywhere,
  SDKEnvironment,
  ModelManager,
  ModelCategory,
  LLMFramework,
  type CompactModelDef,
} from '@runanywhere/web';

import { LlamaCPP, VLMWorkerBridge } from '@runanywhere/web-llamacpp';

// Vite bundles the worker as a standalone JS chunk and returns its URL.
// @ts-ignore — Vite-specific ?worker&url query
import vlmWorkerUrl from './workers/vlm-worker?worker&url';

// ---------------------------------------------------------------------------
// Model catalog
// ---------------------------------------------------------------------------

const MODELS: CompactModelDef[] = [
  // LLM — Liquid AI LFM2 350M (small + fast for chat)
  {
    id: 'lfm2-350m-q4_k_m',
    name: 'LFM2 350M Q4_K_M',
    repo: 'LiquidAI/LFM2-350M-GGUF',
    files: ['LFM2-350M-Q4_K_M.gguf'],
    framework: LLMFramework.LlamaCpp,
    modality: ModelCategory.Language,
    memoryRequirement: 250_000_000,
  },
  // LLM — Liquid AI LFM2 1.2B Tool (optimized for tool calling & function calling)
  {
    id: 'lfm2-1.2b-tool-q4_k_m',
    name: 'LFM2 1.2B Tool Q4_K_M',
    repo: 'LiquidAI/LFM2-1.2B-Tool-GGUF',
    files: ['LFM2-1.2B-Tool-Q4_K_M.gguf'],
    framework: LLMFramework.LlamaCpp,
    modality: ModelCategory.Language,
    memoryRequirement: 800_000_000,
  },
  // VLM — Liquid AI LFM2-VL 450M (vision + language)
  {
    id: 'lfm2-vl-450m-q4_0',
    name: 'LFM2-VL 450M Q4_0',
    repo: 'runanywhere/LFM2-VL-450M-GGUF',
    files: ['LFM2-VL-450M-Q4_0.gguf', 'mmproj-LFM2-VL-450M-Q8_0.gguf'],
    framework: LLMFramework.LlamaCpp,
    modality: ModelCategory.Multimodal,
    memoryRequirement: 500_000_000,
  },
  // STT (sherpa-onnx archive)
  {
    id: 'sherpa-onnx-whisper-tiny.en',
    name: 'Whisper Tiny English (ONNX)',
    url: 'https://huggingface.co/runanywhere/sherpa-onnx-whisper-tiny.en/resolve/main/sherpa-onnx-whisper-tiny.en.tar.gz',
    framework: LLMFramework.ONNX,
    modality: ModelCategory.SpeechRecognition,
    memoryRequirement: 105_000_000,
    artifactType: 'archive' as const,
  },
  // TTS (sherpa-onnx archive)
  {
    id: 'vits-piper-en_US-lessac-medium',
    name: 'Piper TTS US English (Lessac)',
    url: 'https://huggingface.co/runanywhere/vits-piper-en_US-lessac-medium/resolve/main/vits-piper-en_US-lessac-medium.tar.gz',
    framework: LLMFramework.ONNX,
    modality: ModelCategory.SpeechSynthesis,
    memoryRequirement: 65_000_000,
    artifactType: 'archive' as const,
  },
  // VAD (single ONNX file)
  {
    id: 'silero-vad-v5',
    name: 'Silero VAD v5',
    url: 'https://huggingface.co/runanywhere/silero-vad-v5/resolve/main/silero_vad.onnx',
    files: ['silero_vad.onnx'],
    framework: LLMFramework.ONNX,
    modality: ModelCategory.Audio,
    memoryRequirement: 5_000_000,
  },
];

const PREFERRED_LANGUAGE_MODEL_ID = import.meta.env.VITE_LANGUAGE_MODEL_ID as string | undefined;

// ---------------------------------------------------------------------------
// Initialization
// ---------------------------------------------------------------------------

let _initPromise: Promise<void> | null = null;

/** Initialize the RunAnywhere SDK + LlamaCPP backend. Safe to call multiple times. */
export async function initSDK(): Promise<void> {
  if (_initPromise) return _initPromise;

  _initPromise = (async () => {
    const apiKey = import.meta.env.VITE_RUNANYWHEREAI_KEY;
    if (!apiKey) {
      console.error('VITE_RUNANYWHEREAI_KEY is not set. RunAnywhere will initialize without an API key.');
    }

    await RunAnywhere.initialize({
      environment: SDKEnvironment.Development,
      debug: false,
      ...(apiKey ? { apiKey } : {}),
    });

    await LlamaCPP.register();

    RunAnywhere.registerModels(MODELS);

    VLMWorkerBridge.shared.workerUrl = vlmWorkerUrl;
    RunAnywhere.setVLMLoader({
      get isInitialized() { return VLMWorkerBridge.shared.isInitialized; },
      init: () => VLMWorkerBridge.shared.init(),
      loadModel: (params) => VLMWorkerBridge.shared.loadModel(params),
      unloadModel: () => VLMWorkerBridge.shared.unloadModel(),
    });
  })();

  return _initPromise;
}

let _onnxPromise: Promise<void> | null = null;

/** Lazily register the ONNX backend (sherpa-onnx). Only needed for STT/TTS/VAD. */
export async function initONNX(): Promise<void> {
  await initSDK();
  if (_onnxPromise) return _onnxPromise;

  _onnxPromise = (async () => {
    const { ONNX } = await import('@runanywhere/web-onnx');
    await ONNX.register();
  })();

  return _onnxPromise;
}

/** Get acceleration mode after init. */
export function getAccelerationMode(): string | null {
  return LlamaCPP.isRegistered ? LlamaCPP.accelerationMode : null;
}

export function getPreferredLanguageModelId(): string | undefined {
  return PREFERRED_LANGUAGE_MODEL_ID;
}

// Re-export for convenience
export { RunAnywhere, ModelManager, ModelCategory, LLMFramework, VLMWorkerBridge };
