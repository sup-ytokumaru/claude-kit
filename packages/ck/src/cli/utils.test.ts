import { describe, test, expect } from 'bun:test';
import { mkdtempSync, writeFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { getDate, toSlug, uniqueFilepath } from './utils';

describe('getDate', () => {
  test('YYYY-MM-DD 形式を返す', () => {
    expect(getDate()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('toSlug', () => {
  test('英語テキストを kebab-case に変換する', () => {
    expect(toSlug('React performance tips')).toBe('react-performance-tips');
  });

  test('40文字を超える場合は切り詰める', () => {
    expect(toSlug('a'.repeat(50))).toHaveLength(40);
  });

  test('日本語のみの場合はミリ秒タイムスタンプにフォールバックする', () => {
    expect(toSlug('テスト用メモです')).toMatch(/^\d{13}$/);
  });

  test('英数字混在（テスト用TODO）は ASCII 部分を抽出する', () => {
    expect(toSlug('テスト用TODO')).toBe('todo');
  });

  test('末尾のハイフンを除去する', () => {
    expect(toSlug('hello world-')).not.toMatch(/-$/);
  });

  test('日本語混在で生じる先頭・連続ハイフンを畳む', () => {
    expect(toSlug('割引計算は四捨五入。仕様 R1 参照')).toBe('r1');
    expect(toSlug('テスト  --  hello   world')).toBe('hello-world');
  });
});

describe('uniqueFilepath', () => {
  test('衝突がなければそのままのパスを返す', () => {
    const dir = mkdtempSync(join(tmpdir(), 'ck-test-'));
    try {
      expect(uniqueFilepath(dir, '2026-06-11-todo')).toBe(join(dir, '2026-06-11-todo.md'));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('衝突時は連番サフィックスを付けて上書きを防ぐ', () => {
    const dir = mkdtempSync(join(tmpdir(), 'ck-test-'));
    try {
      writeFileSync(join(dir, '2026-06-11-todo.md'), '');
      expect(uniqueFilepath(dir, '2026-06-11-todo')).toBe(join(dir, '2026-06-11-todo-2.md'));
      writeFileSync(join(dir, '2026-06-11-todo-2.md'), '');
      expect(uniqueFilepath(dir, '2026-06-11-todo')).toBe(join(dir, '2026-06-11-todo-3.md'));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
