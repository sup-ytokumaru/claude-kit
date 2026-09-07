# ck スキル群の棚卸・評価・強化

## タスクの要約とブランチ名

- **タスク**: 26 個の ck スキルを棚卸し、定型節の統一・スキル間導線の接続・doctor の検査拡張・他プロジェクトのフォークからの逆輸入・全スキルのドッグフーディングを行う
- **ブランチ**: `fix/skill-review-followups`（現在のブランチで続ける。ユーザー確定）
- **決定の正本**: `decisions/2026-09-07-ck-skills-inventory-and-hardening.md`

## 調査サマリー

- スタブ 26 / 本体 26 は一致し `ck skill doctor` は緑。旧世代の遺物（superpowers・TodoWrite・`Task(`）はゼロ
- 非対話規定の表記は 11 通りに分岐。見出し型 `## 非対話実行時` 6 件、見出し文言ゆれ 1 件（qa）、太字ラベル型 8 件（うち半角括弧の誤記 2 件: git-issue-plan・review-others、文言相違 2 件: new-project・refactor）、散発的言及のみ 6 件、言及なし 5 件（ck-todo-list・handoff・help・office・review）
- `## 完了条件` は 22/26。欠落は handoff・help・office・resume。debug は `## Phase 4: 修正方針の合意と出口`、test は `## Step 7: 完了報告` を持つが `## 完了条件` も別に持つ
- 秘匿情報ガードの欠落は test・playwright-mcp-e2e の 2 件
- body 内のスキル参照は例外なく `` `/<name>` `` 記法。非スキル参照は `/mcp` 1 件（playwright-mcp-e2e L36、組み込みコマンド）。被参照ゼロは ck-note・git-issue-create・git-issue-plan の 3 件
- 裸 `Bash` は 8 スタブ（debug・implement・migrate-verify・playwright-mcp-e2e・qa・refactor・review・test）。すべてプロジェクト固有のビルド・テストコマンドを実行する実装系
- `skill.ts` の doctor は L56-128 のインライン実装。唯一の export 純関数 `toolMismatches(body, allowedTools)` が検査ロジックのモデル。出力規約は warn `⚠ <skill>: <説明>`（exit 0）、error `✗ <skill>: <説明>` ＋ `N 件のエラー`（exit 1）
- `skill.test.ts` は純関数テスト（インライン文字列）＋実リポジトリ回帰テスト（`for (const s of stubs) test(...)`）の 2 層。一時ディレクトリは使わない。`SKILLS_DIR`/`PLUGIN_SKILLS_DIR` はトップレベル定数で注入不可
- 実運用は他プロジェクト 2 件（A・B）のフォークで進んでいた。B の `pj-*` 14 本は 2026-08 まで成長。差分分類は review 汎用 7/固有 5/規約分岐 5、qa 4/3/2、discuss 4/1/3

## 反映された設計決定

| 決定（decisions/2026-09-07-ck-skills-inventory-and-hardening.md） | 実装ステップ |
|---|---|
| `/implement → /qa → /test` を正規順序として確定する | Step 2（implement 出口・test description）、Step 3（CLAUDE.md） |
| 評価は 3 軸すべてで行う（構造整合・実運用逆輸入・ドッグフーディング） | Step 4（構造整合）、Step 5〜7（逆輸入）、Step 8（ドッグフーディング） |
| 逆輸入は ck の規約を変えずに入るプロセス改善に限定し、未解決論点キューは ck-todo で代替する | Step 2（ck-todo 出口導線）、Step 5〜7（個別項目。記録モデルは不採用） |
| 26 スキルをすべて維持し、孤児スキルは導線接続で本線につなぐ | Step 2（git-issue-plan・git-issue-create・ck-note の導線）、Step 8（spec-import・migrate-verify の動作確認） |
| 定型節を全スキルに揃えて文言を統一し、doctor に見出し・リンク死活・裸 Bash の検査と自動テストを追加する | Step 1（定型節）、Step 4（doctor） |

**除外制約**（却下された代替案。再提案しない）: 旧順序 `/test → /qa`、フォークの記録モデル（番号付き ADR・対話ログ分離・`pendings/`・learnings 台帳）の採用、成果物ゼロスキルの deprecated 化・削除、description 長上限と `Task, Agent` 正規化の doctor 検査、定型節の共通 include 化。

## ステップ間共有コンテキスト

**定型節の正規形**（Step 1 で全 26 本体に適用。Step 4 の検査はこの見出し文字列と完全一致で判定）:

```markdown
## 非対話実行時

<スキル固有の振る舞い。質問できない場合の既定値・書き込みの抑止・停止位置を書く>
```

```markdown
## 完了条件

<何が満たされたら完了か。末尾に「完了後は `/X` → `/Y` を案内する。」の出口導線を 1 文で書く>
```

- 非対話節の中身は「非対話では実行できない」旨の 1 行でもよい（kickoff・discuss・new-project）。節の存在を揃えることが目的
- 秘匿情報ガードの定型文（test・playwright-mcp-e2e に追加）: 「テストコード・フィクスチャに実在の顧客名・案件名・認証情報を書き込まない。仕様や既存データから引く場合は架空値に置換する」

**出口導線の文体**（Step 2。既存の implement L69・review L120・debug L123 に合わせる）: 完了条件の末尾に「完了後は `/X`（条件）→ `/Y` を案内する。」の 1 文。分岐がある場合は箇条書き。

**doctor 新検査の純関数シグネチャ**（Step 4。`toolMismatches` と同じ「ファイル I/O なし・doctor が読み込みを担当」の流儀）:

```ts
// packages/ck/src/cli/commands/skill.ts
export const REQUIRED_SECTIONS = ['## 非対話実行時', '## 完了条件'] as const;
export const BUILTIN_COMMANDS = new Set(['mcp']); // Claude Code 組み込み。スキル参照の死活検査から除外
export const BARE_BASH_ALLOWED = new Set([       // 裸 Bash を正当例外として許す実装系スキル（Step 5 議論で確定）
  'debug', 'implement', 'migrate-verify', 'playwright-mcp-e2e', 'qa', 'refactor', 'review', 'test',
]);

/** 必須見出しの欠落を返す（warn） */
export function missingSections(body: string): string[];
/** body 内の `/<name>` 参照のうち実在スキルでも組み込みでもないものを返す（error） */
export function deadSkillLinks(body: string, skillNames: Set<string>): string[];
/** 全 body から参照グラフを作り、被参照ゼロのスキル名を返す（warn） */
export function orphanSkills(bodies: Map<string, string>): string[];
/** allowed-tools に裸の `Bash`（`Bash(` でない）があれば true */
export function hasBareBash(allowedTools: string): boolean;
```

- スキル参照の抽出正規表現: `` /`\/([a-z][a-z0-9-]*)`/g ``（バッククォート＋先頭スラッシュ。`Skill: <name>` 形式は `TOOL_SIGNALS` の関心事で混同しない）
- 裸 Bash の判定: `allowedTools.split(',').map(t => t.trim()).includes('Bash')`（`Bash(git status:*)` は `Bash(` で始まるため一致しない）

## ステップ

### Step 1: 定型節の統一と欠落補完

- [x] 26 本体の非対話規定を `## 非対話実行時` 見出し型に統一し、完了条件・秘匿情報ガードの欠落を補完する

**コミット**: `fix: 全スキルの非対話規定・完了条件・秘匿情報ガードの定型節を統一`

**ファイル変更**（すべて `packages/ck/src/skills/<name>/body.md`）:

| 作業 | 対象 | 内容 |
|---|---|---|
| 見出し文言修正 | qa L13 | `## 非対話実行時の振る舞い` → `## 非対話実行時` |
| 太字ラベル→見出しへ昇格 | debug L17・implement L14・plan L5・playwright-mcp-e2e L6・git-issue-plan L5・review-others L24・new-project L9・refactor L14 | `**非対話実行（…）**: <本文>` を `## 非対話実行時` 節に置き換え（本文は維持。半角括弧誤記・文言相違はこの置換で消える） |
| 散発言及→見出し節へ集約 | ck-note L9・ck-todo L9・doc-this L11・kickoff L3,L87・resume L32・spec-import L11,L48 | 既存の言及を `## 非対話実行時` 節にまとめる。kickoff は「本スキルは非対話型。`AskUserQuestion` を使わない」の 1 行節 |
| 非対話節の新規追加 | ck-todo-list・handoff・help・office・review | スキル固有の既定値を書く（例: review「非対話では `/commit` への遷移を案内せず報告で停止」、office「非対話では出力先の確認を省き既定パスへ書く」） |
| 完了条件の新規追加 | handoff・help・office・resume | 既存の末尾節を `## 完了条件` に整形（handoff: handoff ファイル書き出し完了、resume: 状態復元と次アクション提示、help: 回答提示、office: テキスト化完了と保存先報告） |
| 秘匿ガード追加 | test・playwright-mcp-e2e | 共有コンテキストの定型文を非対話節または該当ステップ末尾に追加 |

**Why**: 検査（Step 4）は見出し文字列の完全一致で判定するため、先に全本体を正規形に揃えないと warn が最大 13 件出てノイズになる。重複記述は単体駆動のための意図的コストであり、共通化しない。

**検証**: `bun run packages/ck/src/cli.ts skill doctor` が緑。`grep -L "^## 非対話実行時" packages/ck/src/skills/*/body.md` と `grep -L "^## 完了条件" packages/ck/src/skills/*/body.md` がともに空。`grep -rn "非対話" packages/ck/src/skills/*/body.md | grep -v "^[^:]*:[0-9]*:## 非対話実行時" | grep "^\*\*\|\*\*非対話"` が空（太字ラベル型が残っていない）。

**依存**: なし。**生産物**: 正規形に揃った 26 本体（Step 4 の検査が緑になる前提条件）。

### Step 2: スキル間の出口導線を接続する

- [x] implement 出口に `/qa`、review・review-others・qa・discuss の出口に `/ck-todo`・`/git-issue-create`、kickoff に `/git-issue-plan`・`/ck-note`、debug に `/ck-note` の導線を追加し、test の description に `/qa` との関係を追記する

**コミット**: `feat: スキル間の出口導線を接続（qa・ck-todo・git-issue・ck-note）`

**ファイル変更**:

| ファイル | 位置 | 変更 |
|---|---|---|
| `packages/ck/src/skills/implement/body.md` | L69（完了条件本文） | 「完了後は `/test` → `/review`」→「完了後は `/qa`（台帳を設計する規模なら。任意）→ `/test`（後置きテストの本作成。qa 台帳があれば active ケースをコード化）→ `/review` を案内する」 |
| `plugins/ck/skills/test/SKILL.md` | L3 description | 末尾に「/qa で台帳を設計済みならその active ケースをコード化する。」を追記（メタデータの正本はスタブ側） |
| `packages/ck/src/skills/kickoff/body.md` | L15 直後 | 「Issue キーが検出された場合、Step 4 で `/git-issue-plan`（Issue 本文の取得と着手）を候補に加える」 |
| `packages/ck/src/skills/kickoff/body.md` | Step 4（L76〜） | 提案リストに「Issue 起点 → `/git-issue-plan`」を追加。末尾に「調査中の副次的な気づき（タスク外の不具合候補など）は `/ck-note` で残す」 |
| `packages/ck/src/skills/debug/body.md` | Phase 4（L85〜）または完了条件 L121 | 「調査で見つかった別件の不具合候補は `/ck-note` に残し、本件の修正に混ぜない」 |
| `packages/ck/src/skills/review/body.md` | 完了条件 L118-120 | 「ユーザー判断が要る指摘（判断要）は `/ck-todo` に積む。修正を別 Issue に切り出す場合は `/git-issue-create`」 |
| `packages/ck/src/skills/review-others/body.md` | 完了条件 L188-190 | 同上（フォローアップ節 L160 は報告テンプレ内の見出しなので触らない） |
| `packages/ck/src/skills/qa/body.md` | 完了条件 L236〜 | 「`要確認` に降格したケースのうちオーナー判断が要るものは `/ck-todo` にケース ID のポインタを積む（台帳が正本。内容はコピーしない）。仕様側の修正が要るものは `/git-issue-create`」 |
| `packages/ck/src/skills/discuss/body.md` | ラップアップ節または完了条件 L177 | 「未解決のまま残した論点は `/ck-todo` に積む（decisions/ には決定のみ記録する）」 |

**Why**: decisions の決定 1・3・4a。被参照ゼロの 3 スキル（ck-note・git-issue-create・git-issue-plan）はこの導線で本線に接続され、Step 4 の孤児 warn が自然消滅する。`pendings/` の役割は ck-todo が担う。

**検証**: `grep -c "/git-issue-plan\|/ck-note" packages/ck/src/skills/kickoff/body.md` が 2 以上。`grep -l "/ck-todo" packages/ck/src/skills/{review,review-others,qa,discuss}/body.md` が 4 件。`grep -l "/git-issue-create" packages/ck/src/skills/{review,review-others,qa}/body.md` が 3 件。`grep "/qa" packages/ck/src/skills/implement/body.md` に完了条件行が含まれる。`ck skill doctor` 緑。**手動確認**: test スタブの description 変更は Claude Code のセッション再起動後に反映されるため、再起動して `/ck:test` のトリガー文が更新されていることを確認。

**依存**: Step 1（完了条件節が全スキルにあること。handoff 等には導線を足さないが、review の非対話節と完了条件を同時に触るため）。**生産物**: 孤児ゼロの参照グラフ（Step 4 の `orphanSkills` が空を返す前提条件）。

### Step 3: CLAUDE.md にワークフロー順序を記載する

- [x] ルート CLAUDE.md にスキルの使用順序（主系列＋補助スキル）を追記する

**コミット**: `docs: CLAUDE.md にスキルのワークフロー順序を記載`

**ファイル変更**: `CLAUDE.md` L62（`### スキルの二層構造` の直前）に `### スキルのワークフロー順序` を新設:

```markdown
### スキルのワークフロー順序

主系列: `/kickoff → /discuss → /plan → /implement → /qa（任意） → /test → /review → /commit → /pr → /handoff`、次セッションは `/resume` で復帰。
`/qa` は `/test` の前段（台帳を設計してからコード化）。`/implement` の出口で必ず提案され、台帳が要らない規模なら飛ばして `/test` へ進む。

補助（主系列のどこからでも）: `/debug`（不具合調査）・`/refactor`（挙動不変の構造改善）・`/review-others`（他者コードの監査）・`/git-issue-plan`（Issue 起点の着手）・`/git-issue-create`（フォローアップの起票）・`/ck-todo`（判断待ちの論点を積む）・`/ck-note`（調査中の気づき）・`/doc-this`（恒久ドキュメント化）。
仕様書系: `/office → /spec-import → /qa`。移行系: `/qa`（移行モード）→ `/migrate-verify`。
```

**Why**: 決定 1。現状は各スキルの位置づけが CLAUDE.md L90-96 の成果物パス表に散在し順序が読めない。成果物パス表（L90-96）は保存先の正本として残し、順序はこの節に一元化する（重複させない）。README.md のフロー図（ステージ済み）と表記を揃える。

**検証**: `grep -n "スキルのワークフロー順序" CLAUDE.md` が 1 件。README.md L54 のフロー図と主系列の順序が一致することを目視確認。

**依存**: Step 2（implement 出口の文言と `/qa` の位置づけを一致させる）。**生産物**: 順序の正本（Step 8 のドッグフーディングはこの順序で回す）。

### Step 4: doctor に 3 検査と自動テストを追加する

- [x] `skill.ts` に純関数 4 つと定数 3 つを追加し、doctor に組み込み、`skill.test.ts` にフィクスチャテストを追加する（実施時の発見: review-others が自己参照のみで孤児だったため review の位置づけに導線を追加）

**コミット**: `feat: skill doctor に定型節・リンク死活・裸 Bash の検査を追加`

**ファイル変更**:

- `packages/ck/src/cli/commands/skill.ts`
  - L40-54 付近: 共有コンテキストの `REQUIRED_SECTIONS`・`BUILTIN_COMMANDS`・`BARE_BASH_ALLOWED` と純関数 4 つを `toolMismatches` の隣に export
  - L100-107（`allowedTools` 取得直後）: `hasBareBash(allowedTools) && !BARE_BASH_ALLOWED.has(s)` なら warn `⚠ <s>: allowed-tools に裸の Bash が含まれています（実装系スキル以外は Bash(<cmd>:*) で列挙してください）`
  - L116-118（body 読み込み直後）: `missingSections(body)` の各項目を warn `⚠ <s>: 定型節 <見出し> がありません`。同時に `deadSkillLinks(body, skillNames)` の各項目を error `✗ <s>: 存在しないスキル /<name> を参照しています`。body を `bodies: Map<string,string>` に蓄積
  - L119 直後（bodies ループの外）: `orphanSkills(bodies)` の各項目を warn `⚠ <s>: どのスキルからも参照されていません（ユーザー直接起動のみ）`
- `packages/ck/src/cli/commands/skill.test.ts`
  - 純関数テスト（インライン文字列フィクスチャ）: `missingSections`（両方あり→空、片方欠落、`## 非対話実行時の振る舞い` のような文言ゆれは欠落扱い）、`deadSkillLinks`（実在→空、`/mcp` は除外、`/nonexistent` は検出、`Skill: name` 形式は無視）、`orphanSkills`（3 スキルの参照グラフで被参照ゼロを 1 件返す。自己参照は被参照に数えない）、`hasBareBash`（`Bash` → true、`Bash(git status:*)` → false、`Bash,Read` → true）
  - 実リポジトリ回帰テスト（既存 L70-87 の `for (const s of stubs)` パターンに追加）: 全 body で `missingSections` が空、`deadSkillLinks` が空、全 body から `orphanSkills` が空、`BARE_BASH_ALLOWED` 外のスタブで `hasBareBash` が false

**Why**: 決定 4b。純関数 export 方式は既存 `toolMismatches` と同じ流儀で、`SKILLS_DIR` が注入不可でもフィクスチャテストが書ける。doctor 本体の DI リファクタは行わない（既存の実リポジトリ回帰テストが統合面を担う）。error と warn の使い分けは決定どおり（死活のみ error）。

**検証**: `cd packages/ck && bun test src` が全緑。`bun run packages/ck/src/cli.ts skill doctor` が `✓ 26 スキル — 問題なし`（警告 0 件。Step 1・2 が済んでいれば warn は出ない）。一時的に body に `` `/nonexistent` `` を書いて doctor が exit 1 になることを確認し、戻す。

**依存**: Step 1（見出し検査が緑になる）、Step 2（孤児検査が緑になる）。**生産物**: 再発防止の常設ガード。以降の Step 5〜8 の各コミット前に `ck skill doctor` を回す。

### Step 5: review に B フォークのプロセス改善を逆輸入する

- [x] review 本体に、Step 5 議論で採用が確定した項目（R1〜R7）を追加する

**コミット**: `feat: review に指摘の判断要フラグ・スコープフィルタ・制約追跡を逆輸入`

**ファイル変更**: `packages/ck/src/skills/review/body.md`

> **[設計決定（確定）: 逆輸入項目]** プラン議論で推奨どおり確定。R1〜R5・R7 を採用、R6 は R5 に含める。
>
> | ID | 項目 | 採否 | 理由 |
> |---|---|---|---|
> | R1 | 指摘に Fix mode（自動修正可 / 判断要）を付ける。Severity の high/medium/low は維持し 2 軸化 | 採用 | 判断要が `/ck-todo` 出口（Step 2）の入力になる。分水嶺は「修正が具体手順の一列で表せるか」 |
> | R2 | 修正案も論点も無い指摘は報告に載せない | 採用 | ノイズ削減。1 行の規則で済む |
> | R3 | 型・lint・format で機械検出できるものは指摘に再掲せず、実行結果を「preflight」として可否だけ記録 | 採用 | 既存の Step（型/Lint 実行）の出力形式を変えるだけ |
> | R4 | high の指摘は文書化済み制約（CLAUDE.md・decisions/・plans/）に辿れること。辿れない場合は「判断要」に落とし新しい制約を発明しない | 採用 | decisions/ を制約源として使う ck の設計と整合 |
> | R5 | 差分が大きいとき（例: 変更ファイル 15 以上）はエリア単位の並列 Explore（最大 2）に分け、横断チェックはメインが担当 | 採用（閾値付き） | review は既に `Task, Agent` を持つ。閾値は本文に明記 |
> | R6 | 横断スキャンはサブエージェントに委譲しない | R5 に含める | 独立項目にしない |
> | R7 | 同種の指摘が 3 回目なら `/doc-this`（Rule of Three）を提案 | 採用 | learnings 台帳は不採用のため、既存 doc-this に接続 |

**検証**: `ck skill doctor` 緑。`bun test src` 緑。**手動確認**: このリポジトリの Step 1〜4 の差分に対して `/ck:review` を実行し、報告に Fix mode 列と preflight 節が出ることを確認（Step 8 のドッグフーディングと兼ねてよい）。

**依存**: Step 2（`/ck-todo` 出口が存在すること）、Step 4（doctor で検証）。**生産物**: 逆輸入済み review。

### Step 6: qa に B フォークのプロセス改善を逆輸入する

- [x] qa 本体に Q1・Q2 を追加し、Q3（ゲート方針）は議論結果に従う（不採用を明文化）

**コミット**: `feat: qa に台帳正本の規則と非対話時の秘匿情報自動伏字化を逆輸入`

**ファイル変更**: `packages/ck/src/skills/qa/body.md`

> **[設計決定（確定）: qa の逆輸入項目]** プラン議論で推奨どおり確定。Q1・Q2 採用、Q3 不採用。
>
> | ID | 項目 | 採否 | 理由 |
> |---|---|---|---|
> | Q1 | 台帳を状態の唯一の正本とし、他所（ck-todo・Issue）にはケース ID のポインタだけ置く。解決時は台帳更新とポインタ消し込みを同一サイクルで行う | 採用 | Step 2 の ck-todo 出口と対で必要 |
> | Q2 | 非対話時は秘匿情報を自動で伏字化し、伏字化した箇所を完了報告に列挙する | 採用 | 現状の「提案して停止」より非対話で前に進める |
> | Q3 | High 優先度の未コード化を合格ゲートに含める | **不採用** | ck の「数を埋めること自体を目的にしない」方針と真逆。代替として完了報告に High 未コード化件数を明示し `/test` を案内する現状を明文化する |

**検証**: `ck skill doctor` 緑。`grep -n "ポインタ\|伏字" packages/ck/src/skills/qa/body.md` に Q1・Q2 の記述が含まれる。qa の概念量・行数は意図的に厚いため、削減はしない。

**依存**: Step 2。**生産物**: 逆輸入済み qa。

### Step 7: discuss に B フォークのプロセス改善を逆輸入する

- [x] discuss 本体に D1〜D3 を追加する（D3 は plan・review にも参照行を追加）

**コミット**: `feat: discuss に過去の学び検索・Superseded 記法・判断レンズ参照を逆輸入`

**ファイル変更**: `packages/ck/src/skills/discuss/body.md`（D3 は `plan/body.md`・`review/body.md` にも 1 行ずつ）

> **[設計決定（確定）: discuss の逆輸入項目]** プラン議論で推奨どおり確定。D1〜D3 採用。
>
> | ID | 項目 | 採否 | 理由 |
> |---|---|---|---|
> | D1 | 選択肢を絞る前に `decisions/`・`.claude/docs/`・`.notes/` を grep し「前に試したか」を確認する手順をコアバリュー「コミットする前に理解する」に追加 | 採用 | learnings 台帳の代替を既存ディレクトリで行う |
> | D2 | 既存決定を覆すときは旧決定ファイルの `## Decision` に「Superseded by `<date>-<slug>`」を追記する | 採用 | ADR-lite のまま履歴が追える |
> | D3 | CLAUDE.md に任意節「判断レンズ」があれば discuss・plan・review が共通参照する（無ければ無視） | 採用 | 構造は汎用。レンズの中身はプロジェクト側に任せる |

**検証**: `ck skill doctor` 緑。**手動確認**: 本トピックの decisions ファイルに対して `/ck:discuss` を追加論点で起動し、D1 の grep 手順が実行されることを確認（Step 8 と兼ねてよい）。

**依存**: Step 2。**生産物**: 逆輸入済み discuss。

### Step 8: 26 スキルのドッグフーディング

- [x] 使い捨てリポジトリで全スキルを主系列の順に一巡し、詰まり・矛盾・実行不能手順を記録して修正する（26 スキル: 合格 18・規定どおり縮退 8・不合格 0。発見 14 件を 9 コミットで修正、所見 3 件を `.notes/todos/` に登録）

**コミット**: 発見ごとに `fix: <skill> の <問題> を修正`（1 発見 1 コミット。ドッグフーディング自体はコミットを生まない）

> **[設計決定（確定）: ドッグフーディングの実施場所]** スクラッチパッド配下に `git init` した使い捨てリポジトリで回す（プラン議論で確定）。架空データのみ使用（架空の業務名・人名は使わず「機能 A」「顧客 X」の記号）。**Why**: このリポジトリで回すと `specs/`・`tests/qa/`・`reviews/` の成果物がプラグイン開発リポジトリを汚す。結果は本プランの下表に記録し、完了時に decisions の Discussion Log に要約を追記する。

**手順**:

1. 使い捨てリポジトリを用意する: 小さな TypeScript プロジェクト（関数 2〜3 個・テスト 1 本）。仕様書サンプルとして架空の xlsx/docx を python3（openpyxl・python-docx）で生成。移行データサンプルとして旧新 2 つの CSV（件数差・キー欠落・値差・形式差を 1 件ずつ仕込む）
2. 主系列を順に回す: `/kickoff → /discuss → /plan → /implement → /qa → /test → /review → /commit → /pr（ドライラン。実際のリモートには push しない）→ /handoff → /resume`
3. 補助を回す: `/debug`（仕込んだバグで）、`/refactor`、`/review-others`（0 からモード）、`/git-issue-create`・`/git-issue-plan`（ドライラン。実際の起票はしない）、`/ck-note`・`/ck-todo`・`/ck-todo-list`、`/doc-this`、`/help`、`/new-project`（空ディレクトリで）
4. 仕様書・移行系を回す: `/office → /spec-import → /qa（移行モード）→ /migrate-verify`、`/playwright-mcp-e2e`（Playwright MCP が接続できる場合のみ。できなければ前提検証の縮退動作を確認）
5. 各スキルの合否を下表に記録する。合格基準: エラーなく `## 完了条件` に到達し、規定パスに成果物が生成され、出口導線が次のスキルを正しく案内する

| スキル | 結果 | 発見 | 修正コミット |
|---|---|---|---|
| kickoff | 合格 | なし | なし |
| discuss | 縮退（規定どおり） | 非対話では decisions/ に書かず停止 | なし |
| plan | 縮退（規定どおり） | 非対話既定「現在のブランチで続ける」が main 上で下流 commit/pr を行き止まりにする | 329c329 |
| implement | 合格 | 連続ステップの同一箇所編集で hunk が融合し commit の 1 ステップ=1 コミットが成立しない | 4a73f18（commit 側） |
| qa | 合格 | specs/ の機能名解決規約が無い。移行モードで新データ突合の責務が migrate-verify と重なる。データ突合行が無い | 11787c0 |
| test | 合格 | `git diff \|\| fallback` がフック環境で空出力になり変更 0 件と誤判定 | 011b135 |
| review | 合格 | 同上。decisions 照合がブランチ slug 依存。`ls` 判定が潰れる | 011b135 |
| commit | 縮退（規定どおり） | デフォルトブランチ上で停止（plan 既定の問題） | 329c329・4a73f18 |
| pr | 縮退（規定どおり） | リモート無しで停止。push・作成なし | 011b135（slug フォールバック） |
| handoff | 合格 | なし | なし |
| resume | 合格 | `ls -1t` が潰れて git フォールバックに誤誘導 | 011b135 |
| debug | 合格 | スラグ規則が kickoff 参照のみ。decisions 初期化が ADR-lite と非互換。refactor への出口に /commit が無い | be78431 |
| refactor | 合格 | debug 直後は未コミットで起動不能。非対話規定に記述なし | 同上 |
| review-others | 合格 | なし（Step 2-B の grep が TanStack 専用なのは所見。TODO 登録） | なし |
| git-issue-create | 縮退（規定どおり） | リモート無しを Phase 1 で検出し gh を呼ばず停止 | なし |
| git-issue-plan | 縮退（規定どおり） | 同上 | なし |
| ck-note | 合格 | 日本語主体でファイル名が `--r1` に退化（CLI） | 562aec9（toSlug） |
| ck-todo | 合格 | 日本語のみでファイル名がタイムスタンプに退化（CLI） | 562aec9 |
| ck-todo-list | 合格 | `done` がファイル名照合のみで日本語 TODO を引けない（CLI） | 562aec9（本文タイトル照合） |
| doc-this | 合格 | なし | なし |
| help | 合格 | なし | なし |
| new-project | 縮退（規定どおり） | 非対話では停止 | なし |
| office | 合格 | xlsx 3 シート・docx 表とも欠損なし。docx の Title スタイルが本文扱いになる | 01b9fe8（Title/表題を `#` に） |
| spec-import | 合格（手順逸脱） | 非対話時に「保存予定の内容」を Grep する手順が対象ファイル不在で実行不能。機能名の解決規約が qa 側に無い | 5ebc143（Grep 対象を入力側に）。qa 側は保留中 |
| migrate-verify | 合格 | 仕込み 4 件を全件検出。非対話規定が CSV でも接続情報を求めて停止しかねない。ヘッダ更新対象（データ突合行・コード化行の母数）の列挙漏れ | aeaad87 |
| playwright-mcp-e2e | 縮退（規定どおり） | MCP 未接続・Playwright 未導入で前提チェックリストどおり停止。推測でのコード生成なし | なし |

**タイムボックス**: 1 スキルで修正が 30 分を超える構造的な問題は、その場で直さず `/ck-todo` に積んで次へ進む（スコープ膨張の防止。決定 4a のとおり spec-import・migrate-verify が動かなかった場合の削減再検討もここで起票する）。

**検証**: 上表 26 行がすべて埋まる。各修正コミット前に `ck skill doctor` と `bun test src` が緑。使い捨てリポジトリに実在の顧客名・案件名・認証情報が含まれていないことを `grep` で確認してから破棄する。

**依存**: Step 1〜7 すべて（修正後のスキルを回す）。**生産物**: 26 スキルの動作実績、発見事項の修正コミット、削減再検討の要否。

## リスクと軽減策

| リスク | 軽減策 |
|---|---|
| Step 1 の 26 ファイル一括編集で、本文の意味を変える置換ミスが混入する | 太字ラベル→見出しの置換は本文を動かさず見出し行の挿入と `**…**:` の削除だけを行う。各ファイルの差分を `git diff --stat` で 5 行以内に収め、超えたものは目視レビュー。Step 4 の doctor と Step 8 のドッグフーディングで検出 |
| doctor の新検査が既存 26 スキルで warn を量産し、CLAUDE.md の手順（doctor 実行）がノイズで形骸化する | Step 1・2 を Step 4 より先に実施し、Step 4 完了時点で警告 0 件を検証基準にする。裸 Bash は `BARE_BASH_ALLOWED` で正当例外を黙らせる |
| description 変更（test スタブ）と新見出しは Claude Code のセッション再起動まで反映されず、ドッグフーディングが旧版を回す | Step 8 開始前にセッションを再起動する手順を明記。`ck skill print <name>` で本体の反映を先に確認 |
| ドッグフーディングで構造的な問題が見つかりスコープが膨張する | 30 分タイムボックスと `/ck-todo` 起票。修正は 1 発見 1 コミットで切り離し、後続の別トピックに回せる形にする |
| 使い捨てリポジトリやフィクスチャに実在データが混入する | 架空値のみ使用。破棄前に `grep` で確認。plans/・decisions/ に他プロジェクトの実名を書かず「プロジェクト A/B」で統一（本プランも準拠） |
| 逆輸入で ck の設計方針（qa の「数を埋めない」、全文日本語・自己完結）を崩す | Q3 不採用と除外制約を明記。各逆輸入項目は 1〜3 行の追記に留め、フォークの本文を転記しない（ライセンス上の問題はないが、規約分岐した文言の混入を防ぐ） |

## 曖昧さ

> **[曖昧さ（解消）: 裸 Bash 例外の仕組み]** **User Context**: `skill.ts` の定数 `BARE_BASH_ALLOWED` にハードコードで確定。**Why**: スタブのフロントマターは Claude Code が読むため未知キーの追加は避ける。新規スキルが裸 Bash を宣言すると warn が出て、実装系なら定数に追加する運用。

> **[曖昧さ: decisions/README.md の混入行 `5555`]** 本トピックの範囲外。未ステージのまま残っており、`/commit` 時に論理単位の分割で目に入る。除去の指示があれば Step 1 の前に単独で処理する。

> **[曖昧さ: ステージ済みの README.md 変更]** 現ブランチに README のフロー順変更（`/implement → /qa → /test`）がステージ済み。Step 3 の CLAUDE.md 変更と同じ論理単位なので、`/commit` では Step 3 のコミットに含めるのが自然。
