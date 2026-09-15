---
status: open
created: 2026-09-15
priority: medium
---

doctor の brokenPatterns の検査範囲を決める: 本文全体に当て続けるか、フェンス内＋行内コードに絞るか。skill-new が「壊れ方を BROKEN_PATTERNS に登録せよ」と誘導する以上、本文に反面教師として旧形（git diff … || git diff）を書いた瞬間に doctor が落ちる。git diff --quiet || git diff --stat のような正当なイディオムも誤検出される。絞るなら「散文中の記述は検出しない」テストを追加する（skill.ts BROKEN_PATTERNS 付近）
