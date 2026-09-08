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
import {
  CUSTOM_RECURRENCE_UNITS,
  RECURRENCE_OPTIONS,
  formatCustomRecurrence,
  parseCustomRecurrence,
} from '../utils/recurrence';

export default function EditTaskScreen({ route, navigation }) {
  const theme = useTheme();
  const existingTask = route.params?.task;
  const isEditing = Boolean(existingTask);
  const existingCustomRecurrence = parseCustomRecurrence(existingTask?.recurrence);

  const [title, setTitle] = useState(existingTask?.title || '');
  const initialDetails = existingTask?.details_md || '';
  const [details, setDetails] = useState(initialDetails);
  const [savedDetails, setSavedDetails] = useState(initialDetails);
  const [detailsConsumed, setDetailsConsumed] = useState(false);
  const [hasDueDate, setHasDueDate] = useState(Boolean(existingTask?.due_at));
  const [dueAt, setDueAt] = useState(
    existingTask?.due_at ? new Date(existingTask.due_at) : new Date()
  );
  const [recurrence, setRecurrence] = useState(
    existingTask?.recurrence || RECURRENCE_OPTIONS[0]
  );
  const [customInterval, setCustomInterval] = useState(
    String(existingCustomRecurrence?.interval || 1)
  );
  const [customUnit, setCustomUnit] = useState(existingCustomRecurrence?.unit || 'days');
  const [subtasks, setSubtasks] = useState(existingTask?.subtasks || []);
  const [selectedSubtaskId, setSelectedSubtaskId] = useState(null);
  const [editingSubtaskId, setEditingSubtaskId] = useState(null);
  const [editorDraft, setEditorDraft] = useState({ text: initialDetails, consumed: false });
  const [editorStatus, setEditorStatus] = useState(
    'Escolha abaixo como o conteúdo do editor será usado.'
  );

  // UI States
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  const [customUnitMenuVisible, setCustomUnitMenuVisible] = useState(false);
  const [detailsTab, setDetailsTab] = useState('edit'); // 'edit' ou 'preview'
  const [detailsInputHeight, setDetailsInputHeight] = useState(140);

  const parsedCustomRecurrence = parseCustomRecurrence(recurrence);
  const isCustomRecurrence = recurrence === 'Personalizado' || Boolean(parsedCustomRecurrence);
  const selectedRecurrenceOption = isCustomRecurrence ? 'Personalizado' : recurrence;

  const updateCustomRecurrence = (interval, unit) => {
    setRecurrence(formatCustomRecurrence(interval, unit));
  };

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
    setDetailsConsumed(false);
    setDetailsTab('edit');
  };

  const handleDetailsChange = (value) => {
    setDetails(value);
    setDetailsConsumed(false);
  };

  const addSubtaskFromEditor = () => {
    const trimmed = details.trim();
    if (!trimmed) return;
    setSubtasks([...subtasks, { id: Crypto.randomUUID(), title: trimmed, completed: false }]);
    setDetails('');
    setDetailsConsumed(true);
    setEditorStatus('✓ Subtarefa adicionada abaixo.');
    setDetailsTab('edit');
  };

  const finishSubtaskEdit = (status) => {
    setEditingSubtaskId(null);
    setDetails(editorDraft.text);
    setDetailsConsumed(editorDraft.consumed);
    setEditorStatus(status);
  };

  const editSubtask = (subtask, switched = false) => {
    if (editingSubtaskId === subtask.id) {
      finishSubtaskEdit('Edição cancelada.');
      setSelectedSubtaskId(null);
      return;
    }
    if (!editingSubtaskId) {
      setEditorDraft({ text: details, consumed: detailsConsumed });
    }
    setSelectedSubtaskId(subtask.id);
    setEditingSubtaskId(subtask.id);
    setDetails(subtask.title);
    setDetailsConsumed(false);
    setDetailsTab('edit');
    setEditorStatus(
      switched
        ? 'Edição anterior descartada. Agora editando a subtarefa selecionada.'
        : 'Editando a subtarefa selecionada no mesmo editor.'
    );
  };

  const selectSubtask = (subtask) => {
    if (selectedSubtaskId === subtask.id) {
      if (editingSubtaskId === subtask.id) {
        finishSubtaskEdit('Edição cancelada.');
      }
      setSelectedSubtaskId(null);
      return;
    }
    setSelectedSubtaskId(subtask.id);
    if (editingSubtaskId) {
      editSubtask(subtask, true);
    }
  };

  const saveEditorContent = () => {
    if (editingSubtaskId) {
      const trimmed = details.trim();
      if (!trimmed) {
        Alert.alert('Aviso', 'Escreva o conteúdo da subtarefa.');
        return;
      }
      setSubtasks(subtasks.map(s => (
        s.id === editingSubtaskId ? { ...s, title: trimmed } : s
      )));
      finishSubtaskEdit('✓ Subtarefa atualizada.');
      return;
    }
    setSavedDetails(details);
    setDetailsConsumed(false);
    setEditorStatus('✓ Descrição geral salva.');
  };

  const toggleSubtask = (id) => {
    setSubtasks(subtasks.map(s => s.id === id ? { ...s, completed: !s.completed } : s));
  };

  const removeSubtask = (id) => {
    setSubtasks(subtasks.filter(s => s.id !== id));
    if (editingSubtaskId === id) {
      finishSubtaskEdit('Subtarefa removida.');
    }
    if (selectedSubtaskId === id) {
      setSelectedSubtaskId(null);
    }
  };

  const handleSave = async () => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      Alert.alert('Aviso', 'Digite o nome da tarefa.');
      return;
    }
    if (editingSubtaskId) {
      Alert.alert('Aviso', 'Salve ou cancele a edição da subtarefa antes de salvar a tarefa.');
      return;
    }

    const now = new Date().toISOString();
    const finalDueAt = hasDueDate ? dueAt.toISOString() : '';

    const taskData = {
      id: existingTask?.id || Crypto.randomUUID(),
      title: trimmedTitle,
      details_md: detailsConsumed ? savedDetails : details,
      due_at: finalDueAt,
      recurrence: hasDueDate
        ? (isCustomRecurrence
          ? formatCustomRecurrence(customInterval, customUnit)
          : recurrence)
        : 'Sem recorrência',
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
                      {isCustomRecurrence ? formatCustomRecurrence(customInterval, customUnit) : recurrence}
                    </Button>
                  }
                >
                  {RECURRENCE_OPTIONS.map((opt) => (
                    <Menu.Item
                      key={opt}
                      onPress={() => {
                        if (opt === 'Personalizado') {
                          updateCustomRecurrence(customInterval, customUnit);
                        } else {
                          setRecurrence(opt);
                        }
                        setMenuVisible(false);
                      }}
                      title={opt}
                      leadingIcon={selectedRecurrenceOption === opt ? 'check' : undefined}
                    />
                  ))}
                </Menu>

                {isCustomRecurrence && (
                  <View style={styles.customRecurrenceRow}>
                    <TextInput
                      label="A cada"
                      value={customInterval}
                      onChangeText={(value) => {
                        const digitsOnly = value.replace(/[^0-9]/g, '');
                        setCustomInterval(digitsOnly);
                        if (digitsOnly) updateCustomRecurrence(digitsOnly, customUnit);
                      }}
                      onBlur={() => {
                        const normalizedInterval = String(Math.max(1, Number.parseInt(customInterval, 10) || 1));
                        setCustomInterval(normalizedInterval);
                        updateCustomRecurrence(normalizedInterval, customUnit);
                      }}
                      keyboardType="number-pad"
                      mode="outlined"
                      dense
                      maxLength={4}
                      style={styles.customIntervalInput}
                    />

                    <View style={styles.customUnitContainer}>
                      <Menu
                        visible={customUnitMenuVisible}
                        onDismiss={() => setCustomUnitMenuVisible(false)}
                        anchor={
                          <Button
                            mode="outlined"
                            icon="chevron-down"
                            contentStyle={styles.customUnitButtonContent}
                            style={styles.customUnitButton}
                            onPress={() => setCustomUnitMenuVisible(true)}
                          >
                            {CUSTOM_RECURRENCE_UNITS.find(item => item.value === customUnit)?.label}
                          </Button>
                        }
                      >
                        {CUSTOM_RECURRENCE_UNITS.map(unit => (
                          <Menu.Item
                            key={unit.value}
                            title={unit.label}
                            leadingIcon={customUnit === unit.value ? 'check' : undefined}
                            onPress={() => {
                              setCustomUnit(unit.value);
                              updateCustomRecurrence(customInterval, unit.value);
                              setCustomUnitMenuVisible(false);
                            }}
                          />
                        ))}
                      </Menu>
                    </View>
                  </View>
                )}
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
                { value: 'preview', label: 'Prévia' },
              ]}
              style={styles.detailsTabs}
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
              placeholder="Escreva a descrição geral ou uma subtarefa em Markdown..."
              value={details}
              onChangeText={handleDetailsChange}
              mode="outlined"
              multiline
              numberOfLines={5}
              scrollEnabled={false}
              textAlignVertical="top"
              rejectResponderTermination={false}
              onContentSizeChange={({ nativeEvent }) => {
                setDetailsInputHeight(Math.max(140, nativeEvent.contentSize.height + 24));
              }}
              style={[styles.detailsInput, { height: detailsInputHeight }]}
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

          <View style={styles.editorActions}>
            <Button
              mode="outlined"
              icon="content-save-outline"
              onPress={saveEditorContent}
            >
              {editingSubtaskId ? 'Salvar alterações da subtarefa' : 'Salvar como descrição'}
            </Button>
            {editingSubtaskId ? (
              <Button
                mode="text"
                icon="close"
                onPress={() => {
                  finishSubtaskEdit('Edição cancelada.');
                  setSelectedSubtaskId(null);
                }}
              >
                Cancelar edição
              </Button>
            ) : (
              <Button
                mode="contained"
                icon="format-list-checks"
                onPress={addSubtaskFromEditor}
                disabled={!details.trim()}
              >
                Adicionar como subtarefa
              </Button>
            )}
            <Text variant="bodySmall" style={styles.editorStatus}>
              {editorStatus}
            </Text>
          </View>
        </Card.Content>
      </Card>

      {/* Seção de Subtarefas */}
      <Card style={styles.cardSection}>
        <Card.Content>
          <Text variant="titleMedium" style={styles.sectionTitle}>
            Subtarefas ({subtasks.filter(s => s.completed).length}/{subtasks.length})
          </Text>

          {subtasks.map((s) => (
            <View
              key={s.id}
              style={[
                styles.subtaskItemRow,
                selectedSubtaskId === s.id && styles.subtaskItemSelected,
              ]}
            >
              <Checkbox
                status={s.completed ? 'checked' : 'unchecked'}
                onPress={() => toggleSubtask(s.id)}
                color={theme.colors.primary}
              />
              <TouchableOpacity
                style={styles.subtaskMarkdownContainer}
                activeOpacity={0.75}
                onPress={() => selectSubtask(s)}
              >
                <Markdown style={s.completed ? completedMarkdownStyles : subtaskMarkdownStyles}>
                  {s.title}
                </Markdown>
              </TouchableOpacity>
              <IconButton
                icon="pencil-outline"
                size={20}
                onPress={() => editSubtask(s, Boolean(editingSubtaskId))}
              />
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
  customRecurrenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 10,
  },
  customIntervalInput: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  customUnitContainer: {
    flex: 1,
  },
  customUnitButton: {
    width: '100%',
  },
  customUnitButtonContent: {
    minHeight: 46,
    flexDirection: 'row-reverse',
  },
  markdownHeaderRow: {
    gap: 8,
    marginBottom: 8,
  },
  detailsTabs: {
    alignSelf: 'stretch',
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
  editorActions: {
    gap: 6,
    marginTop: 10,
  },
  editorStatus: {
    color: '#64748b',
    textAlign: 'center',
    marginTop: 2,
  },
  subtaskItemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 4,
    paddingHorizontal: 4,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    backgroundColor: '#ffffff',
  },
  subtaskItemSelected: {
    borderColor: '#2563eb',
    borderWidth: 2,
    backgroundColor: '#eff6ff',
  },
  subtaskMarkdownContainer: {
    flex: 1,
    paddingHorizontal: 4,
    minHeight: 42,
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

const subtaskMarkdownStyles = {
  ...markdownStyles,
  body: {
    ...markdownStyles.body,
    color: '#1e293b',
    marginTop: 0,
    marginBottom: 0,
  },
  paragraph: {
    marginTop: 4,
    marginBottom: 4,
  },
};

const completedMarkdownStyles = {
  ...subtaskMarkdownStyles,
  body: {
    ...subtaskMarkdownStyles.body,
    color: '#94a3b8',
    textDecorationLine: 'line-through',
  },
};
