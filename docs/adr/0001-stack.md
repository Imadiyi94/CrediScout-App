# ADR 0001 — Modular monolith (Next.js 15 + TypeScript)

Date: 2026-09-27 · Status: accepted

## Context
Single small team, local-first hosting, beginner-friendly ops. Alternatives: separate
frontend/backend repos, or a Python (Django/FastAPI) backend with an SPA.

## Decision
One Next.js App Router monolith in TypeScript: server components for screens,
route handlers for API, server actions for mutations, Prisma for data.

## Consequences
+ One repo, one deploy, shared types end-to-end.
+ Server actions keep mutations co-located with forms.
− Heavy background jobs or a second client would push us toward service extraction;
  the `packages/credit-engine` boundary keeps that path open.
