---
name: fanout
description: 互いに独立した複数の作業をサブエージェントに分けて並列で進めたいときに使用する。独立した複数のテスト失敗・観点別の調査・広いコードベース走査など。分担できるかの見極めから配分・統合までを扱う。
user-invocable: true
allowed-tools: Agent, Task, Bash(git:*), Read, Grep, Glob
argument-hint: "[任意: 分担したい作業・領域の切り分け方針]"
---

!`ck skill print fanout || echo "ERROR: ck not found. Fix: cd ~/claude-kit && bun link"`
