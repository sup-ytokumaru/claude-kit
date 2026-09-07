# handoff

次のセッションがコンテキストを再発見せずに作業を引き継げる状態を記録する。
出力先: `.claude/works/handoffs/<YYYY-MM-DD>-<slug>.md`（gitignore 対象。恒久ドキュメントではなく作業引き継ぎ用の短命ファイルだが、`/resume` で読まれるほか他メンバーに直接共有されることもあるため、書く内容は共有前提で扱う。タスク完了後に不要になったものはユーザー判断で削除してよい）

## 非対話実行時

質問せずに実行できる。スラグは引数が無ければブランチ名から導出し、Step 5 の確認表示はそのまま最終報告にする。Open questions に書く内容が文脈から取れない場合は「なし」ではなく「未収集」と記録する。

## 手順

### Step 1: スラグと日付を決定する

- `$ARGUMENTS` にスラグが指定されている場合は kebab-case に正規化して使用する
- 指定がない場合は Bash ツールで `git rev-parse --abbrev-ref HEAD` を実行してブランチ名を取得する
- **スラグ正規化ルール**: 英数字・ハイフン・アンダースコア以外を除去し、空白とスラッシュはハイフンに変換する
  （例: `feat/add-form` → `feat-add-form`）
- 今日の日付を `YYYY-MM-DD` 形式で取得する（Bash: `date +%Y-%m-%d`）。Step 4 の `## Entry` 見出しに使う ISO タイムスタンプは `date -Iseconds` で取得する

### Step 2: ディレクトリと gitignore を確認する

```sh
mkdir -p .claude/works/handoffs
```

`.gitignore` を Read で確認し、`.claude/works/` を無視する行が無ければ Edit/Write で追記して「`.gitignore` に `.claude/works/` を追加しました」と報告する（`.gitignore` 自体が無い場合は新規作成する）。

### Step 3: 状態を収集する

- **Topic context** — 何を作業していたか、なぜか
- **Last action** — 最後の意味ある変更（`git log -1 --oneline` と会話コンテキストから）
- **Pending work** — 進行中または次に予定している作業（`git status --short`）
- **Open questions** — 先に進むために必要な回答が得られていない疑問点
- **Recent commits** — `git log -5 --oneline` の出力

### Step 4: ファイルに書き出す

**重要: 書き込みは Write / Edit ツールで行う**（Bash のリダイレクト出力は特殊文字（`"`, `$`, バッククォート）で壊れるため使わない）。

ファイルパス: `.claude/works/handoffs/<YYYY-MM-DD>-<slug>.md`

- **ファイルが存在しない場合**: Write で下記テンプレート全体を新規作成する。
- **ファイルが存在する場合**: Write（全文置換）は使わず、**Edit でファイル末尾に新しい `## Entry` ブロックのみを挿入する**（Read で末尾を確認し、最終行を含む末尾の文字列をアンカーに「アンカー＋新 Entry」へ置換する）。既存の `# Handoff` ヘッダ・`## Topic context`・過去の `## Entry` は再生成しない（Topic context に変化があれば新 Entry の Notes に変更点を書く）。

````markdown
# Handoff: <slug>

## Topic context
<一段落でタスクをまとめる>

---

## Entry: <ISO タイムスタンプ>

### Last action
<コミットハッシュ + メッセージ、またはコミット前の最後の変更説明>

### Pending work
- [ ] 項目

### Uncommitted changes
```sh
<git status --short の出力>
```

### Open questions
- 疑問点

### Recent commits
```sh
<git log -5 --oneline の出力>
```

### Notes
<保存しておきたい自由記述のコンテキスト>
````

### Step 5: 確認する

ファイルパスと記録した内容の1行サマリーを表示する。

## 復帰方法

次のセッション開始時は **`/resume` を起動する**（handoff ファイルの選択・読み込み・作業ツリーとの突合まで行う復帰専用スキル）。手動で復帰する場合:
1. `.claude/works/handoffs/` で最新ファイルを確認する
2. 最新の `## Entry` ブロックを読む
3. `git status` と `git log -5 --oneline` で作業ツリーを確認する

Step 5 の確認表示にも「次のセッションでは `/resume` で復帰できます」と添える。

## 制約

- 既存の `## Entry` ブロックを編集・削除しない — 追記のみ
- `git add` を実行しない（gitignore 対象）
- **秘匿情報を書き込まない**: 実在の顧客名・住所・電話番号・メールアドレス・社内システムの認証情報は、そのまま書き込まず伏字化して記録する（例: `顧客A`・`<API_KEY>`）。特に Notes 欄は自由記述で混入しやすい。handoff ファイルは他メンバーに共有されることがあるため、gitignore 対象であっても例外にしない

## 完了条件

handoff ファイルへの `## Entry` 追記と Step 5 の確認表示が済んだ時点で完了。次のセッションでは `/resume` で復帰する。
