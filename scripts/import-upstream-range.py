#!/usr/bin/env python3
# //// Neoffice — added file (no upstream equivalent).
"""Import a range of the openGym upstream WITHOUT its licensed exercise media.

Since v1.4.0 the upstream repository carries the stills and clips of its catalogue (190 MB under the
Gym visual licence: catalogue/media/still and catalogue/media/clip). A `git merge v1.4.x` would copy
every one of those objects into the history of this PUBLIC fork, for good. So the range is first
rewritten into a ref of ours with the same commits minus those two folders, and THAT ref is merged.

Why not git filter-repo: it drops GPG signatures, so every signed commit (GitHub merges, dependabot)
changes hash, and with it everything below: the common base with the upstream would be lost. Here the
commits of the base and everything before it are NEVER touched; the commits of the range are recreated
with the same author, committer, dates and message (signatures cannot survive), parents mapped inside
the range.

usage: import-upstream-range.py <repo> <base> <tip> <new-ref> [--base-filtered <commit>]

  <base>           the upstream tag already merged (its commits are in our history)
  <tip>            the upstream tag to bring in
  <new-ref>        the ref to create, e.g. refs/heads/up-v1.5.0-filtered (never pushed: delete it after the merge)
  --base-filtered  OUR copy of <base> when it was itself imported through this script: the second parent
                   of the last upstream merge commit (`git rev-parse <merge commit>^2`). Without it the
                   first parent of the range would be the original <base>, media included.

Then:  git merge --no-ff <new-ref>   (message without the word of the tool that wrote it; see CLAUDE.md)
"""
import os
import re
import subprocess
import sys

DROP = {"still", "clip"}  # under catalogue/media; NOTICE.md stays


def parse_args(argv):
    base_filtered = None
    if "--base-filtered" in argv:
        i = argv.index("--base-filtered")
        base_filtered = argv[i + 1]
        argv = argv[:i] + argv[i + 2:]
    if len(argv) != 4:
        raise SystemExit(__doc__)
    return (*argv, base_filtered)


repo, base, tip, new_ref, base_filtered = parse_args(sys.argv[1:])


def git(*args, input=None, env=None, text=False):
    r = subprocess.run(["git", "-C", repo, *args], input=input, capture_output=True, env=env)
    if r.returncode != 0:
        raise SystemExit(f"git {' '.join(args)} failed: {r.stderr.decode('utf-8', 'replace')}")
    return r.stdout.decode("utf-8", "surrogateescape") if text else r.stdout


def ls_tree(oid):
    if isinstance(oid, bytes):
        oid = oid.decode()
    out = git("ls-tree", "-z", oid)
    entries = []
    for rec in out.split(b"\0"):
        if not rec:
            continue
        meta, name = rec.split(b"\t", 1)
        mode, kind, sha = meta.split(b" ")
        entries.append((mode, kind, sha, name))
    return entries


def mktree(entries):
    data = b"".join(m + b" " + k + b" " + s + b"\t" + n + b"\0" for m, k, s, n in entries)
    return git("mktree", "-z", input=data).strip()


cache = {}


def filtered_tree(oid):
    """The tree without catalogue/media/{still,clip}; the same tree when there is nothing to drop."""
    if oid in cache:
        return cache[oid]
    root = ls_tree(oid)
    cat = next((e for e in root if e[3] == b"catalogue" and e[1] == b"tree"), None)
    result = oid
    if cat:
        cat_entries = ls_tree(cat[2])
        media = next((e for e in cat_entries if e[3] == b"media" and e[1] == b"tree"), None)
        if media:
            media_entries = ls_tree(media[2])
            kept = [e for e in media_entries if e[3].decode() not in DROP]
            if len(kept) != len(media_entries):
                new_cat = [e for e in cat_entries if e[3] != b"media"]
                if kept:
                    new_cat.append((b"040000", b"tree", mktree(kept), b"media"))
                new_cat.sort(key=lambda e: e[3] + (b"/" if e[1] == b"tree" else b""))
                new_root = [e for e in root if e[3] != b"catalogue"]
                if new_cat:
                    new_root.append((b"040000", b"tree", mktree(new_cat), b"catalogue"))
                new_root.sort(key=lambda e: e[3] + (b"/" if e[1] == b"tree" else b""))
                result = mktree(new_root).decode()
    cache[oid] = result
    return result


def parse(sha):
    raw = git("cat-file", "commit", sha)
    head, _, body = raw.partition(b"\n\n")
    tree, parents, author, committer = None, [], None, None
    for line in head.split(b"\n"):
        if line.startswith(b"tree "):
            tree = line[5:].decode()
        elif line.startswith(b"parent "):
            parents.append(line[7:].decode())
        elif line.startswith(b"author "):
            author = line[7:].decode("utf-8", "surrogateescape")
        elif line.startswith(b"committer "):
            committer = line[10:].decode("utf-8", "surrogateescape")
    return tree, parents, author, committer, body


IDENT = re.compile(r"^(.*) <(.*)> (\d+) ([+-]\d{4})$")
base_commit = git("rev-parse", f"{base}^{{commit}}", text=True).strip()
order = git("rev-list", "--topo-order", "--reverse", f"{base}..{tip}", text=True).split()
mapping = {}
if base_filtered:
    mapping[base_commit] = git("rev-parse", f"{base_filtered}^{{commit}}", text=True).strip()
changed = 0
for sha in order:
    tree, parents, author, committer, body = parse(sha)
    new_tree = filtered_tree(tree)
    if new_tree != tree:
        changed += 1
    for p in parents:
        if p not in mapping and p != base_commit:
            print(f"warning: {sha[:10]} has a parent outside the range ({p[:10]}): kept as it is, check it carries no media")
    new_parents = [mapping.get(p, p) for p in parents]
    an, ae, ad, atz = IDENT.match(author).groups()
    cn, ce, cd, ctz = IDENT.match(committer).groups()
    env = dict(os.environ, GIT_AUTHOR_NAME=an, GIT_AUTHOR_EMAIL=ae, GIT_AUTHOR_DATE=f"{ad} {atz}",
               GIT_COMMITTER_NAME=cn, GIT_COMMITTER_EMAIL=ce, GIT_COMMITTER_DATE=f"{cd} {ctz}")
    cmd = ["commit-tree", new_tree]
    for p in new_parents:
        cmd += ["-p", p]
    new = git(*cmd, input=body, env=env).decode().strip()
    mapping[sha] = new

new_tip = mapping[git("rev-parse", f"{tip}^{{commit}}", text=True).strip()]
git("update-ref", new_ref, new_tip)

# The proof, not the intention: no object of the new commits may sit under the two media folders.
since = mapping.get(base_commit, base_commit)
listing = git("rev-list", "--objects", new_ref, "--not", since, text=True)
leaked = [line for line in listing.splitlines() if re.search(r"catalogue/media/(still|clip)/", line)]
print(f"{len(order)} commits recreated, {changed} of them lose media from their tree; new tip {new_tip}")
if leaked:
    git("update-ref", "-d", new_ref)
    raise SystemExit(f"{len(leaked)} media objects are still reachable (first: {leaked[0]}): the ref was deleted")
print("verified: 0 media objects reachable from the new commits")
