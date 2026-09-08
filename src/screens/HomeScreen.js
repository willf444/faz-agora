import React, { useState, useEffect, useCallback, useLayoutEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  Alert,
  TouchableOpacity,
  Keyboard,
} from 'react-native';
import {
  Text,
  FAB,
  Checkbox,
  IconButton,
  Searchbar,
  SegmentedButtons,
  useTheme,
  Card,
  Chip,
  TextInput,
  Divider,
  Button,
} from 'react-native-paper';
import Markdown from 'react-native-markdown-display';
import { format, isPast, isToday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import * as Crypto from 'expo-crypto';

import { storageService } from '../services/storageService';
import { notificationService } from '../services/notificationService';
import { webDavService } from '../services/webDavService';
import { calculateNextDue } from '../utils/recurrence';

export default function HomeScreen({ navigation }) {
  const [tasks, setTasks] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState('pending');
  const [quickTitle, setQuickTitle] = useState('');
  const [expandedTaskId, setExpandedTaskId] = useState(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [hasSuccessfulSync, setHasSuccessfulSync] = useState(false);
  const syncingRef = useRef(false);
  const theme = useTheme();

  const loadTasks = useCallback(async () => {
    const loaded = await storageService.getTasks();
    setTasks(loaded);
  }, []);

  const syncWebDav = useCallback(async (silent = false) => {
    if (syncingRef.current) return;
    const configured = await webDavService.isConfigured();
    if (!configured) {
      if (!silent) navigation.navigate('WebDavSettings');
      return;
    }

    syncingRef.current = true;
    setIsSyncing(true);
    setHasSuccessfulSync(false);
    try {
      const result = await webDavService.sync();
      const syncedTasks = result.changed
        ? await notificationService.rescheduleTasks(result.tasks)
        : result.tasks;
      setTasks(syncedTasks);
      setHasSuccessfulSync(true);
      if (!silent) {
        Alert.alert(
          'WebDAV sincronizado',
          result.uploaded || result.changed
            ? 'As alterações locais e remotas foram mescladas.'
            : 'As tarefas já estavam atualizadas.'
        );
      }
    } catch (error) {
      setHasSuccessfulSync(false);
      if (!silent) Alert.alert('Falha no WebDAV', error.message);
      else console.warn('Falha na sincronização automática WebDAV:', error);
    } finally {
      syncingRef.current = false;
      setIsSyncing(false);
    }
  }, [navigation]);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <View style={styles.headerActions}>
          <IconButton
            icon="sync"
            iconColor="#ffffff"
            size={22}
            disabled={isSyncing}
            accessibilityLabel={hasSuccessfulSync ? 'WebDAV sincronizado' : 'Sincronizar WebDAV'}
            onPress={() => syncWebDav(false)}
            style={[
              styles.headerIcon,
              styles.syncStatusButton,
              hasSuccessfulSync && styles.syncStatusButtonSuccess,
            ]}
          />
          <IconButton
            icon="cog-outline"
            iconColor="#ffffff"
            size={22}
            accessibilityLabel="Configurar WebDAV"
            onPress={() => navigation.navigate('WebDavSettings')}
            style={styles.headerIcon}
          />
        </View>
      ),
    });
  }, [hasSuccessfulSync, isSyncing, navigation, syncWebDav]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', async () => {
      await loadTasks();
      const config = await webDavService.getConfig();
      setHasSuccessfulSync(await webDavService.hasSuccessfulSync());
      if (config.autoSync && config.url && config.username && config.hasPassword) {
        await syncWebDav(true);
      }
    });
    return unsubscribe;
  }, [navigation, loadTasks, syncWebDav]);

  // Criação rápida sem data (equivalente ao quick_add de willdo.py)
  const handleQuickAdd = async () => {
    const trimmed = quickTitle.trim();
    if (!trimmed) return;

    const now = new Date().toISOString();
    const newTask = {
      id: Crypto.randomUUID(),
      title: trimmed,
      due_at: '',
      recurrence: 'Sem recorrência',
      details_md: '',
      completed: false,
      completed_at: null,
      reminded_at: null,
      created_at: now,
      updated_at: now,
      subtasks: [],
    };

    await storageService.addTask(newTask);
    setQuickTitle('');
    Keyboard.dismiss();
    await loadTasks();
  };

  const advanceRecurringTask = async (task) => {
    const nextDue = calculateNextDue(task.due_at, task.recurrence);
    const updatedTask = {
      ...task,
      due_at: nextDue.toISOString(),
      reminded_at: null,
      updated_at: new Date().toISOString(),
      completed: false,
    };

    // Reagenda notificação
    const newNotifId = await notificationService.scheduleTaskNotification(updatedTask);
    updatedTask.notificationId = newNotifId;

    await storageService.updateTask(updatedTask);
    await loadTasks();
  };

  const toggleTask = async (task) => {
    const now = new Date();
    const isCurrentlyCompleted = task.completed;

    if (!isCurrentlyCompleted) {
      // Tentando concluir a tarefa
      const hasDue = Boolean(task.due_at && task.due_at.trim());
      const isRecurring = task.recurrence && task.recurrence !== 'Sem recorrência';

      if (isRecurring && hasDue) {
        const dueDate = new Date(task.due_at);
        if (dueDate > now) {
          Alert.alert(
            'Confirmação',
            'Você está adiantando essa tarefa recorrente. Tem certeza que quer concluí-la?',
            [
              { text: 'Cancelar', style: 'cancel' },
              {
                text: 'Concluir e Avançar',
                onPress: () => advanceRecurringTask(task),
              },
            ]
          );
          return;
        }

        // Se a data já chegou ou passou, avança para a próxima ocorrência
        await advanceRecurringTask(task);
        return;
      }

      // Tarefa não recorrente
      if (task.notificationId) {
        await notificationService.cancelNotification(task.notificationId);
      }

      const updated = {
        ...task,
        completed: true,
        completed_at: now.toISOString(),
        updated_at: now.toISOString(),
      };
      await storageService.updateTask(updated);
    } else {
      // Reabrindo tarefa concluída
      const updated = {
        ...task,
        completed: false,
        completed_at: null,
        updated_at: now.toISOString(),
      };

      // Se tiver data no futuro, reagenda
      if (updated.due_at && new Date(updated.due_at) > now) {
        const newNotifId = await notificationService.scheduleTaskNotification(updated);
        updated.notificationId = newNotifId;
      }

      await storageService.updateTask(updated);
    }

    await loadTasks();
  };

  const deleteTask = (task) => {
    Alert.alert(
      'Confirmar remoção',
      `Remover a tarefa:\n\n"${task.title}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Remover',
          style: 'destructive',
          onPress: async () => {
            if (task.notificationId) {
              await notificationService.cancelNotification(task.notificationId);
            }
            await storageService.removeTask(task.id);
            await loadTasks();
          },
        },
      ]
    );
  };

  const clearCompleted = () => {
    const completedCount = tasks.filter(t => t.completed).length;
    if (completedCount === 0) {
      Alert.alert('Aviso', 'Não há tarefas concluídas para excluir.');
      return;
    }

    Alert.alert(
      'Excluir concluídas',
      `Deseja excluir ${completedCount} tarefa(s) concluída(s)?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: async () => {
            await storageService.clearCompletedTasks();
            await loadTasks();
          },
        },
      ]
    );
  };

  const toggleSubtask = async (taskId, subtaskId) => {
    await storageService.toggleSubtask(taskId, subtaskId);
    await loadTasks();
  };

  // Filtragem de tarefas
  const filteredTasks = tasks.filter(task => {
    const q = searchQuery.toLowerCase().trim();
    let matchesSearch = true;
    if (q) {
      const subtaskTitles = (task.subtasks || []).map(s => s.title.toLowerCase()).join(' ');
      const haystack = `${task.title.toLowerCase()} ${(task.details_md || '').toLowerCase()} ${(task.recurrence || '').toLowerCase()} ${subtaskTitles}`;
      matchesSearch = haystack.includes(q);
    }

    const matchesFilter = filter === 'pending' ? !task.completed : task.completed;
    return matchesSearch && matchesFilter;
  });

  const pendingCount = tasks.filter(t => !t.completed).length;
  const completedCount = tasks.filter(t => t.completed).length;

  const renderTaskItem = ({ item }) => {
    const isExpanded = expandedTaskId === item.id;
    const hasDetails = Boolean(item.details_md && item.details_md.trim());
    const hasSubtasks = item.subtasks && item.subtasks.length > 0;
    const completedSubtasks = hasSubtasks
      ? item.subtasks.filter(s => s.completed).length
      : 0;

    let dueFormatted = '';
    let dueColor = theme.colors.onSurfaceVariant;
    if (item.due_at) {
      try {
        const d = new Date(item.due_at);
        dueFormatted = format(d, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
        if (!item.completed) {
          if (isPast(d) && !isToday(d)) {
            dueColor = theme.colors.error;
          } else if (isToday(d)) {
            dueColor = '#d97706'; // Âmbar
          } else {
            dueColor = theme.colors.primary;
          }
        }
      } catch (e) {
        dueFormatted = item.due_at;
      }
    }

    return (
      <Card style={[styles.card, item.completed && styles.cardCompleted]}>
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => setExpandedTaskId(isExpanded ? null : item.id)}
        >
          <Card.Content style={styles.cardContent}>
            <View style={styles.cardHeader}>
              <Checkbox
                status={item.completed ? 'checked' : 'unchecked'}
                onPress={() => toggleTask(item)}
                color={theme.colors.primary}
              />

              <View style={styles.titleContainer}>
                <Text
                  variant="titleMedium"
                  style={[
                    styles.taskTitle,
                    item.completed && styles.taskTitleCompleted,
                  ]}
                >
                  {item.title}
                </Text>

                {dueFormatted ? (
                  <View style={styles.dateRow}>
                    <IconButton
                      icon="clock-outline"
                      size={16}
                      iconColor={dueColor}
                      style={styles.dateIcon}
                    />
                    <Text variant="bodySmall" style={{ color: dueColor, fontWeight: '600' }}>
                      {dueFormatted}
                    </Text>
                  </View>
                ) : null}
              </View>

              <View style={styles.actionsRow}>
                <IconButton
                  icon="pencil-outline"
                  size={20}
                  onPress={() => navigation.navigate('EditTask', { task: item })}
                />
                <IconButton
                  icon="delete-outline"
                  size={20}
                  iconColor={theme.colors.error}
                  onPress={() => deleteTask(item)}
                />
              </View>
            </View>

            {/* Chips de Recorrência e Subtarefas */}
            <View style={styles.chipsRow}>
              {item.recurrence && item.recurrence !== 'Sem recorrência' && (
                <Chip icon="repeat" compact style={styles.chip}>
                  {item.recurrence}
                </Chip>
              )}

              {hasSubtasks && (
                <Chip icon="format-list-checks" compact style={styles.chip}>
                  {`Subtarefas ${completedSubtasks}/${item.subtasks.length}`}
                </Chip>
              )}

              {(hasDetails || hasSubtasks) && (
                <Chip
                  icon={isExpanded ? 'chevron-up' : 'chevron-down'}
                  compact
                  style={styles.chip}
                  onPress={() => setExpandedTaskId(isExpanded ? null : item.id)}
                >
                  {isExpanded ? 'Ocultar detalhes' : 'Ver detalhes'}
                </Chip>
              )}
            </View>

            {/* Seção Expandida: Markdown e Checklist de Subtarefas */}
            {isExpanded && (
              <View style={styles.expandedSection}>
                <Divider style={styles.divider} />

                {hasDetails && (
                  <View style={styles.markdownContainer}>
                    <Text variant="labelMedium" style={styles.sectionLabel}>
                      DETALHES:
                    </Text>
                    <Markdown style={markdownStyles}>
                      {item.details_md}
                    </Markdown>
                  </View>
                )}

                {hasSubtasks && (
                  <View style={styles.subtasksContainer}>
                    <Text variant="labelMedium" style={styles.sectionLabel}>
                      SUBTAREFAS:
                    </Text>
                    {item.subtasks.map(s => (
                      <TouchableOpacity
                        key={s.id}
                        style={styles.subtaskRow}
                        onPress={() => toggleSubtask(item.id, s.id)}
                      >
                        <Checkbox
                          status={s.completed ? 'checked' : 'unchecked'}
                          onPress={() => toggleSubtask(item.id, s.id)}
                          color={theme.colors.primary}
                        />
                        <View style={styles.subtaskMarkdownContainer}>
                          <Markdown style={s.completed ? completedSubtaskMarkdownStyles : subtaskMarkdownStyles}>
                            {s.title}
                          </Markdown>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
            )}
          </Card.Content>
        </TouchableOpacity>
      </Card>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Barra de Criação Rápida */}
      <View style={styles.quickAddRow}>
        <TextInput
          placeholder="Adicionar tarefa rápida... (sem data)"
          value={quickTitle}
          onChangeText={setQuickTitle}
          onSubmitEditing={handleQuickAdd}
          returnKeyType="done"
          mode="outlined"
          style={styles.quickInput}
          right={
            quickTitle.trim() ? (
              <TextInput.Icon icon="plus-circle" onPress={handleQuickAdd} />
            ) : null
          }
        />
      </View>

      {/* Busca */}
      <Searchbar
        placeholder="Buscar tarefas..."
        onChangeText={setSearchQuery}
        value={searchQuery}
        style={styles.searchBar}
      />

      {/* Seletor de Abas com Contadores */}
      <View style={styles.tabsHeader}>
        <SegmentedButtons
          value={filter}
          onValueChange={setFilter}
          buttons={[
            {
              value: 'pending',
              label: `Pendentes (${pendingCount})`,
            },
            {
              value: 'completed',
              label: `Concluídas (${completedCount})`,
            },
          ]}
          style={styles.filterButtons}
        />

        {filter === 'completed' && completedCount > 0 && (
          <Button
            mode="text"
            textColor={theme.colors.error}
            icon="trash-can-outline"
            onPress={clearCompleted}
            compact
          >
            Limpar Concluídas
          </Button>
        )}
      </View>

      {/* Lista de Tarefas */}
      <FlatList
        data={filteredTasks}
        renderItem={renderTaskItem}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <IconButton icon="clipboard-check-outline" size={64} iconColor="#94a3b8" />
            <Text variant="titleMedium" style={{ color: '#64748b' }}>
              {searchQuery ? 'Nenhuma tarefa encontrada' : 'Tudo em dia por aqui!'}
            </Text>
            <Text variant="bodySmall" style={{ color: '#94a3b8', marginTop: 4 }}>
              {filter === 'pending'
                ? 'Toque em "Nova Tarefa Completa" ou adicione acima.'
                : 'Tarefas concluídas aparecerão aqui.'}
            </Text>
          </View>
        }
      />

      {/* FAB para criar tarefa completa */}
      <FAB
        icon="plus"
        label="Nova Tarefa"
        style={styles.fab}
        onPress={() => navigation.navigate('EditTask')}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerIcon: {
    margin: 0,
  },
  syncStatusButton: {
    backgroundColor: '#64748b',
    borderRadius: 18,
  },
  syncStatusButtonSuccess: {
    backgroundColor: '#16a34a',
  },
  container: {
    flex: 1,
    paddingHorizontal: 14,
    paddingTop: 12,
  },
  quickAddRow: {
    marginBottom: 10,
  },
  quickInput: {
    backgroundColor: '#ffffff',
    fontSize: 14,
  },
  searchBar: {
    marginBottom: 12,
    backgroundColor: '#ffffff',
    elevation: 1,
  },
  tabsHeader: {
    marginBottom: 10,
  },
  filterButtons: {
    marginBottom: 4,
  },
  listContent: {
    paddingBottom: 90,
  },
  card: {
    backgroundColor: '#ffffff',
    marginBottom: 10,
    borderRadius: 12,
    elevation: 1,
  },
  cardCompleted: {
    backgroundColor: '#f8fafc',
    opacity: 0.85,
  },
  cardContent: {
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  titleContainer: {
    flex: 1,
    marginLeft: 4,
  },
  taskTitle: {
    fontWeight: '600',
    color: '#0f172a',
  },
  taskTitleCompleted: {
    textDecorationLine: 'line-through',
    color: '#64748b',
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  dateIcon: {
    margin: 0,
    padding: 0,
    width: 18,
    height: 18,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
    marginLeft: 38,
  },
  chip: {
    minHeight: 34,
    justifyContent: 'center',
  },
  expandedSection: {
    marginTop: 8,
    paddingLeft: 12,
  },
  divider: {
    marginVertical: 8,
  },
  sectionLabel: {
    color: '#64748b',
    fontWeight: '700',
    marginBottom: 4,
  },
  markdownContainer: {
    marginBottom: 8,
  },
  subtasksContainer: {
    marginTop: 6,
  },
  subtaskRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 2,
  },
  subtaskMarkdownContainer: {
    flex: 1,
    paddingRight: 4,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 60,
  },
  fab: {
    position: 'absolute',
    margin: 16,
    right: 0,
    bottom: 0,
    backgroundColor: '#2563eb',
  },
});

const markdownStyles = {
  body: {
    color: '#334155',
    fontSize: 14,
    lineHeight: 20,
  },
  heading1: {
    color: '#0f172a',
    fontWeight: '700',
    fontSize: 18,
    marginVertical: 4,
  },
  heading2: {
    color: '#0f172a',
    fontWeight: '600',
    fontSize: 16,
    marginVertical: 4,
  },
  code_inline: {
    backgroundColor: '#e2e8f0',
    borderRadius: 4,
    paddingHorizontal: 4,
  },
  link: {
    color: '#2563eb',
  },
};

const subtaskMarkdownStyles = {
  ...markdownStyles,
  body: {
    ...markdownStyles.body,
    color: '#1e293b',
    marginTop: 0,
    marginBottom: 0,
  },
  paragraph: {
    marginTop: 3,
    marginBottom: 3,
  },
};

const completedSubtaskMarkdownStyles = {
  ...subtaskMarkdownStyles,
  body: {
    ...subtaskMarkdownStyles.body,
    color: '#94a3b8',
    textDecorationLine: 'line-through',
  },
};
