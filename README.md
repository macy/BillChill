This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started (Frontend + Flask Backend)

This repository now contains:

* A Next.js 16 frontend (React 19) under `app/`.
* A Flask microservice under `app/hospital/app.py` that calls OpenRouter + Nominatim.

### 1. Environment Variables

Create a `.env.local` (frontend) for optional proxy base:

```
FLASK_BASE_URL=http://127.0.0.1:5000
```

Set backend variables in your shell or a `.env` loaded before starting Flask:

```
export OPENROUTER_API_KEY=sk-...
export NOMINATIM_EMAIL=you@example.com
export CORS_ALLOW_ORIGIN=http://localhost:3000
```

On Windows PowerShell:

```powershell
$env:OPENROUTER_API_KEY="sk-..."; $env:NOMINATIM_EMAIL="you@example.com"; $env:CORS_ALLOW_ORIGIN="http://localhost:3000"
```

### 2. Install Dependencies

Frontend:

```bash
npm install
```

Backend (create a virtual env if desired):

```bash
python -m venv .venv
source .venv/bin/activate  # PowerShell: .venv\Scripts\Activate.ps1
pip install -r app/hospital/requirements.txt
```

### 3. Run Both Services

In one terminal (frontend):

```bash
npm run dev
```

In another terminal (backend):

```bash
python app/hospital/app.py
```

Visit `http://localhost:3000/hospital` and search for a procedure (e.g. "MRI"). The browser will request geolocation, then the Next.js API route (`/api/hospitals`) proxies to Flask.

### 4. Flow Overview

1. User enters condition/procedure and grants location.
2. Frontend calls `POST /api/hospitals` with `{ lat, lon, condition }`.
3. Next.js server route (`app/api/hospitals/route.ts`) forwards to Flask at `FLASK_BASE_URL/api/hospitals`.
4. Flask queries OpenRouter (Perplexity Sonar) + validates + distance filters + enriches; returns JSON results.
5. Frontend renders sorted list with price, distance, maps & website links.

### 5. Troubleshooting

* CORS errors: ensure `CORS_ALLOW_ORIGIN` matches the exact frontend origin (including protocol + port).
* 502 from frontend: check Flask logs; may be OpenRouter timeout or missing `OPENROUTER_API_KEY`.
* Geolocation denied: browser will show an inline error; allow location and retry search.
* Slow searches: OpenRouter + Nominatim calls can take a few seconds; adjust `timeout` values in code if needed.

### 6. Security Notes

* Keep `OPENROUTER_API_KEY` only on the backend; the frontend never sees it.
* For production deployments, restrict CORS and consider rate limiting and persistent caching of geocode results.

### 7. Future Improvements

* Add pagination & more robust validation.
* Introduce optimistic UI skeleton loaders.
* Store frequently queried hospitals in a database with nightly refresh.
* Replace direct Sonar search with curated price datasets when available.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
