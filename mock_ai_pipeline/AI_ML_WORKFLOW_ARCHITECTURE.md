# WayFinder AI/ML Brain Architecture

This document describes the intended final AI/ML workflow behind WayFinder: the data layer, model layer, ranking engine, itinerary optimizer, collaboration engine, and continuous learning loop. The current mock pipeline is a local, deterministic version of this architecture so the team can test product behavior before expensive model and infrastructure work.

## Product Goal

WayFinder should beat generic trip planners by behaving like a travel operating system, not a static itinerary generator. The AI brain must understand destination context, group preferences, budget, timing, fatigue, route flow, weather, visual grounding, and collaborative changes. The output should feel explainable, editable, and locally aware.

## Current Prototype Foundation

The current AI engine already has the first version of these layers:

- Global destination seed data: `mock_ai_pipeline/data/destinationPlaceIntelligence.js`
- Destination visual registry: `mock_ai_pipeline/data/destinationVisualAssets.js`
- Jaipur deep seed data: `mock_ai_pipeline/data/jaipurPlaceIntelligence.js`
- Unified legacy candidate adapter: `mock_ai_pipeline/data/places.js`
- Retrieval: `mock_ai_pipeline/src/retrieveCandidates.js`
- Ranking: `mock_ai_pipeline/src/scoreCandidates.js`
- Optimization: `mock_ai_pipeline/src/optimizeItinerary.js`
- JSON generation: `mock_ai_pipeline/src/generateItineraryJson.js`
- Validation: `mock_ai_pipeline/src/validateItinerary.js`
- Explanations and reliability: `mock_ai_pipeline/src/generateExplanations.js`, `mock_ai_pipeline/src/evaluatePipeline.js`
- Partial regeneration: `mock_ai_pipeline/src/partialRegeneration/partialRegenerationEngine.js`
- Audits: `mock_ai_pipeline/runJaipurSeedAudit.js`, `mock_ai_pipeline/runDestinationSeedAudit.js`

## High-Level System Flow

```text
User / group intent
  -> preference extraction
  -> traveler memory and group consensus model
  -> destination and place intelligence retrieval
  -> semantic candidate expansion
  -> candidate scoring and reranking
  -> route and day optimization
  -> itinerary JSON generation
  -> validation and reliability scoring
  -> explanation generation
  -> collaborative proposal and voting layer
  -> partial regeneration
  -> feedback capture
  -> continuous learning and seed improvement
```

## Core Data Model

WayFinder should treat every place as a rich planning object, not just a card with a name and image.

Each place record should include:

- Stable identifiers: `placeId`, aliases, destination aliases, country, currency.
- Geo intelligence: coordinates, route zone, nearby place IDs, locality cluster, backtracking group.
- User-fit intelligence: semantic tags, vibe tags, trip roles, category, ideal visit windows.
- Planning constraints: duration, fatigue score, budget tier, cost range, indoor/outdoor type.
- Environmental fit: hot/rain/cool suitability, crowd profiles, best slots.
- Quality signals: uniqueness, popularity, local fit, family fit, couple fit, group fit.
- Visual grounding: Wikimedia/Wikidata image where available, exact OpenStreetMap fallback, destination hero image.
- Source confidence: metadata completeness, source confidence, verification timestamp.
- Embedding text: model-ready natural language summary used by retrieval and vector search.

The current global seed has 248 records across 31 destinations. Jaipur remains the deep benchmark city with 100+ records for advanced evaluation.

## Data Ingestion Pipeline

The final ingestion pipeline should be semi-automated:

```text
Destination request
  -> source discovery
  -> candidate place extraction
  -> geocoding
  -> category and tag normalization
  -> Wikimedia/Wikidata/OpenStreetMap visual grounding
  -> cluster generation
  -> cost and duration estimation
  -> weather/crowd/fatigue inference
  -> embedding text generation
  -> schema validation
  -> human review queue
  -> publish to place intelligence store
```

Recommended sources:

- OpenStreetMap/Overpass for coordinates, POI types, spatial density.
- Wikimedia/Wikidata for canonical visuals and landmark metadata.
- Google Places or Foursquare later for ratings, opening hours, price level, popularity.
- Weather APIs for seasonality and day-level disruption handling.
- Internal user feedback for actual quality, skip rates, edits, and group satisfaction.

## Retrieval Layer

Retrieval should be hybrid:

- Exact destination match using destination and aliases.
- Semantic tag match using interests, trip type, and natural language query.
- Fuzzy matching for typos and casual user input.
- Synonym expansion for travel language such as `cafes`, `heritage`, `beaches`, `romantic`, `low energy`.
- Vector retrieval over `embedding.embeddingText` once embeddings are connected.
- Geo retrieval for nearby alternatives during partial regeneration.

Current mock behavior approximates this with token expansion and deterministic semantic scoring. Final production behavior should use a vector database plus lexical filters.

## Ranking Layer

Candidate ranking should combine multiple weighted signals:

```text
finalScore =
  semanticFit
  + travelerPreferenceFit
  + groupConsensusFit
  + budgetFit
  + timeWindowFit
  + weatherFit
  + routeContinuityFit
  + qualitySignals
  + diversityBonus
  - fatiguePenalty
  - backtrackingPenalty
  - duplicateExperiencePenalty
```

The important product principle: ranking should not only pick famous places. It should pick the right mix for the user's trip, group, energy, time, and budget.

## Optimization Layer

The optimizer is the difference between WayFinder and a list generator.

It should:

- Build days around morning, afternoon, evening, and optional late-night slots.
- Avoid impossible same-day jumps.
- Respect max daily fatigue.
- Respect opening hours and booking constraints when available.
- Prefer compact locality clusters.
- Include recovery stops, food breaks, and flexible buffers.
- Avoid repeating the same experience type too often.
- Account for weather and indoor fallback needs.
- Produce explainable sequencing decisions.

Current implementation already prevents impossible travel hops and schedules only feasible same-day activity flows.

## Itinerary JSON Contract

The AI output should be a strict product contract:

- Destination summary.
- Trip input and interpreted preferences.
- Day-by-day plan.
- Activities with title, description, place ID, time, slot, duration, coordinates, budget, source, tags, and image fields.
- Reliability object explaining confidence, fallback use, and retrieval coverage.
- Validation object with warnings and errors.
- Evaluation object with metrics.
- Explanation blocks for why each activity was chosen.

This gives the frontend, backend, and model layer a stable shared surface.

## Validation And Reliability

Every generated itinerary should pass validation before being shown as a confident result.

Validation should check:

- Required fields exist.
- Day count matches request.
- Activity times are chronological.
- Duplicate place IDs are avoided.
- Travel time is reasonable.
- Fatigue is not extreme.
- Best-time mismatches are warned.
- Visual grounding exists.
- Retrieval saw enough candidates.

Reliability scoring should tell the product when to say "confident plan" versus "draft plan that needs review."

## Collaboration Brain

To beat Wanderlog, collaboration cannot just be shared editing. It should be decision intelligence.

Planned group flow:

```text
Members add preferences
  -> preference vectors per traveler
  -> conflict detection
  -> consensus scoring
  -> proposal generation
  -> voting
  -> accepted changes
  -> partial regeneration
  -> itinerary diff explanation
```

The system should understand:

- Who prefers food, nightlife, heritage, nature, comfort, budget, pace.
- Which plan choices satisfy the group overall.
- Where conflicts exist.
- What changed between proposal versions.
- Which locked activities must be preserved.

## Partial Regeneration

Users should be able to edit plans without losing the whole itinerary.

Supported and planned operations:

- Replace one activity.
- Regenerate one day.
- Apply budget change.
- Handle weather disruption.
- Handle opening-hours conflict.
- Add travel delay.
- Preserve locked activities.
- Compare before/after proposal diffs.

This is critical because real trip planning is iterative. Static generation is not enough.

## Model Strategy

The recommended model stack:

- Small deterministic rules for validation, time math, route feasibility, and schema enforcement.
- Embedding model for semantic retrieval over place intelligence.
- Reranker model for final candidate ordering when enough data exists.
- LLM planner for narrative reasoning, explanations, and complex tradeoffs.
- Lightweight preference model for user memory and group consensus.
- Feedback model for learning from accepts, rejects, edits, skips, and votes.

The model should not be allowed to invent ungrounded places. It should plan only from retrieved, source-backed candidates unless clearly marked as exploratory.

## Production Architecture

```text
Frontend
  -> trip intent form, dashboard, itinerary editor, proposals, voting

API Gateway
  -> auth, group access, trip lifecycle, request shaping

AI Planning Service
  -> preference extraction
  -> retrieval
  -> ranking
  -> optimization
  -> validation
  -> explanation
  -> partial regeneration

Data Services
  -> place intelligence store
  -> vector index
  -> trip database
  -> user preference memory
  -> proposal/vote store
  -> telemetry and feedback events

External Services
  -> maps/geocoding
  -> weather
  -> places metadata
  -> images/source metadata
  -> booking/deep links later
```

## Recommended Storage

- MongoDB/Postgres for trips, groups, proposals, votes, users, and saved itineraries.
- Postgres + pgvector, Pinecone, Weaviate, or Qdrant for vector search.
- Object storage/CDN for approved image mirrors if licensing and caching policy allow.
- Event table for model feedback: `shown`, `accepted`, `rejected`, `replaced`, `locked`, `voted_up`, `voted_down`, `completed`.

## Feedback Learning Loop

```text
User action
  -> event capture
  -> preference update
  -> place quality update
  -> reranking calibration
  -> evaluation report
  -> seed improvement tasks
```

Signals to learn from:

- Places users keep or lock.
- Places users remove.
- Activities that receive votes.
- Plan versions accepted by groups.
- Fatigue complaints.
- Budget corrections.
- Image/reporting corrections.
- Destination search demand.

## Evaluation Gates

Before a destination seed or model version is trusted, it should pass:

- Seed schema audit.
- Destination coverage audit.
- Retrieval coverage audit.
- Visual grounding audit.
- Itinerary validation.
- Scenario evaluation.
- Regression tests for known destinations.
- Manual review of generated itinerary samples.

Current commands:

```bash
npm run audit:jaipur
npm run audit:destinations
npm run audit:adaptive
npm run evaluate
npm run build
```

## Roadmap To Final Version

Phase 1: Strong Mock Intelligence

- Maintain Jaipur as the deep benchmark.
- Expand top global destinations with structured seed data.
- Remove random visuals and use grounded assets only.
- Keep audits strict.

Phase 2: Real Retrieval Service

- Move place intelligence into a database.
- Generate embeddings for every place.
- Add vector search plus filters.
- Keep deterministic validation outside the LLM.

Phase 3: AI Planner Service

- Wrap retrieval, ranking, optimization, validation, and explanation behind an API.
- Add model prompts only after candidate grounding.
- Add confidence and fallback reporting.

Phase 4: Group Intelligence

- Build traveler preference profiles.
- Add consensus scoring.
- Add proposal diffs and voting.
- Add partial regeneration for accepted changes.

Phase 5: Continuous Learning

- Capture user actions.
- Tune ranking weights.
- Improve destination seeds from real usage.
- Add quality dashboards for model drift, bad images, weak retrieval, and validation warnings.

## Non-Negotiable Product Rules

- Never show random unrelated images.
- Never silently invent unsupported places.
- Never produce impossible routes without warning.
- Always preserve locked user choices during regeneration.
- Always expose why a recommendation was chosen.
- Always keep a validation and confidence layer between AI output and user trust.

