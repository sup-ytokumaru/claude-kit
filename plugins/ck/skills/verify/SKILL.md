---
name: verify
description: 「完了した」「直った」「通った」と報告する前に、検証コマンドを実行して証跡を添えたいときに使用する。コミット・PR 作成の直前、実装ステップの区切り、サブエージェントの成功報告を受け取ったときに。
user-invocable: true
allowed-tools: Bash, Read, Grep, Glob
argument-hint: "[任意: 検証したい主張・対象スコープ]"
---

!`ck skill print verify || echo "ERROR: ck not found. Fix: cd ~/claude-kit && bun link"`
