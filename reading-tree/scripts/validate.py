#!/usr/bin/env python3
"""
Validate splits.json + tree.json.

Usage:
  python3 reading-tree/scripts/validate.py output_workspaces/my-workspace

Hard errors:
  1. splits.json points to a readable source file.
  2. split points are valid, ordered, and produce non-empty source paragraphs.
  3. required page metadata exists.
  4. every node has a valid label, role, range, and weight.
  5. each child range stays inside its parent range.
  6. sibling ranges preserve source order, do not overlap, and fully cover the parent.
  7. every leaf range contributes to complete source coverage.
  8. nodes use only supported fields.

Soft warnings:
  - overloaded breadth
  - long leaves
  - duplicate labels
  - language-aware weak label openings
  - label compactness heuristics
  - role UI compactness heuristics
  - broad role-set warnings
  - possible source oversplitting
  - singleton non-leaf groups

This validator does not replace the required manual structure and label audit tables,
including role columns in the label audit table.
"""
import argparse
import json
import re
import sys
from collections import defaultdict
from pathlib import Path


REQUIRED_PAGE_KEYS = ("title", "subtitle", "desc", "footer")
ALLOWED_NODE_KEYS = {"label", "role", "weight", "range", "children"}

EN_WEAK_OPENINGS = (
    "he ",
    "she ",
    "it ",
    "this ",
    "these ",
    "there is",
    "there are",
    "the author",
    "the author says",
    "he explains",
    "she explains",
)
ZH_WEAK_OPENINGS = (
    "他",
    "她",
    "它",
    "这",
    "这些",
    "这里",
    "作者",
    "作者说",
    "本文",
    "本章",
    "本节",
)


def add_issue(issues, message):
    if message not in issues:
        issues.append(message)


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("workspace", nargs="?", default=".", help="workspace directory")
    return parser.parse_args()


def load_json(path):
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def collapse_ws(text):
    return re.sub(r"\s+", " ", text.strip())


def visible_chars(text):
    return len(re.sub(r"\s+", "", text))


def count_words(text):
    return len(re.findall(r"[A-Za-z0-9]+(?:['-][A-Za-z0-9]+)?", text))


def count_latin(text):
    return sum(1 for ch in text if ("a" <= ch.lower() <= "z"))


def count_cjk(text):
    return sum(1 for ch in text if "\u4e00" <= ch <= "\u9fff")


def normalize_lang(value):
    if not isinstance(value, str):
        return None
    value = value.strip().lower()
    if not value:
        return None
    if value.startswith("zh"):
        return "zh"
    if value.startswith("en"):
        return "en"
    return "other"


def detect_text_lang(text):
    text = collapse_ws(text)
    if not text:
        return "other"
    cjk = count_cjk(text)
    latin = count_latin(text)
    if cjk >= max(12, latin):
        return "zh"
    if latin >= max(24, cjk * 2):
        return "en"
    return "other"


def is_number(value):
    return isinstance(value, (int, float)) and not isinstance(value, bool)


def resolve_workspace_file(workspace, file_name):
    path = Path(file_name)
    candidate = path if path.is_absolute() else workspace / path
    resolved = candidate.resolve()
    if not resolved.is_relative_to(workspace):
        return None
    return resolved


def validate_splits(splits_cfg, workspace, errors, warnings):
    source_file = splits_cfg.get("source_file")
    if not isinstance(source_file, str) or not source_file.strip():
        add_issue(errors, "splits.json is missing a non-empty 'source_file'")
        return [], "other"
    source_path = resolve_workspace_file(workspace, source_file)
    if source_path is None:
        add_issue(errors, f"source file '{source_file}' resolves outside the workspace")
        return [], "other"
    if not source_path.exists():
        add_issue(errors, f"source file '{source_file}' does not exist")
        return [], "other"

    with source_path.open("r", encoding="utf-8") as f:
        lines = f.readlines()

    total_lines = len(lines)
    splits = splits_cfg.get("splits")
    if not isinstance(splits, list) or not splits:
        add_issue(errors, "splits.json must contain a non-empty 'splits' list")
        return [], detect_text_lang("".join(lines))

    prev = None
    valid_points = True
    for i, split in enumerate(splits):
        if not isinstance(split, int) or isinstance(split, bool):
            add_issue(errors, f"splits[{i}] must be an integer line number")
            valid_points = False
            continue
        if split < 1 or split > total_lines:
            add_issue(errors, f"splits[{i}]={split} is outside the source line range 1..{total_lines}")
        if prev is not None and split <= prev:
            add_issue(errors, f"splits must be strictly increasing; found {split} after {prev}")
        prev = split

    if not valid_points or errors:
        return [], detect_text_lang("".join(lines))

    if splits[0] > 1:
        leading = "".join(lines[: splits[0] - 1]).strip()
        if leading:
            add_issue(errors, "source text exists before the first split point; those lines would be ignored")
        else:
            add_issue(warnings, "blank lines before the first split point are ignored")

    paragraphs = []
    for i, start in enumerate(splits):
        end = splits[i + 1] if i + 1 < len(splits) else total_lines + 1
        chunk = "".join(lines[start - 1 : end - 1]).strip()
        if not chunk:
            add_issue(errors, f"split chunk starting at line {start} is empty after trimming")
            continue
        paragraphs.append(chunk)

    if not paragraphs:
        add_issue(errors, "splits do not produce any source paragraphs")
        return [], detect_text_lang("".join(lines))

    source_lang = detect_text_lang(" ".join(paragraphs))
    lengths = [visible_chars(p) for p in paragraphs]
    if len(lengths) >= 12:
        short_limit = {"en": 80, "zh": 24}.get(source_lang, 50)
        short_count = sum(1 for length in lengths if length < short_limit)
        if short_count / len(lengths) >= 0.35:
            add_issue(
                warnings,
                f"source paragraphs look unusually short overall ({short_count}/{len(lengths)} below {short_limit} chars); article.txt may be oversplit",
            )
        run = 0
        max_run = 0
        for length in lengths:
            if length < short_limit:
                run += 1
                max_run = max(max_run, run)
            else:
                run = 0
        if max_run >= 4:
            add_issue(
                warnings,
                f"source contains a run of {max_run} very short paragraphs; check whether article.txt was split too aggressively",
            )

    return paragraphs, source_lang


def validate_page(tree_cfg, errors):
    page = tree_cfg.get("page")
    if not isinstance(page, dict):
        add_issue(errors, "tree.json is missing the 'page' object")
        return {}
    for key in REQUIRED_PAGE_KEYS:
        value = page.get(key)
        if not isinstance(value, str) or not collapse_ws(value):
            add_issue(errors, f"page.{key} must be a non-empty string")
    return page


def validate_range(range_value, total, errors, path):
    if not isinstance(range_value, list) or len(range_value) != 2:
        add_issue(errors, f"[{path}] range must be a two-item list")
        return None
    start, end = range_value
    if not isinstance(start, int) or isinstance(start, bool) or not isinstance(end, int) or isinstance(end, bool):
        add_issue(errors, f"[{path}] range values must be integers")
        return None
    if start < 0 or end < 0:
        add_issue(errors, f"[{path}] range {range_value} cannot contain negative indices")
        return None
    if start > end:
        add_issue(errors, f"[{path}] range start {start} is greater than end {end}")
        return None
    if total > 0 and end >= total:
        add_issue(errors, f"[{path}] range {range_value} exceeds the paragraph index ceiling {total - 1}")
        return None
    return (start, end)


def infer_label_lang(page, labels, source_lang):
    explicit = normalize_lang(page.get("label_lang")) or normalize_lang(page.get("lang"))
    if explicit:
        return explicit
    if labels:
        return detect_text_lang(" ".join(labels))
    return source_lang


def normalize_label_key(label, lang):
    label = collapse_ws(label)
    if lang == "zh":
        return re.sub(r"\s+", "", label)
    return label.casefold()


def lint_label(path, label, lang, warnings):
    stripped = collapse_ws(label)
    plain = stripped.lstrip(" -:;,.!?()[]{}\"'“”‘’<>/\\")
    compact_units = visible_chars(stripped)

    if not plain:
        return

    if lang == "en":
        lowered = plain.casefold()
        if any(lowered.startswith(prefix) for prefix in EN_WEAK_OPENINGS):
            add_issue(warnings, f"[{path}] label '{label}' starts with a weak English opening")
        words = count_words(stripped)
        if words == 1:
            add_issue(warnings, f"[{path}] label '{label}' is a single word; check that it carries argumentative content")
        elif words > 10:
            add_issue(warnings, f"[{path}] label '{label}' is long for a card ({words} words)")
    elif lang == "zh":
        if any(plain.startswith(prefix) for prefix in ZH_WEAK_OPENINGS):
            add_issue(warnings, f"[{path}] label '{label}' starts with a weak Chinese opening")
        unit_count = count_cjk(stripped) or compact_units
        if unit_count < 3:
            add_issue(warnings, f"[{path}] label '{label}' is very short; check that it is not only a topic noun")
        elif unit_count > 18:
            add_issue(warnings, f"[{path}] label '{label}' is long for a card ({unit_count} visible units)")
    else:
        if compact_units < 3:
            add_issue(warnings, f"[{path}] label '{label}' is very short; check that it is not a placeholder")
        elif compact_units > 48:
            add_issue(warnings, f"[{path}] label '{label}' is very long for a card ({compact_units} visible chars)")

    if compact_units > 72:
        add_issue(warnings, f"[{path}] label '{label}' is unusually long and may scan poorly")


def lint_roles(role_entries, total_nodes, warnings):
    if not role_entries:
        return

    normalized = {}
    for path, role in role_entries:
        key = collapse_ws(role).casefold()
        normalized[key] = role

        if count_words(role) > 4 or visible_chars(role) > 28:
            add_issue(warnings, f"[{path}] role '{role}' is long for a UI filter/control")

    if len(normalized) > 4:
        add_issue(
            warnings,
            f"tree declares {len(normalized)} distinct roles; consider merging niche roles into a smaller reusable set",
        )


def validate_node(
    node,
    parent_range,
    total,
    paragraphs,
    errors,
    warnings,
    leaf_covered,
    label_entries,
    role_entries,
    path="root",
    depth=0,
):
    if not isinstance(node, dict):
        add_issue(errors, f"[{path}] node must be an object")
        return {"range": None, "weight": None, "label": "?"}

    unsupported_keys = sorted(set(node) - ALLOWED_NODE_KEYS)
    for key in unsupported_keys:
        add_issue(errors, f"[{path}] has unsupported field '{key}'")

    label = node.get("label")
    if not isinstance(label, str) or not collapse_ws(label):
        add_issue(errors, f"[{path}] label must be a non-empty string")
        label = "?"
    else:
        label = collapse_ws(label)
        label_entries.append((path, label))

    role = node.get("role")
    if not isinstance(role, str) or not collapse_ws(role):
        add_issue(errors, f"[{path}] role must be a non-empty string")
    else:
        role_entries.append((path, collapse_ws(role)))

    node_range = validate_range(node.get("range"), total, errors, path)
    weight = node.get("weight")
    if not is_number(weight):
        add_issue(errors, f"[{path}] weight must be a number between 0 and 1")
        weight = None
    else:
        weight = float(weight)
        if weight < 0 or weight > 1:
            add_issue(errors, f"[{path}] weight {weight} is outside the allowed range 0..1")

    if parent_range is not None and node_range is not None:
        if node_range[0] < parent_range[0] or node_range[1] > parent_range[1]:
            add_issue(errors, f"[{path}] range {list(node_range)} is not inside parent range {list(parent_range)}")

    children = node.get("children", [])
    if children is None:
        children = []
    if not isinstance(children, list):
        add_issue(errors, f"[{path}] children must be a list when present")
        children = []

    if children:
        child_count = len(children)
        if child_count == 1:
            add_issue(
                warnings,
                f"[{path}] has only 1 child; consider flattening this singleton non-leaf group unless it adds meaningful structure",
            )
        if depth == 0 and child_count >= 5:
            add_issue(warnings, f"[{path}] has {child_count} top-level children; review breadth")
        elif child_count >= 5:
            add_issue(warnings, f"[{path}] has {child_count} children; review whether this sibling group is overloaded")

        child_infos = []
        max_child_weight = None
        for i, child in enumerate(children):
            child_label = child.get("label", "?") if isinstance(child, dict) else "?"
            child_path = f"{path} > [{i}]{collapse_ws(str(child_label))}"
            info = validate_node(
                child,
                node_range,
                total,
                paragraphs,
                errors,
                warnings,
                leaf_covered,
                label_entries,
                role_entries,
                path=child_path,
                depth=depth + 1,
            )
            if info["range"] is not None:
                child_infos.append(info)
            if info["weight"] is not None:
                max_child_weight = info["weight"] if max_child_weight is None else max(max_child_weight, info["weight"])

        if node_range is not None and child_infos:
            covered = set()
            prev_start = None
            prev_end = None
            for info in child_infos:
                child_range = info["range"]
                if prev_start is not None and child_range[0] < prev_start:
                    add_issue(
                        errors,
                        f"[{path}] child range {list(child_range)} breaks source order; sibling ranges must be ordered",
                    )
                if prev_end is not None and child_range[0] <= prev_end:
                    add_issue(
                        errors,
                        f"[{path}] child range {list(child_range)} overlaps the previous sibling ending at {prev_end}",
                    )
                covered.update(range(child_range[0], child_range[1] + 1))
                prev_start = child_range[0]
                prev_end = child_range[1]

            expected = set(range(node_range[0], node_range[1] + 1))
            missing = expected - covered
            if missing:
                add_issue(errors, f"[{path}] child ranges leave uncovered paragraph indices: {sorted(missing)}")

        if weight is not None and max_child_weight is not None and weight < max_child_weight:
            add_issue(errors, f"[{path}] weight {weight} is smaller than max child weight {max_child_weight}")
    else:
        if node_range is not None:
            for idx in range(node_range[0], node_range[1] + 1):
                leaf_covered.add(idx)

            para_span = node_range[1] - node_range[0] + 1
            char_span = sum(visible_chars(paragraphs[idx]) for idx in range(node_range[0], node_range[1] + 1))
            if para_span > 3:
                add_issue(
                    warnings,
                    f"[{path}] leaf spans {para_span} paragraphs; consider a finer split or intermediate node",
                )
            elif char_span > 2200:
                add_issue(
                    warnings,
                    f"[{path}] leaf spans about {char_span} visible chars; check whether article.txt needs a finer semantic split",
                )

    return {"range": node_range, "weight": weight, "label": label}


def lint_labels(label_entries, page, source_lang, warnings):
    labels = [label for _, label in label_entries]
    label_lang = infer_label_lang(page, labels, source_lang)

    duplicates = defaultdict(list)
    for path, label in label_entries:
        duplicates[normalize_label_key(label, label_lang)].append((path, label))
        lint_label(path, label, label_lang, warnings)

    for entries in duplicates.values():
        if len(entries) > 1:
            paths = ", ".join(path for path, _ in entries)
            label = entries[0][1]
            add_issue(warnings, f"label '{label}' is reused at multiple nodes: {paths}")


def main():
    args = parse_args()
    workspace = Path(args.workspace).resolve()

    try:
        splits_cfg = load_json(workspace / "splits.json")
        tree_cfg = load_json(workspace / "tree.json")
    except FileNotFoundError as exc:
        print(f"Validation failed: missing file {exc.filename}")
        sys.exit(1)
    except json.JSONDecodeError as exc:
        print(f"Validation failed: malformed JSON at line {exc.lineno}, column {exc.colno}")
        sys.exit(1)

    errors = []
    warnings = []

    paragraphs, source_lang = validate_splits(splits_cfg, workspace, errors, warnings)
    total = len(paragraphs)

    page = validate_page(tree_cfg, errors)
    tree = tree_cfg.get("tree")
    if not isinstance(tree, dict):
        add_issue(errors, "tree.json is missing the 'tree' object")
        tree = {}

    leaf_covered = set()
    label_entries = []
    role_entries = []

    root_info = validate_node(
        tree,
        None,
        total,
        paragraphs,
        errors,
        warnings,
        leaf_covered,
        label_entries,
        role_entries,
    )

    if total > 0:
        expected_root = [0, total - 1]
        if root_info["range"] != (0, total - 1):
            add_issue(errors, f"root range {tree.get('range')} does not cover all {total} paragraphs {expected_root}")

        uncovered = sorted(set(range(total)) - leaf_covered)
        if uncovered:
            add_issue(errors, f"these paragraph indices are uncovered by every leaf node: {uncovered}")

    lint_labels(label_entries, page, source_lang, warnings)
    lint_roles(role_entries, len(label_entries), warnings)

    if errors:
        print(f"Validation failed with {len(errors)} error(s) and {len(warnings)} warning(s):")
        for message in errors:
            print(f"  error: {message}")
        for message in warnings:
            print(f"  warn: {message}")
        print("Note: validate.py does not replace the required manual structure and label audit tables, including role columns in the label audit table.")
        sys.exit(1)

    if warnings:
        print(f"Validation passed with {len(warnings)} warning(s):")
        for message in warnings:
            print(f"  warn: {message}")
    else:
        print(f"Validation passed: all {total} paragraphs are covered and the tree is structurally valid")

    print("Note: validate.py does not replace the required manual structure and label audit tables, including role columns in the label audit table.")
    sys.exit(0)


if __name__ == "__main__":
    main()
