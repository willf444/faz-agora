import AsyncStorage from '@react-native-async-storage/async-storage';

const TASKS_KEY = '@willdo_tasks';

/**
 * Ordena as tarefas de forma idêntica ao willdo.py (sort_tasks):
 * - Pendentes: com data primeiro (ordem crescente), depois sem data (ordem alfabética)
 * - Concluídas: ordenadas por data de conclusão decrescente
 */
export function sortTasks(tasks) {
  const pending = tasks.filter(t => !t.completed);
  const completed = tasks.filter(t => t.completed);

  pending.sort((a, b) => {
    const aHasDue = Boolean(a.due_at && a.due_at.trim());
    const bHasDue = Boolean(b.due_at && b.due_at.trim());

    if (aHasDue && !bHasDue) return -1;
    if (!aHasDue && bHasDue) return 1;

    if (aHasDue && bHasDue) {
      const diff = new Date(a.due_at).getTime() - new Date(b.due_at).getTime();
      if (diff !== 0) return diff;
    }

    return (a.title || '').localeCompare(b.title || '', 'pt-BR', { sensitivity: 'base' });
  });

  completed.sort((a, b) => {
    const aDate = a.completed_at ? new Date(a.completed_at).getTime() : 0;
    const bDate = b.completed_at ? new Date(b.completed_at).getTime() : 0;
    return bDate - aDate;
  });

  return [...pending, ...completed];
}

export const storageService = {
  async getTasks() {
    try {
      const jsonValue = await AsyncStorage.getItem(TASKS_KEY);
      const parsed = jsonValue != null ? JSON.parse(jsonValue) : [];
      return sortTasks(Array.isArray(parsed) ? parsed : []);
    } catch (e) {
      console.error('Erro ao carregar tarefas do AsyncStorage', e);
      return [];
    }
  },

  async saveTasks(tasks) {
    try {
      const sorted = sortTasks(tasks);
      const jsonValue = JSON.stringify(sorted);
      await AsyncStorage.setItem(TASKS_KEY, jsonValue);
      return sorted;
    } catch (e) {
      console.error('Erro ao salvar tarefas no AsyncStorage', e);
      return tasks;
    }
  },

  async addTask(task) {
    const tasks = await this.getTasks();
    tasks.push(task);
    return await this.saveTasks(tasks);
  },

  async updateTask(updatedTask) {
    const tasks = await this.getTasks();
    const index = tasks.findIndex(t => t.id === updatedTask.id);
    if (index !== -1) {
      tasks[index] = updatedTask;
      return await this.saveTasks(tasks);
    }
    return tasks;
  },

  async removeTask(taskId) {
    const tasks = await this.getTasks();
    const filtered = tasks.filter(t => t.id !== taskId);
    return await this.saveTasks(filtered);
  },

  async clearCompletedTasks() {
    const tasks = await this.getTasks();
    const filtered = tasks.filter(t => !t.completed);
    await this.saveTasks(filtered);
    return tasks.length - filtered.length;
  },

  async toggleSubtask(taskId, subtaskId) {
    const tasks = await this.getTasks();
    const task = tasks.find(t => t.id === taskId);
    if (!task || !task.subtasks) return tasks;

    task.subtasks = task.subtasks.map(s => {
      if (s.id === subtaskId) {
        return { ...s, completed: !s.completed };
      }
      return s;
    });
    task.updated_at = new Date().toISOString();
    return await this.saveTasks(tasks);
  }
};
