#!/usr/bin/env bash
# บันทึกผล/เลขที่ล็อกขึ้น GitHub — ผลจะ commit เฉพาะเมื่อมีงวดใหม่หรือเติมเลขครบ (ไม่ commit แค่เพราะเวลาเช็กเปลี่ยน)
MSG="${1:-Update draws / lock numbers}"
ADD=""
if git diff -U0 -- data/draws.json | grep -q -E '^\+.*"(d|n)":'; then ADD="data/draws.json"; else git checkout -- data/draws.json 2>/dev/null || true; fi
if [ -n "$(git status --porcelain -- data/picks.json)" ]; then ADD="$ADD data/picks.json"; fi
if [ -n "$(git status --porcelain -- data/formulas.json)" ]; then ADD="$ADD data/formulas.json"; fi
if [ -z "$ADD" ]; then echo "no change"; exit 0; fi
git config user.name "github-actions[bot]"
git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
git add $ADD
git commit -m "$MSG"
git push || (git pull --rebase --autostash -X theirs && git push)
