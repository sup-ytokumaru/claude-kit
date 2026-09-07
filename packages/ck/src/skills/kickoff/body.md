# kickoff

タスクに着手する前にコードベースを調査し、Discussion Briefing を作成する。**非対話型** — 途中でユーザーに質問しない。

## 非対話実行時

本スキルは非対話型。対話・非対話を問わず `AskUserQuestion` を使わず、`$ARGUMENTS` と会話文脈だけでタスクを特定する。特定できなければ Step 1 の規定どおり 1 行報告して停止する。

## 手順

### Step 1: トピックとスラグを特定する

`$ARGUMENTS` からタスク説明を解析し、kebab-case のスラグを導出する。
（例: "申請フォームを追加したい" → `add-application-form`）

`$ARGUMENTS` が空の場合は直前の会話文脈からタスクを特定する。文脈からも特定できなければ、本スキルは非対話型（`AskUserQuestion` 不可）のため調査せず「タスク説明を引数で渡してください（例: `/kickoff 申請フォームを追加したい`）」と1行報告して終了する。

Issue キー検出: `$ARGUMENTS` に `#<数字>` が含まれる場合、数字をスラグのプレフィックスとする。
（例: "ログイン修正 #42" → `42-fix-login`）
Issue キーが検出された場合、Step 4 で `/git-issue-plan`（Issue 本文の取得と着手）を候補に加える。

### Step 2: コードベースをサーベイする

**Greenfield 判定（サブエージェント起動前に確認）:**
Bash ツールで以下を確認する:
```sh
# コードファイル数をカウント（node_modules/vendor は除外）
# head での早期打ち切りは環境フック経由で SIGPIPE を誘発するためパイプで打ち切らない
find . \( -name "*.ts" -o -name "*.js" -o -name "*.py" -o -name "*.go" \
  -o -name "*.rs" -o -name "*.java" -o -name "*.php" -o -name "*.rb" \) \
  -not -path "*/node_modules/*" -not -path "*/vendor/*" | wc -l
# src/ ディレクトリの存在確認
test -d src && echo "has-src" || echo "no-src"
```
**カウントが 3 未満かつ `no-src`** の場合は Greenfield と判定し、サブエージェントをスキップして Step 3 に進む。
カウントが 3 未満で `has-src` の場合は `find src -type f | wc -l` で src/ 配下を確認し、実質空（0件）なら同様に Greenfield と判定する（src/ の器だけ在るリポジトリで調査を空振りさせない）。
Greenfield の場合、Discussion Briefing の Background に「新規プロジェクト（既存コードなし）」と記載する。

以下のプロンプト構造で Explore サブエージェント（起動ツールは環境により `Task` または `Agent`、`subagent_type: Explore`）を1つ起動する:

```
あなたは調査専用エージェントです。AskUserQuestion・EnterPlanMode などの対話型ツールは使用しないでください。

## ゴール
[タスクの内容を再掲。何を調査すればこのタスクを上手く議論できるかを示す。]

## 調査内容
[具体的な調査質問: Xはどこにあるか、Yの周辺にどのパターンがあるか、Zの依存関係は何か。]
[CLAUDE.md（ルートおよびサブエリア）が存在する場合は参照するよう、ここに1行加える。]

## 探索制約（厳守）
- 参照ファイルは最大 10 ファイルまで
- ファイル全体の読み込みより、エクスポートされた関数・型定義・クラス名の確認を優先すること
- 各セクション（Files / Patterns / Dependencies / Open Questions）は 8 項目以内に収めること

以下の形式で返答すること:
### Files
- `path/to/file` — トピックとの関連性
### Patterns
- パターン名 — 見つかった規約やパターンの説明
### Dependencies
- 依存関係 — トピックとの関係
### Open Questions
- 質問 — この調査だけでは不明な点
```

サブエージェントが失敗した・実質空の応答を返した場合は再起動しない（サブエージェント予算1つの制約）。メインコンテキストで Read/Grep 相当の軽い確認（CLAUDE.md・ディレクトリ構成程度）に切り替え、Briefing の Background に「調査が不完全（サブエージェント失敗）」と明記して Step 3 に進む。

### Step 3: Discussion Briefing を合成する

Briefing はファイルに書かず**チャットにそのまま提示する**。後続スキル（`/discuss`・`/plan`）が Slug を引き継げるよう、Step 1 で導出したスラグを必ず含める:

```markdown
- **Topic**: <一文でタスクをまとめる>
- **Slug**: <Step 1 で導出したスラグ（後続の decisions/・plans/ のファイル名に使う）>
- **Background**: <コードベース調査の主要な発見・現状・既存パターン>
- **Key Questions**: <依存関係の順に並べた2〜4つの設計上の問い>
- **Constraints**: <調査で浮かび上がった技術的・設計的な制約>
```

### Step 4: 次のスキルを提案する

issue の性質から適切なスキルを提案する（自動で呼び出さない）:

- バグ・エラー → `/debug`（証拠ベースの原因調査と decisions/ への記録）
- 設計の不確定要素がある新機能 → `/discuss`（設計の不確定要素を対話で解消してから `/plan` へ）
- 方向性が明確な実装タスク → `/plan`（直接プランを作成）
- Step 2 で Greenfield と判定した場合 → `/new-project`（CLAUDE.md・用語集の整備から始める）を第一候補として提案する
- Issue 起点（Step 1 で Issue キーを検出）→ `/git-issue-plan`（Issue 本文を取得して着手対象を確定する）

調査中に見つかったタスク外の気づき（別件の不具合候補など）は Briefing に混ぜず、`/ck-note` で残すことを案内する。

## 制約

- **非対話型**: `AskUserQuestion` を使用しない
- **既存コードへの書き込みなし**
- **サブエージェント予算**: コードベースサーベイ1つのみ

## 完了条件

Step 4 で次のスキルを提案した時点で完了。このスキル自身は実装も設計議論も行わない。
