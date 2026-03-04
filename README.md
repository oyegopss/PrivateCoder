# PrivateCoder

**Engineering Intelligence. Fully Offline.**

PrivateCoder is a fully on-device AI engineering assistant that runs entirely in the browser using the RunAnywhere Web SDK and WebGPU acceleration. It performs static and AI-powered code analysis, including risk scoring, refactoring, maintainability metrics, architecture insights, and more — all without backend servers or external API calls.

---

## 🚀 Overview

PrivateCoder demonstrates how advanced coding assistance can be achieved *without cloud dependency*. Instead of sending code to external servers, all processing and inference runs locally using a quantized GPT-style model loaded directly in the browser.

---

## 🔒 Key On-Device AI Advantages

| Feature                            | Traditional AI Tools | PrivateCoder        |
|------------------------------------|----------------------|---------------------|
| Requires Internet                  | ❌                   | ✅                   |
| Sends Code to Cloud                | ❌                   | ✅ (No Code Leaves)  |
| API Cost                          | 💸 Yes               | ₹0 (Zero Cost)       |
| Works Offline                     | ❌                   | ✅                   |
| First Load Update Time             | N/A                  | 30–60s               |
| Cached Load Time                   | N/A                  | 5–12s                |
| Navigate Back After Load          | N/A                  | Instant              |
| Runs Fully in Browser             | ❌                   | ✅                   |
| WebGPU Acceleration               | ❌                   | ✅                   |

---

## 🧠 Capabilities

- **Deep Bug Analysis**
- **Maintainability Scoring**
- **Engineering Risk Assessment**
- **Architecture Analysis**
- **Security Scan**
- **Refactoring with Side-by-Side Diff View**
- **Test Case Generation**
- **Typing Animation for AI Responses**
- **Performance & Token Metrics**
- **Premium UI with Dark Theme**

---

## ⚡ Performance

- **First Ever Load:** ~30–60s (model download + compile)
- **Cached Model Load:** ~5–12s
- **Inference Time:** ~4–6s

---

## 🛠 Setup (Local Testing)

```bash
git clone https://github.com/oyegopss/PrivateCoder.git
cd PrivateCoder
npm install
npm run dev
```

Open the URL Vite prints (e.g. `http://localhost:5173`). Optional: copy `.env.example` to `.env` and add a RunAnywhere key; inference works without it.

**Important:** Never commit `.env` or API keys. Model files (`.gguf`) are downloaded at runtime and must not be committed.

---

## 📄 License

MIT. See `LICENSE` for details.
