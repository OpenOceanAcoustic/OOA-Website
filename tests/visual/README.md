# Visual acceptance

The accepted desktop pages are captured at 1440 × 900 and 1280 × 900 under
`baseline/`. These images are repository-owned regression references; no
external design tool is required.

Run `npm run visual:test` on the pinned Linux Chromium environment to compare
the complete pages, including Canvas pixels, with zero differing pixels. Use
`npm run visual:update` only after an explicitly approved visual change; normal
test commands never overwrite the accepted images.
