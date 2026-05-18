# Mock AI Pipeline

This folder is a local, dependency-free AI systems sandbox for the WayFinder recommendation pipeline.

It is designed to be:

- a reusable intelligence prototype
- a recommendation experimentation layer
- a retrieval and ranking evaluation environment
- a future backend service module starting point

It turns a simple trip request into a grounded itinerary by running:

```text
user input
  -> preference extraction
  -> semantic retrieval and fuzzy matching
  -> candidate ranking
  -> optimization
  -> validation
  -> explanation generation
  -> reliability and evaluation metrics
  -> structured JSON output
```

## Run

From the repo root:

```bash
node mock_ai_pipeline/runMockPipeline.js
```

Named demos:

```bash
node mock_ai_pipeline/runMockPipeline.js jaipur
node mock_ai_pipeline/runMockPipeline.js jaipur_fuzzy
node mock_ai_pipeline/runMockPipeline.js goa
node mock_ai_pipeline/runMockPipeline.js manali
```

Run all sample scenarios as an evaluation pass:

```bash
node mock_ai_pipeline/runEvaluation.js
```

Audit the curated Jaipur place-intelligence seed:

```bash
node mock_ai_pipeline/runJaipurSeedAudit.js
```

Run partial regeneration scenarios:

```bash
node mock_ai_pipeline/runPartialRegenerationScenarios.js
```

Default demo input:

```json
{
  "destination": "Jaipur",
  "days": 3,
  "budget": "balanced",
  "interests": ["heritage", "food"]
}
```

You can also pass JSON:

```bash
node mock_ai_pipeline/runMockPipeline.js "{\"destination\":\"Goa\",\"days\":2,\"budget\":\"cheapest\",\"interests\":[\"beaches\",\"food\"]}"
```

## Why This Exists

The goal is to test WayFinder's decision logic before heavy implementation:

- Does retrieval return useful candidates?
- Do scores match the intended product behavior?
- Does sequencing avoid obvious itinerary mistakes?
- Does the final JSON match the product schema?
- Do validation errors reveal weak planning logic early?

## Current Capabilities

- Local semantic retrieval using token expansion and synonym matching
- Fuzzy matching for imperfect user interests such as `heriage` or `caffes`
- Weighted ranking by semantic fit, preference match, budget, distance, time, diversity, quality, and weather
- Simple sequencing into morning, afternoon, and evening slots
- Validation for duplicate places, missing fields, timing order, high travel, high fatigue, and best-time mismatch
- Explanation generation for retrieval, ranking, optimization, validation, and activity selection
- Evaluation metrics including retrieval coverage, average semantic score, top-candidate utilization, interest coverage, diversity, validation warnings, and quality gate status
- Partial regeneration for activity replacement, day regeneration, budget changes, weather disruption, opening-hours conflicts, travel delays, and locked activity preservation
- Jaipur seed dataset with 100+ rich place-intelligence records: locality clusters, trip roles, vibe tags, fatigue scores, visit windows, weather suitability, curated nearby relationships, and persona evaluation scenarios

## Architecture Notes

- AI pipeline blueprint: `docs/WAYFINDER_AI_PIPELINE_DOCUMENTATION.md`
- Partial regeneration architecture: `mock_ai_pipeline/PARTIAL_REGENERATION_ARCHITECTURE.md`
- Jaipur seed data: `mock_ai_pipeline/data/jaipurPlaceIntelligence.js`
- Jaipur evaluation personas: `mock_ai_pipeline/data/jaipurEvaluationPersonas.js`
