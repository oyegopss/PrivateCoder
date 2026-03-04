# Deploy PrivateCoder to GitHub + Vercel

## 1. Create a GitHub repo

1. Go to [github.com/new](https://github.com/new).
2. **Repository name:** `PrivateCoder` (or your choice).
3. **Visibility:** Public (for hackathon) or Private.
4. Do **not** initialize with README, .gitignore, or license (you already have them).
5. Click **Create repository**.

## 2. Push your code to GitHub

In your project folder (where `package.json` is), run:

```bash
# If you haven't initialized git yet
git init

# Add all files (respects .gitignore)
git add .
git commit -m "Initial commit: PrivateCoder on-device AI assistant"

# Add your GitHub repo as remote (replace YOUR_USERNAME and YOUR_REPO with yours)
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git

# Push (main branch)
git branch -M main
git push -u origin main
```

**Important:** Ensure `.env` is **not** committed (it’s in `.gitignore`). Run `git status` before committing; `.env` should not appear.

## 3. Deploy on Vercel

1. Go to [vercel.com](https://vercel.com) and sign in (GitHub is easiest).
2. Click **Add New…** → **Project**.
3. **Import** your GitHub repo (e.g. `PrivateCoder`).
4. **Configure:**
   - **Framework Preset:** Vite (Vercel usually detects it).
   - **Build Command:** `npm run build` (default).
   - **Output Directory:** `dist` (Vite default).
   - **Install Command:** `npm install`.
5. **Environment variables (optional):**  
   If you use a RunAnywhere key locally, add:
   - Name: `VITE_RUNANYWHEREAI_KEY`  
   - Value: your key (only if you want telemetry; inference works without it).
6. Click **Deploy**.

Vercel will build and deploy. Your site will be at `https://your-project.vercel.app`.

## 4. Notes for this project

- **`vercel.json`** is already set with COOP/COEP headers (needed for WebAssembly/SharedArrayBuffer).
- **Model files** are not in the repo; the app downloads the model in the user’s browser at runtime. No server-side model storage is required.
- After the first deploy, pushes to `main` will trigger new deployments automatically.
