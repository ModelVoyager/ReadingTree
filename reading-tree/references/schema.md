# Schema

## Workspace Files

The reusable workspace contains:

- `article.txt`: the only source of original text; prefer one source paragraph per line, while preserving original paragraph boundaries unless a long paragraph is intentionally subdivided
- `splits.json`: paragraph start lines only
- `tree.json`: page metadata plus the outline tree
- `site/`: the self-contained static interactive site, including generated data modules

The skill also contains shared tooling in `reading-tree/scripts/`:

- `build.py`: generates `site/data/source.js` and `site/data/tree-data.js`
- `validate.py`: validates range coverage, parent-child consistency, roles, and weights

## `splits.json`

```json
{
  "source_file": "article.txt",
  "splits": [1, 4, 8, 12]
}
```

- `splits` is a 1-based list of paragraph start lines.
- Adjacent split points define one source paragraph.
- The generated paragraph indices are `SOURCE[0]`, `SOURCE[1]`, and so on.

## `tree.json`

```json
{
  "page": {
    "title": "Article Title",
    "subtitle": "OUTLINE TREE",
    "desc": "One-sentence reading description.",
    "footer": "One-sentence footer."
  },
  "tree": {
    "label": "Root node",
    "weight": 1.0,
    "range": [0, 9],
    "role": "claim",
    "children": []
  }
}
```

Node fields:

- `label`: required
- `weight`: required, `0` to `1`
- `range`: required, inclusive paragraph range `[start, end]`
- `role`: required short rhetorical category string used by the UI for node detail, tooltip, and role emphasis controls; prefer a small reusable set rather than many niche categories
- `children`: optional

## Validation Rules

`reading-tree/scripts/validate.py` enforces:

1. The root range covers every source paragraph.
2. Every child range is inside its parent range.
3. The union of child ranges fully covers the parent range.
4. Every source paragraph is covered by at least one leaf node.
5. A parent weight is not smaller than its strongest child weight.
6. Every node has a non-empty `role` string.
7. Nodes only use supported keys.

## Serving

After building, you can open `site/index.html` directly in a browser.

If you prefer a local server, serve `site/` with:

```bash
python3 -m http.server 8000 --bind 127.0.0.1
```

Then open `http://127.0.0.1:8000/`.
