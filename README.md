# Slop Score

Deterministic "reads-like-slop" scoring for copy.

Slop Score is not an AI detector. It reports why copy reads like slop: exact spans,
rule names, severity, plain-language reasons, and suggestions.

## M1 Scope

- `packages/rules`: data-first rule packs and schema.
- `packages/engine`: report types and deterministic scoring surface.
- `packages/extract`: prose extraction surface.
- `apps/web`: placeholder for the paste-box app.

The engine must run in CI without model keys or network access.

## Development

```sh
pnpm install
pnpm typecheck
pnpm lint
pnpm test
```
