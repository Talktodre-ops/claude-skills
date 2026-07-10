# Clean Code — Go

Idioms that keep Go readable and correct. Assumes `gofmt`/`goimports` + `golangci-lint` always on.

## Errors
- Return `error` as the last value; check every one.
- Wrap with context: `fmt.Errorf("load market %d: %w", id, err)`. Messages lowercase, no trailing punctuation, skip "failed to" noise.
- Use sentinel/typed errors with `errors.Is` / `errors.As`, not string matching.
- Don't `panic` in libraries; reserve it for truly unrecoverable programmer errors.

## Types & interfaces
- Accept interfaces, return concrete types.
- Keep interfaces small (1–3 methods) and define them where they're *consumed*, not where implemented.
- Make the zero value useful; avoid constructors that only set defaults.
- Avoid `any`/`interface{}`; reach for generics only when they remove real duplication.
- Don't over-pointer — pass small structs by value.

## Concurrency
- "Share memory by communicating." Prefer a single goroutine owning the data (one writer per resource) over locks sprinkled everywhere.
- The sender closes channels, never the receiver.
- Pass `context.Context` as the first parameter for request-scoped work; never store it in a struct.
- Always test concurrent code with `-race`.

## Style
- No naked returns except in very short functions; name return values only when they aid documentation.
- `defer` cleanup close to acquisition.
- Package names: short, lowercase, singular, no `util`/`common` grab-bags.
- Table-driven tests with `t.Run` subtests; use `testify` assertions sparingly; property tests via `rapid`.
- Keep `main` thin; put logic in packages that are easy to test in isolation.
