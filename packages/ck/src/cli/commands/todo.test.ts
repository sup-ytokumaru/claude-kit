import { describe, test, expect, afterEach } from 'bun:test';
import { mkdirSync, rmSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { spawnSync } from 'bun';

const CLI = join(import.meta.dir, '../../cli.ts');
const TMP = join(import.meta.dir, '__test_todos__');

afterEach(() => {
  if (existsSync(TMP)) rmSync(TMP, { recursive: true });
});

function runTodo(args: string[], cwd = TMP): { stdout: string; exitCode: number } {
  mkdirSync(cwd, { recursive: true });
  const result = spawnSync(['bun', 'run', CLI, 'todo', ...args], { cwd });
  return {
    stdout: new TextDecoder().decode(result.stdout).trim(),
    exitCode: result.exitCode ?? 1,
  };
}

describe('ck todo', () => {
  test('todos/ サブディレクトリに個別ファイルを作成する', () => {
    const { stdout, exitCode } = runTodo(['テストを書く']);
    expect(exitCode).toBe(0);
    expect(stdout).toContain('todos');
    expect(existsSync(stdout)).toBe(true);
  });

  test('フロントマターに status: open が含まれる', () => {
    const { stdout } = runTodo(['implement feature']);
    const content = readFileSync(stdout, 'utf-8');
    expect(content).toContain('status: open');
  });

  test('--priority high が反映される', () => {
    const { stdout } = runTodo(['urgent task', '--priority', 'high']);
    const content = readFileSync(stdout, 'utf-8');
    expect(content).toContain('priority: high');
  });

  test('デフォルト優先度は medium', () => {
    const { stdout } = runTodo(['default priority task']);
    const content = readFileSync(stdout, 'utf-8');
    expect(content).toContain('priority: medium');
  });

  test('同じスラグになる内容を2回登録しても上書きしない', () => {
    const first = runTodo(['テスト用TODO']).stdout;   // slug: todo
    const second = runTodo(['検証用TODO']).stdout;    // slug: todo（衝突）
    expect(second).not.toBe(first);
    expect(existsSync(first)).toBe(true);
    expect(existsSync(second)).toBe(true);
  });
});

describe('ck todo list', () => {
  test('open の TODO を一覧表示する', () => {
    runTodo(['write tests']);
    const { stdout, exitCode } = runTodo(['list']);
    expect(exitCode).toBe(0);
    expect(stdout).toContain('write-tests');
    expect(stdout).toContain('write tests');
  });

  test('TODO が0件のときはその旨を表示する', () => {
    const { stdout, exitCode } = runTodo(['list']);
    expect(exitCode).toBe(0);
    expect(stdout).toContain('open の TODO はありません');
  });

  test('done の TODO はデフォルトで表示されない', () => {
    const created = runTodo(['finished task']).stdout;
    runTodo(['done', 'finished-task']);
    const { stdout } = runTodo(['list']);
    expect(stdout).not.toContain('finished-task');
    expect(existsSync(created)).toBe(true);
  });

  test('--all で done も表示される', () => {
    runTodo(['finished task']);
    runTodo(['done', 'finished-task']);
    const { stdout } = runTodo(['list', '--all']);
    expect(stdout).toContain('finished-task');
    expect(stdout).toContain('[done]');
  });

  test('優先度 high が先に表示される', () => {
    runTodo(['low task', '--priority', 'low']);
    runTodo(['urgent task', '--priority', 'high']);
    const { stdout } = runTodo(['list']);
    const lines = stdout.split('\n');
    expect(lines[0]).toContain('urgent-task');
  });
});

describe('ck todo done', () => {
  test('status を done にし completed 日付を追記する', () => {
    const created = runTodo(['complete me']).stdout;
    const { exitCode } = runTodo(['done', 'complete-me']);
    expect(exitCode).toBe(0);
    const content = readFileSync(created, 'utf-8');
    expect(content).toContain('status: done');
    expect(content).toMatch(/completed: \d{4}-\d{2}-\d{2}/);
  });

  test('ファイル名で引けない日本語 TODO は本文タイトルの部分一致で完了にできる', () => {
    const created = runTodo(['割引率上限のエラーメッセージ文言を決める']).stdout;
    const { exitCode } = runTodo(['done', '割引率上限']);
    expect(exitCode).toBe(0);
    expect(readFileSync(created, 'utf-8')).toContain('status: done');
  });

  test('一致しない名前はエラー終了する', () => {
    const { exitCode } = runTodo(['done', 'no-such-todo']);
    expect(exitCode).toBe(1);
  });

  test('複数一致は候補を表示してエラー終了する', () => {
    runTodo(['task alpha']);
    runTodo(['task beta']);
    const { exitCode } = runTodo(['done', 'task']);
    expect(exitCode).toBe(1);
  });

  test('既に done のファイルは変更しない', () => {
    const created = runTodo(['already done']).stdout;
    runTodo(['done', 'already-done']);
    const before = readFileSync(created, 'utf-8');
    const { exitCode } = runTodo(['done', 'already-done']);
    expect(exitCode).toBe(0);
    expect(readFileSync(created, 'utf-8')).toBe(before);
  });
});
