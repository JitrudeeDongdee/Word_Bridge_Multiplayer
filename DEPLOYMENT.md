# Deployment Guide

## Prerequisites

- Node.js 18+
- A Firebase account (free Spark plan is sufficient)
- A GitHub repository for the project

---

## Step 1 — Create a Firebase Project

1. Go to [https://console.firebase.google.com](https://console.firebase.google.com)
2. Click **Add project** and follow the setup wizard
3. Disable Google Analytics (not required for this project)

---

## Step 2 — Enable Realtime Database

1. In your Firebase project, open **Build → Realtime Database**
2. Click **Create Database**
3. Choose a region (e.g., `us-central1`)
4. Start in **Test mode** for development, then tighten rules before production

### Recommended Database Rules

```json
{
  "rules": {
    "rooms": {
      "$roomId": {
        ".read": true,
        ".write": true
      }
    }
  }
}
```

> For production, tighten rules to validate data shapes and enforce authentication.

---

## Step 3 — Get Firebase Config

1. In your Firebase project, click the ⚙️ gear icon → **Project settings**
2. Scroll to **Your apps** and click **Add app → Web**
3. Register the app and copy the `firebaseConfig` object values

---

## Step 4 — Configure Environment Variables

1. Copy `.env.example` to `.env.local`:
   ```bash
   cp .env.example .env.local
   ```
2. Fill in all values from the Firebase config object:
   ```
   VITE_FIREBASE_API_KEY=AIza...
   VITE_FIREBASE_AUTH_DOMAIN=my-project.firebaseapp.com
   VITE_FIREBASE_DATABASE_URL=https://my-project-default-rtdb.firebaseio.com
   VITE_FIREBASE_PROJECT_ID=my-project
   VITE_FIREBASE_STORAGE_BUCKET=my-project.appspot.com
   VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
   VITE_FIREBASE_APP_ID=1:123456789:web:abc...
   ```
3. **Never commit `.env.local` to source control.**

---

## Step 5 — Run Locally

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173)

---

## Step 6 — Deploy to GitHub Pages

### Configure the base path

In `vite.config.ts`, set the `base` option to your repository name:

```ts
export default defineConfig({
  base: '/your-repo-name/',
  // ...
});
```

### Install gh-pages (already in devDependencies)

```bash
npm install
```

### Add GitHub Secrets

In your GitHub repository, go to **Settings → Secrets and variables → Actions** and add all environment variables as repository secrets with the same names as in `.env.example`.

### Create GitHub Actions workflow (optional CI/CD)

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to GitHub Pages
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npm run build
        env:
          VITE_FIREBASE_API_KEY: ${{ secrets.VITE_FIREBASE_API_KEY }}
          VITE_FIREBASE_AUTH_DOMAIN: ${{ secrets.VITE_FIREBASE_AUTH_DOMAIN }}
          VITE_FIREBASE_DATABASE_URL: ${{ secrets.VITE_FIREBASE_DATABASE_URL }}
          VITE_FIREBASE_PROJECT_ID: ${{ secrets.VITE_FIREBASE_PROJECT_ID }}
          VITE_FIREBASE_STORAGE_BUCKET: ${{ secrets.VITE_FIREBASE_STORAGE_BUCKET }}
          VITE_FIREBASE_MESSAGING_SENDER_ID: ${{ secrets.VITE_FIREBASE_MESSAGING_SENDER_ID }}
          VITE_FIREBASE_APP_ID: ${{ secrets.VITE_FIREBASE_APP_ID }}
      - uses: peaceiris/actions-gh-pages@v4
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./dist
```

### Manual deploy

```bash
npm run build
npm run deploy
```

This builds the project and pushes the `dist/` folder to the `gh-pages` branch.

---

## Step 7 — Enable GitHub Pages

1. Go to your repository → **Settings → Pages**
2. Set **Source** to **Deploy from a branch**
3. Set **Branch** to `gh-pages`, folder `/root`
4. Save — your site will be live at `https://your-username.github.io/your-repo-name/`
