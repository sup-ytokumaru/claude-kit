# office

Excel・PowerPoint・Word ファイルを解析してテキスト化する。  
引数にファイルパスを指定する: `/office /path/to/file.xlsx`

## 非対話実行時

ファイルパスが引数に無ければ「ファイルパスを指定してください」と報告して停止する。Step 2 の `pip install` はユーザー環境への書き込みを伴うため実行せず、uv も既存モジュールも無い場合は不足を報告して停止する。

## Step 1: ファイルパスを確認する

`$ARGUMENTS` からファイルパスを取得する。指定がない場合はユーザーにパスを尋ねる。

まずファイルの存在を確認する（`test -f "<パス>"`）。存在しない場合は「ファイルが見つかりません: <パス>」と伝えて終了する（Python の例外メッセージに頼らない）。

ファイルの拡張子からファイル種別を判定する:
- `.xlsx` / `.xlsm` → Excel（openpyxl は両方読める。`.xls` は非対応 — openpyxl が旧形式をサポートしないため）
- `.pptx` → PowerPoint
- `.docx` → Word
- それ以外 → 「対応していない形式です（xlsx/xlsm/pptx/docx のみ。旧形式 xls は非対応）」と伝えて終了

## Step 2: 実行環境を決める

必要パッケージ: Excel → `openpyxl` / PowerPoint → `python-pptx` / Word → `python-docx`

```bash
which uv
```

- **uv がある場合（推奨）**: インストール不要。Step 3 のスクリプトを
  `uv run --with <パッケージ> python - "<ファイルパス>"` で実行する
- **uv が無い場合**: モジュールの有無を確認し、無ければ次の順で試す（成功した時点で止める）。`pip install` はユーザー環境への書き込みを伴うため、実行前に「<パッケージ> を pip でユーザー環境にインストールします」と1行伝えてから実行する:
  1. `python3 -c "import <モジュール>" 2>/dev/null` → あれば `python3 -` で実行
  2. `python3 -m pip install --user <パッケージ> -q`
  3. PEP 668（`externally-managed-environment`）エラーの場合:
     `python3 -m pip install --user --break-system-packages <パッケージ> -q`
  4. pip 自体が無い場合（`No module named pip`）: uv のインストール
     （`curl -LsSf https://astral.sh/uv/install.sh | sh`）または `sudo apt install python3-pip`
     をユーザーに案内して停止する（sudo を伴うためスキルからは実行しない）

## Step 3: ファイルを解析する

以下のスクリプトは `python3 -` で表記する。uv を使う場合は
`python3 -` を `uv run --with <パッケージ> python -` に読み替える。

### Excel (.xlsx)

シートあたりの出力上限（既定 200 行）をスクリプト側で打ち切る。巨大ファイルの全行出力はコンテキストを食い潰すため、省略が出た場合は必要な範囲を確認してから第2引数で上限を上げて再実行する。

```bash
python3 - "<ファイルパス>" [上限行数] <<'EOF'
import openpyxl, sys

MAX_ROWS = int(sys.argv[2]) if len(sys.argv) > 2 else 200  # シートあたりの出力上限（非空行ベース）

try:
    wb = openpyxl.load_workbook(sys.argv[1], data_only=True)
    for sheet_name in wb.sheetnames:
        ws = wb[sheet_name]
        print(f"\n## シート: {sheet_name}  ({ws.max_row}行 × {ws.max_column}列)")
        printed = omitted = 0
        for row in ws.iter_rows(values_only=True):
            if any(v is not None for v in row):
                if printed < MAX_ROWS:
                    print("\t".join(str(v) if v is not None else "" for v in row))
                    printed += 1
                else:
                    omitted += 1
        if omitted:
            print(f"…非空行 {omitted} 行を省略（全件必要なら上限行数を第2引数に指定して再実行）")
except Exception as e:
    print(f"ERROR: {e}", file=sys.stderr)
    sys.exit(1)
EOF
```

### PowerPoint (.pptx)

```bash
python3 - "<ファイルパス>" <<'EOF'
from pptx import Presentation
from pptx.enum.shapes import MSO_SHAPE_TYPE
import sys

def walk(shapes):
    # グループ図形は再帰し、テキストに加えて表（GraphicFrame）も拾う（仕様書 PPT は表が主情報のことが多い）
    for shape in shapes:
        if shape.shape_type == MSO_SHAPE_TYPE.GROUP:
            walk(shape.shapes)
            continue
        if shape.has_text_frame:
            for para in shape.text_frame.paragraphs:
                text = para.text.strip()
                if text:
                    print(text)
        if getattr(shape, "has_table", False) and shape.has_table:
            print()
            for row in shape.table.rows:
                print(" | ".join(cell.text.strip() for cell in row.cells))

try:
    prs = Presentation(sys.argv[1])
    for i, slide in enumerate(prs.slides, 1):
        print(f"\n## スライド {i}")
        walk(slide.shapes)
        if slide.has_notes_slide:
            notes = slide.notes_slide.notes_text_frame.text.strip()
            if notes:
                print(f"\n> ノート: {notes}")
except Exception as e:
    print(f"ERROR: {e}", file=sys.stderr)
    sys.exit(1)
EOF
```

### Word (.docx)

```bash
python3 - "<ファイルパス>" <<'EOF'
from docx import Document
from docx.table import Table
import re
import sys

try:
    doc = Document(sys.argv[1])
    # 文書内の出現順を保って段落と表を出力する（表がどの見出し配下にあるかを維持する）。
    # iter_inner_content は python-docx 1.1+。無い旧環境では段落→表の順に縮退し、その旨を注記する
    if hasattr(doc, "iter_inner_content"):
        blocks = doc.iter_inner_content()
    else:
        print("> 注: python-docx が古いため表は本文の後にまとめて出力される（文書内の位置とは異なる）")
        blocks = list(doc.paragraphs) + list(doc.tables)
    tbl_n = 0
    para_n = 0
    for block in blocks:
        if isinstance(block, Table):
            tbl_n += 1
            print(f"\n### 表 {tbl_n}")
            for row in block.rows:
                print(" | ".join(cell.text.strip() for cell in row.cells))
        elif block.text.strip():
            para_n += 1
            # style が None の段落（スタイル未解決）は本文扱い — 1段落の異常で全体を落とさない
            style = block.style.name if block.style else ""
            # 見出しスタイルは英語 "Heading 1" / 日本語 "見出し 1" の両方に対応する。
            # レベル数字が取れないスタイル名（"Heading" 単独等）は本文として出力し、例外で全体を落とさない
            m = re.match(r"^(?:Heading|見出し)\s*(\d+)$", style)
            if m:
                print(f"\n{'#' * int(m.group(1))} {block.text}")
            elif style in ("Title", "表題"):
                # 文書タイトル（Title / 表題スタイル）は最上位見出しとして出力し、構造を残す
                print(f"\n# {block.text}")
            else:
                print(block.text)
    # Step 4 の規模報告用。別コマンドで数え直さずに済むよう出力の最後に集計を添える
    print(f"\n---\n規模: 段落 {para_n} / 表 {tbl_n}")
except Exception as e:
    print(f"ERROR: {e}", file=sys.stderr)
    sys.exit(1)
EOF
```

## Step 4: 解析結果を提示する

出力を整形してユーザーに提示する。行数が多い場合（100行超）は先頭 50 行と末尾 10 行を示し、全件表示が必要か確認する。Excel はスクリプト側でシートあたり 200 行（既定）に打ち切っているため、省略行の表示があれば「どの範囲が必要か」を確認してから上限を上げて再実行する。

ファイルの概要として以下を先頭に表示する:
- ファイル名
- 種別（Excel / PowerPoint / Word）
- 規模（シート数・行数 / スライド数 / 段落数）

解析対象が**仕様書**（機能仕様・画面仕様・移行仕様など）で、内容をプロジェクトに残す必要がありそうな場合は、`/spec-import` を案内する（テキスト化結果を構造化して `specs/<機能名>.md` に取り込み、`/qa`・`/plan` の一次情報にする後工程）。本スキルは表示のみでファイルを書き込まない。

## 制約

- ファイルが存在しない場合は「ファイルが見つかりません: <パス>」と伝えて終了する
- パスワード保護されたファイルはエラーになる場合がある。その旨をユーザーに伝える
- 画像・図形のテキスト以外の内容（グラフデータ等）は取得できない

## 完了条件

Step 4 の解析結果を提示した時点で完了。解析対象が仕様書なら `/spec-import` を案内する。
