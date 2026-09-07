# playwright-mcp-e2e

Playwright MCP ツールでブラウザを直接操作し、観察した動作を Playwright テストコードに変換する。  
**MCP server name: `playwright`** — ツール名は `mcp__playwright__browser_*` 形式で呼び出す。

## 非対話実行時

「ユーザーに確認する」「案内して停止する」のステップは、環境不足（MCP 未接続・サーバー起動不可・シード特定不能・Playwright 未導入）なら**推定で続行せず停止して不足を報告する**。それ以外の確認は推奨案を採用し、置いた仮定を最終報告で列挙する。

## 利用可能な主要ツール

| ツール | 用途 |
|--------|------|
| `mcp__playwright__browser_navigate` | URL に遷移 |
| `mcp__playwright__browser_snapshot` | アクセシビリティツリー取得（セレクタ特定に使う） |
| `mcp__playwright__browser_take_screenshot` | スクリーンショット撮影 |
| `mcp__playwright__browser_click` | 要素クリック |
| `mcp__playwright__browser_type` | テキスト入力（既存値クリア後） |
| `mcp__playwright__browser_fill_form` | フォーム複数フィールドへの一括入力 |
| `mcp__playwright__browser_select_option` | select/combobox で選択 |
| `mcp__playwright__browser_press_key` | キーボード操作（Enter, Tab 等） |
| `mcp__playwright__browser_wait_for` | 要素やテキストの出現を待機 |
| `mcp__playwright__browser_hover` | ホバー |
| `mcp__playwright__browser_handle_dialog` | confirm/alert ダイアログ操作 |
| `mcp__playwright__browser_console_messages` | コンソールログ取得（エラー確認） |
| `mcp__playwright__browser_evaluate` | JS 実行（状態確認等） |
| `mcp__playwright__browser_navigate_back` | ブラウザ戻る |

## 前提条件チェックリスト

テスト作成前に必ず確認する:
- [ ] **MCP サーバー `playwright` が接続されている**（`mcp__playwright__browser_*` ツールが利用可能か。未接続なら以降のすべてが失敗するため最初に確認する）
- [ ] **Playwright がプロジェクトに導入されている**（`package.json` の devDependencies に `@playwright/test`、`playwright.config.*` の存在）。未導入の場合、生成コードは実行できないため、導入手順（`npm i -D @playwright/test && npx playwright install` と config 作成）を提示してユーザーの承認を得てから導入する（承認が得られなければテストコードの生成・保存までで完了とし、実行確認は導入後に委ねる）
- [ ] 開発サーバーが起動している（`package.json` の `dev` スクリプトを確認）
- [ ] DB にテストデータが存在する（シードは `package.json` の scripts（`seed`・`db:seed` 等）や README の手順から特定して実行する。特定できなければユーザーに確認する）
- [ ] テスト対象の URL を把握している

満たせない項目は先に解消する（サーバーが未起動なら `dev` スクリプトをバックグラウンドで起動する・シードを実行する）。MCP サーバーが未接続の場合はスキル側で解消できないため、`claude mcp add playwright`（または対話セッションの `/mcp`）での接続をユーザーに案内して停止する。その他も解消できない場合は不足している前提を明示してユーザーに案内し停止する。

## 標準ワークフロー

1. **遷移**: `browser_navigate` でページを開く
2. **構造把握**: `browser_snapshot` でアクセシビリティツリーを確認（セレクタが分かる）
3. **操作**: `browser_click` / `browser_type` / `browser_fill_form` / `browser_select_option` で操作
4. **待機**: 非同期処理後は `browser_wait_for` でテキスト/要素を待つ
5. **確認**: `browser_snapshot` または `browser_take_screenshot` で結果を確認
6. **生成**: 観察した操作をテストコードに変換して保存

## テストコード生成規則

- **ファイル場所**: `e2e/{feature}/{scenario-name}.spec.ts`（プロジェクトの規約に従う）
- **ケースID の埋め込み**: `tests/qa/` の台帳ケースに対応するテストは、ケースID をテスト名の先頭に埋め込む（例 `test("ORD-C1: 数量0は拒否", …)`）。コメントへの記載で代替しない。これが `grep -rn ORD-C1` で台帳↔テストを双方向にたどる唯一の結合キー（`/qa`・`/test` と同一規約）。台帳に対応ケースがない場合は埋め込み不要
- **URL**: `playwright.config.*` に `baseURL` が設定されていれば `page.goto('/path')` の相対パスで書く（環境差異に強い）。未設定の場合のみフル URL を書き、config への `baseURL` 追加を提案する
- **セレクタの優先順位**: `getByRole` > `getByLabel` > `getByText` > `data-testid` > CSS
- **アサーション**: `expect(page.getByText('...')).toBeVisible()` を基本とする
- **待機**: `waitFor` より `expect().toBeVisible()` の方が安定する
- **秘匿情報を書き込まない**: テストコード・フィクスチャ・認証情報の例に実在の顧客名・案件名・認証情報を書き込まない。ブラウザで観察した実データは架空値に置換する（e2e ディレクトリは git 管理される）

```typescript
import { test, expect } from '@playwright/test';

test.describe('フォームバリデーション', () => {
  // 台帳ケース FRM-C1 に対応（ケースID をテスト名先頭に埋め込む）
  test('FRM-C1: 必須項目が空のとき送信できない', async ({ page }) => {
    await page.goto('http://localhost:3000/...');

    await page.getByRole('button', { name: '送信' }).click();

    await expect(page.getByText('必須項目です')).toBeVisible();
  });
});
```

## よくある失敗と対処

| 問題 | 原因 | 対処 |
|------|------|------|
| セレクタが見つからない | shadow DOM や動的レンダリング | `browser_snapshot` で実際の DOM を確認 |
| クリックが反応しない | 要素が隠れている / disabled | `browser_hover` 後に click、または JS で確認 |
| フォームが送信されない | バリデーションエラー | `browser_console_messages` でエラーを確認 |
| 認証が切れる | セッションタイムアウト | storageState を更新するか再ログイン |
| ダイアログが邪魔をする | confirm/alert の未処理 | `browser_handle_dialog` で先に登録 |

## 認証が必要な場合

ログインフローを最初に実行し、`e2e/.auth/` に storageState を保存して再利用する。

**storageState の作り方**（初回）: ログイン専用の setup テストを作り、ログイン成功後に保存する:

```typescript
// e2e/auth.setup.ts — ログインして storageState を生成する
import { test as setup } from '@playwright/test';

setup('authenticate', async ({ page }) => {
  await page.goto('http://localhost:3000/login');
  // <ログイン操作: fill + click。認証情報は .env から参照>
  await page.context().storageState({ path: 'e2e/.auth/user.json' });
});
```

**参照設定**: `use.storageState` をグローバルに置くだけだと、ファイル未生成の初回は setup 自身を含む全テストが読込エラーで落ちる。setup プロジェクトを `dependencies` で結線し、setup 側は storageState を使わない構成にする:

```typescript
// playwright.config.ts — setup を先に実行してから本体テストが storageState を参照する
projects: [
  { name: 'setup', testMatch: /auth\.setup\.ts/ },
  {
    name: 'e2e',
    dependencies: ['setup'],
    use: { storageState: 'e2e/.auth/user.json' },
  },
],
```

**`e2e/.auth/` は必ず `.gitignore` に追加する**（storageState はセッショントークンの実体でありコミット厳禁）。`.gitignore` に該当行が無ければ追記して報告する。

プロジェクト固有の認証情報は `.env` または `playwright.config.ts` から参照する（テストコードに直書きしない）。

## テストの実行方法

生成したテストは以下の順で実行コマンドを特定して実行する:

1. `package.json` の scripts に E2E 用エントリ（`test:e2e` / `e2e` 等）があればそれを使う
2. なければ `npx playwright test <生成したファイルのパス>` で対象ファイルのみ実行する（全件実行しない）

## 完了条件

観察した操作を `e2e/{feature}/{scenario}.spec.ts` に保存し、生成したテストを上記の実行方法で実行して通過することを確認した時点で完了。テストが落ちる場合はセレクタ・待機・前提データを見直してから完了とする（落ちたまま完了宣言しない）。

**完了後の導線**: `/test`（Step 6 の E2E 候補）から委譲された場合は test の完了報告に結果を合流させる。`/debug` の視覚確認として使われた場合は debug のフローに戻る。単独起動の場合は `/review`（セルフレビュー）を案内する。QA 台帳のケースをコード化した場合は、台帳のコード化状況の更新を `/qa` に委ねる旨を報告に含める。
