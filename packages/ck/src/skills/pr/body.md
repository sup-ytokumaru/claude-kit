# pr

`/review` 通過後にプルリクエストを作成する。decisions ログからタイトル・本文を生成し、GitHub または GitLab に PR を提出する。

## 非対話実行時

push と PR 作成は外向きアクションのため、`AskUserQuestion` が使えない場合でも無確認で実行しない。生成したタイトル・本文と実行予定のコマンド（push を含む）を提示して停止し、最終承認は人間に残す。Step 5 の本文確認も同様（推奨案で先に進まない）。

## 手順

### Step 1: 事前確認

```bash
git remote get-url origin   # リモート確認（エラーなら「リモートが設定されていません」と伝えて停止）
git status --short
git rev-parse --abbrev-ref HEAD
# デフォルトブランチを検出（未設定なら空が返る）
git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null | sed 's|refs/remotes/origin/||'
```

デフォルトブランチの検出が空の場合は、`git branch -r` の一覧から実在するデフォルトブランチ（`origin/main`・`origin/master` 等）を特定する。`git branch -r` も空（fetch 未実行等）の場合は `git fetch origin` を実行してから再確認し、それでも特定できなければベースブランチ名をユーザーに確認する。特定したデフォルトブランチで差分を確認する:

```bash
git log origin/<デフォルトブランチ>..HEAD --oneline
```

- 未コミット変更がある場合は「先にコミットしてください」と伝えて停止する（論理単位への分割コミットは `/commit` で行える）
- コミットが0件の場合は「デフォルトブランチと差分がありません」と伝えて停止する
- 現在のブランチがデフォルトブランチ（main / master 等）の場合は「フィーチャーブランチを作成してください」と伝えて停止する

### Step 2: リモートプロバイダーを検出する

```bash
git remote get-url origin
```

- コマンドがエラーになる（リモート未設定）→ 「リモートが設定されていません。`git remote add origin <URL>` の実行後に再実行してください」と伝えて停止する
- `github.com` を含む → GitHub（`gh` CLI を使用）
- `gitlab` を含む（セルフホスト含む） → GitLab（`glab` CLI を使用）
- どちらも含まない（Bitbucket 等） → ホスティングサービス名をユーザーに確認する。gh / glab のどちらでも扱えない場合は対応していない旨を伝えて停止する

検出した CLI が使える状態かをここで確認する（Step 7 で初めて失敗させない）:

```bash
which gh && gh auth status      # GitHub の場合
which glab && glab auth status  # GitLab の場合
```

未インストールまたは未認証の場合は、インストール／`auth login` の手順を案内して停止する。

### Step 3: ブランチとベースを確認する

```bash
git rev-parse --abbrev-ref HEAD        # 現在のブランチ名
git log origin/<デフォルトブランチ>..HEAD --oneline    # コミット一覧（Step 1 で特定したデフォルトブランチを使う）
```

ブランチ名のスラグ（例: `feat/add-auth` → `add-auth`）を取り出す。

### Step 4: decisions ログを参照してタイトル・本文を生成する

`decisions/` でブランチスラグに一致するファイルを検索する（ブランチ名から型プレフィックスを除いた部分を slug とみなし、日付を無視して照合する）。ブランチ名から slug が取れない・一致しない場合は、`plans/` の最新ファイルの slug をフォールバックとして使う（`/review` と同じ照合規則）。

**見つかった場合:**
- `## Decision` セクションから変更内容のサマリーを抽出する
- `## Context` から背景を抽出する
- `## Decision` が無いファイル（`/debug` が記録したもの等）の場合は、最新の `### <date> debug` ブロックの `#### Root cause` / `#### Fix direction` からサマリーと背景を抽出する

**見つからない場合:**
- コミットログから内容を推測する

タイトルはブランチの変更内容を表す1行（コミットメッセージと同じ言語・トーン）とし、本文と併せて Step 5 で確認を受ける。

**秘匿情報ガード**: PR/MR 本文は GitHub / GitLab に送信される外部出力である。decisions ログやコミットログから抽出した内容に実在の顧客名・案件名・認証情報・社内 URL が含まれる場合は、本文生成時に伏字化・一般化する（例: 「○○様向け」→「特定顧客向け」）。伏字化した場合は Step 5 でその旨をユーザーに伝える。

以下の形式で PR 本文を生成する:

```markdown
## 概要
<変更内容を箇条書きで 1〜3 点>

## 背景
<なぜこの変更が必要だったか>

## 変更内容
<コミット一覧または主要な変更ファイル>

## 確認事項
- [ ] テストが通っている
- [ ] `/review` で指摘事項なし
```

### Step 5: ユーザーに確認する

生成したタイトルと本文を表示し、`AskUserQuestion` で確認する:
- 「このまま作成する」
- 「タイトル・本文を編集する」

「編集する」を選んだ場合はユーザーの修正を受けてから Step 6 に進む。

### Step 6: リモートへ push する

PR 作成にはブランチがリモートに存在する必要がある。push 状態を確認する:

```bash
git rev-parse --abbrev-ref --symbolic-full-name @{u} 2>/dev/null || echo "no-upstream"
git status -sb   # ahead 表示の確認
```

upstream が無い、またはローカルが ahead の場合は、**ユーザーに push の承認を得てから**実行する:

```bash
git push -u origin HEAD
```

承認が得られない場合は PR を作成せず停止する。push 済みなら何もしない。

### Step 7: PR を作成する

本文は複数行 Markdown のため、シェルのクォート事故を避けて **Write で一時ファイル（作業ツリー外・スクラッチパッド等）に書き出してから渡す**。

**GitHub:**
```bash
gh pr create --title "<タイトル>" --body-file <一時ファイルパス> --base <デフォルトブランチ>
```

**GitLab:**
```bash
glab mr create --title "<タイトル>" --description "$(cat <一時ファイルパス>)" --target-branch <デフォルトブランチ> --yes
```

- `--yes` は glab の追加確認プロンプト（push 確認等）を抑止する。古いバージョンで未対応の場合、対話プロンプトが出たら内容を確認できないため中断し、実行コマンドを提示してユーザーに委ねる

作成後、PR/MR の URL を表示する。

## 制約

- `$ARGUMENTS` にタイトルが指定されている場合は Step 4 のタイトル生成をスキップしてそのまま使用する
- ベースブランチは `git symbolic-ref refs/remotes/origin/HEAD` で自動検出する。取得できない場合は `main` を仮定せず、`git branch -r` の一覧から実在するデフォルトブランチを特定する
- PR/MR 本文に実在の顧客名・案件名・認証情報・社内 URL を含めない（Step 4 の秘匿情報ガード）
- 未コミット変更があるとき、またはデフォルトブランチ上にいるときは絶対に PR を作成しない
- `git push` が必要な場合は実行前にユーザーに確認する（プッシュはユーザーの承認後のみ）

## 完了条件

PR/MR の URL をユーザーに表示した時点で完了。マージされたあとのブランチ・worktree の回収は `/finish` が担う（PR 作成の時点では worktree を消さない。指摘対応をその作業コピーで行うため）。
