# ck スキル群の棚卸・評価・強化

## Context

26 個の ck スキルは 2026-06 に集中的に作られ、2026-07-02 に非対話規定・導線接続・実行不能手順の一括修正が入った。その後は手が入っておらず、鮮度・整合性・実用性を棚卸して強化方針を決める必要がある。

/kickoff 調査（2026-09-07）の主な発見:

- スタブ 26 / 本体 26 は一致し `ck skill doctor` は問題なし。superpowers・TodoWrite・`Task(` の残存参照はゼロ
- README のワークフロー図が `/implement → /qa → /test` に変更されたが、implement の出口と test の description に `/qa` 導線がない
- 定型節のカバレッジが不均一（非対話規定 21/26、完了条件 22/26、秘匿情報ガード 8/26）。非対話規定の文言が 7 通り以上に発散
- 8 スキルが裸の `Bash` を allowed-tools に宣言。`Task, Agent` 併記は doctor が検出しない
- `/git-issue-create`・`/git-issue-plan`・`/ck-note`・`/ck-todo`・`/ck-todo-list` は他スキルから被参照ゼロ
- doctor の検査は構造のみで、description 粒度・定型節の有無・リンク死活・裸 Bash は検査しない。body.md を対象にした自動テストも無い
- このリポジトリ内の利用実績はすべて ck 自身の開発。`reviews/`・`tests/qa/`・`specs/` はディレクトリ不在

## Decision

- 正規ワークフローは `/kickoff → /discuss → /plan → /implement → /qa → /test → /review → /commit → /pr → /handoff` とする（`/qa` は `/test` の前段）
- `/qa` は任意ステップ。ただし `/implement` の完了時の出口導線で必ず提案する（台帳が必要な規模かはユーザーが判断）
- `/test` は `/qa` 台帳（`tests/qa/<機能名>.md`）の `active` ケースがあればそれをコード化する
- 評価は 3 軸すべてで行う: (a) 構造整合（doctor 拡張による機械検査）、(b) 実運用逆輸入（他プロジェクトのフォークと ck 本体の差分読解、成果物の有無による使用実績判定）、(c) ドッグフーディング（26 スキルをこのリポジトリで一巡実行）。主軸は (b)、(a) は (b) の結果を固定する常設ガード、(c) はフォーク・成果物に痕跡のないスキルの実動作確認を含む全スキル対象
- 逆輸入の判定基準: フォーク差分は、ck の保存先・命名・言語（全文日本語・外部参照ゼロの自己完結）の規約を変えずに入るものだけ取り込む。規約変更を要求する差分は既存の ck 機能で代替できるか検討し、できなければ見送る
- 記録モデル（番号付き ADR・対話ログの分離・`pendings/`・`docs/learnings.md`）は採用しない。`decisions/<date>-<slug>.md` の ADR-lite 追記型を維持する
- 未解決論点キュー（`pendings/` 相当）の役割は既存の `ck-todo`（`.notes/todos/`）が担う。review・qa・discuss の出口から「判断要の項目は `/ck-todo` に積む」導線を張る
- 26 スキルはすべて維持する。削除・deprecated 化は行わない。被参照ゼロの孤児スキルは導線接続で本線につなぐ: `git-issue-plan` ← kickoff（`#<数字>` 検出時に案内）、`git-issue-create` ← review・review-others・qa のフォローアップ出口、`ck-note` ← kickoff・debug の調査途中の気づき
- 実運用の痕跡が無い spec-import・migrate-verify は (c) ドッグフーディングの主対象とし、動かなかった場合にのみ削減を再検討する
- 定型節は全スキルに揃える: 非対話規定（欠落 ck-todo-list・handoff・help・office・review）、完了条件（欠落 handoff・help・office・resume）、秘匿情報ガード（欠落 test・playwright-mcp-e2e。テストフィクスチャに実データを入れない観点）。見出しは `## 非対話実行時` と `## 完了条件` に統一し、本文ラベルは 1 種に統一する（括弧誤記も修正）。重複記述自体は単体駆動のための意図的コストであり、共通 include 化はしない
- doctor に 3 検査を追加する: (1) `## 非対話実行時`・`## 完了条件` の見出し欠落 → warn、(2) body 内の `/<name>` 参照が実在スキルでない → error、被参照ゼロのスキル → warn、(3) allowed-tools の裸 `Bash` → warn（実装系スキルの正当例外があるため error にしない）。加えて doctor 自体をフィクスチャで検証する自動テストを `skill.test.ts` に追加する
- doctor に追加しないもの: description 長の上限（最長 258 文字の review-others は起動精度のためのトリガー語列挙で意図的）、`Task, Agent` 併記の正規化（`Agent` が現行正式名・`Task` が旧名で、併記は互換の保険として妥当）

## Consequences

- `/implement` の出口文言（現在「実装完了後は `/test`」）に `/qa` の提案を追加する
- `/test` スタブの description に `/qa` との関係（台帳があればコード化）を追記する
- CLAUDE.md にワークフロー全体の順序を記載する（現状は各スキルの位置づけが散在し、順序が読めない）
- 上記 3 点は本トピックの `/plan` で作業項目に含める
- doctor に検査項目を追加する（裸 `Bash`・定型節の欠落・スキル間リンクの死活・description 長。具体項目は後続論点で確定）
- 他プロジェクトのフォーク差分を読む作業が発生する。フォーク先の実名・案件名は decisions/・plans/ に書かず「プロジェクト A/B」と一般化する
- ドッグフーディングには spec-import・migrate-verify・office 用のサンプル入力（架空データ）の準備が必要
- 逆輸入候補（[汎用] 分類、計 15 項目前後）を `/plan` で個別確定する。review: 指摘の 2 軸分類（Severity × 自動修正可/判断要）・修正案も論点も無い指摘の破棄・機械検出可能項目の除外（責務分離）・Blocker は文書化済み制約に辿れること・エリア単位の並列 Explore。qa: 台帳を状態の唯一の正本とし他所はポインタのみ・非対話時の秘匿情報自動伏字化と箇所列挙。discuss: 選択肢を絞る前の過去の学び検索・既存決定を覆すときの Superseded 記法・プロジェクト固有の判断レンズを CLAUDE.md の 1 箇所に置き discuss/plan/review が共通参照する構造
- 被参照ゼロだった `ck-todo`・`ck-todo-list`・`ck-note` が本線（review・qa・discuss の出口）に接続される
- qa の「High 未コード化を合格ゲートにする」（フォーク）と「ゲートにせず件数を示す」（ck）は方針が真逆のため、個別確定時に判断する（未決）
- 裸 `Bash` の warn は debug・implement・migrate-verify・playwright-mcp-e2e・qa・refactor・review・test の 8 件で毎回出続ける。正当例外を黙らせる仕組み（例: スタブ側の明示マーカー）が要るかは `/plan` で決める
- 定型節の見出し統一は 26 本体の一括編集になるため、`/plan` では機械的な置換と手作業の分担を明示する

## Discussion Log

### 2026-09-07 discuss

#### Decision: `/implement → /qa → /test` を正規順序として確定する
- **Constraint**: `/qa` は `/test` の前段（または並走）に位置づけ、`/implement` の出口で必ず提案する任意ステップとする。`/test` は qa 台帳があればコード化する
- **Why**: qa/test の本体はすでに「qa は test の前段または並走」「test は台帳の active ケースをコード化」と記述しており、README の変更は 6 月の qa 導入時の暗黙の前提を追いつかせたもの。順序の決定は記録されていなかったため今回確定する。修正量が最小で本体と一致する
- **Rejected alternatives**: 旧順序 `/test → /qa` に戻す（qa/test 本体の記述と矛盾し修正量が増える）。順序を規定せず並走のみとする（qa の導線が消え、孤児スキルを増やす方向になる）

#### Decision: 評価は構造整合・実運用逆輸入・ドッグフーディングの 3 軸すべてで行う
- **Constraint**: 主軸は (b) 実運用逆輸入。(a) 構造整合は doctor 拡張として常設化し、(c) ドッグフーディングは 26 スキル全体を対象に一巡する
- **Why**: 他プロジェクト 2 件の調査で、ck の実運用はこのリポジトリではなくフォーク先で進んでいた。B は 14 個の `pj-*` フォークが 2026-08-18 まで成長を続け（review 相当 295 行 vs ck 120 行、qa 相当 256 行）、`ck skill print` 参照ゼロの完全分岐。A は 2026-05-22 の旧版フォーク 10 個を保持しつつ ck 本体も併用。成果物の有無では spec-import・migrate-verify・ck-note/todo が両プロジェクトでゼロ。フォーク差分は実証済みの改善要求であり推測より確実。(a) は安価で再発防止に効く。(c) は未使用スキルの動作を確かめる唯一の手段
- **Rejected alternatives**: (b) のみ・(a)+(b) のみに限定する（ユーザーが全軸採用を選択）

#### Decision: 逆輸入は ck の規約を変えずに入るプロセス改善に限定し、未解決論点キューは ck-todo で代替する
- **Constraint**: 判定基準は「保存先・命名・言語の規約を変えずに入る差分だけ逆輸入。規約を要求する差分は既存 ck 機能で代替できるか検討し、できなければ見送る」。記録モデル（番号付き ADR・対話ログ分離・`pendings/`・learnings 台帳）は不採用。`pendings/` の役割は `ck-todo` に担わせ、review・qa・discuss の出口導線を張る。learnings 台帳は `doc-this` の Rule of Three と重なるため導入しない
- **Why**: フォーク差分の分類は review 汎用 7/固有 5/規約分岐 5、qa 4/3/2、discuss 4/1/3。規約分岐はすべて別の記録モデル（番号 ADR・pendings・learnings の三角連携）に根があり、採用すると decisions/ 規約の破壊的変更になりプロジェクト A の既存 decisions/ 24 件と非互換、かつ ck の可搬性（外部参照ゼロ）を失う。一方フォークが実運用で価値を出した「判断要の項目を取りこぼさない」仕組みは、未使用のまま存在する ck-todo で新ディレクトリなしに実現でき、孤児スキルの処遇にも同時に答えが出る
- **Rejected alternatives**: 規約は ck が正でプロセス改善のみ逆輸入し三角連携は入れない（案 1。ck-todo での代替が可能なため上位互換の案 3 を採用）。フォークの記録モデルを ck に採用する（案 2。破壊的変更と非互換）

#### Decision: 26 スキルをすべて維持し、孤児スキルは導線接続で本線につなぐ
- **Constraint**: 削除・deprecated 化は行わない。git-issue-plan は kickoff の Issue キー検出から、git-issue-create は review・review-others・qa のフォローアップ出口から、ck-note は kickoff・debug の調査途中の気づきから、それぞれ案内する。spec-import・migrate-verify はドッグフーディングで動作確認し、動かなかった場合のみ削減を再検討する
- **Why**: 被参照ゼロ・成果物ゼロの原因を 2 プロジェクトの痕跡で確認すると、「需要が無い」ではなく「導線が無い」（git-issue 系は A に旧版フォーク、B の CLAUDE.md に Issue 運用の記述）または「投入前」（spec-import・migrate-verify は B に 2026-08 更新のフォークがあるが成果物ゼロ）と読める。refactor・commit・pr・resume・help は成果物を残さない種類で測定不能
- **Rejected alternatives**: 成果物ゼロのスキルを deprecated 扱いで残す（B の需要と矛盾し印の実装コストも生じる）。成果物ゼロのスキルを削除する（B で使う予定のものを消し復元コストが高い）

#### Decision: 定型節を全スキルに揃えて文言を統一し、doctor に見出し・リンク死活・裸 Bash の検査と自動テストを追加する
- **Constraint**: 非対話規定・完了条件・秘匿情報ガードの欠落を補完し、見出しを `## 非対話実行時`・`## 完了条件` に、本文ラベルを 1 種に統一する。doctor は (1) 見出し欠落 warn、(2) 存在しないスキルへのリンク error と被参照ゼロ warn、(3) 裸 `Bash` warn の 3 検査を追加し、フィクスチャによる自動テストで doctor 自体を守る。description 長と `Task, Agent` 併記は検査しない
- **Why**: 非対話規定の文言は 11 通りに分岐し半角括弧の誤記もある。欠落は非対話 5・完了条件 4・秘匿 2。doctor は構造検査 9 項目のみで、今回発見した種類の劣化を一切検出しないため、直しても再発を止められない。裸 Bash の 8 件はすべてプロジェクト固有のビルド・テストコマンドを実行する実装系で正当な例外と判断し、error ではなく warn にする。description 長と Task/Agent 併記は調査で意図的・妥当と結論が出た
- **Rejected alternatives**: 欠落補完のみで doctor を変えない（再発を止められない）。description 長上限と Task/Agent 正規化まで doctor に追加する（問題なしと判定済みで費用対効果が低い）

#### Memos
- プロジェクト B の pj-discuss から非対話ガードと秘匿情報ガードが落ちている。ck→フォーク方向の補填候補で、B 側の作業になるため本トピックの範囲外
- kickoff 調査の「秘匿情報ガード 8/26」は「秘匿」語のみの集計で過小。「伏字」「顧客名」を含めると書き込み系にはほぼ全て入っており、欠落は test・playwright-mcp-e2e の 2 件
- kickoff 調査の「`Agent` は実在ツール名でない」は誤り。`Agent` が現行正式名、`Task` が旧名
- `decisions/README.md` 末尾に未ステージの混入行 `5555` がある。編集ミスと見えるが本トピックの対象外で、除去は別途判断
- 逆輸入候補の個別確定と、qa のゲート方針（High 未コード化）の裁定は `/plan` に持ち越す

### 2026-09-07 plan

プラン: `plans/2026-09-07-ck-skills-inventory-and-hardening.md`（8 ステップ。現在のブランチ `fix/skill-review-followups` で続ける）。

- Step 1 定型節統一 → Step 2 出口導線接続 → Step 3 CLAUDE.md ワークフロー順序 → Step 4 doctor 3 検査＋自動テスト → Step 5〜7 review・qa・discuss への逆輸入 → Step 8 使い捨てリポジトリでの 26 スキルドッグフーディング
- プラン議論で確定: 逆輸入は R1〜R5・R7・Q1・Q2・D1〜D3 を採用し Q3（High 未コード化ゲート）は不採用。裸 Bash の正当例外は `skill.ts` の定数 `BARE_BASH_ALLOWED` にハードコード。ドッグフーディングはスクラッチパッド配下の使い捨てリポジトリで架空データのみ使用

### 2026-09-07 implement（ドッグフーディング結果）

使い捨てリポジトリ（架空の在庫管理サンプル）で 26 スキルを 3 系統（主系列 11・補助 11・仕様書/移行系 5）に分けて一巡した。結果は合格 18・規定どおりの縮退 8（discuss・plan・commit・pr・new-project の非対話停止、git-issue 系のリモート無し停止、playwright-mcp-e2e の前提不足停止）・不合格 0。合否表は `plans/2026-09-07-ck-skills-inventory-and-hardening.md` の Step 8。

発見 14 件を修正した（1 発見 1 コミット、計 9 コミット）:
- 非対話チェーンの行き止まり: plan の既定がデフォルトブランチ上のままで commit/pr が停止 → plan 既定を新ブランチ名の記録に変更
- 連続ステップの hunk 融合で「1 ステップ=1 コミット」が成立しない → commit に畳み込み規定
- `git diff || fallback`・`ls` がフック環境で潰れて誤判定 → rev-parse 確認と find に変更（test・review・resume）
- decisions 照合がブランチ slug 依存 → plans/ の slug をフォールバックに（review・pr）
- spec-import の保存前 Grep ゲートが非対話で実行不能 → 検査対象を入力側に明確化
- qa ↔ spec-import（機能名解決）・qa ↔ migrate-verify（責務境界・データ突合行・ヘッダ更新対象）の接合
- debug ↔ refactor の接合（/commit を挟む）・debug の decisions 初期化を ADR-lite に統一・スラグ規則の内包
- CLI: 日本語 TODO を `ck todo done` で引けない → 本文タイトル照合。toSlug の先頭・連続ハイフン除去
- office の docx で Title スタイルが本文扱い → 最上位見出しに

削減対象は出なかった（spec-import・migrate-verify とも動作し、仕込んだ不一致 4 件を全件検出）。所見 3 件（office の規模出力・review-others の grep 一般化・migrate-verify の観点欄長文化）は `.notes/todos/` に登録した。
