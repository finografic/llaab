# LLAAB — Architecture Decisions

Captured decisions during development. Each entry becomes a DecisionNode when the ingestion pipeline is ready.

---

## 001 — Monorepo with Turborepo + pnpm

- **Context**: Need multi-package structure with clean dependency boundaries
- **Decision**: Turborepo for task orchestration, pnpm workspaces for package management
- **Rationale**: Familiar tooling, fast builds, one-directional dependency flow
- **Date**: 2026-03-30
