# Upstream PR Record: pre-dispatch boundary validation

- Status: draft
- Genericity: reusable upstream
- QuantOS area: adapter context translator / allowlist boundary
- Proposed upstream area: request validation before tool or network dispatch

## Motivation

TP01 rejects forbidden tool, network, secret, and venue-adjacent fields before any execution begins. This reduces the chance that downstream integrations perform side effects before policy denies the request.

The generic improvement is:

- validate boundary-forbidden inputs before dispatch;
- produce deterministic permission-denied errors;
- add regression tests for disallowed fields.

## Proposed upstream contribution

1. move request-boundary validation to the earliest dispatch stage;
2. add tests for forbidden network / secret / venue style fields;
3. document validation ordering so adapters and UI clients can reason about failures.

## Notes

- this record is intentionally upstream-generic and excludes QuantOS-specific capability names;
- once an upstream PR or issue exists, replace this placeholder with the public reference.
