# claude-kit

Claude Code をもっと使いやすくする、個人用プラグインセットです。

日々の開発ワークフロー（着手 → 設計 → 実装 → テスト → レビュー → リリース）をスラッシュコマンドとして登録し、
メモ・設計判断・QA 観点などを Markdown ファイルに記録できます。SQLite などの外部依存はなく、すべてプレーンな Markdown で完結します。

---

## 特徴

- **開発フロー全体をコマンド化** — `/kickoff` から `/pr` まで、各工程に専任スキルを用意
- **記録がすべて Markdown** — メモ・TODO・設計判断・QA 台帳・レビュー結果を人が読める形で残す
- **編集が即反映** — スキル本体はファイルを保存するだけで反映（再起動・再インストール不要）
- **プロジェクト単位でカスタマイズ可能** — スキルをプロジェクトにコピーして挙動を上書きできる

---

## セットアップ

### 必要なもの

- [Bun](https://bun.sh) 1.0 以上
- [Claude Code](https://claude.ai/code) がインストール済み

### 手順

```bash
# 1. リポジトリを取得（フォークして使う場合はフォーク先の URL を指定）
git clone <このリポジトリの URL> claude-kit
cd claude-kit

# 2. 依存インストール
bun install

# 3. ck コマンドをグローバルに使えるようにする
cd packages/ck
bun link
ck --version        # 0.1.0 と表示されれば OK

# 4. Claude Code にプラグインを登録する
cd ../..
ck setup
```

登録後、Claude Code を開くと `/kickoff` などのコマンドが使えるようになります。

> **スキルを追加・変更したとき**: 既存スキルの本体変更は即反映されます。新しいスキルを Claude Code に認識させるにはセッションの再起動が必要です。

---

## 開発フロー

主要スキルは、実際の開発サイクルに沿って並んでいます。

```
/kickoff → /discuss → /plan → /implement → /qa → /test → /review → /commit → /pr → /handoff
   ↑                                                                                   │
   └─────────────────────── /resume（次のセッションで再開）───────────────────────────┘

  /new-project … 新規リポジトリの立ち上げ（CLAUDE.md・用語集の整備。/kickoff が Greenfield 判定で誘導）
  /debug … バグ・テスト失敗の調査（フロー中いつでも）
  /refactor … 挙動を変えない構造改善（単独起動。機能追加・バグ修正と混ぜない）
  /review-others … 他者のコードをレビュワーとして監査（別立場）
```

| 工程 | コマンド | やること |
|------|----------|----------|
| 着手 | `/kickoff` | コードベースを自動調査し、タスクのブリーフィングと次に使うスキルを提案 |
| 着手 | `/git-issue-plan` | GitHub/GitLab の Issue を選んで着手する |
| 設計 | `/discuss` | 設計の不確定要素を対話で整理し、決定事項を `decisions/` に記録 |
| 計画 | `/plan` | 実装ステップをプランファイルにまとめる（計画専任） |
| 実装 | `/implement` | 確定した計画を実装する（テスト後置き既定） |
| 改善 | `/refactor` | 挙動を変えずにコード構造を改善する（1変形=1検証） |
| 調査 | `/debug` | バグ・エラー・テスト失敗の根本原因を体系的に特定 |
| QA | `/qa` | L1〜L8 の検証レンズでテストケース・QA 観点を洗い出す（`/test` の前段または並走） |
| テスト | `/test` | 実装完了後にユニットテストを作成する（`/qa` の台帳があればコード化） |
| 移行 | `/migrate-verify` | 旧新データの突合（件数・キー・値・形式）を読み取り専用で機械実行 |
| E2E | `/playwright-mcp-e2e` | UI の E2E テストを作成する |
| レビュー | `/review` | 自分の差分を PR 前に自己レビュー（型・Lint・品質・整合性） |
| レビュー | `/review-others` | 他者の PR/MR・コードをレビュワーとして監査 |
| コミット | `/commit` | 未コミット変更を論理単位に分割してコミットする |
| リリース | `/pr` | レビュー通過後、PR/MR を作成する |
| 引き継ぎ | `/handoff` | 作業状態を保存して次セッションへ引き継ぐ |
| 再開 | `/resume` | 前回の作業状態を復元して続きから始める |

---

## 記録・ドキュメント系スキル

| コマンド | やること | 保存先 |
|----------|----------|--------|
| `/ck-note` | 気づき・調査結果をメモに残す | `.notes/` または `~/.ck-notes/` |
| `/ck-todo` | あとでやる作業を TODO 登録 | `.notes/todos/` または `~/.ck-notes/todos/` |
| `/ck-todo-list` | TODO を一覧・消化する | 同上 |
| `/doc-this` | 繰り返す質問・直近の知見をプロジェクト文書化 | `.claude/docs/` |
| `/git-issue-create` | バグ報告・要望・タスクを Issue 起票 | GitHub / GitLab |
| `/help` | プロジェクト固有の規約・手順・経緯を調べる | （CLAUDE.md → `.claude/docs/` → コードの順で検索） |
| `/new-project` | 新規プロジェクトの CLAUDE.md・用語集を整備 | プロジェクトルート |
| `/office` | Excel / PowerPoint / Word の内容を確認・テキスト化 | — |
| `/spec-import` | 仕様書を構造化 Markdown 仕様に取り込む（`/office` の後工程） | `specs/` |

記録ファイルの主な置き場所:

| 種別 | 保存先 | 書き込むスキル |
|------|--------|----------------|
| 設計判断 | `decisions/<日付>-<slug>.md` | `/discuss`・`/plan` |
| 実装プラン | `plans/<日付>-<slug>.md` | `/plan`（`/implement` が進捗マーカーを更新） |
| QA テストケース台帳 | `tests/qa/<機能名>.md`（横断 index は `tests/qa/README.md`） | `/qa` |
| 他者コードのレビュー結果 | `reviews/<日付>-<slug>.md` | `/review-others` |
| 取込済み仕様 | `specs/<機能名>.md`（index は `specs/README.md`） | `/spec-import` |
| 移行突合レポート | `tests/qa/recon/<日付>-<機能名>.md` | `/migrate-verify` |
| 引き継ぎ | `.claude/works/handoffs/` | `/handoff` |

> `.notes/`・`decisions/`・`plans/`・`reviews/`・`tests/qa/`・`specs/`・`.claude/docs/` は git 管理（共有）されます。実在の顧客名・案件名・認証情報は書き込まないでください（各スキルが検知時に伏字化を提案します）。

---

## 主要スキルの使い方

### `/kickoff` — コードベースを調べてタスクの概要をつかむ

```
/kickoff ユーザー認証機能を追加したい
/kickoff #42 申請フォームのバリデーション
```

Issue 番号（`#42`）を含めるとスラグに番号が付きます。調査結果をもとに次のスキル（`/discuss` または `/plan`）を提案します。

### `/discuss <トピック>` — 設計の不確定要素を対話で整理する

```
/discuss 認証方式の選定
```

コードベースを調査してから議論を始め、決定事項を `decisions/<日付>-<slug>.md` に記録します。方向性が決まったら `/plan` を提案します。

### `/plan <タスク説明>` — 実装計画を作る

```
/plan JWT トークン認証の実装
```

`decisions/` の決定事項を制約として読み込み、コードベースを調査してから計画を作成します。承認後の実装は `/implement` に委譲します。

### `/implement` — 計画を実装する

確定した計画、または方向性が明確なタスクを実装します。**テスト後置きが既定**で、「TDD で」と明示したときのみテスト先行になります。完了後は `/test` に渡します。

### `/qa` — テストケース・QA 観点を洗い出す

```
/qa 注文確定フロー
```

正常系に偏らず、L1〜L8 の検証レンズ（WHO 軸＝誰の脅威・どの観点で壊すか。並行・整合などの非機能観点を含む）とテスト技法（HOW 軸）で網羅します。仕様突合で「実装＝正しい仕様」の思い込みを暴き、不一致は `要確認` で起票します。台帳は `tests/qa/` に蓄積されます。

### `/review` — 自分の差分を PR 前に自己レビューする

型チェック・Lint を実行し、コード品質・セキュリティ・論理整合性・トランザクション整合性を確認します。問題がなければ `/pr` を案内します。

### `/review-others` — 他者のコードをレビュワーとして監査する

他者の PR/MR・ブランチ差分（差分モード）または既存コード全体（0 からモード）が対象です。指摘（high/medium/low）・判断（approve/request-changes）・PR コメント案を `reviews/` に記録します。自己レビューの `/review` とは立場が異なります。

### `/handoff` — 次のセッションへ引き継ぐ

```
/handoff              # ブランチ名をスラグとして使用
/handoff my-feature   # スラグを明示指定
```

作業中のコンテキスト・未完了タスク・未コミット変更を保存します。次のセッションで `/resume` を使うと状態を復元できます。

---

## スキルをカスタマイズする

### スキル本体を直接編集する

```bash
$EDITOR packages/ck/src/skills/handoff/body.md
```

保存するだけで即反映されます（再起動・再インストール不要）。

### プロジェクト専用にカスタマイズする

スキルをプロジェクトにコピーして編集すると、そのプロジェクトだけ挙動を変えられます。

```bash
# 対象プロジェクトのルートで実行
ck skill copy handoff      # 特定のスキルをコピー
ck skill copy --all        # 全スキルを一括コピー
```

コピー先 `.claude/skills/<name>/SKILL.md` を編集するとプロジェクト専用の挙動になります（プロジェクトの `.claude/skills/` はプラグイン版より優先されます）。本体を最新版に追従させたいときは `ck skill update <name>` / `ck skill update --all` を使います。

---

## ck CLI リファレンス

```bash
# スキル
ck skill list              # 利用可能なスキル一覧
ck skill print <name>      # スキル本体を標準出力
ck skill copy [name]       # スキルをプロジェクトにコピー（--all で全部）
ck skill update [name]     # ローカルコピーを最新版で更新（--all で全部）
ck skill doctor            # スタブと本体の整合性を検査

# メモ・TODO
ck note <内容>             # メモを記録（--global でグローバル ~/.ck-notes/）
ck todo <内容>             # TODO を記録（--priority high|medium|low, --global）
ck todo list               # open の TODO 一覧（--all で done も, --global）
ck todo done <name>        # TODO を完了にする（--global）

# セットアップ
ck setup                   # Claude Code プラグインを登録
```

---

## アーキテクチャ

### モノレポ構成

```
packages/ck/   — ck CLI 本体（Bun + TypeScript）
plugins/ck/    — Claude Code プラグインスタブ
```

### スキルの二層構造

スキルはスタブと本体に分離されています。

- **スタブ** `plugins/ck/skills/<name>/SKILL.md` — Claude Code に登録されるメタデータ（name / description / allowed-tools）。本体を読み込む 1 行を持つ
- **本体** `packages/ck/src/skills/<name>/body.md` — 実際のスキル内容。`ck skill print <name>` で出力される

この分離により、スキル内容の変更はファイル編集だけで即反映されます。

---

## 社内・組織での利用（フォーク時の設定）

社内 GitLab / npm プライベートレジストリなどに合わせる場合は `ck-config.json` を編集します。

| キー | デフォルト | 説明 |
|------|-----------|------|
| `org` | `personal` | 組織名（パッケージ名の `@<org>` 部分） |
| `registry` | `https://registry.npmjs.org` | npm レジストリ URL |
| `pluginName` | `claude-kit-plugin` | プラグイン名 |

変更後は `bun install && ck setup` を実行してプラグインを再登録してください。
