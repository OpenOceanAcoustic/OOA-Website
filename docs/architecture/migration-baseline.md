# Component migration baseline

The accepted visual and interaction authority is commit `f45c697`. The React
routes preserve its three public URLs, original section order, text, formulas,
control attributes and scientific Canvas behavior.

| URL | Feature Hook | Runtime | Native import |
|---|---|---|---|
| `/` | `useRayPage` | Bellhop2D | ENV plus SSP/BTY companions, or shared JSON |
| `/normal-mode/` | `useNormalModePage` | Kraken | same-stem ENV+FLP, or shared JSON |
| `/pe/` | `usePePage` | RAM | RAM `.in`, or shared JSON |

Normal Mode and PE have no page controller: React owns their parameter and
result state, while feature-local Canvas renderers receive typed data. Ray's
accepted theory, field, velocity and eigenray drawing system is isolated behind
its Feature Hook as a Canvas experience so the Route has the same lifecycle
seam without replacing the mature scientific drawing algorithms.

The second baseline is the tracked `wasm-package-lock.json`. It freezes the
three clean Field commits, npm metadata and every published Worker, declaration,
module and WASM hash. UI component work may change Website code but may not
change that lock or the active package bytes.

Automated acceptance includes six full-page desktop screenshots, DOM/control
contracts, real browser WASM execution, native file import and same-origin-only
network assertions. The supported first phase remains Bellhop2D, Kraken and RAM
only; there is no mobile layout target, backend compute, PWA, SSR or Figma flow.
