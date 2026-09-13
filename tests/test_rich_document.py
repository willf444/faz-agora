import importlib.util
import json
import os
import sys
from pathlib import Path

os.environ.setdefault("QT_QPA_PLATFORM", "offscreen")

from PyQt6.QtCore import Qt
from PyQt6.QtGui import QFont, QTextCharFormat, QTextCursor, QTextDocument, QTextListFormat
from PyQt6.QtTest import QTest
from PyQt6.QtWidgets import QApplication, QTextEdit

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location("faz_agora", ROOT / "faz-agora.py")
MODULE = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = MODULE
SPEC.loader.exec_module(MODULE)
APP = QApplication.instance() or QApplication([])

fixtures = json.loads((ROOT / "tests/rich-document-fixtures.json").read_text(encoding="utf-8"))
canonical_documents = json.loads(
    (ROOT / "tests/rich-document-canonical.json").read_text(encoding="utf-8")
)
if "--dump-json" in sys.argv:
    print(json.dumps(
        [MODULE.markdown_to_rich_document(source) for source in fixtures],
        ensure_ascii=False,
        separators=(",", ":"),
    ))
    raise SystemExit(0)

for source in fixtures:
    expected = MODULE.markdown_to_rich_document(source)
    current = expected
    for _ in range(25):
        editor = QTextEdit()
        MODULE.set_text_edit_rich_document(editor, current)
        current = MODULE.qtext_document_to_rich_document(editor.document())
    if current != expected:
        raise AssertionError(f"Documento Linux mudou após 25 ciclos: {source!r}")

for expected in canonical_documents:
    current = expected
    for _ in range(25):
        editor = QTextEdit()
        MODULE.set_text_edit_rich_document(editor, current)
        current = MODULE.qtext_document_to_rich_document(editor.document())
    if current != expected:
        raise AssertionError("Documento canônico Linux mudou após 25 ciclos.")

sample_path = os.environ.get("RICH_DOCUMENT_SAMPLE_FILE")
if sample_path:
    sample_tasks = json.loads(Path(sample_path).read_text(encoding="utf-8"))
    latest = max(
        sample_tasks,
        key=lambda task: task.get("updated_at", task.get("created_at", "")),
    )
    expected = MODULE.normalize_rich_document(
        latest.get("details_doc"), latest.get("details_md", "")
    )
    current = expected
    for _ in range(50):
        editor = QTextEdit()
        MODULE.set_text_edit_rich_document(editor, current)
        current = MODULE.qtext_document_to_rich_document(editor.document())
    if current != expected:
        raise AssertionError("A nota real mudou durante os ciclos do editor Linux.")

for enter_count in (1, 2, 3):
    editor = QTextEdit()
    editor.show()
    editor.setFocus()
    QTest.keyClicks(editor, "Linha 1")
    for _ in range(enter_count):
        QTest.keyClick(editor, Qt.Key.Key_Return)
    QTest.keyClicks(editor, "Linha 2")
    actual = MODULE.rich_document_to_markdown(
        MODULE.qtext_document_to_rich_document(editor.document())
    )
    expected = "Linha 1" + ("\n" * enter_count) + "Linha 2"
    if actual != expected:
        raise AssertionError(
            f"Linux alterou {enter_count} Enter(s): esperado {expected!r}, recebido {actual!r}"
        )

editor = QTextEdit()
editor.show()
editor.setFocus()
list_format = QTextListFormat()
list_format.setStyle(QTextListFormat.Style.ListDisc)
editor.textCursor().createList(list_format)
QTest.keyClicks(editor, "Lista 1")
QTest.keyClick(editor, Qt.Key.Key_Return)
QTest.keyClicks(editor, "Lista 2")
QTest.keyClick(editor, Qt.Key.Key_Return)
QTest.keyClick(editor, Qt.Key.Key_Return)
QTest.keyClicks(editor, "Texto normal")
actual = MODULE.rich_document_to_markdown(
    MODULE.qtext_document_to_rich_document(editor.document())
)
if actual != "- Lista 1\n- Lista 2\nTexto normal":
    raise AssertionError(f"Linux não saiu corretamente da lista: {actual!r}")

editor = QTextEdit()
editor.setPlainText("texto normal")
cursor = editor.textCursor()
cursor.setPosition(0)
cursor.setPosition(5, QTextCursor.MoveMode.KeepAnchor)
bold = QTextCharFormat()
bold.setFontWeight(QFont.Weight.Bold.value)
cursor.mergeCharFormat(bold)
normal = QTextCharFormat()
normal.setFontWeight(QFont.Weight.Normal.value)
cursor.mergeCharFormat(normal)
actual = MODULE.qtext_document_to_rich_document(editor.document())
if any(run.get("bold") for block in actual["blocks"] for run in block["runs"]):
    raise AssertionError("Linux não removeu o negrito aplicado anteriormente.")

layout_document = QTextDocument()
layout_document.setHtml(MODULE.rich_document_to_html(
    MODULE.markdown_to_rich_document("Linha 1\n\n\nLinha 2")
))
layout_document.setTextWidth(600)
layout_document.documentLayout().documentSize()
layout_metrics = []
block = layout_document.begin()
while block.isValid():
    layout = block.layout()
    layout_metrics.append((layout.position().y(), layout.boundingRect().height()))
    block = block.next()
if len(layout_metrics) != 4:
    raise AssertionError("A visualização Linux não preservou os quatro blocos visuais.")
for index, (position, height) in enumerate(layout_metrics):
    if index:
        previous_position, previous_height = layout_metrics[index - 1]
        if abs(position - (previous_position + previous_height)) > 0.1:
            raise AssertionError("A visualização Linux inseriu espaço entre blocos.")
normal_height = layout_metrics[0][1]
if any(abs(height - normal_height) > 0.1 for _, height in layout_metrics[1:3]):
    raise AssertionError("Uma linha vazia ocupa mais de uma linha na visualização Linux.")

document = MODULE.markdown_to_rich_document(
    "# Título\nLinha 1\n\n- Lista 1\n- Lista 2\n**Negrito** e *itálico*"
)
payload = {
    "id": "task-1",
    "title": "Contrato de sincronização",
    "details_md": "campo legado propositalmente diferente",
    "details_doc": document,
    "subtasks": [{
        "id": "sub-1",
        "title": "legado diferente",
        "content_doc": MODULE.markdown_to_rich_document("## Subtarefa\nTexto"),
        "completed": False,
    }],
}
for _ in range(25):
    payload = MODULE.Task.from_dict(json.loads(json.dumps(payload))).to_dict()
if payload["details_doc"] != document:
    raise AssertionError("O ciclo JSON/WebDAV do Linux modificou a descrição estruturada.")
if payload["details_md"] != MODULE.rich_document_to_markdown(document):
    raise AssertionError("O campo de compatibilidade da descrição ficou divergente.")

print("Linux: editor e JSON/WebDAV estáveis em 25 ciclos.")
