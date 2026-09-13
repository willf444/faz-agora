import importlib.util
import os
import sys
from datetime import datetime, timedelta
from pathlib import Path

os.environ.setdefault("QT_QPA_PLATFORM", "offscreen")

from PyQt6.QtWidgets import QApplication

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location("faz_due_colors", ROOT / "faz-agora.py")
MODULE = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = MODULE
SPEC.loader.exec_module(MODULE)
APP = QApplication.instance() or QApplication([])

reference = datetime(2026, 9, 12, 15, 0)


def task(identifier, due, completed=False):
    return MODULE.Task(
        id=identifier,
        title="Teste",
        due_at=MODULE.datetime_to_storage(due) if due else "",
        completed=completed,
    )


cases = [
    (task("overdue", reference - timedelta(days=1)), "#f87171"),
    (task("earlier-today", reference - timedelta(hours=2)), "#d97706"),
    (task("later-today", reference + timedelta(hours=2)), "#d97706"),
    (task("future", reference + timedelta(days=1)), "#f5f5f5"),
    (task("without-date", None), "#d4d4d4"),
    (task("completed", reference - timedelta(days=1), completed=True), "#737373"),
]

for current_task, expected in cases:
    actual = MODULE.task_due_color(current_task, reference)
    if actual != expected:
        raise AssertionError(
            f"Cor divergente para {current_task.id}: esperado {expected}, recebido {actual}"
        )

label_cases = [
    (task("yesterday-label", datetime(2026, 9, 11, 23, 55)), "Ontem às 23:55"),
    (task("today-label", datetime(2026, 9, 12, 16, 30)), "Hoje às 16:30"),
    (task("tomorrow-label", datetime(2026, 9, 13, 9, 7)), "Amanhã às 09:07"),
    (task("other-label", datetime(2026, 9, 14, 10, 45)), "14/09/2026 às 10:45"),
    (task("other-year-label", datetime(2027, 1, 2, 6, 0)), "02/01/2027 às 06:00"),
    (task("without-date-label", None), "Sem data"),
]

for current_task, expected in label_cases:
    actual = MODULE.format_task_due(current_task, reference)
    if actual != expected:
        raise AssertionError(
            f"Data divergente para {current_task.id}: esperado {expected}, recebido {actual}"
        )

dated_label = MODULE.DueDateLabel("Hoje", True)
undated_label = MODULE.DueDateLabel("Sem data", False)
if dated_label.contentsMargins().left() != 20:
    raise AssertionError("O relógio não reservou espaço ao lado da data.")
if undated_label.contentsMargins().left() != 0:
    raise AssertionError("Tarefa sem data recebeu espaço para um relógio inexistente.")

print("Linux: cores e textos de vencimento alinhados ao Android.")
