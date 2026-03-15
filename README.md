# Verdure

Application PWA mobile-first pour suivre l'arrosage des plantes avec météo locale, bilan hydrique et assistant IA.

## Stack

- React 18 + Vite
- Zustand (persist localStorage)
- React Router v6
- CSS pur (sans librairie UI)

## Démarrage

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
npm run preview
```

## Variables d'environnement

Créer un fichier `.env`:

```bash
VITE_TREFLE_USER_TOKEN=usr-...
VITE_ANTHROPIC_API_KEY=...
```

Sans cette variable, l'écran IA reste accessible mais retourne un message d'information.

## Configuration Trefle.io

1. Créer un compte sur Trefle et récupérer un user token (`usr-...`).
2. Ajouter ce token dans `.env` via `VITE_TREFLE_USER_TOKEN`.
3. Dans le dashboard Trefle (`/me`), ajouter les origins autorisées:
	- `http://localhost:5173`
	- ton domaine de production (ex: `https://ton-app.vercel.app`)

Le projet utilise ensuite le flow recommandé côté navigateur: claim JWT court via `/api/auth/claim`, puis appels API avec ce JWT.
