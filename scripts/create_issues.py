#!/usr/bin/env python3
"""Creates one GitHub issue per mini task in PLAN.md (label + milestone per phase).

Usage: python3 scripts/create_issues.py [--dry-run]
Tasks already present as issues (same title) are skipped, so it is safe to re-run.
"""
import json, re, subprocess, sys

REPO = "jgestal/dotmd"
DRY = "--dry-run" in sys.argv

def gh(*args, check=True):
    r = subprocess.run(["gh", *args], capture_output=True, text=True)
    if check and r.returncode != 0:
        raise SystemExit(r.stderr)
    return r.stdout

phases, current = [], None
for line in open("PLAN.md", encoding="utf-8"):
    h = re.match(r"^### (.+)$", line)
    if h:
        title = h.group(1).strip()
        m = re.match(r"Fase (\d+) — (.+)", title)
        if m:
            current = {"label": f"phase-{m.group(1)}", "milestone": f"Fase {m.group(1)} — {m.group(2)}", "tasks": []}
        elif title.startswith("Sonidos"):
            current = {"label": "sounds", "milestone": title, "tasks": []}
        else:
            current = None
        if current:
            phases.append(current)
        continue
    t = re.match(r"^- \[[ x]\] ((?:F\d+|S)-\d+) (.+?)(?: \(#\d+\))?$", line.rstrip())
    if t and current:
        current["tasks"].append((t.group(1), t.group(2)))

existing = {i["title"] for i in json.loads(gh("issue", "list", "-R", REPO, "--state", "all", "--limit", "500", "--json", "title"))}
milestones = {m["title"] for m in json.loads(gh("api", f"repos/{REPO}/milestones?state=all&per_page=100"))}

for ph in phases:
    if not DRY:
        gh("label", "create", ph["label"], "-R", REPO, "--force", "--color", "5319e7" if ph["label"] == "sounds" else "0e8a16")
        if ph["milestone"] not in milestones:
            gh("api", f"repos/{REPO}/milestones", "-f", f"title={ph['milestone']}")
    for tid, text in ph["tasks"]:
        title = f"{tid} {text}"
        if title in existing:
            continue
        body = f"Mini task **{tid}** from [PLAN.md](https://github.com/{REPO}/blob/main/PLAN.md) — milestone *{ph['milestone']}*.\n\n{text}\n"
        print(("would create: " if DRY else "creating: ") + title)
        if not DRY:
            gh("issue", "create", "-R", REPO, "--title", title, "--body", body, "--label", ph["label"], "--milestone", ph["milestone"])
