# Figma 1:1 baseline handoff

The first Figma pass is a migration of the accepted `f45c697` desktop pages,
not a redesign. Until the three original pages finish functional acceptance,
token and asset changes must not alter computed styles, layout, copy or
scientific color maps in production.

The editable Figma file has not been connected yet. Add its URL here after the
owner creates and shares a blank file:

```text
FIGMA_FILE_URL=
```

## Required file pages

- `00 Foundations`: exact CSS colors, typography, spacing, radius, shadows and
  separate scientific color-scale variables.
- `01 Components`: only components that are actually shared by the current
  pages—navigation, panels, form controls, status, metrics and file import.
- `02 Scientific Visualization`: axes, legends, color bars, hover/selection
  states and Canvas frames.
- `10 Ray Mode`, `11 Normal Mode`, `12 PE`: full 1440 × 900 desktop pages.
- `90 Archive`: the accepted website screenshots and superseded frames.

Use 1440 × 900 as the authoring frame and verify the same layout at 1280 px.
Do not create mobile frames in this phase. Curves, rays, axes, labels and
legends use fixed fixtures as editable vector layers. Large heatmaps may be
placed as fixed-data images, while their frames, axes, color bars and labels
remain editable.

Figma Variables are reviewed by a human and then written into the JSON files in
`packages/design-tokens`. CSS consumes their semantic variables through
`packages/design-tokens/src/tokens.css`.

Storybook is the acceptance surface for primitives and reusable patterns:

```bash
npm run storybook
npm run build-storybook
```

Brand colors and scientific chart scales are separate token groups. Scientific
color maps must not change as a side effect of a brand refresh. Figma-generated
business page code is not committed; route pages are composed from reviewed UI
components and feature-specific workflow code.

## Acceptance sequence

1. capture the accepted 1440 × 900 website pages with fixed fixtures;
2. place those captures in `90 Archive` and rebuild each page 1:1;
3. overlay the Figma frame and website capture to verify panel geometry and
   non-Canvas pixels;
4. promote exact CSS values into `00 Foundations` variables;
5. review real reusable components through Storybook;
6. approve the Figma baseline before making any visual change in code.

Code remains hand-written. Figma-generated business-page code is never
committed.

With a production preview listening on port 4174, capture the accepted desktop
pages with:

```bash
npm run figma:capture
```

Set `OOA_FIGMA_BASE_URL` when the preview uses another origin. The command
writes the 1440 × 900 and 1280 × 900 full-page references to
`docs/figma/baseline/`.
