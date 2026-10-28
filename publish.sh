#!/bin/sh
# One-step publish: run this from the unzipped Marbles folder on a computer where you are signed in to GitHub.
set -e
git init -q -b main 2>/dev/null || true
git remote get-url origin >/dev/null 2>&1 || git remote add origin https://github.com/dritchie218/Marbles.git
git add -A
git commit -m "Add Marbles game, tests, CI and MIT license" || true
git push -u origin main
echo "Pushed. Now turn on Pages: Settings > Pages > Deploy from a branch > main / (root)."
echo "Game link: https://dritchie218.github.io/Marbles/"
