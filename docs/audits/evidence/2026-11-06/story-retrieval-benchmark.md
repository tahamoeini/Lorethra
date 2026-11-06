# Story retrieval ranking regression

- **Source:** `3a39ca4cacd2f4870effd32a325a8c076ce2aa48`
- **Branch:** `codex/lorethra-platform-refinement`
- **Date:** 2026-11-06
- **Runtime:** Windows, repository Python 3.13.14
- **Fixture:** [story_retrieval_bilingual.json](../../../../tests/fixtures/story_retrieval_bilingual.json)

## Method

The fixture contains three hand-authored queries: English, Persian (with Arabic/Persian letter variants), and mixed English/Persian. Each query has one designated relevant older turn and three later distractors containing most or all query terms. The distractors receive 28 repetitions of unrelated filler to exercise the old scorer's term-overlap ties and recency preference against long, noisy text.

The baseline reproduces the previous episode scorer's ranking terms: distinct query-term overlap plus narrative recency. The constant importance term is omitted because every candidate uses the same default and therefore cannot affect ranking. The new implementation uses deterministic BM25 (`k1 = 1.2`, `b = 0.75`) over the already eligible bilingual-normalized candidate set. The selector returns the top three episodes for Recall@3; the regression also inspects the highest selected score for Recall@1.

## Result

| Metric | Previous overlap + recency | BM25 |
|---|---:|---:|
| Recall@1 | 0/3 (0%) | 3/3 (100%) |
| Recall@3 | 1/3 (33.3%) | 3/3 (100%) |

The BM25 target ranked first in all three cases. The previous scorer favored newer distractors in the English and mixed-script cases; in the Persian case, one target remained inside its top three.

## Selector execution diagnostic

On a separate synthetic in-memory fixture of 1,000 turns and 500 accepted shared memories, 50 measured selector calls after five warm-ups produced episode-selector p50/p95/max of 9.274/10.040/10.466 ms and memory-selector p50/p95/max of 4.371/4.852/5.091 ms. The [raw summary](story-retrieval-stress.json) records the source, interpreter, procedure, and limits. These timings exclude SQLite, provider, full prompt assembly, and browser work; memory source-turn checks were not exercised, and no before-scorer timing was collected. They cannot establish end-to-end responsiveness or a BM25 speedup.

## Permission and regression coverage

BM25 receives candidates only after the existing review, actor-scope, source-turn revision, active-history, and narrative-time checks. The full repository Python suite passed **224 tests in 14.357 seconds** at the source SHA above. This includes the existing permission/time, historical retry, source-turn invalidation, and review-state retrieval tests.

Focused command:

```powershell
$env:PYTHONPATH = 'backend'
& '.venv\Scripts\python.exe' -m unittest discover -s tests\unit -p test_story_memory_retrieval.py -v
```

Full command:

```powershell
$env:PYTHONPATH = 'backend'
& '.venv\Scripts\python.exe' -m unittest discover -s tests\unit -v
```

## Limits

This is a deliberately small synthetic ranking regression, not evidence of broad retrieval quality or better story output. It does not represent real user queries, multiple relevant passages, spelling errors, Persian morphology, actor knowledge tasks, semantic retrieval, provider requests, or human judgment. It does not measure story-wide token use. The actor-claim compiler's serialized-character estimate remains separate from the full narrative prompt budget and is not a provider tokenizer. Expand this corpus and compare saved context manifests with actual outbound payloads before setting a general Recall@K or context-efficiency target.
