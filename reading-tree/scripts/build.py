#!/usr/bin/env python3
"""
Build a reading-tree workspace.

Usage:
  python3 reading-tree/scripts/build.py output_workspaces/my-workspace --step source
"""
import argparse
import json
import re
import sys
import unicodedata
from pathlib import Path


REQUIRED_PAGE_KEYS = ("title", "subtitle", "desc", "footer")


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("workspace", nargs="?", default=".", help="workspace directory")
    parser.add_argument("--step", choices=("source", "tree", "all"), default="all")
    return parser.parse_args()


def collapse_ws(text):
    return re.sub(r"\s+", " ", str(text).strip())


def normalize_text(text):
    text = unicodedata.normalize("NFKC", str(text))
    text = text.replace("\u2018", "'").replace("\u2019", "'")
    text = text.replace("\u201c", '"').replace("\u201d", '"')
    text = text.replace("\xa0", " ")
    return collapse_ws(text)


def slugify(value):
    value = normalize_text(value).casefold()
    value = value.replace("&", " and ")
    value = re.sub(r"[\s_]+", "-", value)
    value = re.sub(r"[^a-z0-9-]+", "-", value)
    value = re.sub(r"-{2,}", "-", value).strip("-")
    return value


def read_lines(path):
    with path.open("r", encoding="utf-8") as f:
        return f.readlines()


def split_paragraphs(lines, split_points):
    paragraphs = []
    for index, start in enumerate(split_points):
        end = split_points[index + 1] if index + 1 < len(split_points) else len(lines) + 1
        chunk = "".join(lines[start - 1 : end - 1]).strip()
        if chunk:
            paragraphs.append(chunk)
    return paragraphs


def build_source_js(paragraphs):
    entries = []
    for index, paragraph in enumerate(paragraphs):
        entries.append(f"  // {index}\n  {json.dumps(paragraph, ensure_ascii=False)}")
    return "globalThis.LINKED_READING_SOURCE = [\n" + ",\n".join(entries) + "\n];\n"


def normalize_roles(node):
    raw_roles = node.get("roles") if isinstance(node.get("roles"), list) else []
    seen = set()
    roles = []
    for raw_role in raw_roles:
        if not isinstance(raw_role, str):
            continue
        slug = slugify(raw_role)
        if not slug or slug in seen:
            continue
        seen.add(slug)
        roles.append(slug)
    return roles


def build_tree_data_js(tree_cfg):
    source_tree = json.loads(json.dumps(tree_cfg["tree"]))

    def normalize_walk(node):
        if not isinstance(node, dict):
            return {}
        normalized = {}
        for key in ("label", "weight", "range"):
            if key in node:
                normalized[key] = node[key]
        normalized["roles"] = normalize_roles(node)
        children = node.get("children") if isinstance(node.get("children"), list) else []
        normalized["children"] = [normalize_walk(child) for child in children if isinstance(child, dict)]
        return normalized

    tree = normalize_walk(source_tree)

    tree_str = json.dumps(tree, ensure_ascii=False, indent=2)
    page = tree_cfg["page"]
    lines = [f"globalThis.LINKED_READING_TREE_DATA = {tree_str};\n"]
    for key in REQUIRED_PAGE_KEYS:
        const_name = "LINKED_READING_PAGE_" + key.upper()
        lines.append(
            f"globalThis[{json.dumps(const_name, ensure_ascii=False)}] = {json.dumps(page[key], ensure_ascii=False)};"
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
