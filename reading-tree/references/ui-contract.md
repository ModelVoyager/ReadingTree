# UI Contract

The provided `site/` files implement this contract. Keep it unless the user explicitly requests a redesign.

## Reading Model

- The tree is a navigation layer for reading the original text.
- The right pane always shows the full source text.
- The tree must not replace the source text with summary-only cards.

## Bidirectional Linking

- Clicking a node selects it, highlights its paragraph range, and scrolls the reading pane to the start of that range.
- Clicking a source paragraph selects the best matching node.
- Paragraph-to-node mapping prefers the deepest covering node, then the smallest covering range.

## Interaction Requirements

- Sticky, scrollable tooltip on node hover
- Show each node's `roles` in the hover tooltip and the detail panel
- Provide a global search bar where text and outline labels use JavaScript regex, while roles stay plain
- Search uses `AND` by default across clauses, with explicit uppercase `OR` for alternatives
- `A/W/S/D` keyboard navigation
- drag-to-pan tree canvas
- zoom in, zoom out, reset, and `Ctrl` or `Cmd` plus wheel
- visible selected node state
- visible search-hit state that is distinct from the selected node state
- visible weight gradient through size, border, and color
- global weight should set overall prominence, while sibling-local contrast should still make differences inside the same branch legible

## Layout Requirements

- left: horizontal tree
- right: full reading pane
- warm reading theme
- stable node widths
- connector rails aligned to node centers
