import importlib.util
import os
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

os.environ.setdefault("QT_QPA_PLATFORM", "offscreen")

from PyQt6.QtWidgets import QApplication

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location("faz_notifications", ROOT / "faz-agora.py")
MODULE = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = MODULE
SPEC.loader.exec_module(MODULE)
APP = QApplication.instance() or QApplication([])

hidden_seconds = datetime(2026, 9, 12, 18, 25, 57, 843000)
minute_due = MODULE.datetime_at_minute(hidden_seconds)
if minute_due != datetime(2026, 9, 12, 18, 25, 0, 0):
    raise AssertionError("Linux manteve segundos ocultos no horário escolhido.")
if MODULE.REMINDER_CHECK_INTERVAL_MS != 1000:
    raise AssertionError("Linux ainda pode esperar até um minuto para verificar o lembrete.")
if MODULE.REMINDER_TIMER_TYPE != MODULE.Qt.TimerType.PreciseTimer:
    raise AssertionError("Linux não está usando um temporizador preciso para lembretes.")

old_due = MODULE.now_dt() - timedelta(minutes=10)
new_due = MODULE.now_dt() - timedelta(seconds=1)
previous_synced_task = MODULE.Task(
    id="edited-on-android",
    title="Teste antigo",
    due_at=MODULE.datetime_to_storage(old_due),
    reminded_at=MODULE.datetime_to_storage(old_due),
)
current_synced_task = MODULE.Task(
    id="edited-on-android",
    title="Teste alterado",
    due_at=MODULE.datetime_to_storage(new_due),
    reminded_at="",
)
reconciled_ids = MODULE.reconcile_notified_task_ids(
    {"edited-on-android"},
    [previous_synced_task],
    [current_synced_task],
)
if "edited-on-android" in reconciled_ids:
    raise AssertionError("Linux manteve bloqueada uma tarefa reagendada no Android.")

unchanged_ids = MODULE.reconcile_notified_task_ids(
    {"unchanged"},
    [MODULE.Task(id="unchanged", title="Igual", due_at=MODULE.datetime_to_storage(new_due))],
    [MODULE.Task(id="unchanged", title="Igual", due_at=MODULE.datetime_to_storage(new_due))],
)
if "unchanged" not in unchanged_ids:
    raise AssertionError("Linux liberou indevidamente uma tarefa sincronizada sem alteração.")

hidden_precision = MODULE.now_dt().replace(second=57, microsecond=843000)
minute_precision = MODULE.datetime_at_minute(hidden_precision)
if minute_precision.second != 0 or minute_precision.microsecond != 0:
    raise AssertionError("Linux manteve segundos ocultos no horário escolhido.")
if MODULE.REMINDER_CHECK_INTERVAL_MS != 1000:
    raise AssertionError("Linux pode demorar até um minuto para verificar o vencimento.")


class FakeStore:
    def __init__(self, task):
        self.tasks = [task]
        self.save_count = 0

    def save(self):
        self.save_count += 1


class FakeApp:
    def __init__(self, task, shown):
        self.store = FakeStore(task)
        self.notified_task_ids = set()
        self.last_notified_task_id = None
        self._shown = shown
        self.reload_count = 0

    def show_reminder(self, _task):
        return self._shown

    def load_tasks_into_ui(self):
        self.reload_count += 1


def overdue_task(identifier):
    due = MODULE.datetime_to_storage(MODULE.now_dt() - timedelta(minutes=1))
    return MODULE.Task(id=identifier, title="Teste", due_at=due)


not_shown_task = overdue_task("not-shown")
not_shown_app = FakeApp(not_shown_task, shown=False)
MODULE.TodoApp.check_reminders(not_shown_app)
if not_shown_task.reminded_at or not_shown_app.store.save_count:
    raise AssertionError("Linux marcou como notificado um lembrete que não apareceu.")

shown_task = overdue_task("shown")
shown_app = FakeApp(shown_task, shown=True)
MODULE.TodoApp.check_reminders(shown_app)
if not shown_task.reminded_at or shown_app.store.save_count != 1:
    raise AssertionError("Linux não registrou um lembrete exibido com sucesso.")
if shown_task.id not in shown_app.notified_task_ids:
    raise AssertionError("Linux não protegeu o lembrete exibido contra repetição.")

android_due = MODULE.now_dt() - timedelta(seconds=1)
android_task = MODULE.Task.from_dict({
    "id": "synced-from-android",
    "title": "Teste sincronizado",
    "due_at": android_due.astimezone(timezone.utc).isoformat().replace("+00:00", "Z"),
    "reminded_at": "",
    "completed": False,
})
android_sync_app = FakeApp(android_task, shown=True)
MODULE.TodoApp.check_reminders(android_sync_app)
if not android_task.reminded_at or android_sync_app.store.save_count != 1:
    raise AssertionError("Linux não notificou uma tarefa recebida do Android.")

dialog = MODULE.ReminderDialog("Teste", "Agora")
dialog.show()
APP.processEvents()
if not dialog.isVisible():
    raise AssertionError("A janela real de lembrete do Linux não ficou visível.")
dialog.close()

print("Linux: precisão, exibição e confirmação de notificações passaram.")
