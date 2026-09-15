# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 概要

個人用 Claude Code プラグインリポジトリ。`ck` CLI・Markdownベースのノート/TODO管理・複数のスキルを提供する。

## コマンド

```bash
# 依存インストール
bun install

# ck CLI をグローバルにリンク（初回セットアップ）
cd packages/ck && bun link

# Claude Code プラグインを登録
ck setup

# 型チェック（tsconfig がない場合は bun build で代替）
bun run packages/ck/src/cli.ts --help

# テスト実行（packages/ck 配下の *.test.ts）
cd packages/ck && bun test src

# スキル一覧確認
ck skill list

# スタブ⇔本体の整合性検査（ツール整合検査を含む）
ck skill doctor

# ck コマンドをローカルで直接実行（グローバルリンクなしで）
bun run packages/ck/src/cli.ts skill list
```

## 運用ルール

- `.notes/`・`decisions/`・`plans/`・`reviews/`・スキル本文・handoff ファイルは git 管理（または共有）されるため、実在の顧客名・案件名・社内システムの認証情報を書き込まない
- スキルのメタデータ（description / allowed-tools）の源泉はスタブ側（`plugins/ck/skills/<name>/SKILL.md`）。body にはフロントマターを書かない

## 社内移行時の設定変更

社内 GitLab / npm プライベートレジストリへの移行時は `ck-config.json` を編集する:

| キー | デフォルト | 説明 |
|---|---|---|
| `org` | `personal` | 組織名（パッケージ名の `@<org>` 部分） |
| `registry` | `https://registry.npmjs.org` | npm レジストリ URL |
| `pluginName` | `claude-kit-plugin` | プラグイン名 |

変更後: `bun install && ck setup` を実行してプラグインを再登録する。

## アーキテクチャ

### モノレポ構成

```
packages/ck/   — ck CLI 本体（Bun + TypeScript）
plugins/ck/    — Claude Code プラグインスタブ
```

### スキルのワークフロー順序

主系列: `/kickoff → /discuss → /plan → /implement → /qa（任意） → /test → /review → /commit → /pr → /finish → /handoff`。次のセッションは `/resume` で復帰する。
`/finish` は PR がマージされたあとのブランチ・worktree の回収を担う（`/pr` の時点では worktree を残す）。
`/qa` は `/test` の前段（台帳を設計してからコード化する）。`/implement` の出口で必ず提案され、台帳が要らない規模なら飛ばして `/test` へ進む。

補助（主系列のどこからでも）: `/debug`（不具合調査）・`/refactor`（挙動不変の構造改善）・`/review-others`（他者コードの監査）・`/git-issue-plan`（Issue 起点の着手）・`/git-issue-create`（フォローアップの起票）・`/ck-todo`（判断待ちの論点を積む）・`/ck-todo-list`（TODO の確認・消化）・`/ck-note`（調査中の気づき）・`/doc-this`（恒久ドキュメント化）・`/help`（プロジェクト固有の質問）・`/verify`（完了主張の前に検証の証跡を揃えるゲート）・`/fanout`（独立した複数作業のサブエージェント並列配分）・`/skill-new`（ck スキルの新規作成・改訂）。
UI: `/test` の後段で `/playwright-mcp-e2e`（E2E テストの作成。qa 台帳のケースID をテスト名に埋め込む）。仕様書系: `/office → /spec-import → /qa`。移行系: `/qa`（移行モード）→ `/migrate-verify`。新規リポジトリ: `/new-project`（`/kickoff` が Greenfield 判定で誘導）。

各スキルの成果物の保存先は後述「ノート・TODOのストレージ」を正本とする。

### スキルの二層構造

スキルはスタブと本体に分離されている：

- **スタブ** `plugins/ck/skills/<name>/SKILL.md` — Claude Code プラグインとして登録されるメタデータ。`!`ck skill print <name>`` でシェル実行して本体を読み込む
- **本体** `packages/ck/src/skills/<name>/body.md` — 実際のスキル内容。`ck skill print <name>` で stdout に出力される

スキル内容の変更はファイル編集のみで即反映（再起動・再インストール不要）。

### packages/ck 内部構造

- `src/cli.ts` — エントリポイント（Commander で4コマンドを登録）
- `src/cli/commands/skill.ts` — `ck skill print/list/copy/update/doctor`（`SKILLS_DIR = src/skills/` を参照。`doctor` はスタブ⇔本体の整合性検査。`BROKEN_PATTERNS` で一度直した壊れパターンの再発を、`SHARED_SNIPPETS` でスキル間に複製されたコード片のズレを error にする）
- `src/cli/commands/note.ts` — `ck note <content> [--global]`（`.notes/` または `~/.ck-notes/` に書き込み）
- `src/cli/commands/todo.ts` — `ck todo <content>` / `ck todo list [--all]` / `ck todo done <name>`（`.notes/todos/` または `~/.ck-notes/todos/`、`--global` でグローバル）
- `src/cli/commands/setup.ts` — `claude plugin install plugins/ck` を実行

### ノート・TODOのストレージ

すべてMarkdownファイル。SQLiteは使用しない。

| 種別 | ローカル（デフォルト） | グローバル（`--global`） |
|---|---|---|
| ノート | `.notes/<date>-<slug>.md` | `~/.ck-notes/<date>-<slug>.md` |
| TODO | `.notes/todos/<date>-<slug>.md` | `~/.ck-notes/todos/<date>-<slug>.md` |

TODOファイルのフロントマターで `status: open/done` を管理する。
設計判断は `decisions/<date>-<slug>.md` に記録する（`/discuss` スキルが書き込む）。
実装プランは `plans/<date>-<slug>.md` に記録する（`/plan` スキルが書き込み、`/implement` が進捗マーカー `- [ ]`→`- [x]` を更新する。git 管理対象）。
QAテストケース台帳は `tests/qa/<機能名>.md`（機能単位）と横断 index `tests/qa/README.md` に記録する（`/qa` スキルが書き込む）。各ケースは L1〜L8 の検証レンズ（WHO軸＝誰の脅威/どの観点で壊すか。アクター起点 L1〜L4／観点起点 L5〜L8。L6/L7 は並行・整合などの非機能観点）とテスト技法（HOW軸＝どの値/組合せで網羅するか）で網羅し、ケースID は `<機能略号>-C<連番>`（例 `ORD-C1`）で横断一意にする。「実装＝正しい仕様」を疑う突合はレンズではなく仕様突合アクティビティで行い、不一致は `要確認` で起票する。スコープは `full`（全レンズ一巡）/`light`（重点レンズ＋High のみ）の2値。台帳テーブルはレンズ・技法・優先度（High/Mid/Low）を含む9列（列の正本は `packages/ck/src/skills/qa/body.md`）。ケース状態は `active`/`要確認`/`obsolete` の3値で、既存ケースは削除せず降格で鮮度管理する。台帳は git 管理されるため、実在の顧客名・案件名・認証情報を書き込まない。

他者コードのレビュー結果は `reviews/<date>-<slug>.md`（レビュー1回単位、横断 index は作らない）に記録する（`/review-others` スキルが書き込む）。記録内容は対象/作者の意図・指摘（high/medium/low）・判断（approve/request-changes）・PRコメント案・フォローアップ。`/review-others` は他者の PR/MR・ブランチ差分（差分モード）または既存コード全体（0からモード）が対象で、自分の差分を PR 前に自己レビューする `/review` とは立場が異なる。reviews/ は git 管理されるため、実在の顧客名・案件名・認証情報を書き込まない。

取込済み仕様は `specs/<機能名>.md`（横断 index は `specs/README.md`）に記録する（`/spec-import` スキルが書き込む。`/office` でテキスト化した仕様書を構造化し、原文に無い仕様は補完せず「不明」として `/qa` の仕様突合に渡す）。移行データの突合レポートは `tests/qa/recon/<date>-<機能名>.md` に記録する（`/migrate-verify` スキルが書き込む。件数・キー・値・形式の4種突合を読み取り専用で実行し、不一致は qa 台帳の対応ケースを `要確認`〈理由タグ=突合〉に降格して反映する）。specs/・tests/qa/recon/ も git 管理されるため、実在の顧客名・案件名・認証情報を書き込まない。

### plugins/ck 内部構造

- `.claude-plugin/plugin.json` — プラグインメタデータ
- `skills/<name>/SKILL.md` — フロントマター（name/description/allowed-tools）＋ `!`ck skill print <name>`` の1行

## 新しいスキルを追加する場合

`/skill-new` が以下の手順と作法（定型節・導線接続・doctor 検査）を内蔵しているため、通常はそちらを起動する。手作業で行う場合:

1. `packages/ck/src/skills/<name>/body.md` を作成（スキル本体。フロントマターは書かない）
2. `plugins/ck/skills/<name>/SKILL.md` を作成（スタブ、既存を参考）
3. `ck skill doctor` で整合性を確認（`ck skill list` で一覧確認）
4. 新スタブを Claude Code に認識させるにはセッション再起動（既存スキルの本体変更は即反映）
