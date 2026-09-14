---
name: skill-new
description: ck のスキルを新規作成・改訂したいときに使用する。「スキルにして」「この手順をスキル化して」と言われたとき、または同じ手順を別プロジェクトでも参照したくなったとき。プロジェクト固有の知見の文書化は doc-this。
user-invocable: true
allowed-tools: Bash(ck:*), Bash(bun:*), Bash(git:*), Read, Write, Edit, Grep, Glob, Agent
argument-hint: "[任意: スキル名・扱いたい手順]"
---

!`ck skill print skill-new || echo "ERROR: ck not found. Fix: cd ~/claude-kit && bun link"`
