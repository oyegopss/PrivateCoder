# PrivateCoder

**Engineering Intelligence. Fully Offline.**

## 🚀 Overview

PrivateCoder is a fully on-device AI engineering assistant powered by the [RunAnywhere Web SDK](https://runanywhere.ai). It explains, refactors, and analyzes code in your browser—no backend, no cloud APIs, no API keys required for core inference.

## 🔒 Why On-Device?

- **100% Private** — Your code never leaves your machine.
- **Zero API Cost** — No per-token billing or usage limits.
- **Works Offline** — After the first model download, run without internet.
- **WebGPU Accelerated** — Fast inference when supported by your browser.

## 🧠 Architecture

- **React + Vite** — Frontend and build.
- **RunAnywhere Web SDK** — On-device model management and inference.
- **LFM2 350M Q4_K_M** — Default language model (downloaded at runtime).
- **WebGPU** — Hardware-accelerated inference where available.
- **OPFS** — Browser storage for cached model weights.

All inference runs locally in the browser. No model files are committed; the model is downloaded on first run.

## ⚡ Performance

| Scenario              | Expected time        |
|-----------------------|----------------------|
| First load (download) | 30–60s (network)    |
| Cached load           | 5–10s                |
| Typical inference     | ~4–6s                |

## 🎥 Demo

(Add demo video link here)

## 🛠 Run Locally

**Prerequisites:** Node.js ≥ 18, npm ≥ 9, modern browser (Chrome/Edge recommended) with WebAssembly and ideally WebGPU.

```bash
npm install
npm run dev
```

Open the URL Vite prints (e.g. `http://localhost:5173`). Optional: copy `.env.example` to `.env` and add a RunAnywhere key for telemetry; inference works without it.

**Important:** Never commit `.env` or any file containing API keys. Model files (e.g. `.gguf`) are not in the repo and must not be committed; they are downloaded at runtime. If `.env` or a key was ever committed, rotate the key immediately.

## 📁 Project Structure

```
src/
  assets/       # Static assets (e.g. logo)
  components/   # React components
  hooks/        # Custom hooks
  pages/        # Home, Tool
  styles/       # Global CSS
  workers/      # VLM worker
public/
README.md
package.json
.gitignore
```

## 📄 License

MIT. See `LICENSE` for details.
