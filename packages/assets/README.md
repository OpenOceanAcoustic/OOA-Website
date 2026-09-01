# OOA page asset library

Only shipped, reusable page resources belong here. Source files stay editable;
generated screenshots, WASM binaries and model data do not.

Each resource must be listed in `src/catalog.json` with its owner, purpose and
format. Page modules consume package exports instead of reaching into another
feature directory. Adding an asset must not silently replace the accepted CSS
brand mark or scientific rendering.
