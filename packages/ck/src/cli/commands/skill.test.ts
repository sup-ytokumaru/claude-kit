import { describe, expect, test } from 'bun:test';
import { join } from 'path';
import { existsSync, readdirSync, readFileSync } from 'fs';
import {
  BARE_BASH_ALLOWED,
  deadSkillLinks,
  hasBareBash,
  missingSections,
  orphanSkills,
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
});
