import { existsSync } from 'fs';
import { join } from 'path';

export function getDate(): string {
  return new Date().toISOString().split('T')[0];
}

// 同名ファイルが存在する場合は -2, -3 ... を付けて黙殺上書きを防ぐ
export function uniqueFilepath(dir: string, basename: string): string {
  let path = join(dir, `${basename}.md`);
  for (let i = 2; existsSync(path); i++) {
    path = join(dir, `${basename}-${i}.md`);
  }
  return path;
}

export function toSlug(text: string): string {
  const ascii = text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .slice(0, 40)
    // 日本語除去で生じる連続ハイフンを畳み、先頭・末尾のハイフンを除く（`--r1` のような退化を防ぐ）
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
  // 日本語等でASCII部分が空になる場合はミリ秒タイムスタンプで補完（衝突回避）
  if (!ascii) {
    return Date.now().toString();
  }
  return ascii;
}
