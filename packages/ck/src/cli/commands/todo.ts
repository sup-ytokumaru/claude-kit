import { Command } from 'commander';
import { mkdirSync, writeFileSync, readFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { getDate, toSlug, uniqueFilepath } from '../utils';

function resolveDir(global: boolean | undefined): string {
  return global
    ? join(homedir(), '.ck-notes', 'todos')
    : join(process.cwd(), '.notes', 'todos');
}

type TodoMeta = {
  file: string;
  status: string;
  priority: string;
  created: string;
  title: string;
};

function readTodos(dir: string): TodoMeta[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter(f => f.endsWith('.md'))
    .map(file => {
      const raw = readFileSync(join(dir, file), 'utf-8');
      const fm = raw.match(/^---\n([\s\S]*?)\n---\n?/);
      const get = (key: string) =>
        fm?.[1].match(new RegExp(`^${key}:\\s*(.+)$`, 'm'))?.[1].trim() ?? '';
      const body = fm ? raw.slice(fm[0].length) : raw;
      const title = (body.split('\n').find(l => l.trim()) ?? file).trim();
      return {
        file,
        status: get('status') || 'open',
        priority: get('priority') || 'medium',
        created: get('created'),
        title,
      };
    });
}

export const todoCommand = new Command('todo').description('TODO管理（Markdownファイル）');

todoCommand
  .command('add <content>', { isDefault: true })
  .description('TODOをMarkdownファイルに記録する')
  .option('--global', 'グローバル保存 (~/.ck-notes/todos/)')
  .option('--priority <priority>', '優先度 (high|medium|low)', 'medium')
  .action((content: string, opts) => {
    const date = getDate();
    const slug = toSlug(content);
    const dir = resolveDir(opts.global);
    mkdirSync(dir, { recursive: true });
    const filepath = uniqueFilepath(dir, `${date}-${slug}`);
    writeFileSync(filepath, `---\nstatus: open\ncreated: ${date}\npriority: ${opts.priority}\n---\n\n${content}\n`);
    console.log(filepath);
  });

todoCommand
  .command('list')
  .description('TODO一覧を表示（デフォルトは open のみ）')
  .option('--global', 'グローバル (~/.ck-notes/todos/) を参照')
  .option('--all', 'done を含めて表示')
  .action(opts => {
    const todos = readTodos(resolveDir(opts.global)).filter(
      t => opts.all || t.status === 'open'
    );
    if (todos.length === 0) {
      console.log(opts.all ? 'TODO はありません' : 'open の TODO はありません');
      return;
    }
    const order: Record<string, number> = { high: 0, medium: 1, low: 2 };
    todos.sort(
      (a, b) =>
        (order[a.priority] ?? 1) - (order[b.priority] ?? 1) ||
        a.file.localeCompare(b.file)
    );
    for (const t of todos) {
      const status = opts.all ? `[${t.status}] ` : '';
      console.log(`${status}[${t.priority}] ${t.file} — ${t.title}`);
    }
  });

todoCommand
  .command('done <name>')
  .description('TODOを完了にする（status: done + completed 日付）')
  .option('--global', 'グローバル (~/.ck-notes/todos/) を参照')
  .action((name: string, opts) => {
    const dir = resolveDir(opts.global);
    const files = existsSync(dir)
      ? readdirSync(dir).filter(f => f.endsWith('.md'))
      : [];
    const exact = name.endsWith('.md') ? name : `${name}.md`;
    let matches = files.filter(f => f === exact);
    if (matches.length === 0) matches = files.filter(f => f.includes(name));
    // 日本語のみの TODO はファイル名がタイムスタンプになり名前で引けないため、本文タイトルの部分一致にもフォールバックする
    if (matches.length === 0) {
      matches = readTodos(dir)
        .filter(t => t.title.includes(name))
        .map(t => t.file);
    }
    if (matches.length === 0) {
      console.error(`TODO が見つかりません: ${name}`);
      process.exit(1);
    }
    if (matches.length > 1) {
      console.error('複数の TODO が一致します。ファイル名で指定してください:');
      matches.forEach(m => console.error(`  ${m}`));
      process.exit(1);
    }
    const filepath = join(dir, matches[0]);
    const raw = readFileSync(filepath, 'utf-8');
    if (/^status:\s*done$/m.test(raw)) {
      console.log(`すでに完了済み: ${filepath}`);
      return;
    }
    if (!/^status:\s*open$/m.test(raw)) {
      console.error(`status: open が見つかりません: ${filepath}`);
      process.exit(1);
    }
    writeFileSync(
      filepath,
      raw.replace(/^status:\s*open$/m, `status: done\ncompleted: ${getDate()}`)
    );
    console.log(filepath);
  });
