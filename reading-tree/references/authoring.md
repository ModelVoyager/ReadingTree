# Authoring Rules

## Split First, Tree Second

Use a two-pass workflow.

1. Split the source into semantic paragraphs.
2. Lock the split.
3. Build the tree on paragraph indices.

This prevents range churn.

## Preparing `article.txt`

- `article.txt` is the normalized reading source for the workspace.
- Preserve the author's original paragraph boundaries by default.
- Prefer one source paragraph per line in `article.txt`.
- Only split one original paragraph into multiple lines when it is unusually long or contains an obvious internal semantic shift, such as a new claim, example block, or contrast.
- If a paragraph already reads as one coherent move, keep it intact even if it is somewhat dense.
- Do not subdivide paragraphs just to reduce tree breadth or to dodge adding intermediate grouping nodes.
- When you do subdivide, keep the chunks readable. Avoid sentence-by-sentence fragmentation unless the sentence itself is the semantic unit.

### What Counts As An Obvious Internal Split

Use a split inside one original paragraph only when the paragraph clearly contains separate navigable moves.

Good reasons to split:

- a principle statement followed by a distinct example block
- a setup move followed by a clear objection, concession, or reversal
- a long paragraph that shifts from framing the problem to listing consequences or cases
- explicit internal markers such as `But`, `However`, `Yet`, `On the other hand`, `Secondly`, or `Thirdly` when they introduce a genuinely new move

Good:

- `General rule stated. But the next half turns to the main objection.` -> split
- `Claim about mind. Then three concrete cases follow.` -> split if the cases form a distinct block
- `Dense paragraph, but all sentences develop one claim.` -> keep intact

Weak:

- `Paragraph feels long.` -> not enough by itself
- `Two adjacent sentences could each get a node.` -> not enough by itself
- `Splitting here would make the top level cleaner.` -> not a reason
- `Every sentence adds a nuance.` -> keep intact unless the function clearly changes

## Paragraph Splitting

- Split by semantic unit, not by accidental raw wrapping.
- A source paragraph should usually represent one claim, one example group, or one rhetorical move.
- After normalizing `article.txt`, keep `splits.json` aligned to those source-paragraph lines unless there is a clear reason not to.
- Get split line numbers from a numbered file view, not by counting lines from model context.
- Use `nl -ba article.txt` so blank lines are numbered too.
- For long files, inspect smaller windows such as `sed -n '120,180p' article.txt | nl -ba -v120`.
- After editing `splits.json`, run `python3 reading-tree/scripts/build.py <workspace> --step source` and inspect `site/data/source.js` before moving on to the tree.
- `reading-tree/scripts/validate.py` will catch broken ranges, but it will not catch a semantically wrong split if the line numbers are internally consistent.
- If a leaf node becomes visually or cognitively too long, refine `splits.json`.
- Prefer preserving an intact original paragraph over splitting it for cosmetic regularity.

## Node Naming

- Use short, role-expressive phrases.
- Optimize for fast comprehension, not polished sentence grammar.
- A label does not need to be a full grammatical sentence if the point is immediately clear.
- Root and top-level labels should usually stand on their own more than deep child labels.
- Child labels may be more elliptical when the parent already establishes the subject, frame, or contrast.
- Do not repeat inherited context in every child if the branch already makes it obvious.
- Avoid empty pronoun-led openings such as `He`, `She`, `It`, `This`, `These`, or `There is` when a more specific subject is available.
- Do not force author names into labels unless the person is itself part of the point.
- Avoid filler scaffolding such as `The author says`, `He explains`, or `There is a discussion of`.
- Prefer action, contrast, transition, or judgement words over topic nouns.
- Keep labels compact enough for cards, usually about `4–9` words.
- Match the language of the source text unless the user requests translation.
- A label is a compression of the covered source, not a rewrite that upgrades its claims.
- Do not make a label more certain, more accusatory, or more sweeping than the covered paragraphs support.
- Preserve distinctions the source itself is carefully making, such as recovery vs gain, example vs claim, or local case vs general principle.
- A parent label must be literally true of every child it groups. If one child only recovers while another benefits from harm, do not force both under a shared `benefits from harm` label.
- Prefer the author's argumentative function over your own verdict. If a paragraph is used to show domain dependence, do not relabel it as hypocrisy, double standards, or contradiction unless the source itself makes that charge.
- Preserve source modality. If the source says `may`, `seems`, `approaches`, `not fully`, or `cannot quite`, do not upgrade that to certainty.
- Avoid imported evaluative intensifiers such as `finally`, `completely`, `obviously`, `hypocrisy`, `stigma`, or `self-contradiction`, unless the covered text clearly carries that force. Apply the same rule to equivalent wording in the source language.

Good:

- `Appealing to laws only repeats the problem`
- `Habit creates expectation, not justification`
- `From data to the problem of inference`
- `Data stay narrow`
- `Sunrise as the test case`
- `Chicken shows habit can mislead`

Weak:

- `Laws`
- `Induction`
- `Transition`
- `He shifts from data to the problem of inference`
- `The author talks about induction`
- `Expectation in the case of habit and repeated pairings`

## Role Tags

Every node must declare `roles`. The UI and the audit workflow rely on complete role coverage.

- Prefer a small, reusable role set for the whole tree, usually about `2–4` roles.
- Start broad. In many trees, `claim`, `example`, `mechanism`, and `frame` are enough.
- Merge narrow rhetorical variants into a broader role unless the distinction is important in the UI.
- Prefer `claim` over niche labels such as `definition`, `distinction`, `warning`, or `implication` unless the project explicitly needs those distinctions.
- A role should be stable across articles, not invented ad hoc for one chapter.
- Because `roles` are required, keep the role set useful enough that search chips still help the reader.
- Role coverage must be complete. Do not leave spotty gaps.
- Fold role review into the same one-row-per-label audit table used for final label review. Do not create a separate role table unless the user explicitly asks for one.
- Each label-audit row must check both the label and the node's assigned roles.

Required role columns in the combined label audit table:

- `roles`
- `roles present`
- `roles fit node function`
- `roles stay broad`

Meaning-fidelity examples:

- Weak: `Both examples benefit from damage`
- Better: `One example recovers; the other gains`
- Weak: `The case exposes hypocrisy`
- Better: `The case shows domain dependence`
- Weak: `Stigma buried the evidence`
- Better: `The phenomenon was wrongly grouped with another doctrine`

## Meaning Fidelity Check

Before you finalize `tree.json`, run a meaning-fidelity pass in addition to the style-focused label lint.

Pass condition:

- zero labels make a stronger claim than the covered source supports
- zero parent labels apply a shared predicate that fails for one or more children
- zero labels replace the author's mechanism with the model's own rhetoric
- zero labels upgrade possibility, approximation, or partiality into certainty

Immediate rewrite triggers:

- a label adds a judgement word not grounded in the covered text
- a label merges adjacent examples under a predicate that is only true of some of them
- a label turns recovery, restoration, or survival into `benefit from harm`
- a label turns `may`, `seems`, `almost`, `not fully`, or similar modality into certainty

Required audit format:

- Materialize the review as a markdown table.
- Use one row per label, in tree order.
- Include columns that force a direct check against the covered source, not only against naming style.
- You may combine this table with the final label audit if the fidelity columns are still present.
- Keep the role columns in that same combined table.

Recommended extra columns:

- `not stronger than source`
- `fits full covered range`
- `modality preserved`
- `loaded wording avoided`
- `mechanism preserved`

## Final Label Check

Before you finalize `tree.json`, review every node label against this checklist.
This is a hard gate, not a polish pass.
Read the labels one by one in tree order and do not stop early.
Do not treat this as a mental skim. The audit table is required because some models otherwise skip the soft review.

Pass condition:

- zero labels begin with weak pronoun-led openings or filler scaffolding
- zero labels still feel like placeholder prose rather than scan-friendly cards

Immediate rewrite triggers:

- any label starting with `He`, `She`, `It`, `This`, `These`, or `There is`
- any label starting with `The author`, `The author says`, `He explains`, or similar scaffolding
- any label that only names a topic without the argumentative role

Required audit format:

- Materialize the review as a markdown table.
- Use one row per label, in tree order.
- Use one column per condition.
- Do not treat the audit as complete until every row is marked pass.
- The table is not just reporting format. It is the mechanism that forces the model to inspect each label explicitly.
- Even if an automated linter exists, still perform the row-by-row table review.

Recommended columns:

- `label`
- `fast`
- `compact`
- `no weak opening`
- `no scaffolding`
- `inherits context well`
- `argumentative content`
- `not stronger than source`
- `fits full covered range`
- `modality preserved`
- `loaded wording avoided`
- `roles`
- `roles present`
- `roles fit node function`
- `roles stay broad`
- `action needed`

Checklist:

- Can a reader get the point quickly without rereading?
- Is the label short enough for a card, usually about `4–9` words?
- If the label starts with `He`, `She`, `It`, `This`, `These`, or `There is`, can you replace it with a more specific phrase or cut the opening entirely?
- If the label starts with scaffolding such as `The author says`, `He explains`, or `There is a discussion of`, rewrite it.
- If the parent already establishes the subject or frame, can the child label be shorter?
- Is the label carrying real argumentative content rather than only a topic noun?
- Would a stronger verb, contrast, or judgement word make it clearer?
- Is the label still no stronger than the covered source paragraphs?
- For a parent label, is the shared claim literally true of every child in that group?
- Does the label preserve the source's mechanism, rather than substituting your own verdict or rhetoric?
- If the source is tentative, partial, or approximate, does the label preserve that modality?
- If the label feels like a sentence written for prose rather than a card written for scanning, compress it.

Quick fixes:

- `He shifts from data to the problem of inference` -> `From data to inference`
- `The author talks about induction` -> `Induction as the real problem`
- `There is a discussion of habit` -> `Habit creates expectation`

## Weighting

Weight represents semantic prominence, not just length.

Treat weight mainly as a chapter-wide or article-wide scale, not a score that only ranks a node inside its immediate sibling group.
In other words, ask how much semantic work this node does in the whole piece, then adjust that judgement to stay coherent within its branch.
Children should usually be less important than their parent, but a node's weight is not defined only relative to that parent.

Consider:

- coverage in the source
- argumentative centrality
- author emphasis
- structural position

Practical ranges:

- `0.85–1.00`: core theme
- `0.65–0.85`: major section or major turn
- `0.45–0.65`: standard supporting movement
- `0.25–0.45`: minor support or transition
- `0.15–0.25`: brief mention

## Breadth Control

Do not let the tree fan out too widely near the top.
For substantially longer texts, these are defaults, not hard caps.

- Depth 1 should usually aim for about `3–5` children.
- Any sibling group should usually aim for about `2–4` children.
- Depth 1 with `6` children is a ceiling case, not a target.
- Any sibling group with `5–6` children should trigger an explicit regrouping check.
- If a sibling group grows past `6`, treat that as a regrouping signal, not as a normal case.
- Top-level nodes should capture major argumentative turns, not every example, clause, or local support move.
- If a sibling group mixes examples, claims, transitions, or local support in a confusing way, add an intermediate node so the grouping logic is easier to scan.
- Prefer adding grouping nodes over coarsening paragraph splits just to reduce visible breadth.
- Passing the breadth cap does not by itself mean the structure is good.
- Every top-level node should justify itself as a major turn in the argument.
- If two adjacent top-level nodes feel like local steps inside the same major turn, group them.
- Examples, clauses, and narrow support moves should usually live below depth 1, not directly under the root.
- If you exceed the default breadth targets for a substantially longer text, justify that choice in the structure audit instead of pretending the defaults still fit cleanly.

Heuristic:

- too many depth-1 nodes -> compress into fewer major turns
- too many children under one parent -> insert intermediate grouping nodes
- mixed examples, claims, and local transitions under one parent -> split into cleaner sibling groups

## Final Structure Check

Before you accept the tree structure, run a structure audit.
This is not just a count check.

Required audit format:

- Materialize the review as a markdown table.
- Use one row per non-leaf sibling group, in tree order. Top-level nodes are mandatory rows, but the review is not complete until every non-leaf group has a row.
- You may include a `row type` column if you want to distinguish top-level major-turn rows from deeper sibling-group rows.
- Do not treat the audit as complete until every row has either passed or been rewritten.

Recommended columns:

- `path`
- `label`
- `range`
- `major turn?`
- `too specific?`
- `could merge with neighbor?`
- `grouping clear?`
- `sibling logic clear?`
- `breadth ok?`
- `action needed`

Pass condition:

- root children clearly read as major argumentative turns
- no top-level node exists only because the model stopped grouping too early
- no overloaded sibling group remains without a strong reason
- every non-leaf sibling group has clear grouping logic
- no singleton non-leaf group remains unless there is a strong structural reason to keep it

Immediate rewrite triggers:

- depth 1 has more than `6` children
- a sibling group has more than `6` children
- a top-level node is only an example, clause, or local support move
- two neighboring top-level nodes obviously belong inside the same larger turn

## Order Preservation

Sibling order must follow the source order exactly.
Never regroup the chapter into a cleaner abstract taxonomy if that breaks the reading sequence.
