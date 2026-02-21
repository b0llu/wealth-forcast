# Wealth Forecast (Next.js + Firebase + Gemini + Web Search)

This app lets users add any investment in a unified form (mutual fund, stock, PPF, NPS, etc.) and generate one combined portfolio wealth forecast.
Portfolio data is persisted in Firebase (no localStorage persistence).

## Routes

- `/investments` for adding and editing investments
- `/wealth` for running generation and viewing combined forecast output

## Stack

- Next.js (App Router, TypeScript)
- Tailwind CSS v4 (tokenized palette)
- Firebase Firestore (via Firebase Admin SDK)
- Gemini via `@google/genai`
- Gemini grounding with Google Search tool (`tools: [{ googleSearch: {} }]`)

## Setup

1. Install dependencies:

```bash
npm install
```

2. Configure env:

```bash
cp .env.example .env.local
```

3. Run dev server:

```bash
npm run dev
```

## Required environment variables

- `GOOGLE_API_KEY`
- `GEMINI_MODEL` (optional, default `gemini-2.5-flash`)
- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY` (keep `\\n` escaped in `.env.local`)
- `DEBUG_LOGS` (optional, set `1` for verbose logs)

## API endpoints

- `GET /api/portfolio`: load/create the current portfolio (cookie-based id)
- `PUT /api/portfolio`: persist investments/settings to Firebase
- `POST /api/forecast`: generate combined forecast and save run to Firestore

## AI data strategy

- If user provides `sourceUrl`, model uses it as a primary source.
- If no URL is provided, model searches web sources directly.
- For mutual funds/stocks, model tries to return: YTD, 1Y, 3Y CAGR, 5Y CAGR, since-inception CAGR.
- Model JSON is schema-validated and source URLs are sanitized.

## Backend logs

Structured backend logs are emitted for:

- forecast request summary
- per-investment Gemini request/response parsing summary
- forecast output summary and Firestore save
