# @sumalpha/api-client

Typed API client helpers for the BFF surface.

`pnpm generate:bff` generates the OpenAPI path/component types and the exported
`bffZodSchemas` registry from `bff/openapi/quantos-bff.v1.yaml`. Generated files
must not be edited directly; `pnpm check:bff-generated` fails on drift.
