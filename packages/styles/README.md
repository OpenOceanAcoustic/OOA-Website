# OOA CSS control library

This package is the visual source for controls shared by the accepted desktop
pages. It contains CSS interfaces, not model workflows or generated page code.

- `base.css` owns the application reset and fatal error presentation.
- `model-lab.css` owns the shared Normal Mode / PE page chrome, panels, form
  controls, status states, metrics and plot containers.
- Model-specific layout stays beside its feature in `apps/web`.

Add a selector here only after it is used by at least two page sections. Keep
scientific color scales stable unless a numerical-visualization change is
explicitly approved.
