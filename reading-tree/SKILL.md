---
name: reading-tree
description: Turn an article or book chapter into an order-preserving interactive outline tree with bidirectional links between tree nodes and full-text paragraphs. Use when the user wants a detailed reading structure, not a standalone summary.
---

# Reading Tree

Use this skill when the user wants to transform an article or chapter into a linked reading interface:

- The tree must preserve the source order.
- Clicking a node must jump to and highlight the covered source paragraphs.
- Clicking a source paragraph must jump back to the best matching node.
- The result must stay suitable for full reading, not just skimming.

## Outcome

Produce a workspace that can build:

- `site/data/source.js`
- `site/data/tree-data.js`
- a static interactive site in `site/`

Shared tooling lives in `scripts/`.
For online tools such as ChatGPT or Claude.ai that cannot serve the generated UI directly, provide the packaged `site/` folder and tell the user to open `site/index.html` in a browser.
The default site template opens locally, but it is not fully self-contained in the strict offline/privacy sense: when online, it requests Google Fonts for typography. If those requests are blocked, the browser falls back to local serif fonts and the UI still works.

The reusable workspace scaffold lives in `assets/workspace-template/`.

## Workflow

1. Copy `assets/workspace-template/` into a fresh workspace.
2. Save the source text as `article.txt`, preserving the original paragraph boundaries by default. Prefer one source paragraph per line. Only split one original paragraph into multiple lines when it is very long or contains an obvious internal semantic shift.
3. Inspect `article.txt` with real line numbers from the terminal, for example `nl -ba article.txt`.
4. For long files, inspect windows such as `sed -n '120,180p' article.txt | nl -ba -v120` instead of counting lines in model context.
5. Create `splits.json` with semantic paragraph start lines only. If `article.txt` already uses one source paragraph per line, the split list will often start on every non-empty line.
6. Run `python3 reading-tree/scripts/build.py <workspace> --step source` and inspect `site/data/source.js`.
7. Create `tree.json` after the paragraph split is stable. Every node must declare a non-empty broad `role`.
8. Run a structure audit against `references/authoring.md`, especially `Breadth Control` and `Final Structure Check`.
9. Materialize that review as a markdown table before continuing. Use one row per non-leaf sibling group in tree order so grouping choices are explicit. Top-level nodes are mandatory rows.
10. Regroup until the structure audit table is clean. `6` is a ceiling, not a target for normal-length texts. For substantially longer texts, treat the breadth numbers as defaults rather than hard caps, but justify any exception in the audit table.
11. Prefer adding intermediate grouping nodes over coarsening paragraph splits when reducing breadth.
12. During structural iteration, run `python3 reading-tree/scripts/validate.py <workspace>` after each structural edit as cheap feedback.
13. Run a mandatory final label lint pass against `references/authoring.md`, especially the `Meaning Fidelity Check` and `Final Label Check` sections. Inspect every node label one by one in tree order.
14. Materialize that review as a markdown table before continuing. Use one row per label, and include both style columns and meaning-fidelity columns from `references/authoring.md`, plus the role columns for every row. Treat the table as the required reasoning scaffold, not as optional presentation.
15. Rewrite every weak or semantically overstated label before continuing. Update the table until every row passes. Do not continue if even one row still fails.
16. After the structure audit table and label audit table are both clean, run `python3 reading-tree/scripts/validate.py <workspace>` again as the required final validation pass.
17. Run `python3 reading-tree/scripts/build.py <workspace> --step all`.
18. To inspect or hand off the result, note that `site/index.html` can be opened directly in a browser, or `cd site/` and serve it with `python3 -m http.server 8000 --bind 127.0.0.1`. For online tools such as ChatGPT or Claude.ai that cannot serve the UI themselves, provide the packaged `site/` folder and instruct the user to open `site/index.html`. Also mention that the default template requests Google Fonts when online; if those requests are blocked, the browser falls back to local serif fonts.
19. If serving locally, tell the user to open `http://127.0.0.1:8000/` in a browser. Only launch a browser from the agent if the user explicitly asks for that.

## Non-Negotiable Rules

- Preserve the original narrative order in every sibling list.
- Do not repeat source text in assistant output after it is saved to `article.txt`.
- Keep per-article edits limited to `article.txt`, `splits.json`, and `tree.json` unless the user explicitly asks for a site template change.
- Preserve the source paragraphing in `article.txt` unless a paragraph is so long, or so internally split in function, that one line would make linking or reading clumsy.
- Do not subdivide source paragraphs just to make the tree cleaner or to avoid adding intermediate grouping nodes.
- Take split line numbers from a numbered file view such as `nl -ba article.txt`, not by mentally counting lines from model context.
- If a leaf node is still too long after it covers a single paragraph, go back and refine `splits.json`.
- Inspect `site/data/source.js` after splitting. `scripts/validate.py` checks structure, but it will not catch a semantically wrong off-by-one split if the ranges remain self-consistent.
- Treat overloaded breadth as unfinished structure. If the root has more than `6` children, or any sibling group has more than `6`, regroup before build unless there is a strong reason not to.
- Treat `3–5` top-level nodes as the preferred target. `6` is a ceiling, not a success condition.
- For substantially longer texts, treat the breadth numbers as defaults, not hard caps, and explain any justified exception in the structure audit table.
- Reduce breadth by adding intermediate grouping nodes before you consider coarsening paragraph splits.
- A structure review is not complete until the model has produced a structure audit table and resolved every flagged row.
- The structure audit table must record grouping and breadth checks for every non-leaf sibling group.
- Run `scripts/validate.py` after every structural edit for cheap feedback, and run it again after the structure audit table and final label audit table are clean as the required final validation pass.
- Every node must declare a non-empty broad `role`.
- Treat the final label lint pass as a hard gate, not a suggestion.
- Do not treat `scripts/validate.py` or any future automated lint as a substitute for the label audit table. The model must still inspect every label one by one and record the judgement explicitly.
- The final label lint pass is not complete until the model has produced a label audit table with one row per label and one column per condition.
- The label audit table must also record the role checks for each row. Do not move that review into a separate role-only table unless the user asks for it.
- If the response omits the per-label table, the label review has not been done.
- A tree is not complete if even one label still uses weak pronoun-led openings or filler scaffolding such as `He ...`, `It ...`, `This ...`, `There is ...`, or `The author says ...`.
- A tree is not complete if even one label is stronger, sharper, or more accusatory than its covered source paragraphs justify.
- A tree is not complete if a parent label states a shared property that is not actually true of every child under it.
- If the delivery surface cannot serve the generated UI directly, do not pretend it can. Hand off the packaged `site/` folder and instruct the user to open `site/index.html` locally.

## Read These References

- `references/schema.md` for the file formats and validation constraints.
- `references/authoring.md` for splitting, naming, weighting, and structure rules.
- `references/ui-contract.md` for the required linked-reading interaction model.
