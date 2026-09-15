import { Command } from 'commander';
import { join } from 'path';
import { existsSync, readFileSync, readdirSync, mkdirSync, writeFileSync } from 'fs';

const SKILLS_DIR = join(import.meta.dir, '../../skills');
const PLUGIN_SKILLS_DIR = join(import.meta.dir, '../../../../../plugins/ck/skills');

export const skillCommand = new Command('skill').description('スキル管理');

skillCommand
  .command('print <name>')
  .description('スキル本体を標準出力')
  .action((name: string) => {
    const bodyPath = join(SKILLS_DIR, name, 'body.md');
    if (!existsSync(bodyPath)) {
      console.error(`スキル "${name}" が見つかりません`);
      process.exit(1);
    }
    // メタデータの源泉はスタブ側。body 先頭のフロントマターは出力に含めない
    const rawBody = readFileSync(bodyPath, 'utf-8');
    process.stdout.write(rawBody.replace(/^---[\s\S]*?---\n+/, ''));
  });

skillCommand
  .command('list')
  .description('利用可能なスキル一覧を表示')
  .action(() => {
    if (!existsSync(SKILLS_DIR)) {
      console.log('スキルが登録されていません');
      return;
    }
    const skills = readdirSync(SKILLS_DIR, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .map(d => d.name);
    skills.forEach(s => console.log(s));
  });

// body が使うツールとスタブ allowed-tools の乖離を検出するシグナル。
// 肯定的な使用文のみ拾う（「〜しない」等の否定的言及はパターンに一致させない）
const TOOL_SIGNALS: Array<{ accepts: string[]; label: string; pattern: RegExp }> = [
  { accepts: ['Skill'], label: '別スキル呼び出し（Skill）', pattern: /`Skill:\s|^Skill:\s|Skill tool|Skill ツール/m },
  // 「サブエージェントから呼ばれた場合」等の受け身の言及は起動ではないため、起動文脈に限定する
  { accepts: ['Task', 'Agent'], label: 'サブエージェント起動（Task/Agent）', pattern: /subagent_type|エージェント[^\n]{0,30}起動/ },
  { accepts: ['AskUserQuestion'], label: '選択肢の提示（AskUserQuestion）', pattern: /AskUserQuestion`? で/ },
  { accepts: ['EnterPlanMode'], label: 'プランモード開始（EnterPlanMode）', pattern: /EnterPlanMode`? を呼び出/ },
  { accepts: ['mcp__playwright__'], label: 'Playwright MCP（mcp__playwright__*）', pattern: /mcp__playwright__/ },
];

// body の記述から要求されるのに allowed-tools に無いツールを返す（doctor のツール整合検査本体）
export function toolMismatches(body: string, allowedTools: string): Array<{ tool: string; label: string }> {
  return TOOL_SIGNALS.filter(
    sig => sig.pattern.test(body) && !sig.accepts.some(t => allowedTools.includes(t))
  ).map(sig => ({ tool: sig.accepts[0], label: sig.label }));
}

// 全スキル本体に必須の定型節（見出し行と完全一致で判定する）
export const REQUIRED_SECTIONS = ['## 非対話実行時', '## 完了条件'] as const;

// body 内の `/<name>` 参照のうち、スキルではなく Claude Code 組み込みコマンドを指すもの（死活検査から除外）
export const BUILTIN_COMMANDS = new Set(['mcp']);

// allowed-tools に裸の `Bash` を宣言してよい実装系スキル。
// プロジェクト固有のビルド・テストコマンドを実行するため事前列挙が本質的に困難なもののみ列挙する
export const BARE_BASH_ALLOWED = new Set([
  'debug', 'implement', 'migrate-verify', 'playwright-mcp-e2e', 'qa', 'refactor', 'review', 'test',
  'verify', 'finish',
]);

// body 内のスキル参照（`` `/<name>` `` 記法）を抽出する。`Skill: <name>` 形式は TOOL_SIGNALS の関心事で対象外
function skillLinks(body: string): string[] {
  return [...body.matchAll(/`\/([a-z][a-z0-9-]*)`/g)].map(m => m[1]);
}

// 必須の定型節のうち body に無い見出しを返す（doctor では warn）
export function missingSections(body: string): string[] {
  return REQUIRED_SECTIONS.filter(h => !new RegExp(`^${h}$`, 'm').test(body));
}

// body が参照するスキル名のうち、実在せず組み込みコマンドでもないものを返す（doctor では error）
export function deadSkillLinks(body: string, skillNames: Set<string>): string[] {
  return [...new Set(skillLinks(body))].filter(n => !skillNames.has(n) && !BUILTIN_COMMANDS.has(n));
}

// 全 body の参照グラフから、他のどのスキルからも参照されないスキル名を返す（doctor では warn）。自己参照は被参照に数えない
export function orphanSkills(bodies: Map<string, string>): string[] {
  const referenced = new Set<string>();
  for (const [name, body] of bodies) {
    for (const link of skillLinks(body)) if (link !== name) referenced.add(link);
  }
  return [...bodies.keys()].filter(n => !referenced.has(n)).sort();
}

// allowed-tools に裸の `Bash`（`Bash(<cmd>:*)` のスコープ指定なし）が含まれていれば true
export function hasBareBash(allowedTools: string): boolean {
  return allowedTools.split(',').map(t => t.trim()).includes('Bash');
}

// 一度直した壊れパターンの再発を検出する（doctor では error）。
// 直した経緯は fix に残し、同じ修正を別スキルで繰り返さない
export const BROKEN_PATTERNS: Array<{ label: string; pattern: RegExp; fix: string }> = [
  {
    label: '`||` 連鎖による git diff のフォールバック',
    // 「git diff … \」の次行（または同行）が「|| git diff」で始まる形。フック経由の git は存在しない参照でも exit 0 で空を返すため、|| は働かない
    pattern: /git diff[^\n]*\n?\s*\|\|\s*git diff/,
    fix: 'git rev-parse --verify -q で参照の存在を確認してから if/elif で分岐する（test / review の Step 1〜2 と同じ形）',
  },
];

// body 内で再発している壊れパターンを返す
export function brokenPatterns(body: string): Array<{ label: string; fix: string }> {
  return BROKEN_PATTERNS.filter(b => b.pattern.test(body)).map(({ label, fix }) => ({ label, fix }));
}

// 複数スキルに複製された同一役割のコード片。marker を含むフェンス付きコードブロックを比較し、
// 内容がスキル間でズレていたら横展開漏れとみなす（doctor では error）
export const SHARED_SNIPPETS: Array<{ label: string; marker: RegExp }> = [
  {
    label: 'デフォルトブランチ分岐点からの変更ファイル取得',
    // 行頭の空白は許容する（ブロック内でインデントされていても同じコード片とみなす）
    marker: /^\s*BASE=\$\(git symbolic-ref refs\/remotes\/origin\/HEAD/m,
  },
];

// フェンス付きコードブロック（```lang … ```）の中身を列挙する。
// リスト内などでインデントされたフェンスも拾う（marker 側が行頭空白を許容しているのと揃える。拾えないと比較対象から静かに脱落する）。
// 閉じフェンスは開きと同数以上のバッククォートに限定する（````〜```` の中に ``` を含む入れ子で、外側の開きと内側の閉じが対にならないように）
function fencedBlocks(body: string): string[] {
  return [...body.matchAll(/^[ \t]*(`{3,})[^\n]*\n([\s\S]*?)^[ \t]*\1`*[ \t]*$/gm)].map(m => m[2]);
}

// コメント行・行末コメント・空行・行頭行末の空白を除いて比較用に正規化する（説明コメントの差は許容し、コマンドの差だけを見る）。
// 行末コメントは「2 個以上の空白 + #」を目印にする（`sed 's|#||'` のように引用内に # を含むコマンドを巻き込まないための規約）
function normalizeSnippet(block: string): string {
  return block
    .split('\n')
    .map(l => l.trim().replace(/\s{2,}#.*$/, ''))
    .filter(l => l !== '' && !l.startsWith('#'))
    .join('\n');
}

// marker を含むコードブロックを全 body から集め、正規化した内容ごとに「どのスキルが持つか」を返す。
// 返り値のキー数が 2 以上なら複製がズレている
export function sharedSnippetVariants(bodies: Map<string, string>, marker: RegExp): Map<string, string[]> {
  const variants = new Map<string, string[]>();
  for (const [name, body] of bodies) {
    for (const block of fencedBlocks(body)) {
      if (!marker.test(block)) continue;
      const key = normalizeSnippet(block);
      const names = variants.get(key) ?? [];
      // 同一スキルが同じブロックを複数持っていてもエラー文にスキル名を重複して並べない
      if (!names.includes(name)) variants.set(key, [...names, name]);
    }
  }
  return variants;
}

skillCommand
  .command('doctor')
  .description('スタブ（plugins/）と本体（src/skills/）の整合性を検査')
  .action(() => {
    const errors: string[] = [];
    const warns: string[] = [];
    const listDirs = (base: string) =>
      existsSync(base)
        ? readdirSync(base, { withFileTypes: true })
            .filter(d => d.isDirectory())
            .map(d => d.name)
        : [];
    const bodies = listDirs(SKILLS_DIR);
    const stubs = listDirs(PLUGIN_SKILLS_DIR);

    for (const s of stubs) if (!bodies.includes(s)) errors.push(`${s}: スタブに対応する body.md ディレクトリがありません`);
    for (const b of bodies) if (!stubs.includes(b)) errors.push(`${b}: body に対応するスタブ（plugins/ck/skills/）がありません`);

    for (const s of stubs) {
      const stubPath = join(PLUGIN_SKILLS_DIR, s, 'SKILL.md');
      if (!existsSync(stubPath)) {
        errors.push(`${s}: SKILL.md がありません`);
        continue;
      }
      const raw = readFileSync(stubPath, 'utf-8');
      const fm = raw.match(/^---\n([\s\S]*?)\n---/);
      if (!fm) {
        errors.push(`${s}: スタブにフロントマターがありません`);
        continue;
      }
      const name = fm[1].match(/^name:\s*(.+)$/m)?.[1].trim();
      if (name !== s) errors.push(`${s}: name "${name}" がディレクトリ名と一致しません`);
      if (!/^description:\s*\S/m.test(fm[1])) errors.push(`${s}: description がありません`);

      const invoke = raw.match(/^!`ck skill print ([a-z0-9-]+)([^`]*)`/m);
      if (!invoke) {
        errors.push(`${s}: 実行行 !\`ck skill print ...\` が見つかりません`);
      } else {
        if (invoke[1] !== s) errors.push(`${s}: print 対象 "${invoke[1]}" がディレクトリ名と一致しません`);
        if (!invoke[2].includes('||')) warns.push(`${s}: フォールバック（|| echo）がバッククォート内にありません`);
      }
      if (/^!`[^`]*`\s*\|\|/m.test(raw)) errors.push(`${s}: || フォールバックがバッククォートの外にあります（シェル実行されません）`);

      // body が要求するツールが allowed-tools に揃っているか（ヒューリスティック検査）
      const allowedTools = fm[1].match(/^allowed-tools:\s*(.+)$/m)?.[1] ?? '';
      if (hasBareBash(allowedTools) && !BARE_BASH_ALLOWED.has(s)) {
        warns.push(`${s}: allowed-tools に裸の Bash が含まれています（実装系スキル以外は Bash(<cmd>:*) で列挙してください）`);
      }
      const bodyPath = join(SKILLS_DIR, s, 'body.md');
      if (allowedTools && existsSync(bodyPath)) {
        const body = readFileSync(bodyPath, 'utf-8');
        for (const m of toolMismatches(body, allowedTools)) {
          errors.push(`${s}: body が${m.label}を使うのに allowed-tools にありません`);
        }
      }
    }

    const bodyTexts = new Map<string, string>();
    const skillNames = new Set(bodies);
    for (const b of bodies) {
      const bodyPath = join(SKILLS_DIR, b, 'body.md');
      if (!existsSync(bodyPath)) {
        errors.push(`${b}: body.md がありません`);
        continue;
      }
      const body = readFileSync(bodyPath, 'utf-8');
      bodyTexts.set(b, body);
      if (body.startsWith('---\n')) {
        errors.push(`${b}: body.md にフロントマターがあります（メタデータはスタブに一本化）`);
      }
      for (const h of missingSections(body)) warns.push(`${b}: 定型節 ${h} がありません`);
      for (const n of deadSkillLinks(body, skillNames)) errors.push(`${b}: 存在しないスキル /${n} を参照しています`);
      for (const bp of brokenPatterns(body)) errors.push(`${b}: 既知の壊れパターン「${bp.label}」が再発しています。直し方: ${bp.fix}`);
    }
    // 参照グラフは全 body を読み終えてから集計する
    for (const o of orphanSkills(bodyTexts)) warns.push(`${o}: どのスキルからも参照されていません（ユーザー直接起動のみ）`);
    // 複製コード片のズレも全 body を読み終えてから比較する
    for (const snip of SHARED_SNIPPETS) {
      const variants = sharedSnippetVariants(bodyTexts, snip.marker);
      if (variants.size > 1) {
        const groups = [...variants.values()].map(names => `[${names.join(', ')}]`).join(' / ');
        errors.push(`横展開漏れ: 「${snip.label}」のコード片が ${variants.size} 種類に分かれています: ${groups}`);
      }
    }

    warns.forEach(w => console.log(`⚠ ${w}`));
    if (errors.length > 0) {
      errors.forEach(e => console.error(`✗ ${e}`));
      console.error(`\n${errors.length} 件のエラー`);
      process.exit(1);
    }
    console.log(`✓ ${stubs.length} スキル — 問題なし${warns.length > 0 ? `（警告 ${warns.length} 件）` : ''}`);
  });

skillCommand
  .command('copy [name]')
  .description('スキルをプロジェクトの .claude/skills/ にコピー（カスタマイズ用）')
  .option('--all', '全スキルをコピー')
  .action((name: string | undefined, opts: { all?: boolean }) => {
    const targetBase = join(process.cwd(), '.claude', 'skills');

    const copySkill = (skillName: string) => {
      const stubPath = join(PLUGIN_SKILLS_DIR, skillName, 'SKILL.md');
      const bodyPath = join(SKILLS_DIR, skillName, 'body.md');

      if (!existsSync(stubPath) || !existsSync(bodyPath)) {
        console.error(`スキル "${skillName}" が見つかりません`);
        return;
      }

      // スタブの !`ck skill print ...` 行をボディ内容（フロントマター除去済み）で置換
      const stub = readFileSync(stubPath, 'utf-8');
      const rawBody = readFileSync(bodyPath, 'utf-8');
      const bodyContent = rawBody.replace(/^---[\s\S]*?---\n+/, '').trimEnd();
      const result = stub.replace(/^!`ck skill print [^`]+`.*$/m, bodyContent);

      const destDir = join(targetBase, skillName);
      mkdirSync(destDir, { recursive: true });
      writeFileSync(join(destDir, 'SKILL.md'), result);
      console.log(`✔ ${skillName} → .claude/skills/${skillName}/SKILL.md`);
    };

    if (opts.all) {
      const skills = readdirSync(SKILLS_DIR, { withFileTypes: true })
        .filter(d => d.isDirectory())
        .map(d => d.name);
      skills.forEach(copySkill);
    } else if (name) {
      copySkill(name);
    } else {
      console.error('スキル名を指定するか --all を使用してください');
      process.exit(1);
    }
  });

skillCommand
  .command('update [name]')
  .description('ローカルコピーのスキル本体を最新版で上書き更新')
  .option('--all', '全ローカルスキルを更新')
  .action((name: string | undefined, opts: { all?: boolean }) => {
    const localBase = join(process.cwd(), '.claude', 'skills');

    const updateSkill = (skillName: string): boolean => {
      const localSkillPath = join(localBase, skillName, 'SKILL.md');
      if (!existsSync(localSkillPath)) {
        console.error(`スキル "${skillName}" はローカルにコピーされていません。先に "ck skill copy ${skillName}" を実行してください。`);
        return false;
      }
      const stubPath = join(PLUGIN_SKILLS_DIR, skillName, 'SKILL.md');
      const bodyPath = join(SKILLS_DIR, skillName, 'body.md');
      if (!existsSync(stubPath) || !existsSync(bodyPath)) {
        console.error(`スキル "${skillName}" のグローバル定義が見つかりません`);
        return false;
      }
      const stub = readFileSync(stubPath, 'utf-8');
      const rawBody = readFileSync(bodyPath, 'utf-8');
      const bodyContent = rawBody.replace(/^---[\s\S]*?---\n+/, '').trimEnd();
      const result = stub.replace(/^!`ck skill print [^`]+`.*$/m, bodyContent);
      writeFileSync(localSkillPath, result);
      console.log(`✔ ${skillName} を最新版に更新しました`);
      return true;
    };

    if (opts.all) {
      if (!existsSync(localBase)) {
        console.error('ローカルスキルが見つかりません。先に "ck skill copy --all" を実行してください。');
        process.exit(1);
      }
      const localSkills = readdirSync(localBase, { withFileTypes: true })
        .filter(d => d.isDirectory())
        .map(d => d.name);
      if (localSkills.length === 0) {
        console.error('更新対象のローカルスキルがありません。');
        process.exit(1);
      }
      localSkills.forEach(updateSkill);
    } else if (name) {
      const ok = updateSkill(name);
      if (!ok) process.exit(1);
    } else {
      console.error('スキル名を指定するか --all を使用してください');
      process.exit(1);
    }
  });
