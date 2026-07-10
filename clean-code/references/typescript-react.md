# Clean Code — TypeScript / React

## TypeScript
- `strict` on. Avoid `any` — use `unknown` and narrow. Avoid `as` assertions; prefer type guards.
- Model the domain with discriminated unions; make illegal states unrepresentable.
- `readonly` and `const` assertions where they help; prefer immutability.
- Exhaustive `switch` with a `never` fallthrough check.
- Types describe data; don't smuggle behavior into them.

## React
- Components are small and single-purpose; split when one does two jobs.
- **Derive, don't duplicate.** Compute from props/state during render instead of syncing copies in `useEffect`. An effect that only mirrors derived state is a smell.
- One source of truth per piece of state; lift state only as far as needed.
- Hooks rules: call at top level, keep dependency arrays honest, extract custom hooks for reuse.
- Keep data/network/state logic in hooks; keep components presentational where you can.
- Stable list `key`s — never the array index for dynamic lists.
- Memoize (`useMemo`/`useCallback`/`memo`) only when you've measured a need.
- Accessibility is not optional: semantic elements, labels, focus management.
- Route cross-cutting state through context/store, not deep prop drilling.

## State separation
If the stack splits server-cache state from client state (e.g. TanStack Query + Zustand/Redux), keep them in separate lanes — server data in the query cache, UI/live state in the store. Format money only at the display edge; keep integer minor units in state.
