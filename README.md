# soksak-browser-kit

Shared browser-shell logic and the `BrowserDriver` contract for soksak's browser
plugins. The three browsers (`soksak-plugin-browser-native`,
`soksak-plugin-browser-chromium`, `soksak-plugin-browser-chromium-offscreen`)
drive different backends but present the same browser chrome; this package is
the single source for the parts that must not drift.

## What lives here

| module | what |
|---|---|
| `driver` | `BrowserDriver` — the backend contract a plugin implements (navigate / back / forward / reload / stop / bounds / hidden / focus / close + nav / title / loading / cursor / popup-url events), aligned with `soksak-sidecar-browser-spec` |
| `url` | `normalizeUrl` — address-bar input to a loadable URL |
| `nav-state` | loading / canBack / canForward → toolbar rendering decisions (reload↔stop toggle, progress bar, back/forward enablement) |
| `lifecycle` | reload-surviving lifetime: re-attach map (viewId→id, page state survives plugin reloads), created ledger (removed only on a confirmed close), debounced close (a remount cancels it), and the pure `reclaimTargets` reconcile decision |
| `input-forward` | DOM events → engine input messages for offscreen hosting (mouse / wheel / key / Korean IME, including WKWebView's non-standard composition path — WebKit bug 274700) |

Framework-free: React views (native / chromium) and vanilla views (offscreen)
consume the same decisions.

## Using from a plugin

```json
"devDependencies": { "soksak-browser-kit": "github:soksak-ai/soksak-browser-kit" }
```

```ts
import { normalizeUrl, renderNavState, createLifecycle, forwardInput } from "soksak-browser-kit";
```

Plugins bundle with esbuild; the kit ships TypeScript sources and is bundled
into each plugin's single-file `main.js` at build time.

## Tests

`npm test` — contract tests for every module (input forwarding includes both
IME paths: standard composition events and WKWebView's `input`-event variant).
