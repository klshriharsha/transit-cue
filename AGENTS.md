<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
# Keep the README current

The root `README.md` documents what this project is, the tools/tech stack it uses, and how to  
run it locally for development. Whenever a change affects any of those, update `README.md` in  
the same change. In particular:

- adding, removing, or upgrading a dependency, tool, or service
- changing the local setup or development workflow
- adding, renaming, or removing `package.json` scripts
- adding, renaming, or removing required environment variables

# Frontend code conventions

Apply these when writing or modifying React/Next.js UI code in this repo:

- **Keep page files thin.** `app/**/page.tsx` files should compose components and wire up
  top-level state, not contain the full UI. Extract distinct UI sections (headers, forms, lists,
  cards, toasts, modals, etc.) into their own components under `components/`, each taking
  explicit props rather than reaching into shared state or hooks directly.
- **Separate concerns by directory.** Pure, framework-agnostic logic (formatting, date math,
  label/derivation helpers) belongs in `lib/`. Stateful React logic reusable across components
  belongs in `hooks/`. Presentational or composed UI belongs in `components/`.
- **Avoid `useEffect` for state that can be derived or set during render.** Don't reach for
  `setState` inside a `useEffect` to initialize or adjust state in response to something already
  known during render (e.g. a prop change, a "have we mounted" flag). Prefer computing the value
  directly, a lazy `useState` initializer, or the React-endorsed pattern of calling `setState`
  conditionally in the render body (guarded so it fires at most once) instead. Reserve
  `useEffect` for actually synchronizing with something outside React — subscriptions, DOM APIs,
  network calls, timers.
- **Single source of truth for shared types.** Before declaring a type (e.g. a domain model
  shared between a hook, a component, and an API route), check `lib/types.ts` and existing
  hooks/components first, and import the existing type rather than redeclaring an equivalent one
  locally.
- **Prefer canonical Tailwind classes over arbitrary values.** Before writing an arbitrary-value
  class like `p-[16px]` or `w-[38px]`, check whether an existing utility produces identical CSS —
  a named scale class (`text-lg`, `rounded-xs`, …) or, since this project is on Tailwind v4, the
  dynamic numeric spacing utilities (e.g. `w-9.5` for 38px). Reserve bracket syntax for values
  with no canonical equivalent (odd/half-pixel values, compound shorthands like
  `flex-[1_1_360px]`, raw multi-part CSS like a custom `shadow-[...]`). When a two-value CSS
  shorthand such as `padding: Apx Bpx` is needed, prefer separate `px-*`/`py-*` utilities over one
  combined arbitrary value.

