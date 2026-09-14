# 他者コードレビュー（review-others）

**位置づけ**: **他者が書いたコードをレビュワー側として評価する**スキル。自分の差分を PR 化前に自己レビューする `ck:review`（`implement → test → review → pr` の連鎖）とは立場が逆で、入力・ゴール・出力先がすべて違う。対象は他者の PR/MR・ブランチ差分（差分モード）に限らず、パス指定で既存コード全体（0からモード）も扱う。

| | ck:review（自己） | ck:review-others（他者・本スキル） |
|---|---|---|
| 立場 | 作者 | レビュワー |
| 対象 | 自分の作業差分 | 他者の PR/MR・ブランチ差分、または既存コード全体 |
| ゴール | 自分で直す前の洗い出し | approve / request-changes の判断とコメント |
| 出力 | 自分への指摘 | PR コメント案 + `reviews/` への記録 |

レビューの核心は「**動くか**」ではなく「**正しく・安全に・保守できるか**を実コードで裏取りする」こと。型が通り画面が動いても、認可の付け忘れ・非決定的な集計・サーバー状態の二重管理は隠れる。**すべての指摘は grep / 精読 / tsc で事実確認してから報告する（推測で指摘しない）**。良い設計（なりすまし防止・機密非露出など）は明記し、トレードオフがある指摘は「絶対」と書かない。

---

## Step 1: モード判定

引数（`$ARGUMENTS`）からレビューモードを決める。

- **PR/MR 番号 or ブランチ名** → **差分モード**（Step 2-A）
- **ファイル / ディレクトリのパス** → **0からモード**（Step 2-B）
- **引数なし** → `AskUserQuestion` でどちらかを確認する（対象も尋ねる）

## 非対話実行時

引数があればモード判定どおり進める。引数なしの場合は「現在のブランチとデフォルトブランチの差分」を対象（差分モード）と**推定**して進め、推定であることを報告の冒頭に明記する。ただし現在地がデフォルトブランチ自身で差分がゼロの場合は推定が成立しないため、「レビュー対象を特定できません（PR 番号・ブランチ・パスのいずれかを指定してください）」と伝えて停止する。以降の「確認する」ステップは推奨案を採用し、置いた仮定を最終報告で列挙する。

## Step 2-A: 対象把握（差分モード）

作者の意図を先に掴んでから差分を読む。

1. PR/MR の description・関連 Issue を読む（`gh pr view <n>` / `glab mr show <n>` など。無ければブランチ名・コミットメッセージから意図を推定）。
2. **対象の差分を取得する**。現在の HEAD が対象ブランチとは限らないため、指定方法に応じて明示的に取得する:
   - **PR/MR 番号指定**: `gh pr checkout <n>` / `glab mr checkout <n>` で対象ブランチに切り替える（精読・tsc 検証のため checkout を優先する）。作業ツリーが汚れている等で checkout できない場合は `gh pr diff <n>` / `glab mr diff <n>` で差分のみ取得し、精読はリモート追跡ブランチ（`origin/<head>`）のファイルで行う。
   - **ブランチ名指定**: `git switch <branch>` で切り替えるか、`git diff origin/<base>...origin/<branch>` で差分を取る。
   - **切り替えた場合は元のブランチ名を控えておき、レビュー完了後（Step 7 の記録後）に `git switch <元のブランチ>` で必ず戻す**。ユーザーの作業状態を変えたまま終えない。**途中でエラーや中断が起きた場合も同じ**: 以降のステップが続行不能と判断した時点で、報告の前に必ず `git switch <元のブランチ>` を実行してから停止する。
3. 対象ブランチ上にいる場合、デフォルトブランチとの分岐点からの全変更を対象にする（複数コミットでも漏れない）:

```bash
BASE=$(git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null | sed 's|refs/remotes/origin/||')
git diff --name-only "origin/${BASE:-main}...HEAD" 2>/dev/null \
  || git diff --name-only HEAD~1 HEAD 2>/dev/null \
  || git diff --name-only
```

`HEAD~1` へのフォールバックが発動した場合は**直近1コミットしか見ていない**（「複数コミットでも漏れない」が成立していない）。縮退したことをレビュー報告の冒頭に明記し、可能なら `git fetch origin` 後に再実行する。

4. 差分だけでなく、変更が依存する**関連レイヤー**（呼び出し元・スキーマ・認可ヘルパー）も精読対象に含める。

## Step 2-B: 対象把握（0からモード）

差分が無いので、対象ファイル/ディレクトリを**コールドで精読**する。「最近 git で触られた箇所」に偏らず、対象全体を地図化してから読む。

1. 規模を掴む（対象配下のファイル数・行数。大きければ Step 6 の独立視点起動を視野に入れる）。
2. **対象スタックを判定してから**エントリポイントを grep で特定する。エントリ規約はスタックごとに違うため、当て推量の grep で空振りを重ねない:

```bash
# JS/TS: 依存からフレームワークを判定する
jq -r '(.dependencies // {}) + (.devDependencies // {}) | keys[]' package.json packages/*/package.json apps/*/package.json 2>/dev/null | sort -u  # モノレポも拾う
# 他言語: 依存定義ファイルの有無を見る
ls Gemfile requirements.txt pyproject.toml go.mod pom.xml composer.json 2>/dev/null
```

判定結果に応じてパターンを選び、`grep -rln "<パターン>" <対象パス>` で当てる:

| スタック | ルート / エントリ | スキーマ / データ層 |
|---|---|---|
| TanStack Start / Router | `createFileRoute`・`createServerFn`・`export const Route` | — |
| Next.js | `route.ts`・`page.tsx`・`generateMetadata` | — |
| Remix / React Router | `export const loader`・`export const action` | — |
| Express / Fastify / Hono | `app.get(`・`router.`・`new Hono(` | — |
| NestJS | `@Controller`・`@Get(`・`@Post(` | — |
| Rails | `config/routes.rb`・`< ApplicationController` | `db/schema.rb`・`db/migrate/` |
| Django | `urlpatterns`・`urls.py` | `models.py`・`class Meta` |
| Spring | `@RestController`・`@RequestMapping` | `@Entity` |
| Drizzle | — | `pgTable`・`sqliteTable`・`mysqlTable` |
| Prisma | — | `schema.prisma`・`^model ` |
| TypeORM | — | `@Entity`・`@Column` |
| ActiveRecord / Eloquent | — | `< ApplicationRecord`・`extends Model` |

**表に無いスタック**は、まずディレクトリ命名から当たりをつける（`routes/`・`controllers/`・`api/`・`handlers/` → エントリ、`models/`・`entities/`・`migrations/`・`schema*` → データ層）。
それでも掴めなければ、依存定義から主要フレームワークを1つ特定し、そのルーティング規約を調べてからパターンを決める。

3. 起点から呼び出しを辿り、**データの流れ・認可境界・状態の置き場**を地図化する。
4. 地図ができたら Step 3 以降のレンズを当てる。

## Step 3: 汎用レンズ（スタック非依存）

どのスタックでも当てる観点。`ck:qa`・`ck:review` 由来だが、**本スキル単体で完結するよう以下に展開する**（別スキルを読みに行かなくてよい）。非 TanStack スタックでは Step 4 を skip し、この Step 3 がレビューの主軸になる。

**検証レンズ L1〜L8（WHO 軸＝誰が・どの観点で壊すか）** — 各レンズを実コードに当て、該当する破壊シナリオが防げているか裏取りする:

- **L1 直感操作**: 通常の操作・入力で破綻しないか（空・極端値・想定外の順序）
- **L2 高速大量**: 連打・大量データ・並べ替え/ページングで破綻・性能劣化しないか
- **L3 権限不正**: 権限のないアクターが越境できないか（他人のデータ参照/更新・ロール詐称）
- **L4 既存データ**: 移行データ・既存レコードの想定外の形（null・旧スキーマ）を壊さないか
- **L5 裏側整合**: DB/外部状態と画面表示・キャッシュが食い違わないか
- **L6 並行・負荷**: 同時実行・競合・ロック・順序不定で結果がぶれないか
- **L7 整合障害・復旧**: 複数書き込み（DB / 外部 API / 状態）が原子的か。トランザクションのコミット境界は適切か、途中失敗・部分コミットで中途半端な状態が残らないか、リトライ時に冪等か
- **L8 回帰**: この変更が既存機能・別経路を壊さないか（横展開漏れ）

**コード品質 / セキュリティ / 論理整合性チェックリスト**（`ck:review` と同一）:

- 品質: 未使用 import・null/undefined 漏れ・不要な型アサーション・命名/構成の規約
- セキュリティ: サーバー側バリデーション・機密のログ/レスポンス混入・インジェクション
- 論理整合性: 意図と実装の一致・エッジケース（空配列・null・境界値）

各指摘は「ファイル:行 / 問題 / なぜ / 直し方 / 裏取り」の形で控え、重要度は末尾の Severity Rubric で high / medium / low に分類する。

## Step 4: スタック固有レンズ（TanStack Start 系）

対象が **TanStack Start（createServerFn / loader / search params）+ Drizzle ORM + better-auth**、または同種のフルスタック TypeScript のとき当てる。**該当しないスタックでは本節をまるごとスキップ**し、「固有レンズ該当なし」と記録する（その場合は Step 3 の汎用レンズがレビューの主軸になる。Step 3 は単体で完結しているので、本節を欠いてもレビューの厚みは保たれる）。各観点は grep / 精読で裏取りしてから指摘する。

| 観点 | 何を疑うか | 見つけ方（コマンド/確認） | あるべき姿 |
|------|-----------|--------------------------|-----------|
| **認可の強制** | 各 server fn が認可を手書きで呼ぶ＝付け忘れリスク | `grep -rn ".middleware(\|createMiddleware" src/`（0なら手書き）＋各 `createServerFn` 冒頭の `require*` 有無 | `createMiddleware` で宣言的に強制。data 依存認可はヘルパー併用 |
| **クライアント値の信用** | `createdBy/userId/role` をクライアント `data` から採用＝なりすまし | `grep -n "createdBy\|enteredBy\|data.userId\|user.id" src/lib/server/*.ts` | 作成者等はガード戻り値(`user.id`)から設定。role 入力は拒否 |
| **自己操作の防御** | 自分のロール削除/降格をサーバーが防いでいない | ロール変更 fn に `data.userId === user.id` チェックがあるか | サーバー側で自己降格を拒否（UI で隠すだけは不可） |
| **機密カラム露出** | password/token を select している | `grep -rn "password\|accessToken\|refreshToken\|\.token\|schema.account\|schema.session" src/lib src/routes` | アプリ fn は必要列のみ明示 select |
| **集計の決定性** | 追記式テーブルの「最新1件」を `ORDER BY ts DESC` だけで選ぶ＝同時刻で不定 | `grep -rni "orderBy" src/` で `enteredAt`/`createdAt` 等の時刻キーで並べる箇所を全件洗い出し、タイブレークの有無を横断比較 | 第2キー(`, desc(id)`)でタイブレーク。**全箇所に横展開** |
| **集計の整合** | 立場(role)で抽出条件が違う/status フィルタ漏れ | 同種クエリの分岐(admin vs member)を並べて差分確認 | active 等のフィルタを全分岐で統一 |
| **サーバー状態の二重管理** | loader データを `useState` にコピーし手動 fetch | `grep -rn "useState" src/routes` ＋ `router.invalidate` と手動 fetch の併用 | URL/search param を SSOT に。`useLoaderData()` から読む |
| **状態の置き場** | 「表示中の月」等のナビ状態が `useState`(URL に無い) | `validateSearch`/`loaderDeps` 不使用で `useState` 管理 | search param 化（リロード/戻る/共有が壊れない） |
| **エラー設計** | 文字列例外(`throw new Error('FORBIDDEN')`)＋loader で全例外を 404 握り潰し | `grep -rn "throw new Error('\|catch {" src/` | 型付き例外＋`instanceof` 分岐。想定外はログ+再 throw |
| **ロジック重複** | 同じ集計/クエリが複数ファイルにコピペ（API↔server fn） | 同名処理を複数ファイルで grep | 純粋関数に抽出し共有。認可は1本化 |
| **ドメイン型の境界** | クライアントが `lib/server` から型 import＝混入リスク | `grep -rn "import type.*lib/server" src/components src/lib/pdf` | 型は `lib/types.ts` に分離。可能なら `$inferSelect` |
| **入力検証** | `.validator` 不在 / inline で any 化 / クライアント手書きチェック | `grep -rn ".validator(" src` ＋ 下の IsAny 型テスト | zod schema を渡す。client/server で同一 schema 共有 |
| **DB 制約** | role/status/permission が裸の `text`、頻用列に index 無し | `src/db/schema.ts` を精読 | `pgEnum`/`check`、複合 index。`drizzle-zod` で zod と同期 |
| **フォーム設計** | `<form>` でなく `onClick`、手書き検証 | `grep -rn "Dialog.Root\|onClick={handle" src/routes` で form 有無 | `<form onSubmit>`+`type=submit`+共有 zod `safeParse` |
| **PDF/CJK** | `@react-pdf/renderer` で日本語に標準フォント(Helvetica)使用 | `grep -rn "Font.register\|fontFamily" src/lib/pdf` | CJK フォントを `Font.register` し fontFamily 指定 |

## Step 5: 検証手法

**`.validator` の data が any に劣化していないかを tsc で実証**（型推論された any は `noImplicitAny` で捕捉できない）。この検証は対象ツリーへの checkout が成立している場合のみ実行できる。Step 2-A で diff のみ取得に縮退した場合は本 Step をスキップし、報告に「tsc 検証未実施（checkout 不能のため）」と明記する:

```ts
// 検証ファイルは import 解決と tsconfig 適用のため「対象リポジトリ内」（tsconfig の include 範囲、
// 例: src/__anycheck.tmp.ts）に置き、`npx tsc --noEmit`（プロジェクトの tsconfig が自動適用される）を実行する。
// 検証後に必ずこのファイルを削除する — 削除までを1ステップとして扱い、対象の作業ツリーを汚したまま次に進まない。
// エラーが出たら any。
type IsAny<T> = 0 extends 1 & T ? true : false
createServerFn().validator(theSchema).handler(async ({ data }) => {
  const _c: IsAny<typeof data> extends true ? 'ANY_DETECTED' : 'ok' = 'ok' // any なら代入エラー
})
```

**順序不定の横断検出**: 同じ「最新1件」選択が複数箇所にあるとき、`desc(id)` 等のタイブレークが**全箇所に揃っているか**を1回の grep で並べて比較する（1箇所だけ修正済み＝展開漏れ、が典型）。

## Step 6: 独立視点（オプション）

独立視点は**重い再検証**なので、単発の指摘では起動しない。次のいずれかに該当するときだけ `feature-dev:code-reviewer` エージェント（コードレビュー専用の組み込みエージェント型）を起動して独立した視点で再検証する:

- **根幹に high 級の疑い**: 認可・状態管理・エラー設計のいずれかに **high** の疑いがあり、自分の裏取りだけでは確信が持てない
- **指摘が広範**: 根幹に関わる **medium が複数本**ある（単発の medium では起動しない）
- **規模が大きい**:
  - 差分モード — 変更行数が 200 行超（追加+削除合計。`BASE` は Step 2-A から持ち越せないため同一コマンド内で再取得する: `BASE=$(git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null | sed 's|refs/remotes/origin/||'); git diff --stat "origin/${BASE:-main}...HEAD" | tail -1`）または新規機能の追加（新規ファイル）
  - 0からモード — 対象ファイル数が 5 件超、または同等以上の規模（差分が無いので行数でなく規模で判断する）

## Step 7: 記録

レビュー1回を `reviews/<YYYY-MM-DD>-<slug>.md` に残す（横断索引は作らない）。

1. `reviews/` ディレクトリが無ければ作成する。
2. `<slug>` は対象を表す短い kebab-case（例 `pr123-auth`・`order-module`）。
3. 以下の形式で Write する:

```markdown
# <対象> レビュー（<差分|0から>モード）

## 対象 / 作者の意図
- 対象: PR #123 / src/routes/orders など
- 作者の意図: <description から要約>

## 指摘（high / medium / low）
- **[high]** <ファイル:行> / 問題 / なぜ / 直し方 / 裏取り（grep・tsc の実行内容）

## 判断: approve | request-changes

## PR コメント案
<そのまま PR に貼れる文面>

## フォローアップ
- <別 Issue 化すべき事項・横展開が必要な箇所>
```

4. `reviews/` は git 管理される。**実在の顧客名・案件名・社内システムの認証情報を書き込まない**。
5. `git add` は自動実行しない。記録後に次を出力する:
   > レビューを `reviews/<date>-<slug>.md` に記録しました。ステージングの準備ができたら `git add reviews/<date>-<slug>.md` を実行してください。

## 報告形式

```
## レビュー結果
- 対象: <PR番号 / パス>（<差分|0から>モード）
- 固有レンズ: TanStack Start 系を適用 / 該当なし

**[high/medium/low]** <カテゴリ>
- ファイル: path/to/file.ts:行番号
- 問題: 内容
- 直し方: 対応方法
- 裏取り: 実行した grep / tsc

合計 N件

判断: approve / request-changes
```

良い点（維持すべき設計）も併記する。指摘ゼロなら「指摘事項なし — approve 可」と明示する。

## 完了条件

レビュー結果を報告し、`reviews/<date>-<slug>.md` に記録した時点で完了。request-changes の場合は作者の修正後に再レビュー（`/review-others` 再実行）を案内する。レビュワー側の判断待ち事項は `/ck-todo` に積み、フォローアップを Issue 化する場合は `/git-issue-create` を案内する。

---

## Severity Rubric（指摘の重要度判定）

| 重要度 | 基準 |
|--------|------|
| high | 機能不成立・認可漏れ・なりすまし・ロックアウト・お金の数字が不定 |
| medium | 立場(role)で結果が変わる/誤集計、重複による将来の乖離、認可の手書き依存 |
| low | 品質・規約・型精度・UX・優先度の低い予防 |

## Common Mistakes（レビュアー自身が陥る罠）

- **推測で指摘する** → 必ず grep/精読/tsc で裏取りしてから書く
- **「絶対」と断じる** → トレードオフ（例: 存在隠蔽目的の一律 404、連番 ID+認可の多層防御）は両論併記する
- **良い点を書かない** → 維持すべき設計（なりすまし防止等）も明記し、レビューの信頼性を担保する
- **1箇所だけ見て満足** → 同種パターン（順序不定・握り潰し・重複）は全箇所を横断確認する
- **新しすぎる解を押し付ける** → 採用歴の浅い手法（例: React Compiler）は安定性/移行コストを添えて「任意」と位置づける

## Note

- 本スキルには**スタック非依存の観点（Step 3）とスタック固有の観点（Step 4）が混在**する。対象スタックが TanStack Start 系でなければ Step 4 をスキップし、Step 3 の汎用レンズのみ当てる。固有レンズが2スタック目で必要になったら、その時点で別スキルへの切り出しを検討する。
- レビュー対象のコードに含まれる実在の顧客名・案件名・認証情報を、記録・報告にそのまま転記しない。
