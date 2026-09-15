import { describe, expect, test } from 'bun:test';
import { join } from 'path';
import { existsSync, readdirSync, readFileSync } from 'fs';
import {
  BARE_BASH_ALLOWED,
  SHARED_SNIPPETS,
  brokenPatterns,
  deadSkillLinks,
  hasBareBash,
  missingSections,
  orphanSkills,
  sharedSnippetVariants,
  toolMismatches,
} from './skill';

const tools = (body: string, allowed: string) => toolMismatches(body, allowed).map(m => m.tool);

describe('missingSections: 必須の定型節の欠落を返す', () => {
  test('両方の見出しがあれば空', () => {
    expect(missingSections('# x\n\n## 非対話実行時\n\n本文\n\n## 完了条件\n\n本文\n')).toEqual([]);
  });

  test('片方が欠けていればその見出しだけ返す', () => {
    expect(missingSections('# x\n\n## 完了条件\n\n本文\n')).toEqual(['## 非対話実行時']);
    expect(missingSections('# x\n\n## 非対話実行時\n\n本文\n')).toEqual(['## 完了条件']);
  });

  test('見出しの文言ゆれ（余分な語・階層違い・太字ラベル）は欠落扱い', () => {
    expect(missingSections('## 非対話実行時の振る舞い\n\n## 完了条件\n')).toEqual(['## 非対話実行時']);
    expect(missingSections('### 非対話実行時\n\n## 完了条件\n')).toEqual(['## 非対話実行時']);
    expect(missingSections('**非対話実行時**: 推奨案を採用する\n\n## 完了条件\n')).toEqual(['## 非対話実行時']);
  });
});

describe('deadSkillLinks: 存在しないスキルへの参照を返す', () => {
  const names = new Set(['plan', 'test', 'qa']);

  test('実在スキルへの参照のみなら空', () => {
    expect(deadSkillLinks('完了後は `/test` → `/qa` を案内する', names)).toEqual([]);
  });

  test('実在しないスキルへの参照を検出する（重複は1件に畳む）', () => {
    expect(deadSkillLinks('`/nonexistent` を案内する。`/nonexistent` 再実行', names)).toEqual(['nonexistent']);
  });

  test('組み込みコマンド `/mcp` は検出しない', () => {
    expect(deadSkillLinks('対話セッションの `/mcp` で接続する', names)).toEqual([]);
  });

  test('`Skill: <name>` 形式やバッククォート外のスラッシュは対象外', () => {
    expect(deadSkillLinks('`Skill: nonexistent` を呼び出す。/tmp に書く。`/tmp/x` を読む', names)).toEqual([]);
  });
});

describe('orphanSkills: 他スキルから参照されないスキルを返す', () => {
  test('被参照ゼロのスキルだけを返す（ソート済み）', () => {
    const bodies = new Map([
      ['kickoff', '次は `/plan` を案内する'],
      ['plan', '承認後は `/implement` へ'],
      ['implement', '完了後は `/test`'],
      ['test', '本文'],
      ['zzz-orphan', '`/plan` を参照する'],
      ['aaa-orphan', '本文'],
    ]);
    expect(orphanSkills(bodies)).toEqual(['aaa-orphan', 'kickoff', 'zzz-orphan']);
  });

  test('自己参照は被参照に数えない', () => {
    expect(orphanSkills(new Map([['review', '問題ありなら `/review` 再実行']]))).toEqual(['review']);
  });
});

describe('hasBareBash: allowed-tools の裸 Bash を判定する', () => {
  test('スコープ指定なしの Bash は true', () => {
    expect(hasBareBash('Bash')).toBe(true);
    expect(hasBareBash('Read, Bash, Grep')).toBe(true);
  });

  test('Bash(<cmd>:*) のスコープ指定のみなら false', () => {
    expect(hasBareBash('Bash(git status:*), Bash(git diff:*), Read')).toBe(false);
  });

  test('Bash を含まなければ false', () => {
    expect(hasBareBash('Read, Grep, Glob')).toBe(false);
    expect(hasBareBash('')).toBe(false);
  });
});

describe('toolMismatches: 検出する（肯定的な使用文）', () => {
  test('Skill 呼び出し（`Skill: <name>`）で Skill を要求する', () => {
    expect(tools('`Skill: implement` を呼び出して実行フェーズを委譲する', 'Bash, Read')).toContain('Skill');
  });

  test('Skill tool の表記でも Skill を要求する', () => {
    expect(tools('Skill tool で `kickoff` スキルを呼び出す', 'Bash, Read, Task')).toContain('Skill');
  });

  test('サブエージェント言及で Task/Agent を要求する', () => {
    expect(tools('Explore サブエージェントを1つ起動する', 'Bash, Read')).toContain('Task');
  });

  test('「エージェント（…）を起動」の表記でも Task/Agent を要求する', () => {
    expect(tools('feature-dev:code-reviewer エージェント（組み込みエージェント型）を起動して再検証する', 'Bash')).toContain('Task');
  });

  test('AskUserQuestion の肯定使用で AskUserQuestion を要求する', () => {
    expect(tools('`AskUserQuestion` で1度だけ確認する', 'Bash, Read')).toContain('AskUserQuestion');
  });

  test('EnterPlanMode を呼び出す記述で EnterPlanMode を要求する', () => {
    expect(tools('`EnterPlanMode` を呼び出す。', 'Bash, Read')).toContain('EnterPlanMode');
  });

  test('mcp__playwright__ 言及で許可を要求する', () => {
    expect(tools('ツール名は `mcp__playwright__browser_*` 形式で呼び出す', 'Bash, Read')).toContain('mcp__playwright__');
  });
});

describe('toolMismatches: 検出しない（許可済み・否定的言及）', () => {
  test('allowed-tools に Skill があれば検出しない', () => {
    expect(tools('`Skill: implement` を呼び出す', 'Bash, Read, Skill')).toEqual([]);
  });

  test('Agent が許可されていれば Task 不在でも検出しない', () => {
    expect(tools('サブエージェントを起動する', 'Bash, Agent')).toEqual([]);
  });

  test('サブエージェントの受け身の言及（呼ばれる側）は Task を要求しない', () => {
    expect(tools('サブエージェント等から呼ばれ AskUserQuestion が使えない場合は止まらない', 'Bash')).toEqual([]);
    expect(tools('非対話実行（サブエージェント・自動実行などユーザーに質問できない場合）は推奨案を採用する', 'Bash')).toEqual([]);
  });

  test('mcp__playwright__* のワイルドカード表記を許可として認める', () => {
    expect(tools('`mcp__playwright__browser_navigate` で遷移する', 'Bash, mcp__playwright__*')).toEqual([]);
  });

  test('EnterPlanMode の否定的言及（入らない）は検出しない', () => {
    expect(tools('プランモード（`EnterPlanMode`）に入らない。それは `/plan` の責務。', 'Bash')).toEqual([]);
  });

  test('AskUserQuestion の条件・否定言及は検出しない', () => {
    expect(tools('`AskUserQuestion` は比較可能な3案以上のときのみ使用する', 'Bash')).toEqual([]);
    expect(tools('AskUserQuestion が使えない場合は止まらない', 'Bash')).toEqual([]);
  });

  test('シグナルに該当しない本文は何も返さない', () => {
    expect(tools('git status --short で作業ツリーを確認する', 'Bash(git *)')).toEqual([]);
  });
});


describe('brokenPatterns: 一度直した壊れパターンの再発を返す', () => {
  const OLD = [
    'BASE=$(git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null | sed \'s|refs/remotes/origin/||\')',
    'git diff --name-only "origin/${BASE:-main}...HEAD" 2>/dev/null \\',
    '  || git diff --name-only HEAD~1 HEAD 2>/dev/null \\',
    '  || git diff --name-only',
  ].join('\n');
  const FIXED = [
    '# フック経由の git は存在しない参照でも exit 0 で空を返すことがあり、|| フォールバックが働かない',
    'if git rev-parse --verify -q "origin/${BASE:-main}" >/dev/null; then',
    '  git diff --name-only "origin/${BASE:-main}...HEAD"',
    'elif git rev-parse --verify -q HEAD~1 >/dev/null; then',
    '  git diff --name-only HEAD~1 HEAD',
    'else',
    '  git diff --name-only',
    'fi',
  ].join('\n');

  test('複数行の `|| git diff` 連鎖を検出する', () => {
    expect(brokenPatterns(OLD).map(b => b.label)).toEqual(['`||` 連鎖による git diff のフォールバック']);
  });

  test('1 行に畳んだ `|| git diff` も検出する', () => {
    expect(brokenPatterns('git diff --name-only origin/main...HEAD || git diff --name-only')).toHaveLength(1);
  });

  test('rev-parse で分岐する修正後の形は検出しない（説明コメント中の「|| フォールバック」も含む）', () => {
    expect(brokenPatterns(FIXED)).toEqual([]);
  });

  test('git diff と無関係な `||` は検出しない', () => {
    expect(brokenPatterns('!`ck skill print x || echo "ERROR"`\ntest -d src && echo has || echo no')).toEqual([]);
  });
});

describe('sharedSnippetVariants: 複製コード片のズレを返す', () => {
  // 配列の並び順に依存しないよう label で該当エントリを引く（先頭に別エントリを足しても本テストが空洞化しない）
  const marker = SHARED_SNIPPETS.find(s => s.label === 'デフォルトブランチ分岐点からの変更ファイル取得')!.marker;
  const fence = (lines: string[]) => '本文\n\n```bash\n' + lines.join('\n') + '\n```\n\n続き';
  const BASE = 'BASE=$(git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null | sed \'s|refs/remotes/origin/||\')';

  test('コメント・空行・インデントだけが違う複製は 1 種類に畳む', () => {
    const bodies = new Map([
      ['test', fence(['# 説明 A', BASE, 'git diff --name-only "origin/${BASE:-main}...HEAD"'])],
      ['review', fence(['# 説明 B', '', '  ' + BASE, '  git diff --name-only "origin/${BASE:-main}...HEAD"'])],
    ]);
    const v = sharedSnippetVariants(bodies, marker);
    expect(v.size).toBe(1);
    expect([...v.values()][0]).toEqual(['test', 'review']);
  });

  test('コマンドが 1 行でも違えば別種類として分ける', () => {
    const bodies = new Map([
      ['test', fence([BASE, 'git diff --name-only "origin/${BASE:-main}...HEAD"'])],
      ['review-others', fence([BASE, 'git diff --name-only "origin/${BASE:-main}...HEAD" || git diff --name-only'])],
    ]);
    expect(sharedSnippetVariants(bodies, marker).size).toBe(2);
  });

  test('フェンス外のインライン記述（同一コマンド内の再取得など）は比較対象にしない', () => {
    const bodies = new Map([
      ['test', fence([BASE, 'git diff --name-only "origin/${BASE:-main}...HEAD"'])],
      ['review', '変更行数は `' + BASE + '; git diff --stat "origin/${BASE:-main}...HEAD" | tail -1` で取る'],
    ]);
    expect(sharedSnippetVariants(bodies, marker).size).toBe(1);
  });

  test('リスト内などでインデントされたフェンスも比較対象に拾う', () => {
    const indented = '- 手順:\n  ```bash\n  ' + BASE + '\n  git diff --name-only "origin/${BASE:-main}...HEAD" || git diff --name-only\n  ```\n';
    const bodies = new Map([
      ['test', fence([BASE, 'git diff --name-only "origin/${BASE:-main}...HEAD"'])],
      ['review', indented],
    ]);
    const v = sharedSnippetVariants(bodies, marker);
    expect(v.size).toBe(2);
    expect([...v.values()].flat().sort()).toEqual(['review', 'test']);
  });

  test('行末コメントの文言差だけなら 1 種類に畳む（引用内の # はコマンドとして残す）', () => {
    const bodies = new Map([
      ['test', fence([BASE, 'git diff --name-only "origin/${BASE:-main}...HEAD"  # 参照が無ければ空', "sed 's|#||'"])],
      ['review', fence([BASE, 'git diff --name-only "origin/${BASE:-main}...HEAD"  # 分岐点から', "sed 's|#||'"])],
      ['other', fence([BASE, 'git diff --name-only "origin/${BASE:-main}...HEAD"', "sed 's|x||'"])],
    ]);
    const v = sharedSnippetVariants(bodies, marker);
    expect(v.size).toBe(2);
    expect(v.get([...v.keys()].find(k => k.includes("sed 's|#||'"))!)).toEqual(['test', 'review']);
  });

  test('同一スキルが同じブロックを 2 回持ってもスキル名は重複させない', () => {
    const twice = fence([BASE, 'git diff --name-only "origin/${BASE:-main}...HEAD"']) + '\n' + fence([BASE, 'git diff --name-only "origin/${BASE:-main}...HEAD"']);
    const v = sharedSnippetVariants(new Map([['review', twice]]), marker);
    expect([...v.values()]).toEqual([['review']]);
  });

  test('marker を含むブロックが無ければ空', () => {
    expect(sharedSnippetVariants(new Map([['x', fence(['git status --short'])]]), marker).size).toBe(0);
  });
});

describe('実リポジトリの全スキルが整合している（回帰テスト）', () => {
  const SKILLS_DIR = join(import.meta.dir, '../../skills');
  const PLUGIN_SKILLS_DIR = join(import.meta.dir, '../../../../../plugins/ck/skills');

  const stubs = readdirSync(PLUGIN_SKILLS_DIR, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name);

  const bodies = new Map(stubs.map(s => [s, readFileSync(join(SKILLS_DIR, s, 'body.md'), 'utf-8')] as const));
  const skillNames = new Set(stubs);

  for (const s of stubs) {
    test(`${s}: body の要求ツールが allowed-tools に揃っている`, () => {
      const stub = readFileSync(join(PLUGIN_SKILLS_DIR, s, 'SKILL.md'), 'utf-8');
      const allowedTools = stub.match(/^allowed-tools:\s*(.+)$/m)?.[1] ?? '';
      const bodyPath = join(SKILLS_DIR, s, 'body.md');
      expect(existsSync(bodyPath)).toBe(true);
      expect(toolMismatches(readFileSync(bodyPath, 'utf-8'), allowedTools)).toEqual([]);
    });

    test(`${s}: 定型節（非対話実行時・完了条件）が揃っている`, () => {
      expect(missingSections(bodies.get(s)!)).toEqual([]);
    });

    test(`${s}: 存在しないスキルを参照していない`, () => {
      expect(deadSkillLinks(bodies.get(s)!, skillNames)).toEqual([]);
    });

    test(`${s}: 裸の Bash は実装系スキル（BARE_BASH_ALLOWED）に限られる`, () => {
      const stub = readFileSync(join(PLUGIN_SKILLS_DIR, s, 'SKILL.md'), 'utf-8');
      const allowedTools = stub.match(/^allowed-tools:\s*(.+)$/m)?.[1] ?? '';
      if (hasBareBash(allowedTools)) expect(BARE_BASH_ALLOWED.has(s)).toBe(true);
    });
  }

  test('どのスキルからも参照されない孤児スキルがない', () => {
    expect(orphanSkills(bodies)).toEqual([]);
  });

  for (const s of stubs) {
    test(`${s}: 既知の壊れパターンが再発していない`, () => {
      expect(brokenPatterns(bodies.get(s)!)).toEqual([]);
    });
  }

  for (const snip of SHARED_SNIPPETS) {
    test(`複製コード片「${snip.label}」がスキル間でズレていない`, () => {
      const variants = sharedSnippetVariants(bodies, snip.marker);
      expect(variants.size).toBeLessThanOrEqual(1);
      // 複製が消えて 1 箇所以下になったら検査の存在意義を見直す（marker の陳腐化検知）
      expect([...variants.values()].flat().length).toBeGreaterThanOrEqual(2);
    });
  }
});
