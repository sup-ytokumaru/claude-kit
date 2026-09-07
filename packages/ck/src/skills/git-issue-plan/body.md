# git-issue-plan

リモートに登録された自分向けの Issue を確認し、着手する Issue を選んで詳細を要約し、コードベースサーベイ（`ck:kickoff`）へ委譲する。**実装計画そのものは作らない**（計画は `/plan` の責務。本スキルはその入口）。

## 非対話実行時

`$ARGUMENTS` に Issue 番号が指定されていれば、Phase 1（プロバイダー検出・CLI 確認）を実行したうえで **Phase 2（一覧取得）のみスキップ**し、指定番号で Phase 3 以降へ進む（Phase 3 のコマンドは Phase 1 の判定結果に依存するため Phase 1 は省略できない）。番号指定がなければ Phase 2 の一覧を提示して停止する（着手対象の選択はスコープ判断のため勝手に選ばない）。Phase 3 で body が空でも補足を求められないため、「本文なし」と明記して Phase 4 に進む。

## Phase 1: リモートプロバイダーの検出

```bash
git remote get-url origin
```

URL から自動検出する:
- `github.com` を含む → GitHub（`gh` CLI を使用）
- `gitlab` を含む（セルフホスト含む） → GitLab（`glab` CLI を使用）
- どちらも含まない（Bitbucket 等） → どちらのサービスかユーザーに確認する。gh / glab のどちらでも扱えない場合は対応していない旨を伝えて停止する
- リモート未設定 → 「origin が設定されていません」と伝えて停止する

### GitHub の場合: gh CLI の確認

```bash
which gh && gh auth status
```

`gh` が見つからない場合は、公式手順（https://github.com/cli/cli#installation — apt の場合は GitHub の公式リポジトリ追加が必要）でのインストールと `gh auth login` を案内して停止する（パッケージリポジトリの追加や sudo を伴うためスキルからは実行しない）。

### GitLab の場合: glab CLI の確認

```bash
which glab && glab auth status
```

`glab` が見つからない場合は、公式手順（https://gitlab.com/gitlab-org/cli#installation）でのインストールと `glab auth login` を案内して停止する（sudo を伴うためスキルからは実行しない）。

CLI が使えない / 未ログインの場合は案内して停止する。

## Phase 2: Issue 一覧の取得

**GitHub:**
```bash
gh issue list --assignee @me --json number,title,labels
```

**GitLab:**
```bash
glab issue list --assignee @me
```

（glab には gh のような `--json` 出力が無いため表形式の出力をそのまま読み取る。古い glab では `--assignee @me` が使えないことがある。エラーになったら `glab auth status` 等で自分のユーザー名を確認して指定する）

取得した Issue を以下の形式で表示する:

| # | タイトル | ラベル |
|---|--------|--------|

Issue が 0 件の場合はその旨を伝えて終了する。

## Phase 3: Issue の選択と詳細確認

ユーザーの依頼が「一覧を見たい」だけの場合は、一覧の提示をもって完了とする（選択を強制しない）。着手する場合はユーザーに「対象の Issue 番号を教えてください」と尋ねる。

**GitHub:**
```bash
gh issue view {number}
```

**GitLab:**
```bash
glab issue view {number}
```

取得した内容（title, description, labels）を日本語で要約して表示する。
body が空または極端に短い場合はユーザーに補足情報を求める（非対話時は冒頭の規定に従う）。

- 選択された Issue が **closed** の場合はその旨を伝え、本当に着手するか確認する（非対話時は停止して報告する）
- **他メンバーにアサイン済み**の場合は重複着手の恐れがあるため、その旨を伝えてから進む

## Phase 4: コードベースサーベイ（kickoff）

Skill tool で `ck:kickoff` スキル（プラグイン名前空間付きの完全修飾名で指定する）を呼び出す。引数:
```
#<issue番号> <issueタイトル>
例: "#42 申請フォームのバリデーションを追加"
```

`kickoff` がコードベースをサーベイし Discussion Briefing を作成する。
その後 `kickoff` が次のスキルを提案するので、ユーザーが判断して進む。

## 重要なルール

- このスキルの責務は「Issue の取得 → 選択 → 詳細の要約」まで。コードベース調査と Discussion Briefing の作成は Phase 4 で `kickoff` に委譲し、自身では行わない
- Phase を順番通りに実行する。スキップ禁止（唯一の例外: 非対話で Issue 番号指定時の Phase 2 スキップ — 冒頭の規定に従う）
- CLI がない / 未ログインの場合は必ず案内で停止する
- `/plan` はユーザーが判断して呼び出す（自動遷移しない）

## 完了条件

Phase 4 で `kickoff` を呼び出し、コードベースサーベイの結果（Discussion Briefing）が提示された時点で完了。次に進むスキル（`/discuss`・`/plan` など）はユーザーが選ぶ。例外: ユーザーの依頼が「一覧を見たい」だけの場合は、Phase 2 の一覧提示をもって完了とする（Phase 3 の規定どおり）。
