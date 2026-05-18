# WayFinder

WayFinder is an AI-powered collaborative travel planning platform. It combines group trip planning, itinerary generation, route-aware recommendation logic, validation, partial regeneration, and a local mock AI pipeline for evaluating travel intelligence before connecting production AI/provider APIs.

## Current Focus

The project is currently focused on making Jaipur itinerary generation feel locally intelligent, geographically smooth, emotionally paced, weather-aware, realistic, and explainable.

The Jaipur seed dataset now contains 129 curated place-intelligence records covering:

- landmarks and heritage
- cafes and local food
- markets and craft areas
- viewpoints and sunset stops
- cultural spots and workshops
- nightlife
- filler, recovery, arrival, and departure-safe places
- weather-safe alternatives
- locality clusters and nearby-place relationships

## Tech Stack

- Frontend: Vite, React, Tailwind CSS
- Backend: Node.js, Express, MongoDB/Mongoose
- AI planning sandbox: local Node.js mock pipeline
- Local database: MongoDB on `mongodb://127.0.0.1:27017/travelApp`

## Local Development

From the repository root:

```bash
npm run install:all
```

Then start the full local app:

```bash
npm run dev
```

This starts:

- MongoDB on `127.0.0.1:27017` when available
- backend API on `http://localhost:5000`
- frontend on `http://127.0.0.1:5173`

Open the app at:

```text
http://127.0.0.1:5173
```

If `npm run dev` cannot start MongoDB, install MongoDB Community Server or make sure `mongod` is available on your PATH. The backend can still boot with `REQUIRE_DB=false`, but DB-backed auth/group routes need MongoDB.

## Manual Local Commands

Start MongoDB only:

```bash
npm run dev:mongo
```

Start the backend only:

```bash
npm run dev:server
```

Start the frontend only:

```bash
npm run dev:client
```

Build the frontend:

```bash
npm run build
```

## Environment Files

Frontend:

```bash
copy client\.env.example client\.env
```

Backend:

```bash
copy server\.env.example server\.env
```

The local mock planning pipeline does not require AI API keys. Legacy AI endpoints can use `GROQ_API_KEY`, `OPENAI_API_KEY`, or `GEMINI_API_KEY` when configured.

## Jaipur Intelligence Checks

Audit the curated Jaipur seed:

```bash
npm run audit:jaipur
```

Run all mock planning evaluation scenarios:

```bash
npm run evaluate
```

You can also run a specific mock pipeline scenario:

```bash
node mock_ai_pipeline/runMockPipeline.js jaipur
node mock_ai_pipeline/runMockPipeline.js jaipur_luxury_couple
node mock_ai_pipeline/runMockPipeline.js jaipur_low_energy_family
```

## Important Project Paths

- `client/` - Vite React frontend
- `server/` - Express API and Mongo-backed routes
- `mock_ai_pipeline/` - local retrieval, ranking, optimization, validation, explanation, and evaluation sandbox
- `mock_ai_pipeline/data/jaipurPlaceIntelligence.js` - curated Jaipur seed dataset
- `mock_ai_pipeline/data/jaipurEvaluationPersonas.js` - Jaipur persona test suite
- `docs/WAYFINDER_AI_PIPELINE_DOCUMENTATION.md` - AI pipeline architecture and product logic

## License

MIT
