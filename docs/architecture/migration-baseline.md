# Migration baseline

The React SPA preserves the three public entry URLs and separates their session
state and runtime lifecycle.

| URL | Runtime | Main workflows | Imported environment |
|---|---|---|---|
| `/` | Bellhop2D | field and eigenrays | Bellhop ENV companion set or shared JSON |
| `/normal-mode/` | Kraken | full/truncated modes and single-mode inspection | ENV + FLP or shared JSON |
| `/pe/` | RAM | one field or `nPade=1..10` sweep | RAM `.in` or shared JSON |

Automated baselines cover shared environment fixtures, runtime contracts, route
startup, original DOM/control contracts, package contents and production assets.
The production React routes mechanically convert the original `f45c697` body
nodes and attributes into React elements, then attach the accepted page
controllers. The redesigned Workbench is not used.

Known first-phase scope is Bellhop2D, Kraken and RAM only. The Bellhop2D npm
result includes horizontal and vertical complex velocity typed arrays used by
the original Ray velocity panels.
