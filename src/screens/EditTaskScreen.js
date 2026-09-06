import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Platform,
  Alert,
  TouchableOpacity,
} from 'react-native';
import {
  TextInput,
  Button,
  Text,
  useTheme,
  Divider,
  IconButton,
  List,
  Checkbox,
  Menu,
  Switch,
  SegmentedButtons,
  Card,
} from 'react-native-paper';
import DateTimePicker from '@react-native-community/datetimepicker';
import Markdown from 'react-native-markdown-display';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import * as Crypto from 'expo-crypto';

import { storageService } from '../services/storageService';
import { notificationService } from '../services/notificationService';
import { RECURRENCE_OPTIONS } from '../utils/recurrence';

export default function EditTaskScreen({ route, navigation }) {
  const theme = useTheme();
  const existingTask = route.params?.task;
  const isEditing = Boolean(existingTask);

  const [title, setTitle] = useState(existingTask?.title || '');
  const [details, setDetails] = useState(existingTask?.details_md || '');
  const [hasDueDate, setHasDueDate] = useState(Boolean(existingTask?.due_at));
  const [dueAt, setDueAt] = useState(
    existingTask?.due_at ? new Date(existingTask.due_at) : new Date()
  );
  const [recurrence, setRecurrence] = useState(
    existingTask?.recurrence || RECURRENCE_OPTIONS[0]
  );
  const [subtasks, setSubtasks] = useState(existingTask?.subtasks || []);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');

  // UI States
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  const [detailsTab, setDetailsTab] = useState('edit'); // 'edit' ou 'preview'

  const onDateChange = (event, selectedDate) => {
    setShowDatePicker(false);
    if (selectedDate) {
      const updated = new Date(dueAt);
      updated.setFullYear(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());
      setDueAt(updated);
      // No Android, abre o seletor de hora logo após a data
      if (Platform.OS === 'android') {
        setShowTimePicker(true);
      }
    }
  };

  const onTimeChange = (event, selectedTime) => {
    setShowTimePicker(false);
    if (selectedTime) {
      const updated = new Date(dueAt);
      updated.setHours(selectedTime.getHours(), selectedTime.getMinutes());
      setDueAt(updated);
    }
  };

  // Funções de formatação rápida de Markdown
  const insertMarkdownSnippet = (prefix, suffix = '') => {
    setDetails(prev => `${prev}\n${prefix}Texto${suffix}\n`.trim());
    setDetailsTab('edit');
  };

  const addSubtask = () => {
    const trimmed = newSubtaskTitle.trim();
    if (!trimmed) return;
    setSubtasks([...subtasks, { id: Crypto.randomUUID(), title: trimmed, completed: false }]);
    setNewSubtaskTitle('');
  };

  const toggleSubtask = (id) => {
    setSubtasks(subtasks.map(s => s.id === id ? { ...s, completed: !s.completed } : s));
  };

  const removeSubtask = (id) => {
    setSubtasks(subtasks.filter(s => s.id !== id));
  };

  const handleSave = async () => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      Alert.alert('Aviso', 'Digite o nome da tarefa.');
      return;
    }

    const now = new Date().toISOString();
    const finalDueAt = hasDueDate ? dueAt.toISOString() : '';

    const taskData = {
      id: existingTask?.id || Crypto.randomUUID(),
      title: trimmedTitle,
      details_md: details,
      due_at: finalDueAt,
      recurrence: hasDueDate ? recurrence : 'Sem recorrência',
      subtasks,
      completed: existingTask?.completed || false,
      completed_at: existingTask?.completed_at || null,
      reminded_at: existingTask?.due_at !== finalDueAt ? null : (existingTask?.reminded_at || null),
      created_at: existingTask?.created_at || now,
      updated_at: now,
      notificationId: existingTask?.notificationId || null,
    };

    // Agendamento / Cancelamento de Notificações
    if (existingTask?.notificationId && (existingTask.due_at !== finalDueAt || !hasDueDate)) {
      await notificationService.cancelNotification(existingTask.notificationId);
      taskData.notificationId = null;
    }

    if (hasDueDate && !taskData.completed && dueAt > new Date()) {
      const notificationId = await notificationService.scheduleTaskNotification(taskData);
      taskData.notificationId = notificationId;
    }

    if (isEditing) {
      await storageService.updateTask(taskData);
    } else {
      await storageService.addTask(taskData);
    }

    navigation.goBack();
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={styles.scrollContent}
      keyboardShouldPersistTaps="handled"
    >
      {/* Título da Tarefa */}
      <TextInput
        label="Nome da tarefa *"
        value={title}
        onChangeText={setTitle}
        placeholder="Ex: Pagar fatura do cartão"
        mode="outlined"
        style={styles.input}
      />

      {/* Seção Data e Hora de Vencimento */}
      <Card style={styles.cardSection}>
        <Card.Content>
          <View style={styles.switchRow}>
            <Text variant="bodyLarge" style={styles.switchLabel}>
              Definir data e hora
            </Text>
            <Switch
              value={hasDueDate}
              onValueChange={(val) => {
                setHasDueDate(val);
                if (val && !dueAt) setDueAt(new Date());
              }}
              color={theme.colors.primary}
            />
          </View>

          {hasDueDate && (
            <View style={styles.dueConfigContainer}>
              <Divider style={styles.divider} />

              <View style={styles.pickerButtonsRow}>
                <Button
                  mode="outlined"
                  icon="calendar"
                  onPress={() => setShowDatePicker(true)}
                  style={styles.dateButton}
                >
                  {format(dueAt, 'dd/MM/yyyy', { locale: ptBR })}
                </Button>

                <Button
                  mode="outlined"
                  icon="clock-outline"
                  onPress={() => setShowTimePicker(true)}
                  style={styles.timeButton}
                >
                  {format(dueAt, 'HH:mm', { locale: ptBR })}
                </Button>
              </View>

              {/* Seletor de Recorrência */}
              <View style={styles.recurrenceRow}>
                <Text variant="bodyMedium" style={{ color: '#475569', marginBottom: 4 }}>
                  Recorrência:
                </Text>
                <Menu
                  visible={menuVisible}
                  onDismiss={() => setMenuVisible(false)}
                  anchor={
                    <Button
                      mode="outlined"
                      icon="repeat"
                      onPress={() => setMenuVisible(true)}
                      contentStyle={{ justifyContent: 'flex-start' }}
                    >
                      {recurrence}
                    </Button>
                  }
                >
                  {RECURRENCE_OPTIONS.map((opt) => (
                    <Menu.Item
                      key={opt}
                      onPress={() => {
                        setRecurrence(opt);
                        setMenuVisible(false);
                      }}
                      title={opt}
                      leadingIcon={recurrence === opt ? 'check' : undefined}
                    />
                  ))}
                </Menu>
              </View>
            </View>
          )}
        </Card.Content>
      </Card>

      {/* Seção de Detalhes com Markdown */}
      <Card style={styles.cardSection}>
        <Card.Content>
          <View style={styles.markdownHeaderRow}>
            <Text variant="titleMedium" style={styles.sectionTitle}>
              Detalhes da Tarefa
            </Text>
            <SegmentedButtons
              value={detailsTab}
              onValueChange={setDetailsTab}
              density="small"
              buttons={[
                { value: 'edit', label: 'Editor' },
                { value: 'preview', label: 'Preview' },
              ]}
              style={{ width: 180 }}
            />
          </View>

          {/* Barra de atalhos rápidos de Markdown */}
          {detailsTab === 'edit' && (
            <View style={styles.toolbarRow}>
              <IconButton icon="format-bold" size={20} onPress={() => insertMarkdownSnippet('**', '**')} />
              <IconButton icon="format-italic" size={20} onPress={() => insertMarkdownSnippet('*', '*')} />
              <IconButton icon="format-list-bulleted" size={20} onPress={() => insertMarkdownSnippet('- ')} />
              <IconButton icon="format-header-1" size={20} onPress={() => insertMarkdownSnippet('# ')} />
              <IconButton icon="link-variant" size={20} onPress={() => insertMarkdownSnippet('[link](', ')')} />
            </View>
          )}

          {detailsTab === 'edit' ? (
            <TextInput
              placeholder="Escreva anotações ou detalhes em markdown..."
              value={details}
              onChangeText={setDetails}
              mode="outlined"
              multiline
              numberOfLines={5}
              style={styles.detailsInput}
            />
          ) : (
            <View style={styles.previewContainer}>
              {details.trim() ? (
                <Markdown style={markdownStyles}>{details}</Markdown>
              ) : (
                <Text variant="bodyMedium" style={{ color: '#94a3b8', fontStyle: 'italic' }}>
                  Sem detalhes para visualizar.
                </Text>
              )}
            </View>
          )}
        </Card.Content>
      </Card>

      {/* Seção de Subtarefas */}
      <Card style={styles.cardSection}>
        <Card.Content>
          <Text variant="titleMedium" style={styles.sectionTitle}>
            Subtarefas ({subtasks.filter(s => s.completed).length}/{subtasks.length})
          </Text>

          <View style={styles.addSubtaskRow}>
            <TextInput
              placeholder="Adicionar subtarefa..."
              value={newSubtaskTitle}
              onChangeText={setNewSubtaskTitle}
              onSubmitEditing={addSubtask}
              mode="outlined"
              dense
              style={styles.subtaskInput}
            />
            <Button
              mode="contained"
              onPress={addSubtask}
              disabled={!newSubtaskTitle.trim()}
              style={styles.addSubtaskButton}
            >
              Inserir
            </Button>
          </View>

          {subtasks.map((s) => (
            <View key={s.id} style={styles.subtaskItemRow}>
              <Checkbox
                status={s.completed ? 'checked' : 'unchecked'}
                onPress={() => toggleSubtask(s.id)}
                color={theme.colors.primary}
              />
              <Text
                variant="bodyMedium"
                style={[
                  styles.subtaskTitle,
                  s.completed && styles.subtaskTitleCompleted,
                ]}
              >
                {s.title}
              </Text>
              <IconButton
                icon="delete-outline"
                size={20}
                iconColor={theme.colors.error}
                onPress={() => removeSubtask(s.id)}
              />
            </View>
          ))}
        </Card.Content>
      </Card>

      {/* Botões de Ação */}
      <Button
        mode="contained"
        onPress={handleSave}
        style={styles.saveButton}
        icon="content-save"
        disabled={!title.trim()}
      >
        {isEditing ? 'Salvar Alterações' : 'Criar Tarefa'}
      </Button>

      {/* Date & Time Pickers */}
      {showDatePicker && (
        <DateTimePicker
          value={dueAt}
          mode="date"
          display="default"
          onChange={onDateChange}
        />
      )}

      {showTimePicker && (
        <DateTimePicker
          value={dueAt}
          mode="time"
          is24Hour
          display="default"
          onChange={onTimeChange}
        />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  input: {
    marginBottom: 14,
    backgroundColor: '#ffffff',
  },
  cardSection: {
    backgroundColor: '#ffffff',
    marginBottom: 14,
    borderRadius: 12,
    elevation: 1,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  switchLabel: {
    fontWeight: '600',
    color: '#0f172a',
  },
  dueConfigContainer: {
    marginTop: 8,
  },
  divider: {
    marginVertical: 10,
  },
  pickerButtonsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  dateButton: {
    flex: 3,
  },
  timeButton: {
    flex: 2,
  },
  recurrenceRow: {
    marginTop: 4,
  },
  markdownHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionTitle: {
    fontWeight: '700',
    color: '#0f172a',
  },
  toolbarRow: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    borderRadius: 8,
    marginBottom: 8,
  },
  detailsInput: {
    backgroundColor: '#ffffff',
    minHeight: 120,
  },
  previewContainer: {
    minHeight: 100,
    padding: 12,
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  addSubtaskRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 12,
  },
  subtaskInput: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  addSubtaskButton: {
    justifyContent: 'center',
  },
  subtaskItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 2,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  subtaskTitle: {
    flex: 1,
    color: '#1e293b',
  },
  subtaskTitleCompleted: {
    textDecorationLine: 'line-through',
    color: '#94a3b8',
  },
  saveButton: {
    marginTop: 10,
    paddingVertical: 6,
    borderRadius: 8,
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
