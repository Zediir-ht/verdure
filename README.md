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

## Variable d'environnement (IA)

Créer un fichier `.env`:

```bash
VITE_ANTHROPIC_API_KEY=...
```

Sans cette variable, l'écran IA reste accessible mais retourne un message d'information.
