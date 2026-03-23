# Reading Tree

Reading Tree is an agent skill that turns an article or chapter into a linked outline you can read alongside the original text.

I built it for close reading, especially philosophy chapters, long essays, and nonfiction. AI summaries are useful in many cases, but sometimes the source is good enough that I want to read it properly, not just get the gist. Those are exactly the cases where a summary can leave out the parts I would care about most.

Reading Tree keeps the original words in place. Every node links to the passage it covers, and every paragraph links back to the node that explains its role. Nodes are weighted by importance, so you can see at a glance which parts of the argument carry the most weight. It is closer to a very detailed table of contents than a summary.

<img src="docs/images/ui-demo.gif" alt="Reading Tree UI demo" width="720" />

(Desktop only for now.)

Jump to [Quick Start](#quick-start) if you want the fastest way to try it, or [Live Example](#live-example) if you want to see it first.

## Live Example

- [On Liberty, Chapter 1 demo](https://modelvoyager.github.io/ReadingTree/on-liberty-ch1-reading-tree/)

## Use

The skill folder in this repo is [reading-tree](reading-tree).

### Quick Start

The lowest-friction path is to upload two files directly to a chat:

- [reading-tree.zip](https://github.com/ModelVoyager/ReadingTree/releases/latest/download/reading-tree.zip)
- your source document, such as `article.txt`

If you prefer, you can zip the `reading-tree/` folder yourself instead.

Then ask something like:

```text
Use the reading-tree skill in the uploaded zip to transform the uploaded article into a reading tree UI.
```

You will get a static site you can open locally, along with its `site/data/` folder.
The default template is not fully self-contained in the strict offline/privacy sense: when online, it requests Google Fonts for typography. If those requests are blocked, the browser falls back to local serif fonts and the UI still works.

This workflow has only been tested with GPT-5.4 Thinking in ChatGPT and Claude Opus 4.6 with extended thinking in Claude.ai. Newer models may also work, but that has not been verified. Output quality and reliability are not guaranteed with other models or interfaces. In particular, the Gemini web UI is not a good fit for running this skill.

### Formal Skill Installation

#### Claude.ai customization

Claude.ai allows customization via skills. Open the skill settings and upload `reading-tree.zip`.

#### Codex, Claude Code, and other agent tools

Install `reading-tree` as a normal skill, either from the `reading-tree/` folder or from `reading-tree.zip`.

## What It Produces

For each text, the deliverable is a workspace containing:

- `splits.json`
- `tree.json`
- `site/data/source.js`
- `site/data/tree-data.js`
- a static interactive site in `site/`

The site keeps the full source text, a weighted outline tree, and bidirectional links between nodes and paragraphs.

## Good Fits

- essays with dense argument structure
- philosophy chapters
- nonfiction chapters
- long articles you want to read in order without getting lost

If you want an outline that helps you read the source instead of replacing it, this is the point of the skill.

## Build Note


I designed the interaction model and UX direction, then used AI to help build it out. I've spent a lot of time actually reading with it and tightening what felt off: bad paragraph splits, nonsense trees, unclear structure, reading comfort. The skill is shaped more by use than by a single prompt.


## Copyright Note

The MIT license covers this repository and its code/assets. It does not grant rights to any third-party source texts processed with the tool.
