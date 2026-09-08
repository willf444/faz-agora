#!/usr/bin/env python3
from __future__ import annotations

import json
import sys
import uuid
import calendar
import html
import re
from dataclasses import dataclass, asdict, field
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional

from PyQt6.QtCore import Qt, QDateTime, QTimer, QLocale, QSize, QPoint, QEvent, pyqtSignal
from PyQt6.QtGui import QAction, QGuiApplication, QTextDocument
from PyQt6.QtWidgets import (
    QApplication,
    QWidget,
    QVBoxLayout,
    QPushButton,
    QListWidget,
    QLineEdit,
    QCheckBox,
    QHBoxLayout,
    QListWidgetItem,
    QLabel,
    QDateTimeEdit,
    QMessageBox,
    QComboBox,
    QDialog,
    QTextEdit,
    QFileDialog,
    QMenu,
    QSizePolicy,
    QDialogButtonBox,
    QTabWidget,
    QSplitter,
    QTextBrowser,
    QSpinBox,
    QAbstractItemView,
)

APP_DIR = Path.home() / ".willdo"
CONFIG_FILE = APP_DIR / "config.json"
TASKS_FILENAME = "task.json"
DATE_FMT = "%d/%m/%Y %H:%M"
DISPLAY_DATE_FMT = "dd/MM/yyyy HH:mm"

RECURRENCE_OPTIONS = [
    "Sem recorrência",
    "Diariamente",
    "Semanalmente",
    "Mensalmente no mesmo dia",
    "Anualmente no mesmo dia",
    "Personalizado",
]

CUSTOM_RECURRENCE_UNITS = {
    "hours": ("Hora", "Horas", "hora", "horas"),
    "days": ("Dia", "Dias", "dia", "dias"),
    "weeks": ("Semana", "Semanas", "semana", "semanas"),
}

BASE_STYLESHEET = """
QWidget {
    font-family: Arial;
    font-size: 14px;
    color: #111827;
    background: #f5f7fb;
}
QLineEdit, QTextEdit, QComboBox, QDateTimeEdit, QListWidget {
    padding: 8px;
    border: 1px solid #cbd5e1;
    border-radius: 6px;
    background: white;
}
QLineEdit:focus, QTextEdit:focus, QComboBox:focus, QDateTimeEdit:focus, QListWidget:focus {
    border: 1px solid #3b82f6;
}
QPushButton {
    background: #2563eb;
    color: white;
    border: none;
    border-radius: 6px;
    padding: 8px 12px;
    font-weight: 600;
}
QPushButton:hover {
    background: #1d4ed8;
}
QPushButton#ghostButton {
    background: transparent;
    color: #475569;
    border: 1px solid transparent;
}
QPushButton#ghostButton:hover {
    background: #e2e8f0;
}
QPushButton#smallButton {
    padding: 5px 10px;
    font-size: 12px;
}
QPushButton#smallDangerButton {
    background: white;
    color: #dc2626;
    border: 1px solid #fecaca;
    padding: 5px 10px;
    font-size: 12px;
}
QPushButton#smallDangerButton:hover {
    background: #fef2f2;
}
QPushButton#secondaryButton {
    background: white;
    color: #1e40af;
    border: 1px solid #bfdbfe;
}
QPushButton#secondaryButton:hover {
    background: #eff6ff;
    border-color: #60a5fa;
}
QPushButton#dangerButton {
    background: white;
    color: #dc2626;
    border: 1px solid #fecaca;
}
QPushButton#dangerButton:hover {
    background: #fef2f2;
    border-color: #f87171;
}
QPushButton#syncButton {
    background: #f8fafc;
    color: #475569;
    border: 1px solid #cbd5e1;
    padding: 5px 10px;
    font-size: 12px;
}
QPushButton#syncButton:hover {
    background: #f1f5f9;
}
QPushButton#syncButton[synced="true"] {
    background: #16a34a;
    color: white;
    border-color: #15803d;
}
QPushButton:disabled {
    background: #f1f5f9;
    color: #94a3b8;
    border-color: #e2e8f0;
}
QListWidget {
    background: #f8fafc;
    border: none;
    border-radius: 8px;
    padding: 8px;
    outline: none;
}
QListWidget::item {
    background: transparent;
    border: none;
    padding: 0;
}
QListWidget::item:selected {
    background: transparent;
}
QTabWidget::pane {
    border: 1px solid #dbe3ec;
    border-radius: 8px;
    background: white;
}
QTabBar::tab {
    background: #dbe3ec;
    color: #334155;
    padding: 8px 14px;
    margin-right: 3px;
    border: 1px solid #cbd5e1;
    border-bottom: none;
    border-top-left-radius: 8px;
    border-top-right-radius: 8px;
}
QTabBar::tab:hover {
    background: #e2e8f0;
}
QTabBar::tab:selected {
    background: white;
    color: #0f172a;
    font-weight: 700;
    border: 1px solid #cbd5e1;
    border-bottom: 1px solid white;
    margin-bottom: -1px;
}
QLabel#mutedLabel {
    color: #64748b;
    font-size: 12px;
    background: transparent;
}
QLabel#dateLabel {
    color: #334155;
    font-weight: 700;
    font-size: 12px;
    background: transparent;
}
QLabel#sectionLabel {
    color: #334155;
    font-size: 12px;
    font-weight: 700;
    background: transparent;
}
QLabel#appTitle {
    color: #0f172a;
    font-size: 24px;
    font-weight: 700;
    background: transparent;
}
QLabel#appSubtitle {
    color: #64748b;
    font-size: 12px;
    background: transparent;
}
"""

def ensure_app_dir() -> None:
    APP_DIR.mkdir(parents=True, exist_ok=True)

def now_dt() -> datetime:
    return datetime.now()

def now_str() -> str:
    return datetime_to_storage(now_dt())

def parse_stored_datetime(value: str) -> Optional[datetime]:
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
        if parsed.tzinfo is not None:
            parsed = parsed.astimezone().replace(tzinfo=None)
        return parsed
    except (TypeError, ValueError):
        try:
            return datetime.strptime(value, DATE_FMT)
        except (TypeError, ValueError):
            return None

def datetime_to_storage(value: datetime) -> str:
    if value.tzinfo is None:
        value = value.astimezone()
    else:
        value = value.astimezone()
    return value.isoformat(timespec="seconds")

def normalize_stored_datetime(value: str) -> str:
    parsed = parse_stored_datetime(value)
    return datetime_to_storage(parsed) if parsed else ""

def parse_custom_recurrence(recurrence: str) -> Optional[tuple[int, str]]:
    match = re.fullmatch(
        r"A cada (\d+) (hora|horas|dia|dias|semana|semanas)",
        (recurrence or "").strip(),
        flags=re.IGNORECASE,
    )
    if not match:
        return None
    unit_text = match.group(2).lower()
    unit = "hours" if unit_text.startswith("hora") else "weeks" if unit_text.startswith("semana") else "days"
    return max(1, int(match.group(1))), unit

def format_custom_recurrence(interval: int, unit: str) -> str:
    interval = max(1, interval)
    unit_config = CUSTOM_RECURRENCE_UNITS.get(unit, CUSTOM_RECURRENCE_UNITS["days"])
    label = unit_config[2] if interval == 1 else unit_config[3]
    return f"A cada {interval} {label}"

def clean_details_text(text: str) -> str:
    raw = (text or "").strip()
    if not raw:
        return ""
    raw = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", raw)
    raw = re.sub(r"[*_`#>~-]+", " ", raw)
    raw = re.sub(r"\s+", " ", raw).strip()
    return raw

def markdown_to_html(md: str) -> str:
    if not md.strip():
        return "<p style='color:#94a3b8;'>Sem preview.</p>"

    lines = md.splitlines()
    out = []
    in_ul = False

    def close_ul():
        nonlocal in_ul
        if in_ul:
            out.append("</ul>")
            in_ul = False

    for line in lines:
        raw = line.rstrip()
        stripped = raw.strip()

        if not stripped:
            close_ul()
            out.append("<br>")
            continue

        if stripped.startswith("### "):
            close_ul()
            out.append(f"<h3>{inline_md(stripped[4:])}</h3>")
            continue
        if stripped.startswith("## "):
            close_ul()
            out.append(f"<h2>{inline_md(stripped[3:])}</h2>")
            continue
        if stripped.startswith("# "):
            close_ul()
            out.append(f"<h1>{inline_md(stripped[2:])}</h1>")
            continue
        if stripped.startswith("- ") or stripped.startswith("* "):
            if not in_ul:
                out.append("<ul>")
                in_ul = True
            out.append(f"<li>{inline_md(stripped[2:])}</li>")
            continue

        close_ul()
        out.append(f"<p>{inline_md(stripped)}</p>")

    close_ul()
    body = "\n".join(out)
    return f"""
    <html>
    <head>
      <style>
        body {{ font-family: Arial; color:#111827; line-height:1.45; }}
        h1,h2,h3 {{ color:#0f172a; margin:8px 0 6px 0; }}
        p {{ margin:6px 0; }}
        ul {{ margin:6px 0 6px 18px; padding:0; }}
        li {{ margin:4px 0; }}
        code {{ background:#eef2ff; padding:2px 4px; border-radius:4px; }}
        strong {{ font-weight:700; }}
        em {{ font-style:italic; }}
        a {{ color:#2563eb; text-decoration:none; }}
      </style>
    </head>
    <body>{body}</body>
    </html>
    """

def inline_md(text: str) -> str:
    s = html.escape(text)
    s = re.sub(r"\[([^\]]+)\]\(([^)]+)\)", r'<a href="\2">\1</a>', s)
    s = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", s)
    s = re.sub(r"\*(.+?)\*", r"<em>\1</em>", s)
    s = re.sub(r"`(.+?)`", r"<code>\1</code>", s)
    return s

@dataclass
class SubTask:
    id: str
    title: str
    completed: bool = False

    def to_dict(self) -> dict:
        return asdict(self)

    @classmethod
    def from_dict(cls, data: dict) -> "SubTask":
        return cls(
            id=data["id"],
            title=data["title"],
            completed=data.get("completed", False),
        )

@dataclass
class Task:
    id: str
    title: str
    due_at: str = ""
    recurrence: str = "Sem recorrência"
    details_md: str = ""
    completed: bool = False
    completed_at: str = ""
    reminded_at: str = ""
    created_at: str = ""
    updated_at: str = ""
    subtasks: list[SubTask] = field(default_factory=list)

    @property
    def has_due_date(self) -> bool:
        return bool(self.due_at.strip())

    @property
    def due_datetime(self) -> Optional[datetime]:
        if not self.has_due_date:
            return None
        return parse_stored_datetime(self.due_at)

    @property
    def completed_datetime(self) -> Optional[datetime]:
        if not self.completed_at:
            return None
        try:
            return parse_stored_datetime(self.completed_at)
        except Exception:
            return None

    @property
    def details_plain(self) -> str:
        return clean_details_text(self.details_md)

    def to_dict(self) -> dict:
        data = asdict(self)
        data["subtasks"] = [s.to_dict() for s in self.subtasks]
        return data

    @classmethod
    def from_dict(cls, data: dict) -> "Task":
        details_md = data.get("details_md", "")
        if not details_md:
            details_md = data.get("details_html", "") or data.get("details", "")
        return cls(
            id=data["id"],
            title=data["title"],
            due_at=normalize_stored_datetime(data.get("due_at", "")),
            recurrence=data.get("recurrence", "Sem recorrência"),
            details_md=details_md,
            completed=data.get("completed", False),
            completed_at=normalize_stored_datetime(data.get("completed_at", "")),
            reminded_at=normalize_stored_datetime(data.get("reminded_at", "")),
            created_at=normalize_stored_datetime(data.get("created_at", "")),
            updated_at=normalize_stored_datetime(data.get("updated_at", "")),
            subtasks=[SubTask.from_dict(s) for s in data.get("subtasks", []) if isinstance(s, dict)],
        )

class ConfigStore:
    def __init__(self, path: Path):
        self.path = path
        self.data = self._load()

    def _load(self) -> dict:
        ensure_app_dir()
        if not self.path.exists():
            return {}
        try:
            return json.loads(self.path.read_text(encoding="utf-8"))
        except Exception:
            return {}

    def save(self) -> None:
        ensure_app_dir()
        self.path.write_text(json.dumps(self.data, ensure_ascii=False, indent=2), encoding="utf-8")

    def get_tasks_dir(self) -> Optional[Path]:
        value = self.data.get("tasks_dir")
        return Path(value) if value else None

    def set_tasks_dir(self, path: Path) -> None:
        self.data["tasks_dir"] = str(path)
        self.save()

    def get_geometry(self) -> tuple[Optional[QSize], Optional[QPoint]]:
        size = self.data.get("window_size")
        pos = self.data.get("window_pos")
        qsize = QSize(size["w"], size["h"]) if isinstance(size, dict) else None
        qpos = QPoint(pos["x"], pos["y"]) if isinstance(pos, dict) else None
        return qsize, qpos

    def set_geometry(self, size: QSize, pos: QPoint) -> None:
        self.data["window_size"] = {"w": size.width(), "h": size.height()}
        self.data["window_pos"] = {"x": pos.x(), "y": pos.y()}
        self.save()

class TaskStore:
    def __init__(self, tasks_file: Path):
        self.tasks_file = tasks_file
        self.tasks_file.parent.mkdir(parents=True, exist_ok=True)
        self.tasks: list[Task] = []
        self._last_signature = None
        self.load()

    def file_signature(self):
        try:
            stat = self.tasks_file.stat()
            return stat.st_mtime_ns, stat.st_size
        except OSError:
            return None

    def has_external_changes(self) -> bool:
        current = self.file_signature()
        return current is not None and current != self._last_signature

    def load(self) -> bool:
        if not self.tasks_file.exists():
            self.tasks = []
            self._last_signature = None
            return True
        try:
            raw = json.loads(self.tasks_file.read_text(encoding="utf-8"))
        except Exception:
            return False
        if not isinstance(raw, list):
            return False

        loaded_tasks = []
        for item in raw:
            if isinstance(item, dict) and "id" in item and "title" in item:
                try:
                    loaded_tasks.append(Task.from_dict(item))
                except Exception:
                    pass
        self.tasks = loaded_tasks
        self.sort_tasks()
        self._last_signature = self.file_signature()
        return True

    def save(self) -> None:
        self.tasks_file.parent.mkdir(parents=True, exist_ok=True)
        self.tasks_file.write_text(
            json.dumps([t.to_dict() for t in self.tasks], ensure_ascii=False, indent=2),
            encoding="utf-8"
        )
        self._last_signature = self.file_signature()

    def sort_tasks(self) -> None:
        pending = [t for t in self.tasks if not t.completed]
        completed = [t for t in self.tasks if t.completed]

        def pending_key(t: Task):
            due = t.due_datetime
            return (0 if due else 1, due or datetime.max, t.title.lower())

        pending.sort(key=pending_key)
        completed.sort(key=lambda t: (t.completed_datetime or datetime.min), reverse=True)
        self.tasks = pending + completed

    def add(self, task: Task) -> None:
        self.tasks.append(task)
        self.sort_tasks()
        self.save()

    def update(self, task: Task) -> None:
        for i, current in enumerate(self.tasks):
            if current.id == task.id:
                self.tasks[i] = task
                break
        self.sort_tasks()
        self.save()

    def remove(self, task_id: str) -> None:
        self.tasks = [t for t in self.tasks if t.id != task_id]
        self.save()

    def get(self, task_id: str) -> Optional[Task]:
        for t in self.tasks:
            if t.id == task_id:
                return t
        return None

    def remove_completed(self) -> int:
        before = len(self.tasks)
        self.tasks = [t for t in self.tasks if not t.completed]
        removed = before - len(self.tasks)
        self.save()
        return removed

class SubTaskRow(QWidget):
    clicked = pyqtSignal()
    double_clicked = pyqtSignal()
    wheel_requested = pyqtSignal(int)

    def __init__(self, title: str, checked: bool = False, parent: Optional[QWidget] = None):
        super().__init__(parent)
        self.setObjectName("subtaskCard")
        self.setAttribute(Qt.WidgetAttribute.WA_StyledBackground, True)
        self.setCursor(Qt.CursorShape.PointingHandCursor)
        self._selected = False

        layout = QHBoxLayout(self)
        layout.setContentsMargins(10, 7, 10, 7)
        layout.setSpacing(9)
        self.checkbox = QCheckBox(self)
        self.checkbox.setChecked(checked)
        self.checkbox.toggled.connect(self.update_style)
        self._title = title.strip()
        self.title_label = QLabel(self)
        self.title_label.setWordWrap(True)
        self.title_label.setTextFormat(Qt.TextFormat.RichText)
        self.title_label.setOpenExternalLinks(True)
        self.title_label.installEventFilter(self)
        layout.addWidget(self.checkbox)
        layout.addWidget(self.title_label, stretch=1)
        layout.setAlignment(self.checkbox, Qt.AlignmentFlag.AlignTop)
        layout.setAlignment(self.title_label, Qt.AlignmentFlag.AlignTop)
        self.update_style()

    def title(self) -> str:
        return self._title

    def set_title(self, title: str) -> None:
        self._title = title.strip()
        self.update_style()

    def set_selected(self, selected: bool) -> None:
        self._selected = selected
        self.update_style()

    def update_style(self) -> None:
        checked = self.checkbox.isChecked()
        background = "#eff6ff" if self._selected else "#ffffff"
        border = "#2563eb" if self._selected else "#e2e8f0"
        border_width = 2 if self._selected else 1
        self.setStyleSheet(
            f"#subtaskCard {{ background:{background}; border:{border_width}px solid {border}; border-radius:8px; }}"
        )
        font = self.title_label.font()
        font.setStrikeOut(checked)
        self.title_label.setFont(font)
        color = "#94a3b8" if checked else "#1e293b"
        self.title_label.setStyleSheet(f"color:{color};background:transparent;border:none;")
        rendered = markdown_to_html(self._title)
        if checked:
            rendered = rendered.replace(
                "body {",
                "body { color:#94a3b8; text-decoration:line-through;",
                1,
            )
        self.title_label.setText(rendered)

    def eventFilter(self, watched, event) -> bool:  # type: ignore[override]
        if watched is self.title_label:
            if event.type() == QEvent.Type.MouseButtonPress:
                self.clicked.emit()
            elif event.type() == QEvent.Type.MouseButtonDblClick:
                self.double_clicked.emit()
            elif event.type() == QEvent.Type.Wheel:
                self.wheel_requested.emit(event.angleDelta().y())
                return True
        return super().eventFilter(watched, event)

    def mousePressEvent(self, event) -> None:  # type: ignore[override]
        self.clicked.emit()
        super().mousePressEvent(event)

    def mouseDoubleClickEvent(self, event) -> None:  # type: ignore[override]
        self.double_clicked.emit()
        super().mouseDoubleClickEvent(event)

    def wheelEvent(self, event) -> None:  # type: ignore[override]
        self.wheel_requested.emit(event.angleDelta().y())
        event.accept()

class TaskEditorDialog(QDialog):
    def __init__(self, parent: Optional[QWidget] = None, task: Optional[Task] = None):
        super().__init__(parent)
        self.setWindowTitle("Editar tarefa" if task else "Nova tarefa")
        self.setMinimumSize(860, 660)
        self.setWindowFlags(self.windowFlags() | Qt.WindowType.WindowMinMaxButtonsHint)
        self.description_md = task.details_md if task else ""
        self.editing_subtask_item: Optional[QListWidgetItem] = None
        self.editor_draft = ""
        self.editor_draft_was_consumed = False
        self.editor_was_consumed = False
        self.updating_editor = False
        self.last_subtasks_width = -1

        layout = QVBoxLayout(self)

        self.title_input = QLineEdit(self)
        self.title_input.setPlaceholderText("Digite a tarefa...")
        layout.addWidget(self.title_input)

        self.use_date_checkbox = QCheckBox("Definir data e hora")
        self.use_date_checkbox.toggled.connect(self.update_due_enabled)
        layout.addWidget(self.use_date_checkbox)

        self.datetime_picker = QDateTimeEdit(self)
        self.datetime_picker.setCalendarPopup(True)
        self.datetime_picker.setDisplayFormat(DISPLAY_DATE_FMT)
        self.datetime_picker.setLocale(QLocale("pt_BR"))
        self.datetime_picker.setDateTime(QDateTime.currentDateTime())
        layout.addWidget(self.datetime_picker)

        self.recurrence_box = QComboBox(self)
        self.recurrence_box.addItems(RECURRENCE_OPTIONS)
        self.recurrence_box.currentTextChanged.connect(self.update_custom_recurrence_visibility)
        self.custom_interval = QSpinBox(self)
        self.custom_interval.setRange(1, 9999)
        self.custom_interval.setPrefix("A cada ")
        self.custom_unit = QComboBox(self)
        for unit, labels in CUSTOM_RECURRENCE_UNITS.items():
            self.custom_unit.addItem(labels[1], unit)
        recurrence_row = QHBoxLayout()
        recurrence_row.addWidget(self.recurrence_box, stretch=2)
        recurrence_row.addWidget(self.custom_interval, stretch=1)
        recurrence_row.addWidget(self.custom_unit, stretch=1)
        layout.addLayout(recurrence_row)

        toolbar = QHBoxLayout()
        self.bold_button = QPushButton("**negrito**")
        self.bold_button.setObjectName("smallButton")
        self.bold_button.clicked.connect(self.wrap_bold)
        self.italic_button = QPushButton("*itálico*")
        self.italic_button.setObjectName("smallButton")
        self.italic_button.clicked.connect(self.wrap_italic)
        self.list_button = QPushButton("- lista")
        self.list_button.setObjectName("smallButton")
        self.list_button.clicked.connect(self.insert_list)
        self.h1_button = QPushButton("# título")
        self.h1_button.setObjectName("smallButton")
        self.h1_button.clicked.connect(self.insert_h1)
        self.link_button = QPushButton("[link](url)")
        self.link_button.setObjectName("smallButton")
        self.link_button.clicked.connect(self.insert_link)
        for b in (self.bold_button, self.italic_button, self.list_button, self.h1_button, self.link_button):
            toolbar.addWidget(b)
        toolbar.addStretch()
        layout.addLayout(toolbar)

        labels = QHBoxLayout()
        left_label = QLabel("Markdown")
        left_label.setObjectName("sectionLabel")
        right_label = QLabel("Prévia")
        right_label.setObjectName("sectionLabel")
        labels.addWidget(left_label)
        labels.addWidget(right_label)
        layout.addLayout(labels)

        self.details_splitter = QSplitter(Qt.Orientation.Horizontal, self)
        self.details_edit = QTextEdit(self)
        self.details_edit.setPlaceholderText(
            "Escreva a descrição geral ou o conteúdo de uma subtarefa em Markdown..."
        )
        self.details_edit.textChanged.connect(self.on_editor_text_changed)
        self.details_preview = QTextBrowser(self)
        self.details_preview.setOpenExternalLinks(True)
        self.details_splitter.addWidget(self.details_edit)
        self.details_splitter.addWidget(self.details_preview)
        self.details_splitter.setSizes([420, 420])
        layout.addWidget(self.details_splitter)

        editor_actions = QHBoxLayout()
        self.save_description_button = QPushButton("Salvar como descrição")
        self.save_description_button.setObjectName("secondaryButton")
        self.save_description_button.clicked.connect(self.save_editor_content)
        self.add_subtask_button = QPushButton("+ Adicionar como subtarefa")
        self.add_subtask_button.clicked.connect(self.add_subtask_from_editor)
        self.cancel_subtask_edit_button = QPushButton("Cancelar edição")
        self.cancel_subtask_edit_button.setObjectName("ghostButton")
        self.cancel_subtask_edit_button.clicked.connect(self.cancel_subtask_edit)
        self.cancel_subtask_edit_button.hide()
        self.editor_status = QLabel("O botão escolhido define como o texto será usado.")
        self.editor_status.setObjectName("mutedLabel")
        editor_actions.addWidget(self.save_description_button)
        editor_actions.addWidget(self.add_subtask_button)
        editor_actions.addWidget(self.cancel_subtask_edit_button)
        editor_actions.addWidget(self.editor_status, stretch=1)
        layout.addLayout(editor_actions)

        subtasks_header = QHBoxLayout()
        subtasks_label = QLabel("Subtarefas")
        subtasks_label.setObjectName("sectionLabel")
        self.edit_subtask_button = QPushButton("Editar")
        self.edit_subtask_button.setObjectName("smallButton")
        self.edit_subtask_button.clicked.connect(self.edit_selected_subtask)
        self.remove_subtask_button = QPushButton("Remover")
        self.remove_subtask_button.setObjectName("smallDangerButton")
        self.remove_subtask_button.clicked.connect(self.remove_selected_subtask)
        subtasks_header.addWidget(subtasks_label)
        subtasks_header.addStretch()
        subtasks_header.addWidget(self.edit_subtask_button)
        subtasks_header.addWidget(self.remove_subtask_button)
        layout.addLayout(subtasks_header)

        self.subtasks_list = QListWidget(self)
        self.subtasks_list.setObjectName("subtasksList")
        self.subtasks_list.setMinimumHeight(140)
        self.subtasks_list.setHorizontalScrollBarPolicy(Qt.ScrollBarPolicy.ScrollBarAlwaysOff)
        self.subtasks_list.setVerticalScrollMode(QAbstractItemView.ScrollMode.ScrollPerPixel)
        self.subtasks_list.verticalScrollBar().setSingleStep(36)
        self.subtasks_list.setSpacing(6)
        self.subtasks_list.currentItemChanged.connect(self.on_subtask_selection_changed)
        layout.addWidget(self.subtasks_list)

        buttons = QDialogButtonBox(
            QDialogButtonBox.StandardButton.Save | QDialogButtonBox.StandardButton.Cancel,
            parent=self,
        )
        buttons.accepted.connect(self.accept)
        buttons.rejected.connect(self.reject)
        buttons.button(QDialogButtonBox.StandardButton.Save).setText("Salvar")
        buttons.button(QDialogButtonBox.StandardButton.Cancel).setText("Cancelar")
        layout.addWidget(buttons)

        if task:
            self.title_input.setText(task.title)
            self.use_date_checkbox.setChecked(task.has_due_date)
            if task.has_due_date:
                due = task.due_datetime
                if due:
                    self.datetime_picker.setDateTime(QDateTime(due))
            custom_recurrence = parse_custom_recurrence(task.recurrence)
            if custom_recurrence:
                interval, unit = custom_recurrence
                self.recurrence_box.setCurrentText("Personalizado")
                self.custom_interval.setValue(interval)
                unit_index = self.custom_unit.findData(unit)
                if unit_index >= 0:
                    self.custom_unit.setCurrentIndex(unit_index)
            else:
                self.recurrence_box.setCurrentText(task.recurrence)
            self.set_editor_text(task.details_md)
            for subtask in task.subtasks:
                self.add_subtask_item(subtask.title, subtask.completed, subtask.id)
        else:
            self.use_date_checkbox.setChecked(False)

        self.update_due_enabled()
        self.update_custom_recurrence_visibility()
        self.update_preview()
        self.update_subtask_actions()
        self.setStyleSheet(BASE_STYLESHEET)

    def update_due_enabled(self) -> None:
        enabled = self.use_date_checkbox.isChecked()
        self.datetime_picker.setEnabled(enabled)
        self.recurrence_box.setEnabled(enabled)
        self.custom_interval.setEnabled(enabled)
        self.custom_unit.setEnabled(enabled)

    def update_custom_recurrence_visibility(self) -> None:
        visible = self.recurrence_box.currentText() == "Personalizado"
        self.custom_interval.setVisible(visible)
        self.custom_unit.setVisible(visible)

    def current_cursor_text(self) -> str:
        cursor = self.details_edit.textCursor()
        return cursor.selectedText()

    def wrap_selection(self, left: str, right: str) -> None:
        cursor = self.details_edit.textCursor()
        selected = cursor.selectedText() or "texto"
        cursor.insertText(f"{left}{selected}{right}")
        self.details_edit.setFocus()

    def wrap_bold(self) -> None:
        self.wrap_selection("**", "**")

    def wrap_italic(self) -> None:
        self.wrap_selection("*", "*")

    def insert_list(self) -> None:
        cursor = self.details_edit.textCursor()
        selected = cursor.selectedText()
        if selected:
            lines = selected.split("\u2029")
            cursor.insertText("\n".join([f"- {line}" for line in lines]))
        else:
            cursor.insertText("- item")
        self.details_edit.setFocus()

    def insert_h1(self) -> None:
        cursor = self.details_edit.textCursor()
        selected = cursor.selectedText() or "Título"
        cursor.insertText(f"# {selected}")
        self.details_edit.setFocus()

    def insert_link(self) -> None:
        cursor = self.details_edit.textCursor()
        selected = cursor.selectedText() or "link"
        cursor.insertText(f"[{selected}](https://)")
        self.details_edit.setFocus()

    def update_preview(self) -> None:
        self.details_preview.setHtml(markdown_to_html(self.details_edit.toPlainText()))

    def set_editor_text(self, text: str) -> None:
        self.updating_editor = True
        self.details_edit.setPlainText(text)
        self.updating_editor = False
        self.update_preview()

    def on_editor_text_changed(self) -> None:
        self.update_preview()
        if not self.updating_editor:
            self.editor_was_consumed = False

    def save_editor_content(self) -> None:
        content = self.details_edit.toPlainText()
        if self.editing_subtask_item is not None:
            row = self.subtasks_list.itemWidget(self.editing_subtask_item)
            if row and content.strip():
                row.set_title(content)
                self.update_subtask_item_height(self.editing_subtask_item)
                self.finish_subtask_edit("Subtarefa atualizada.")
            elif not content.strip():
                QMessageBox.warning(self, "Aviso", "Escreva o conteúdo da subtarefa.")
            return

        self.description_md = content
        self.editor_was_consumed = False
        self.editor_status.setText("✓ Descrição geral salva.")

    def add_subtask_from_editor(self) -> None:
        content = self.details_edit.toPlainText().strip()
        if not content:
            QMessageBox.warning(self, "Aviso", "Escreva o conteúdo da subtarefa.")
            return
        self.add_subtask_item(content, False)
        self.set_editor_text("")
        self.editor_was_consumed = True
        self.editor_status.setText("✓ Subtarefa adicionada abaixo.")
        self.details_edit.setFocus()

    def finish_subtask_edit(self, status: str) -> None:
        self.editing_subtask_item = None
        self.save_description_button.setText("Salvar como descrição")
        self.add_subtask_button.show()
        self.cancel_subtask_edit_button.hide()
        self.set_editor_text(self.editor_draft)
        self.editor_was_consumed = self.editor_draft_was_consumed
        self.editor_status.setText(status)

    def cancel_subtask_edit(self) -> None:
        if self.editing_subtask_item is not None:
            self.finish_subtask_edit("Edição da subtarefa cancelada.")

    def subtask_item_height(self, title: str) -> int:
        available_width = max(280, self.subtasks_list.viewport().width() - 80)
        document = QTextDocument()
        document.setHtml(markdown_to_html(title))
        document.setTextWidth(available_width)
        return max(58, int(document.size().height()) + 18)

    def update_subtask_item_height(self, item: QListWidgetItem) -> None:
        row = self.subtasks_list.itemWidget(item)
        if row:
            item.setSizeHint(QSize(0, self.subtask_item_height(row.title())))

    def scroll_subtasks(self, delta: int) -> None:
        scrollbar = self.subtasks_list.verticalScrollBar()
        direction = -1 if delta > 0 else 1
        scrollbar.setValue(scrollbar.value() + direction * 72)

    def on_subtask_selection_changed(
        self,
        current: Optional[QListWidgetItem],
        previous: Optional[QListWidgetItem],
    ) -> None:
        if previous:
            previous_row = self.subtasks_list.itemWidget(previous)
            if previous_row:
                previous_row.set_selected(False)
        if current:
            current_row = self.subtasks_list.itemWidget(current)
            if current_row:
                current_row.set_selected(True)
        if self.editing_subtask_item is not None and current is not self.editing_subtask_item:
            if current is None:
                self.cancel_subtask_edit()
            else:
                self.load_subtask_in_editor(current, switched=True)
        self.update_subtask_actions()

    def update_subtask_actions(self) -> None:
        has_selection = self.subtasks_list.currentItem() is not None
        self.edit_subtask_button.setEnabled(has_selection)
        self.remove_subtask_button.setEnabled(has_selection)

    def clear_subtask_selection(self) -> None:
        if self.editing_subtask_item is not None:
            self.cancel_subtask_edit()
        self.subtasks_list.clearSelection()
        self.subtasks_list.setCurrentItem(None)
        self.update_subtask_actions()

    def add_subtask_item(
        self,
        title: str,
        checked: bool = False,
        subtask_id: Optional[str] = None,
    ) -> None:
        title = title.strip()
        if not title:
            return
        item = QListWidgetItem()
        item.setData(Qt.ItemDataRole.UserRole, subtask_id or uuid.uuid4().hex)
        row = SubTaskRow(title, checked)
        row.clicked.connect(lambda current=item: self.toggle_subtask_selection(current))
        row.double_clicked.connect(self.edit_selected_subtask)
        row.wheel_requested.connect(self.scroll_subtasks)
        row.checkbox.clicked.connect(lambda _checked, current=item: self.subtasks_list.setCurrentItem(current))
        item.setSizeHint(QSize(0, self.subtask_item_height(title)))
        self.subtasks_list.addItem(item)
        self.subtasks_list.setItemWidget(item, row)

    def toggle_subtask_selection(self, item: QListWidgetItem) -> None:
        if self.subtasks_list.currentItem() is item:
            self.clear_subtask_selection()
        else:
            self.subtasks_list.setCurrentItem(item)

    def remove_selected_subtask(self) -> None:
        if self.subtasks_list.currentItem() is self.editing_subtask_item:
            self.cancel_subtask_edit()
        row = self.subtasks_list.currentRow()
        if row >= 0:
            self.subtasks_list.takeItem(row)
        self.update_subtask_actions()

    def edit_selected_subtask(self) -> None:
        item = self.subtasks_list.currentItem()
        row = self.subtasks_list.itemWidget(item) if item else None
        if not row:
            return
        if self.editing_subtask_item is None:
            self.editor_draft = self.details_edit.toPlainText()
            self.editor_draft_was_consumed = self.editor_was_consumed
        self.load_subtask_in_editor(item)

    def load_subtask_in_editor(self, item: QListWidgetItem, switched: bool = False) -> None:
        row = self.subtasks_list.itemWidget(item)
        if not row:
            return
        self.editing_subtask_item = item
        self.save_description_button.setText("Salvar alterações da subtarefa")
        self.add_subtask_button.hide()
        self.cancel_subtask_edit_button.show()
        label = clean_details_text(row.title())[:55]
        prefix = "Edição anterior descartada. Editando" if switched else "Editando"
        self.editor_status.setText(f"{prefix}: {label}")
        self.set_editor_text(row.title())
        self.details_edit.setFocus()

    def get_data(self) -> dict:
        subtasks = []
        for i in range(self.subtasks_list.count()):
            item = self.subtasks_list.item(i)
            row = self.subtasks_list.itemWidget(item)
            if not row:
                continue
            subtasks.append({
                "id": item.data(Qt.ItemDataRole.UserRole),
                "title": row.title(),
                "completed": row.checkbox.isChecked(),
            })

        due_at = ""
        recurrence = "Sem recorrência"
        if self.use_date_checkbox.isChecked():
            due_at = datetime_to_storage(self.datetime_picker.dateTime().toPyDateTime())
            recurrence = self.recurrence_box.currentText()
            if recurrence == "Personalizado":
                recurrence = format_custom_recurrence(
                    self.custom_interval.value(),
                    self.custom_unit.currentData(),
                )

        return {
            "title": self.title_input.text().strip(),
            "due_at": due_at,
            "recurrence": recurrence,
            "details_md": self.description_md,
            "subtasks": subtasks,
        }

    def resizeEvent(self, event) -> None:  # type: ignore[override]
        super().resizeEvent(event)
        if not hasattr(self, "subtasks_list"):
            return
        current_width = self.subtasks_list.viewport().width()
        if current_width == self.last_subtasks_width:
            return
        self.last_subtasks_width = current_width
        for index in range(self.subtasks_list.count()):
            self.update_subtask_item_height(self.subtasks_list.item(index))

    def accept(self) -> None:
        if not self.title_input.text().strip():
            QMessageBox.warning(self, "Aviso", "Digite o nome da tarefa.")
            return
        if self.editing_subtask_item is not None:
            QMessageBox.warning(
                self,
                "Aviso",
                "Salve ou cancele a edição da subtarefa antes de salvar a tarefa.",
            )
            return
        if not self.editor_was_consumed:
            self.description_md = self.details_edit.toPlainText()
        super().accept()

class TaskRow(QWidget):
    clicked = pyqtSignal(str)
    double_clicked = pyqtSignal(str)

    def __init__(self, task_id: str, parent: Optional[QWidget] = None):
        super().__init__(parent)
        self.task_id = task_id
        self.setObjectName("taskCard")
        self.setAttribute(Qt.WidgetAttribute.WA_StyledBackground, True)
        self.setCursor(Qt.CursorShape.PointingHandCursor)

    def mousePressEvent(self, event) -> None:  # type: ignore[override]
        self.clicked.emit(self.task_id)
        super().mousePressEvent(event)

    def mouseDoubleClickEvent(self, event) -> None:  # type: ignore[override]
        self.double_clicked.emit(self.task_id)
        super().mouseDoubleClickEvent(event)

class TodoApp(QWidget):
    def __init__(self):
        super().__init__()
        self.config = ConfigStore(CONFIG_FILE)
        self.store: Optional[TaskStore] = None
        self.notified_task_ids: set[str] = set()

        self.quick_add_input = QLineEdit(self)
        self.search_input = QLineEdit(self)
        self.add_button = QPushButton("+ Nova tarefa", self)
        self.edit_button = QPushButton("Editar", self)
        self.complete_button = QPushButton("Concluir", self)
        self.delete_button = QPushButton("Excluir", self)
        self.sync_button = QPushButton("↻ Sync", self)
        self.clear_completed_button = QPushButton("Excluir concluídas", self)
        self.change_dir_button = QPushButton("Alterar diretório", self)
        self.help_button = QPushButton("Ajuda e privacidade", self)
        self.status_label = QLabel(self)

        self.tabs = QTabWidget(self)
        self.pending_list = QListWidget(self)
        self.completed_list = QListWidget(self)

        self.setup_ui()
        if not self.prepare_store():
            sys.exit(0)
        self.load_tasks_into_ui()
        self.set_sync_success(f"{len(self.store.tasks)} tarefa(s) carregada(s) de {TASKS_FILENAME}.")
        self.setup_reminder()
        self.setup_external_sync()
        self.restore_window_geometry()

    def setup_ui(self) -> None:
        self.setWindowTitle("WillDo")
        self.setMinimumSize(940, 660)
        self.resize(940, 660)

        layout = QVBoxLayout(self)
        layout.setContentsMargins(18, 14, 18, 12)
        layout.setSpacing(10)

        header = QHBoxLayout()
        brand = QVBoxLayout()
        brand.setSpacing(0)
        app_title = QLabel("WillDo")
        app_title.setObjectName("appTitle")
        app_subtitle = QLabel("Suas tarefas no Debian e no Android")
        app_subtitle.setObjectName("appSubtitle")
        brand.addWidget(app_title)
        brand.addWidget(app_subtitle)
        header.addLayout(brand)
        header.addStretch()

        help_menu = QMenu(self)
        first_steps_action = help_menu.addAction("Primeiros passos")
        webdav_action = help_menu.addAction("Como configurar o WebDAV")
        privacy_action = help_menu.addAction("Privacidade")
        help_menu.addSeparator()
        about_action = help_menu.addAction("Sobre o WillDo")
        first_steps_action.triggered.connect(self.show_first_steps)
        webdav_action.triggered.connect(self.show_webdav_help)
        privacy_action.triggered.connect(self.show_privacy)
        about_action.triggered.connect(self.show_about)
        self.help_button.setObjectName("ghostButton")
        self.help_button.setMenu(help_menu)
        header.addWidget(self.help_button)
        layout.addLayout(header)

        self.quick_add_input.setPlaceholderText("Digite a tarefa e aperte Enter... (cria sem data)")
        self.quick_add_input.returnPressed.connect(self.quick_add_task)
        layout.addWidget(self.quick_add_input)

        self.search_input.setPlaceholderText("Buscar em pendentes e concluídas...")
        self.search_input.textChanged.connect(self.apply_filter)
        layout.addWidget(self.search_input)

        buttons = QHBoxLayout()
        buttons.setSpacing(8)
        self.add_button.clicked.connect(self.add_task)
        self.edit_button.clicked.connect(self.edit_selected_task)
        self.complete_button.clicked.connect(self.complete_selected_task)
        self.delete_button.clicked.connect(self.delete_selected_task)
        self.sync_button.clicked.connect(self.manual_sync)
        self.clear_completed_button.clicked.connect(self.clear_completed_tasks)
        self.edit_button.setObjectName("secondaryButton")
        self.complete_button.setObjectName("secondaryButton")
        self.delete_button.setObjectName("dangerButton")
        self.clear_completed_button.setObjectName("ghostButton")
        self.sync_button.setObjectName("syncButton")
        self.sync_button.setProperty("synced", False)
        self.sync_button.setMaximumWidth(110)
        self.sync_button.setToolTip("Recarregar as tarefas do task.json")
        buttons.addWidget(self.add_button)
        buttons.addWidget(self.edit_button)
        buttons.addWidget(self.complete_button)
        buttons.addWidget(self.delete_button)
        buttons.addStretch()
        buttons.addWidget(self.sync_button)
        buttons.addWidget(self.clear_completed_button)
        layout.addLayout(buttons)

        selection_hint = QLabel("Selecione uma tarefa para editar, concluir ou excluir. Dois cliques também abrem o editor.")
        selection_hint.setObjectName("mutedLabel")
        layout.addWidget(selection_hint)

        for lst in (self.pending_list, self.completed_list):
            lst.setContextMenuPolicy(Qt.ContextMenuPolicy.CustomContextMenu)
            lst.customContextMenuRequested.connect(self.show_context_menu)
            lst.setSizePolicy(QSizePolicy.Policy.Preferred, QSizePolicy.Policy.Expanding)
            lst.setSpacing(8)
            lst.currentItemChanged.connect(self.on_selection_changed)

        self.tabs.addTab(self.pending_list, "Pendentes")
        self.tabs.addTab(self.completed_list, "Concluídas")
        self.tabs.currentChanged.connect(lambda _index: self.on_active_tab_changed())
        layout.addWidget(self.tabs, stretch=1)

        bottom = QHBoxLayout()
        self.status_label.setObjectName("mutedLabel")
        self.status_label.setText("Pronto")
        bottom.addWidget(self.status_label)
        bottom.addStretch()
        self.change_dir_button.setObjectName("ghostButton")
        self.change_dir_button.clicked.connect(self.change_directory)
        bottom.addWidget(self.change_dir_button)
        layout.addLayout(bottom)

        self.setLayout(layout)
        self.setStyleSheet(BASE_STYLESHEET)
        self.update_action_buttons()

    def show_first_steps(self) -> None:
        QMessageBox.information(
            self,
            "Primeiros passos",
            "1. Digite uma tarefa no campo superior e pressione Enter.\n"
            "2. Para adicionar data, recorrência, notas ou subtarefas, use + Nova tarefa.\n"
            "3. Clique uma vez em uma tarefa para selecioná-la.\n"
            "4. Use Editar, Concluir ou Excluir. Dois cliques também abrem o editor.",
        )

    def show_webdav_help(self) -> None:
        tasks_file = self.store.tasks_file if self.store else Path(TASKS_FILENAME)
        QMessageBox.information(
            self,
            "Configuração WebDAV",
            "O WillDo para Debian usa uma pasta WebDAV já montada pelo sistema.\n\n"
            "1. Monte seu servidor WebDAV no gerenciador de arquivos.\n"
            "2. Clique em Alterar diretório e escolha essa pasta.\n"
            f"3. O desktop e o Android devem usar o mesmo arquivo {TASKS_FILENAME}.\n"
            "4. No Android, informe a URL completa desse arquivo.\n\n"
            f"Arquivo atual:\n{tasks_file}",
        )

    def show_privacy(self) -> None:
        QMessageBox.information(
            self,
            "Privacidade",
            "Suas tarefas ficam somente no arquivo escolhido por você.\n\n"
            "O aplicativo Debian não envia telemetria e não armazena sua senha WebDAV. "
            "A conexão é gerenciada pelo próprio Debian. No Android, a senha fica no "
            "armazenamento seguro do sistema.",
        )

    def show_about(self) -> None:
        QMessageBox.information(
            self,
            "Sobre o WillDo",
            "WillDo Desktop 1.1\n\n"
            "Gerenciador de tarefas integrado ao WillDo para Android por meio do seu próprio WebDAV.",
        )

    def prepare_store(self) -> bool:
        tasks_dir = self.config.get_tasks_dir()
        if tasks_dir is None:
            selected = QFileDialog.getExistingDirectory(
                self,
                "Escolha onde salvar suas tarefas",
                str(Path.home()),
                QFileDialog.Option.ShowDirsOnly,
            )
            if not selected:
                QMessageBox.information(self, "Encerrado", "Nenhum diretório foi escolhido.")
                return False
            tasks_dir = Path(selected)
            self.config.set_tasks_dir(tasks_dir)
        tasks_file = tasks_dir / TASKS_FILENAME
        self.store = TaskStore(tasks_file)
        self.status_label.setText(f"Salvando em: {tasks_file}")
        return True

    def change_directory(self) -> None:
        selected = QFileDialog.getExistingDirectory(
            self,
            "Escolha onde salvar suas tarefas",
            str(self.config.get_tasks_dir() or Path.home()),
            QFileDialog.Option.ShowDirsOnly,
        )
        if not selected:
            return
        self.config.set_tasks_dir(Path(selected))
        tasks_file = Path(selected) / TASKS_FILENAME
        self.store = TaskStore(tasks_file)
        self.notified_task_ids.clear()
        self.load_tasks_into_ui()
        self.set_sync_success(f"Diretório alterado e {len(self.store.tasks)} tarefa(s) carregada(s).")

    def manual_sync(self) -> None:
        if not self.store:
            return
        tasks_file = self.store.tasks_file
        loaded = self.store.load()
        if not loaded:
            QMessageBox.warning(
                self,
                "Falha na sincronização",
                f"Não foi possível ler um JSON válido em:\n{tasks_file}",
            )
            return
        self.notified_task_ids.intersection_update(task.id for task in self.store.tasks)
        self.load_tasks_into_ui()
        self.set_sync_success(
            f"{len(self.store.tasks)} tarefa(s) sincronizada(s) de: {tasks_file.name}"
        )

    def set_sync_success(self, message: str) -> None:
        self.sync_button.setText("✓ Atualizado")
        self.sync_button.setProperty("synced", True)
        self.sync_button.style().unpolish(self.sync_button)
        self.sync_button.style().polish(self.sync_button)
        self.status_label.setText(message)

    def restore_window_geometry(self) -> None:
        size, pos = self.config.get_geometry()
        min_w, min_h = 940, 660
        if size and size.width() >= min_w and size.height() >= min_h:
            screen = QGuiApplication.primaryScreen()
            if screen:
                available = screen.availableGeometry()
                width = min(size.width(), available.width())
                height = min(size.height(), available.height())
                self.resize(max(min_w, width), max(min_h, height))
        if pos:
            screen = QGuiApplication.primaryScreen()
            if screen:
                available = screen.availableGeometry()
                x = min(max(pos.x(), available.left()), max(available.left(), available.right() - self.width()))
                y = min(max(pos.y(), available.top()), max(available.top(), available.bottom() - self.height()))
                self.move(x, y)

    def setup_external_sync(self) -> None:
        self.external_sync_timer = QTimer(self)
        self.external_sync_timer.timeout.connect(self.reload_external_changes)
        self.external_sync_timer.start(3000)

    def reload_external_changes(self) -> None:
        if not self.store or QApplication.activeModalWidget() is not None:
            return
        if not self.store.has_external_changes():
            return
        selected_task_id = self.get_selected_task_id()
        if not self.store.load():
            self.status_label.setText("Aguardando o término da sincronização externa...")
            return
        current_ids = {task.id for task in self.store.tasks}
        self.notified_task_ids.intersection_update(current_ids)
        self.load_tasks_into_ui(selected_task_id=selected_task_id)
        self.set_sync_success("Tarefas do Android sincronizadas automaticamente.")

    def closeEvent(self, event) -> None:  # type: ignore[override]
        self.config.set_geometry(self.size(), self.pos())
        super().closeEvent(event)

    def human_due_text(self, task: Task) -> str:
        due = task.due_datetime
        if due is None:
            return "Sem data"
        now = now_dt()
        if due.date() == now.date():
            return f"Hoje às {due.strftime('%H:%M')}"
        if due.date() == (now + timedelta(days=1)).date():
            return f"Amanhã às {due.strftime('%H:%M')}"
        if due.year == now.year:
            return due.strftime("%d/%m às %H:%M")
        return due.strftime("%d/%m/%Y às %H:%M")

    def quick_add_task(self) -> None:
        title = self.quick_add_input.text().strip()
        if not title:
            return
        now = now_str()
        task = Task(
            id=uuid.uuid4().hex,
            title=title,
            due_at="",
            recurrence="Sem recorrência",
            details_md="",
            created_at=now,
            updated_at=now,
            subtasks=[],
        )
        self.store.add(task)
        self.quick_add_input.clear()
        self.load_tasks_into_ui(selected_task_id=task.id, switch_to_completed=False)
        self.quick_add_input.setFocus()
        self.status_label.setText("Tarefa criada sem data.")

    def add_task(self) -> None:
        dialog = TaskEditorDialog(self)
        if dialog.exec() != QDialog.DialogCode.Accepted:
            return
        self.create_or_update_from_dialog(None, dialog.get_data())

    def edit_selected_task(self) -> None:
        task_id = self.get_selected_task_id()
        if not task_id:
            QMessageBox.information(self, "Aviso", "Selecione uma tarefa.")
            return
        task = self.store.get(task_id)
        if task:
            self.open_editor(task)

    def edit_task_from_item(self, item: QListWidgetItem) -> None:
        task = self.store.get(item.data(Qt.ItemDataRole.UserRole))
        if task:
            self.open_editor(task)

    def on_selection_changed(self, current: Optional[QListWidgetItem], previous: Optional[QListWidgetItem]) -> None:
        self.refresh_task_styles()
        self.update_action_buttons()

    def on_active_tab_changed(self) -> None:
        self.refresh_task_styles()
        self.update_action_buttons()

    def refresh_task_styles(self) -> None:
        for task_list in (self.pending_list, self.completed_list):
            current = task_list.currentItem()
            for index in range(task_list.count()):
                item = task_list.item(index)
                task = self.store.get(item.data(Qt.ItemDataRole.UserRole)) if self.store else None
                row = task_list.itemWidget(item)
                if task and row:
                    self.apply_task_style(
                        task,
                        row,
                        row.title_label,
                        row.subtitle_label,
                        row.date_label,
                        selected=item is current,
                    )

    def update_action_buttons(self) -> None:
        task_id = self.get_selected_task_id()
        task = self.store.get(task_id) if self.store and task_id else None
        enabled = task is not None
        self.edit_button.setEnabled(enabled)
        self.complete_button.setEnabled(enabled)
        self.delete_button.setEnabled(enabled)
        self.complete_button.setText("Reabrir" if task and task.completed else "Concluir")

    def complete_selected_task(self) -> None:
        task_list = self.pending_list if self.tabs.currentWidget() is self.pending_list else self.completed_list
        item = task_list.currentItem()
        task_id = item.data(Qt.ItemDataRole.UserRole) if item else None
        task = self.store.get(task_id) if self.store and task_id else None
        row = task_list.itemWidget(item) if item else None
        if not task or not row:
            return
        checkbox = row.layout().itemAt(0).widget()
        checkbox.setChecked(not task.completed)

    def delete_selected_task(self) -> None:
        task_id = self.get_selected_task_id()
        if task_id:
            self.remove_task(task_id)

    def open_editor(self, task: Task) -> None:
        dialog = TaskEditorDialog(self, task)
        if dialog.exec() != QDialog.DialogCode.Accepted:
            return
        self.create_or_update_from_dialog(task, dialog.get_data())

    def create_or_update_from_dialog(self, task: Optional[Task], data: dict) -> None:
        now = now_str()
        subtasks = []
        old_subtasks_by_id = {}
        old_subtasks_by_title = {}
        if task:
            old_subtasks_by_id = {s.id: s for s in task.subtasks}
            old_subtasks_by_title = {s.title: s for s in task.subtasks}
        for s in data["subtasks"]:
            title = s["title"].strip()
            if not title:
                continue
            old = old_subtasks_by_id.get(s.get("id")) or old_subtasks_by_title.get(title)
            subtasks.append(
                SubTask(
                    id=old.id if old else (s.get("id") or uuid.uuid4().hex),
                    title=title,
                    completed=s["completed"],
                )
            )

        if task is None:
            task = Task(
                id=uuid.uuid4().hex,
                title=data["title"],
                due_at=data["due_at"],
                recurrence=data["recurrence"],
                details_md=data["details_md"],
                created_at=now,
                updated_at=now,
                subtasks=subtasks,
            )
            self.store.add(task)
            self.load_tasks_into_ui(selected_task_id=task.id, switch_to_completed=False)
            self.status_label.setText("Tarefa adicionada.")
            return

        old_due_at = task.due_at
        task.title = data["title"]
        task.due_at = data["due_at"]
        task.recurrence = data["recurrence"]
        task.details_md = data["details_md"]
        task.subtasks = subtasks
        task.updated_at = now
        if task.due_at != old_due_at:
            task.reminded_at = ""
            self.notified_task_ids.discard(task.id)
        self.store.update(task)
        self.load_tasks_into_ui(selected_task_id=task.id, switch_to_completed=task.completed)
        self.status_label.setText("Tarefa atualizada.")

    def get_selected_task_id(self) -> Optional[str]:
        current = self.pending_list.currentItem() if self.tabs.currentIndex() == 0 else self.completed_list.currentItem()
        if not current:
            return None
        return current.data(Qt.ItemDataRole.UserRole)

    def create_task_item(self, task: Task, target_list: QListWidget) -> None:
        row = TaskRow(task.id)
        row.clicked.connect(lambda task_id, lst=target_list: self.select_task_in_list(lst, task_id))
        row.double_clicked.connect(self.open_task_by_id)
        layout = QHBoxLayout(row)
        layout.setContentsMargins(12, 9, 12, 9)
        layout.setSpacing(10)

        checkbox = QCheckBox()
        checkbox.setProperty("task_id", task.id)
        checkbox.setChecked(task.completed)
        checkbox.stateChanged.connect(self.toggle_task_completion)
        layout.addWidget(checkbox)

        text_col = QVBoxLayout()
        text_col.setSpacing(2)

        title = QLabel(task.title)
        title.setWordWrap(True)
        title.setAttribute(Qt.WidgetAttribute.WA_TransparentForMouseEvents)

        meta_parts = []
        details_preview = task.details_plain
        if details_preview:
            meta_parts.append(details_preview[:100] + ("..." if len(details_preview) > 100 else ""))
        else:
            meta_parts.append("Sem detalhes")

        if task.subtasks:
            done = sum(1 for s in task.subtasks if s.completed)
            meta_parts.append(f"Subtarefas {done}/{len(task.subtasks)}")

        if task.recurrence != "Sem recorrência" and task.has_due_date:
            meta_parts.append(task.recurrence)

        subtitle = QLabel(" • ".join(meta_parts))
        subtitle.setObjectName("mutedLabel")
        subtitle.setWordWrap(False)
        subtitle.setAttribute(Qt.WidgetAttribute.WA_TransparentForMouseEvents)

        text_col.addWidget(title)
        text_col.addWidget(subtitle)
        layout.addLayout(text_col, 1)

        date_label = QLabel(self.human_due_text(task))
        date_label.setObjectName("dateLabel")
        date_label.setAlignment(Qt.AlignmentFlag.AlignRight | Qt.AlignmentFlag.AlignVCenter)
        date_label.setAttribute(Qt.WidgetAttribute.WA_TransparentForMouseEvents)
        layout.addWidget(date_label)

        row.title_label = title
        row.subtitle_label = subtitle
        row.date_label = date_label

        item = QListWidgetItem()
        item.setData(Qt.ItemDataRole.UserRole, task.id)
        item.setSizeHint(QSize(0, 72))
        target_list.addItem(item)
        target_list.setItemWidget(item, row)

        self.apply_task_style(task, row, title, subtitle, date_label)

    def select_task_in_list(self, task_list: QListWidget, task_id: str) -> None:
        for index in range(task_list.count()):
            item = task_list.item(index)
            if item.data(Qt.ItemDataRole.UserRole) == task_id:
                task_list.setCurrentItem(item)
                return

    def open_task_by_id(self, task_id: str) -> None:
        task = self.store.get(task_id) if self.store else None
        if task:
            self.open_editor(task)

    def apply_task_style(
        self,
        task: Task,
        row: QWidget,
        title: QLabel,
        subtitle: QLabel,
        date_label: QLabel,
        selected: bool = False,
    ) -> None:
        query = self.search_input.text().strip().lower()

        if task.completed:
            bg = "#f8fafc"
            border = "#d1d5db"
            title_style = "color:#6b7280;font-weight:600;text-decoration: line-through;background:transparent;border:none;"
            subtitle_style = "color:#94a3b8;background:transparent;border:none;"
            date_style = "color:#94a3b8;font-weight:700;background:transparent;border:none;"
        else:
            bg = "#ffffff"
            border = "#e5e7eb"
            title_style = "color:#111827;font-weight:700;background:transparent;border:none;"
            subtitle_style = "color:#64748b;background:transparent;border:none;"
            date_style = "color:#334155;font-weight:700;background:transparent;border:none;"

        if query:
            haystack = " ".join([
                task.title.lower(),
                task.details_plain.lower(),
                task.recurrence.lower(),
                task.due_at.lower(),
                " ".join(s.title.lower() for s in task.subtasks),
                "concluída" if task.completed else "pendente",
            ])
            if query in haystack:
                border = "#3b82f6"
                bg = "#eff6ff"

        if selected:
            border = "#2563eb"
            bg = "#eff6ff"

        border_width = 2 if selected else 1
        row.setStyleSheet(
            f"#taskCard {{ background:{bg}; border:{border_width}px solid {border}; border-radius:10px; }}"
        )
        title.setStyleSheet(title_style)
        subtitle.setStyleSheet(subtitle_style)
        date_label.setStyleSheet(date_style)

    def load_tasks_into_ui(self, selected_task_id: Optional[str] = None, switch_to_completed: Optional[bool] = None) -> None:
        self.pending_list.clear()
        self.completed_list.clear()
        self.store.sort_tasks()
        for task in self.store.tasks:
            target = self.completed_list if task.completed else self.pending_list
            self.create_task_item(task, target)

        pending_count = len([task for task in self.store.tasks if not task.completed])
        completed_count = len(self.store.tasks) - pending_count
        if pending_count == 0:
            self.add_empty_state(self.pending_list, "Tudo em dia por aqui. Crie uma tarefa no campo acima.")
        if completed_count == 0:
            self.add_empty_state(self.completed_list, "As tarefas concluídas aparecerão aqui.")
        self.tabs.setTabText(0, f"Pendentes ({pending_count})")
        self.tabs.setTabText(1, f"Concluídas ({completed_count})")

        self.apply_filter(self.search_input.text())

        if switch_to_completed is True:
            self.tabs.setCurrentWidget(self.completed_list)
        elif switch_to_completed is False:
            self.tabs.setCurrentWidget(self.pending_list)

        if selected_task_id:
            self.select_task_by_id(selected_task_id)
        self.update_action_buttons()

    def add_empty_state(self, task_list: QListWidget, message: str) -> None:
        item = QListWidgetItem(message)
        item.setFlags(Qt.ItemFlag.NoItemFlags)
        item.setTextAlignment(Qt.AlignmentFlag.AlignCenter)
        item.setSizeHint(QSize(0, 90))
        task_list.addItem(item)

    def select_task_by_id(self, task_id: str) -> None:
        for lst in (self.pending_list, self.completed_list):
            for i in range(lst.count()):
                item = lst.item(i)
                if item.data(Qt.ItemDataRole.UserRole) == task_id:
                    lst.setCurrentItem(item)
                    return

    def apply_filter(self, text: str) -> None:
        needle = text.strip().lower()
        counts = {"pending": 0, "completed": 0}

        for lst, key in ((self.pending_list, "pending"), (self.completed_list, "completed")):
            for i in range(lst.count()):
                item = lst.item(i)
                task = self.store.get(item.data(Qt.ItemDataRole.UserRole))
                if not task:
                    item.setHidden(bool(needle))
                    continue
                haystack = ""
                haystack = " ".join([
                    task.title.lower(),
                    task.details_plain.lower(),
                    task.recurrence.lower(),
                    task.due_at.lower(),
                    " ".join(s.title.lower() for s in task.subtasks),
                    "concluída" if task.completed else "pendente",
                ])
                hidden = bool(needle) and needle not in haystack
                item.setHidden(hidden)
                if not hidden:
                    counts[key] += 1

                widget = lst.itemWidget(item)
                if task and widget:
                    self.apply_task_style(
                        task,
                        widget,
                        widget.title_label,
                        widget.subtitle_label,
                        widget.date_label,
                        selected=item is lst.currentItem(),
                    )

        self.status_label.setText(f"{counts['pending']} pendente(s) | {counts['completed']} concluída(s)")

    def toggle_task_completion(self) -> None:
        checkbox = self.sender()
        if not isinstance(checkbox, QCheckBox):
            return
        task_id = checkbox.property("task_id")
        task = self.store.get(task_id)
        if not task:
            return

        now = now_dt()
        due = task.due_datetime

        if checkbox.isChecked():
            if task.recurrence != "Sem recorrência" and due is not None and due.date() > now.date():
                reply = QMessageBox.question(
                    self,
                    "Confirmação",
                    "Você está adiantando essa tarefa. Tem certeza que quer concluí-la?",
                    QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No,
                )
                if reply != QMessageBox.StandardButton.Yes:
                    checkbox.setChecked(False)
                    return

            if task.recurrence == "Sem recorrência" or due is None:
                task.completed = True
                task.completed_at = datetime_to_storage(now)
                task.updated_at = datetime_to_storage(now)
                self.store.update(task)
                self.load_tasks_into_ui(selected_task_id=task.id, switch_to_completed=True)
                self.status_label.setText("Tarefa concluída.")
                return

            next_due = self.calculate_next_due(due, task.recurrence)
            task.reminded_at = ""
            task.due_at = datetime_to_storage(next_due)
            task.updated_at = datetime_to_storage(now)
            self.notified_task_ids.discard(task.id)
            self.store.update(task)
            self.load_tasks_into_ui(selected_task_id=task.id, switch_to_completed=False)
            self.status_label.setText("Tarefa recorrente avançada.")
            return

        if task.completed:
            task.completed = False
            task.completed_at = ""
            task.updated_at = datetime_to_storage(now)
            self.store.update(task)
            self.load_tasks_into_ui(selected_task_id=task.id, switch_to_completed=False)
            self.status_label.setText("Tarefa reaberta.")

    def calculate_next_due(self, old_date: datetime, recurrence: str) -> datetime:
        custom_recurrence = parse_custom_recurrence(recurrence)
        if custom_recurrence:
            interval, unit = custom_recurrence
            if unit == "hours":
                return old_date + timedelta(hours=interval)
            if unit == "weeks":
                return old_date + timedelta(weeks=interval)
            return old_date + timedelta(days=interval)
        if recurrence == "Diariamente":
            return old_date + timedelta(days=1)
        if recurrence == "Semanalmente":
            return old_date + timedelta(weeks=1)
        if recurrence == "Mensalmente no mesmo dia":
            year = old_date.year + (old_date.month // 12)
            month = old_date.month % 12 + 1
            day = min(old_date.day, calendar.monthrange(year, month)[1])
            return datetime(year, month, day, old_date.hour, old_date.minute)
        if recurrence == "Anualmente no mesmo dia":
            year = old_date.year + 1
            day = old_date.day
            if old_date.month == 2 and old_date.day == 29 and not calendar.isleap(year):
                day = 28
            return datetime(year, old_date.month, day, old_date.hour, old_date.minute)
        return old_date

    def show_context_menu(self, position) -> None:
        lst = self.sender()
        if not isinstance(lst, QListWidget):
            return
        item = lst.itemAt(position)
        if not item:
            return
        task = self.store.get(item.data(Qt.ItemDataRole.UserRole))
        if not task:
            return

        menu = QMenu(self)
        edit_action = QAction("Editar", self)
        remove_action = QAction("Remover", self)
        reopen_action = QAction("Reabrir", self)
        menu.addAction(edit_action)
        if task.completed:
            menu.addAction(reopen_action)
        menu.addAction(remove_action)

        action = menu.exec(lst.mapToGlobal(position))
        if action == edit_action:
            self.open_editor(task)
        elif action == reopen_action:
            task.completed = False
            task.completed_at = ""
            task.updated_at = now_str()
            self.store.update(task)
            self.load_tasks_into_ui(selected_task_id=task.id, switch_to_completed=False)
        elif action == remove_action:
            self.remove_task(task.id)

    def remove_task(self, task_id: str) -> None:
        task = self.store.get(task_id)
        if not task:
            return
        reply = QMessageBox.question(
            self,
            "Confirmar remoção",
            f"Remover a tarefa:\n\n{task.title}",
            QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No,
        )
        if reply != QMessageBox.StandardButton.Yes:
            return
        self.store.remove(task_id)
        self.load_tasks_into_ui()
        self.status_label.setText("Tarefa removida.")

    def clear_completed_tasks(self) -> None:
        count = len([t for t in self.store.tasks if t.completed])
        if count == 0:
            QMessageBox.information(self, "Aviso", "Não há tarefas concluídas para excluir.")
            return
        reply = QMessageBox.question(
            self,
            "Excluir concluídas",
            f"Excluir {count} tarefa(s) concluída(s)?",
            QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No,
        )
        if reply != QMessageBox.StandardButton.Yes:
            return
        removed = self.store.remove_completed()
        self.load_tasks_into_ui()
        self.status_label.setText(f"{removed} concluída(s) excluída(s).")

    def setup_reminder(self) -> None:
        self.timer = QTimer(self)
        self.timer.timeout.connect(self.check_reminders)
        self.timer.start(60000)
        self.check_reminders()

    def check_reminders(self) -> None:
        now = now_dt()
        due_now = []
        changed = False

        for task in self.store.tasks:
            if task.completed or not task.has_due_date:
                continue

            due = task.due_datetime
            if due is None or due > now:
                continue

            if task.reminded_at:
                try:
                    reminded_dt = parse_stored_datetime(task.reminded_at)
                    if reminded_dt >= due:
                        continue
                except Exception:
                    pass

            if task.id in self.notified_task_ids:
                continue

            due_now.append(task)
            task.reminded_at = datetime_to_storage(now)
            task.updated_at = datetime_to_storage(now)
            self.notified_task_ids.add(task.id)
            changed = True

        if changed:
            self.store.save()
            self.load_tasks_into_ui()

        for task in due_now:
            QMessageBox.information(self, "Lembrete", f"{task.title}\n\n{self.human_due_text(task)}")

def main() -> int:
    app = QApplication(sys.argv)
    app.setApplicationName("WillDo")
    app.setOrganizationName("Willian")
    window = TodoApp()
    window.show()
    return app.exec()

if __name__ == "__main__":
    sys.exit(main())
