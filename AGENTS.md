# Kano Blog

Astro site. Use the checked-in package scripts and pnpm; dependency versions and scripts in `package.json` are authoritative.

## Development and Verification

- Start the background development server with `pnpm dev`; manage it with `pnpm dev:status`, `pnpm dev:logs`, and `pnpm dev:stop`.
- `pnpm check` runs Astro checks, lint, and formatting checks. `pnpm build` also builds the site and Pagefind index.
- `pnpm test` runs the configured Vitest coverage suite; `pnpm test:e2e` runs Playwright, and `pnpm test:e2e:full` builds first.
- Select checks for the affected behavior. For text-only instructions, check links and command accuracy; use browser evidence for visual or interaction changes. Report unavailable prerequisites accurately.

## Documentation

Use existing code and [Astro documentation](https://docs.astro.build) to resolve relevant API questions. Load only the needed guide for routing, components, content collections, styling, framework integrations, or internationalization.
