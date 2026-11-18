---
name: react-dashboard-architect
description: Use when designing, implementing or reviewing the React + TypeScript frontend (react-app/) — dashboards, KPIs, charts, tables, forms, modals, selects, date pickers, toasts or data fetching. Enforces Shadcn UI, Tremor/Recharts, TanStack Table/Query and Clean Architecture; forbids hand-built UI primitives.
---

# React Dashboard Architect

Rules for the React migration of pmo-front. The React app lives in `react-app/`.

## Golden rule: never reinvent the wheel

Never build these from scratch. Always use the listed library:

| Need | Use |
|---|---|
| Buttons, inputs, dialogs/modals, sheets, popovers, tabs, cards, badges, tooltips, progress bars, skeletons, alerts | **Shadcn UI** (`npx shadcn@latest add <component>`) |
| Selects / comboboxes with search | Shadcn `Select` or `Command` + `Popover` (combobox) |
| Date and date-range pickers | Shadcn `Calendar` (react-day-picker) + `Popover` |
| Toasts / notifications | Shadcn `Sonner` |
| Forms and validation | `react-hook-form` + `zod` + Shadcn `Form` |
| KPI cards, bar/line/area/donut charts | **Tremor** or Shadcn `Chart` (Recharts) |
| Data tables (sort, filter, paging, grouping) | **TanStack Table** + Shadcn `Table` |
| Server state, caching, retries, mutations | **TanStack Query** |
| Icons | `lucide-react` |
| Maps | `react-leaflet` |
| Excel import | `read-excel-file` (already used) |

A custom component is allowed only to **compose** library components into a feature view (for example `RecordsPreviewTable` built on TanStack Table). If something seems to need a hand-built primitive, stop and justify it in the PR.

## Architecture (Clean Architecture, unchanged)

```
react-app/src/
  domain/          pure TS: models, policies, calculators. No React, no fetch, no rxjs.
  application/     use cases + ports (interfaces). async/await, no React.
  infrastructure/  adapters implementing ports (fetch, Supabase, geolocation, storage).
  presentation/    React: pages, feature components, hooks, providers, routes.
  shared/ui/       generated Shadcn components (components.json → @/shared/ui).
```

- Dependencies point inward only: presentation → application → domain; infrastructure → application/domain.
- Ports return `Promise<T>`, never `Observable`. Progress streams use a callback (`onProgress`) or an `AsyncIterable`.
- Dependency injection: a single composition root (`presentation/providers/container.ts`) creates adapters and use cases, exposed through a React context. No singletons imported directly by components.
- Components never call `fetch` or adapters. They call custom hooks (`useTimeRecords`, `useSendAllRecords`) that wrap use cases with TanStack Query.

## Business rules that must not change

- Domain code from `src/domain/` is copied as-is. Business-rule specs must pass unchanged.
- Dates: America/Bogota (UTC-5). `fechaInicio` goes through `colombiaDateLabel` (anchored at 12:00 GMT-0500). Never derive the day from `new Date('YYYY-MM-DD')` in local time.
- Fábrica hours are stored on the date the user worked them and do not count against workday caps (`WorkdayHoursPolicy`).
- Sending: only one send in flight; ignore progress from stale runs; confirmed records leave drafts and `pmo_pending_time_records` immediately; progress is clamped to total / 100 %.

## UX checklist for every view

- Skeletons while loading (Shadcn `Skeleton`), empty state, error state with retry.
- Toasts for success/failure of mutations.
- Responsive down to 360 px; tables scroll horizontally inside their card, the page never does.
- Light and dark themes via Tailwind `dark:` + Shadcn CSS variables.
- Spanish UI copy, same wording as the Angular app.

## Verification

`npm run typecheck` (tsc --noEmit), `npm run lint`, `npm run test` (Vitest + React Testing Library), `npm run build` — all must be green.
