# Decisions ログ

このディレクトリはプロジェクトの決定事項と議論のログを保持する。トピックごとに1つの Markdown ファイルを作成し、作業が進むにつれてコンテキストを蓄積していく。

## ファイル名規則

```
<YYYY-MM-DD>-<slug>.md
```

- `<YYYY-MM-DD>`: トピックを開いた日付
- `<slug>`: トピックの kebab-case 短縮識別子

注意: 既存ファイルはリネームしない。トピックごとに1ファイル、後から追記する。

## セクションテンプレート（ADR-lite）

```markdown
# <トピックタイトル>

## Context

<背景 — なぜ議論するのか>

## Decision

<確定した制約の箇条書き>

## Consequences

<下流への影響>

## Discussion Log

### <YYYY-MM-DD> discuss

#### Decision: <一行の要約>

- **Constraint**: <今後の制約として確定したこと>
- **Why**: <理由>
- **Rejected alternatives**: <却下した選択肢（あれば）>
```

## 追記ルール

- `/discuss` が `discuss` セクションを追記し、各決定をサブブロックとして記録する
- ファイルが存在しない場合は上記テンプレートで初期化してから追記する

## Git ワークフロー

- `/decisions/` 内のファイルは git 管理する
- スキルは `git add` を自動実行しない。リマインダーを出力するのみ
