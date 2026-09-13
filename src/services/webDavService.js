import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

import { storageService } from './storageService';
import { normalizeRichDocument, richDocumentToMarkdown } from '../utils/richDocument';

const CONFIG_KEY = '@willdo_webdav_config';
const PASSWORD_KEY = 'willdo_webdav_password';
const BASELINE_KEY = '@willdo_webdav_baseline';
const LAST_SYNC_KEY = '@willdo_webdav_last_success';
const REQUEST_TIMEOUT_MS = 20000;

function normalizeWebDavServerUrl(value) {
  return String(value || '')
    .trim()
    .replace(/\/+$/, '')
    .replace(/\/task\.json$/i, '');
}

function taskFileUrl(serverUrl) {
  return `${normalizeWebDavServerUrl(serverUrl)}/task.json`;
}

function freshTaskFileUrl(serverUrl, requestId = Date.now()) {
  return `${taskFileUrl(serverUrl)}?_willdo_sync=${requestId}`;
}

function encodeBasicAuth(username, password) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const utf8Value = encodeURIComponent(`${username}:${password}`).replace(
    /%([0-9A-F]{2})/g,
    (_, hex) => String.fromCharCode(Number.parseInt(hex, 16))
  );
  let encoded = '';

  for (let index = 0; index < utf8Value.length; index += 3) {
    const first = utf8Value.charCodeAt(index);
    const second = utf8Value.charCodeAt(index + 1);
    const third = utf8Value.charCodeAt(index + 2);
    encoded += alphabet[first >> 2];
    encoded += alphabet[((first & 3) << 4) | (second >> 4)];
    encoded += Number.isNaN(second) ? '=' : alphabet[((second & 15) << 2) | (third >> 6)];
    encoded += Number.isNaN(third) ? '=' : alphabet[third & 63];
  }

  return encoded;
}

function taskWithoutLocalFields(task) {
  const { notificationId, ...sharedTask } = task;
  return {
    ...sharedTask,
    completed_at: sharedTask.completed_at || '',
    reminded_at: sharedTask.reminded_at || '',
  };
}

function taskForComparison(task) {
  const { notificationId, reminded_at, ...sharedTask } = task;
  return sharedTask;
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === 'object') {
    return Object.keys(value)
      .sort()
      .reduce((result, key) => {
        result[key] = stableValue(value[key]);
        return result;
      }, {});
  }
  return value;
}

function taskFingerprint(task) {
  return JSON.stringify(stableValue(taskForComparison(task)));
}

function tasksFingerprint(tasks) {
  return JSON.stringify(
    [...tasks]
      .map(taskForComparison)
      .sort((a, b) => String(a.id).localeCompare(String(b.id)))
      .map(stableValue)
  );
}

function timestamp(task) {
  const parsed = new Date(task?.updated_at || task?.created_at || 0).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeDate(value) {
  if (!value) return '';
  const legacy = String(value).match(/^(\d{2})\/(\d{2})\/(\d{4}) (\d{2}):(\d{2})$/);
  const parsed = legacy
    ? new Date(
      Number(legacy[3]),
      Number(legacy[2]) - 1,
      Number(legacy[1]),
      Number(legacy[4]),
      Number(legacy[5])
    )
    : new Date(value);
  return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString();
}

function normalizeRemoteTask(task) {
  if (!task || typeof task !== 'object' || !task.id || !task.title) return null;
  const detailsFallback = task.details_md || task.details_html || task.details || '';
  const detailsDocument = normalizeRichDocument(task.details_doc, detailsFallback);
  return {
    id: String(task.id),
    title: String(task.title),
    due_at: normalizeDate(task.due_at),
    recurrence: task.recurrence || 'Sem recorrência',
    details_md: richDocumentToMarkdown(detailsDocument),
    details_doc: detailsDocument,
    completed: Boolean(task.completed),
    completed_at: normalizeDate(task.completed_at),
    reminded_at: normalizeDate(task.reminded_at),
    created_at: normalizeDate(task.created_at),
    updated_at: normalizeDate(task.updated_at),
    notificationId: task.notificationId || null,
    subtasks: Array.isArray(task.subtasks)
      ? task.subtasks
        .filter(subtask => subtask && subtask.id && subtask.title)
        .map(subtask => {
          const contentDocument = normalizeRichDocument(subtask.content_doc, subtask.title);
          return {
            id: String(subtask.id),
            title: richDocumentToMarkdown(contentDocument),
            content_doc: contentDocument,
            completed: Boolean(subtask.completed),
          };
        })
      : [],
  };
}

function mergeTasks(localTasks, remoteTasks, baselineTasks) {
  const local = new Map(localTasks.map(task => [task.id, task]));
  const remote = new Map(remoteTasks.map(task => [task.id, task]));
  const baseline = new Map(baselineTasks.map(task => [task.id, task]));
  const ids = new Set([...local.keys(), ...remote.keys(), ...baseline.keys()]);
  const merged = [];

  ids.forEach(id => {
    const localTask = local.get(id);
    const remoteTask = remote.get(id);
    const baselineTask = baseline.get(id);

    if (!baselineTask) {
      if (localTask && remoteTask) {
        merged.push(timestamp(localTask) >= timestamp(remoteTask) ? localTask : remoteTask);
      } else if (localTask || remoteTask) {
        merged.push(localTask || remoteTask);
      }
      return;
    }

    const localChanged = Boolean(localTask)
      && taskFingerprint(localTask) !== taskFingerprint(baselineTask);
    const remoteChanged = Boolean(remoteTask)
      && taskFingerprint(remoteTask) !== taskFingerprint(baselineTask);

    if (!localTask && !remoteTask) return;
    if (!localTask) {
      if (remoteChanged) merged.push(remoteTask);
      return;
    }
    if (!remoteTask) {
      if (localChanged) merged.push(localTask);
      return;
    }

    if (localChanged && remoteChanged) {
      merged.push(timestamp(localTask) >= timestamp(remoteTask) ? localTask : remoteTask);
    } else if (localChanged) {
      merged.push(localTask);
    } else {
      merged.push(remoteTask);
    }
  });

  const localById = new Map(localTasks.map(task => [task.id, task]));
  return merged.map(task => {
    const previousLocal = localById.get(task.id);
    const canKeepNotification = previousLocal
      && previousLocal.due_at === task.due_at
      && previousLocal.title === task.title;
    return {
      ...task,
      notificationId: canKeepNotification ? previousLocal.notificationId || null : null,
    };
  });
}

async function request(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error('O servidor WebDAV demorou mais de 20 segundos para responder.');
    }
    throw new Error(`Não foi possível acessar o servidor WebDAV: ${error.message}`);
  } finally {
    clearTimeout(timeout);
  }
}

export const webDavService = {
  async getConfig() {
    const stored = await AsyncStorage.getItem(CONFIG_KEY);
    let config = {};
    try {
      config = stored ? JSON.parse(stored) : {};
    } catch (error) {
      console.warn('Configuração WebDAV inválida:', error);
    }
    const password = await SecureStore.getItemAsync(PASSWORD_KEY);
    return {
      url: normalizeWebDavServerUrl(config.url),
      username: config.username || '',
      autoSync: config.autoSync !== false,
      hasPassword: Boolean(password),
    };
  },

  async saveConfig({ url, username, password, autoSync }) {
    const normalizedUrl = normalizeWebDavServerUrl(url);
    const normalizedUsername = username.trim();
    if (!/^https?:\/\//i.test(normalizedUrl)) {
      throw new Error('Informe a URL completa do task.json, começando com http:// ou https://.');
    }
    if (!normalizedUsername) throw new Error('Informe o usuário WebDAV.');

    const previous = await this.getConfig();
    await AsyncStorage.setItem(CONFIG_KEY, JSON.stringify({
      url: normalizedUrl,
      username: normalizedUsername,
      autoSync: Boolean(autoSync),
    }));
    if (password) await SecureStore.setItemAsync(PASSWORD_KEY, password);

    if (previous.url !== normalizedUrl || previous.username !== normalizedUsername) {
      await AsyncStorage.removeItem(BASELINE_KEY);
      await AsyncStorage.removeItem(LAST_SYNC_KEY);
    }
  },

  async hasSuccessfulSync() {
    return Boolean(await AsyncStorage.getItem(LAST_SYNC_KEY));
  },

  async isConfigured() {
    const config = await this.getConfig();
    return Boolean(config.url && config.username && config.hasPassword);
  },

  async sync() {
    const config = await this.getConfig();
    const password = await SecureStore.getItemAsync(PASSWORD_KEY);
    if (!config.url || !config.username || !password) {
      throw new Error('Configure a URL, o usuário e a senha do WebDAV primeiro.');
    }

    const headers = {
      Authorization: `Basic ${encodeBasicAuth(config.username, password)}`,
      Accept: 'application/json',
    };
    const remoteTaskUrl = taskFileUrl(config.url);
    const response = await request(freshTaskFileUrl(config.url), {
      method: 'GET',
      headers: {
        ...headers,
        'Cache-Control': 'no-cache, no-store',
        Pragma: 'no-cache',
      },
      cache: 'no-store',
    });
    let remoteTasks = [];
    let etag = null;

    if (response.status === 404) {
      remoteTasks = [];
    } else if (!response.ok) {
      throw new Error(`WebDAV recusou a leitura (${response.status}). Verifique URL e credenciais.`);
    } else {
      const data = await response.json().catch(() => null);
      if (!Array.isArray(data)) throw new Error('O task.json remoto não contém uma lista válida.');
      remoteTasks = data.map(normalizeRemoteTask).filter(Boolean);
      etag = response.headers.get('etag');
    }

    const localTasks = (await storageService.getTasks())
      .map(normalizeRemoteTask)
      .filter(Boolean);
    const storedBaseline = await AsyncStorage.getItem(BASELINE_KEY);
    let baselineTasks = [];
    try {
      baselineTasks = storedBaseline
        ? JSON.parse(storedBaseline).map(normalizeRemoteTask).filter(Boolean)
        : [];
    } catch (error) {
      console.warn('Base anterior do WebDAV inválida:', error);
    }
    const mergedTasks = mergeTasks(localTasks, remoteTasks, baselineTasks);
    const remoteChanged = tasksFingerprint(mergedTasks) !== tasksFingerprint(remoteTasks);
    const localChanged = tasksFingerprint(mergedTasks) !== tasksFingerprint(localTasks);

    if (remoteChanged) {
      const putHeaders = {
        ...headers,
        'Content-Type': 'application/json; charset=utf-8',
      };
      if (etag) putHeaders['If-Match'] = etag;
      const putResponse = await request(remoteTaskUrl, {
        method: 'PUT',
        headers: putHeaders,
        body: JSON.stringify(mergedTasks.map(taskWithoutLocalFields), null, 2),
      });
      if (putResponse.status === 412) {
        throw new Error('O arquivo remoto mudou durante o sync. Sincronize novamente.');
      }
      if (!putResponse.ok) {
        throw new Error(`WebDAV recusou a gravação (${putResponse.status}).`);
      }
    }

    const savedTasks = await storageService.saveTasks(mergedTasks);
    await AsyncStorage.setItem(
      BASELINE_KEY,
      JSON.stringify(savedTasks.map(taskWithoutLocalFields))
    );
    await AsyncStorage.setItem(LAST_SYNC_KEY, new Date().toISOString());
    return { tasks: savedTasks, changed: localChanged, uploaded: remoteChanged };
  },
};

export const webDavInternals = {
  mergeTasks,
  freshTaskFileUrl,
  normalizeRemoteTask,
  normalizeWebDavServerUrl,
  taskFileUrl,
  taskForComparison,
  taskWithoutLocalFields,
  tasksFingerprint,
};
