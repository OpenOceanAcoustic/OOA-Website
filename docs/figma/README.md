# Figma handoff

Figma work is intentionally deferred. Until the original desktop pages have
finished functional acceptance, token and asset changes must not alter their
computed styles, layout, copy or scientific color maps.

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

Recommended handoff sequence:

1. update or add semantic variables in Figma;
2. review naming, contrast and scientific-scale implications;
3. update token JSON and CSS variables;
4. review primitives and patterns in Storybook;
5. roll the accepted components into the three routes.
