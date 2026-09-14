---
name: finish
description: 作業ブランチを片付けて終えたいときに使用する。「マージして終わり」「ブランチを片付けて」「worktree を掃除して」と言われたとき、PR がマージされた後の回収に。/pr の後段。
user-invocable: true
allowed-tools: Bash, AskUserQuestion, Read, Grep, Glob
argument-hint: "[任意: 統合先ブランチ・出口の指定]"
---

!`ck skill print finish || echo "ERROR: ck not found. Fix: cd ~/claude-kit && bun link"`
