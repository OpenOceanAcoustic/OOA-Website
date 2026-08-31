# Visual acceptance

The accepted desktop pages are captured at 1440 × 900 and 1280 × 900 under
`baseline/`. These images are repository-owned regression references; no
external design tool is required.

Start the production preview on port 4174, then run `npm run visual:capture` to
refresh them after an explicitly approved visual change. Numerical Canvas
fixtures are reviewed separately so a Field version change does not silently
approve a layout change.
