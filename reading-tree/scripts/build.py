#!/usr/bin/env python3
"""
Build a reading-tree workspace.

Usage:
  python3 reading-tree/scripts/build.py output_workspaces/my-workspace --step source
"""
import argparse
import json
from pathlib import Path
import sys


REQUIRED_PAGE_KEYS = ("title", "subtitle", "desc", "footer")


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("workspace", nargs="?", default=".", help="workspace directory")
    parser.add_argument("--step", choices=("source", "tree", "all"), default="all")
    return parser.parse_args()


def read_lines(path):
    with path.open("r", encoding="utf-8") as f:
        return f.readlines()
def split_paragraphs(lines, split_points):
    paragraphs = []
    for i, start in enumerate(split_points):
        end = split_points[i + 1] if i + 1 < len(split_points) else len(lines) + 1
        chunk = "".join(lines[start - 1 : end - 1]).strip()
        if chunk:
            paragraphs.append(chunk)
    return paragraphs


def build_source_js(paragraphs):
    entries = []
    for i, p in enumerate(paragraphs):
        entries.append(f"  // {i}\n  {json.dumps(p, ensure_ascii=False)}")
    return "globalThis.LINKED_READING_SOURCE = [\n" + ",\n".join(entries) + "\n];\n"


def build_tree_data_js(tree_cfg):
    tree_str = json.dumps(tree_cfg["tree"], ensure_ascii=False, indent=2)
    page = tree_cfg["page"]
    lines = [f"globalThis.LINKED_READING_TREE_DATA = {tree_str};\n"]
    for key in REQUIRED_PAGE_KEYS:
        val = page[key]
        const_name = "LINKED_READING_PAGE_" + key.upper()
        lines.append(
            f"globalThis[{json.dumps(const_name, ensure_ascii=False)}] = {json.dumps(val, ensure_ascii=False)};"
        )
    return "\n".join(lines) + "\n"


def load_json(path):
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def resolve_workspace_file(workspace, file_name):
    path = Path(file_name)
    candidate = path if path.is_absolute() else workspace / path
    resolved = candidate.resolve()
    if not resolved.is_relative_to(workspace):
        raise ValueError(f"workspace file '{file_name}' resolves outside {workspace}")
    return resolved


def main():
    try:
        args = parse_args()
        workspace = Path(args.workspace).resolve()
        data_dir = workspace / "site" / "data"
        data_dir.mkdir(parents=True, exist_ok=True)

        splits_cfg = load_json(workspace / "splits.json")
        lines = read_lines(resolve_workspace_file(workspace, splits_cfg["source_file"]))
        paragraphs = split_paragraphs(lines, splits_cfg["splits"])

        if args.step in ("source", "all"):
            source_js = build_source_js(paragraphs)
            with (data_dir / "source.js").open("w", encoding="utf-8") as f:
                f.write(source_js)
            print(f"✓ site/data/source.js ({len(paragraphs)} paragraphs)")

        if args.step in ("tree", "all"):
            tree_cfg = load_json(workspace / "tree.json")
            tree_data_js = build_tree_data_js(tree_cfg)
            with (data_dir / "tree-data.js").open("w", encoding="utf-8") as f:
                f.write(tree_data_js)
            print("✓ site/data/tree-data.js")
    except (FileNotFoundError, ValueError, KeyError, json.JSONDecodeError) as exc:
        print(f"Build failed: {exc}", file=sys.stderr)
        raise SystemExit(1) from exc


if __name__ == "__main__":
    main()
