Let me look at their TypeScript repos to see what's actually available and open source.OK, I've got a solid picture now. Here's the honest assessment:

## The Short Answer

Most of LlamaIndex's ecosystem is **not a good fit for LLAAB**. Their value proposition is being a full framework that owns your pipeline end-to-end — ingestion, indexing, retrieval, agents. You've already built your own pipeline with explicit architectural opinions (control layer governs everything, Zod schemas as system contracts, vault as truth store). Adopting LlamaIndex's framework would mean either replacing your control layer or awkwardly wrapping theirs, which defeats the purpose.

That said, there are **two specific standalone tools** worth knowing about:

## Actually Worth Using

**`@llamaindex/liteparse`** — This one is genuinely interesting for LLAAB. It's a TypeScript-native, local-first document parser for PDFs, Office docs, and images, with zero Python dependencies. It uses PDF.js for text extraction and Tesseract.js for OCR, runs entirely locally, and ships as both a CLI and a library. The key differentiator is its spatial parsing approach — instead of converting to markdown (which breaks on multi-column layouts and tables), it projects text onto a spatial grid preserving the original layout.

This would slot directly into `@llaab/ingestion` as a new source type alongside your YouTube fetcher. Right now your ingestion pipeline is YouTube-only. When you eventually want to ingest PDFs, articles, or research papers, LiteParse gives you the "fetch → clean text" stage without you having to build PDF parsing from scratch. It's Apache 2.0, standalone (`pnpm add @llamaindex/liteparse`), and has no dependency on the rest of LlamaIndex. It aligns perfectly with your local-first philosophy.

**Not urgent** — you don't need it until you add PDF/document ingestion as a source type. But it's the kind of thing worth bookmarking in the backlog.

## Worth Reading the Source Code (But Not Installing)

✅ **`SentenceSplitter` from `@llamaindex/core`** — Their sentence splitter can be used as a standalone module for splitting raw text, with configurable chunk size and overlap. It's defined in `packages/core/src/node-parser/sentence-splitter.ts` and the implementation is instructive. However, pulling in `@llamaindex/core` or even the full `llamaindex` package just for a text splitter brings a huge transitive dependency tree. You're better off reading their chunking logic and writing a focused `chunkText()` in `@llaab/llm` that does exactly what you need — token-aware splitting with overlap, using `js-tiktoken` for counting. It's maybe 80 lines of code and you avoid a framework dependency.

**Their `IngestionPipeline` concept** — the idea of composable transform steps (read → parse → split → embed → store) is well-designed and mirrors what your `ingestion` package already does. Worth reading `packages/core/src/ingestion/` in their repo for pattern validation, but you don't need their implementation.

✅ **`PDF-VIEWER`**
https://github.com/run-llama/pdf-viewer

The source file is in their monorepo. Based on the API docs, it's at:
https://github.com/run-llama/LlamaIndexTS/blob/main/packages/core/src/node-parser/sentence-splitter.ts
Let me verify that's the right path:Searched the webSearched the webHere are the two URLs you'll want:
TypeScript version (the one relevant to your stack — lives in @llamaindex/core):
https://ts.llamaindex.ai/docs/api/classes/SentenceSplitter
That's the API reference.

The actual source file in the LlamaIndexTS monorepo is at `packages/core/src/node-parser/sentence-splitter.ts` but GitHub's org page blocks direct fetching. You can browse it from the repo root at https://github.com/run-llama/LlamaIndexTS and navigate to that path.
Python version (more mature, more instructive to read for the algorithm):
https://github.com/run-llama/llama_index/blob/main/llama-index-core/llama_index/core/node_parser/text/sentence.py

The Python source is honestly the better one to study for the chunking algorithm — it's more readable and the logic is the same. The TS version is a port of it.

## TL;DR

Bookmark `@llamaindex/liteparse` for when you add PDF ingestion. Read their `SentenceSplitter` source for chunking inspiration but don't install it. Everything else either duplicates what you've built or pulls you toward framework lock-in that conflicts with your control-layer-is-the-system philosophy.
