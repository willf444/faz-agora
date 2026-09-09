import React, { useRef, useState } from 'react';
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
  Card,
  Dialog,
  Portal,
} from 'react-native-paper';
import DateTimePicker from '@react-native-community/datetimepicker';
import Markdown from 'react-native-markdown-display';
import {
  actions,
  RichEditor,
  RichToolbar,
} from 'react-native-pell-rich-editor';
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
import {
  editorHtmlToMarkdown,
  markdownToEditorHtml,
} from '../utils/richText';

export default function EditTaskScreen({ route, navigation }) {
  const theme = useTheme();
  const screenScrollRef = useRef(null);
  const richEditorRef = useRef(null);
  const detailsSectionYRef = useRef(0);
  const screenScrollYRef = useRef(0);
  const editorScrollYRef = useRef(0);
  const editorContentHeightRef = useRef(0);
  const editorTouchRef = useRef({ pageY: 0, screenY: 0 });
  const existingTask = route.params?.task;
  const existingCustomRecurrence = parseCustomRecurrence(existingTask?.recurrence);
  const [taskId] = useState(existingTask?.id || Crypto.randomUUID());
  const [createdAt] = useState(existingTask?.created_at || new Date().toISOString());
  const [isPersisted, setIsPersisted] = useState(Boolean(existingTask));
  const [persistedDueAt, setPersistedDueAt] = useState(existingTask?.due_at || '');
  const [notificationId, setNotificationId] = useState(existingTask?.notificationId || null);
  const [isSaving, setIsSaving] = useState(false);

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
    'Use os botões acima para salvar o conteúdo.'
  );

  // UI States
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  const [customUnitMenuVisible, setCustomUnitMenuVisible] = useState(false);
  const [linkDialogVisible, setLinkDialogVisible] = useState(false);
  const [linkUrl, setLinkUrl] = useState('https://');

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

  const handleEditorChange = (html) => {
    setDetails(editorHtmlToMarkdown(html));
    setDetailsConsumed(false);
  };

  const replaceEditorContent = (markdown) => {
    setDetails(markdown);
    requestAnimationFrame(() => {
      richEditorRef.current?.setContentHTML(markdownToEditorHtml(markdown));
    });
  };

  const insertEditorLink = () => {
    const trimmedUrl = linkUrl.trim();
    if (!trimmedUrl) return;
    const normalizedUrl = /^https?:\/\//i.test(trimmedUrl)
      ? trimmedUrl
      : `https://${trimmedUrl}`;
    setLinkDialogVisible(false);
    setLinkUrl('https://');
    richEditorRef.current?.insertLink('', normalizedUrl);
  };

  const persistTask = async (nextDetails, nextSubtasks) => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      Alert.alert('Aviso', 'Digite o nome da tarefa.');
      return false;
    }

    setIsSaving(true);
    try {
      const now = new Date().toISOString();
      const finalDueAt = hasDueDate ? dueAt.toISOString() : '';
      const dueChanged = persistedDueAt !== finalDueAt;
      let nextNotificationId = notificationId;

      if (nextNotificationId && (dueChanged || !hasDueDate)) {
        await notificationService.cancelNotification(nextNotificationId);
        nextNotificationId = null;
      }

      const taskData = {
        id: taskId,
        title: trimmedTitle,
        details_md: nextDetails,
        due_at: finalDueAt,
        recurrence: hasDueDate
          ? (isCustomRecurrence
            ? formatCustomRecurrence(customInterval, customUnit)
            : recurrence)
          : 'Sem recorrência',
        subtasks: nextSubtasks,
        completed: existingTask?.completed || false,
        completed_at: existingTask?.completed_at || null,
        reminded_at: dueChanged ? null : (existingTask?.reminded_at || null),
        created_at: createdAt,
        updated_at: now,
        notificationId: nextNotificationId,
      };

      if (
        hasDueDate
        && !taskData.completed
        && dueAt > new Date()
        && (!nextNotificationId || dueChanged)
      ) {
        nextNotificationId = await notificationService.scheduleTaskNotification(taskData);
        taskData.notificationId = nextNotificationId;
      }

      if (isPersisted) {
        await storageService.updateTask(taskData);
      } else {
        await storageService.addTask(taskData);
        setIsPersisted(true);
      }

      setNotificationId(nextNotificationId);
      setPersistedDueAt(finalDueAt);
      return true;
    } catch (error) {
      Alert.alert('Falha ao salvar', error.message || 'Não foi possível salvar a tarefa.');
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const addSubtaskFromEditor = async () => {
    const trimmed = details.trim();
    if (!trimmed) return;
    const nextSubtasks = [
      ...subtasks,
      { id: Crypto.randomUUID(), title: trimmed, completed: false },
    ];
    if (!await persistTask(savedDetails, nextSubtasks)) return;
    setSubtasks(nextSubtasks);
    replaceEditorContent('');
    setDetailsConsumed(true);
    setEditorStatus('✓ Subtarefa adicionada e tarefa salva.');
  };

  const finishSubtaskEdit = (status) => {
    setEditingSubtaskId(null);
    replaceEditorContent(editorDraft.text);
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
    replaceEditorContent(subtask.title);
    setDetailsConsumed(false);
    setEditorStatus(
      switched
        ? 'Edição anterior descartada. Agora editando a subtarefa selecionada.'
        : 'Editando a subtarefa selecionada no mesmo editor.'
    );
    requestAnimationFrame(() => {
      screenScrollRef.current?.scrollTo({
        y: Math.max(0, detailsSectionYRef.current - 12),
        animated: true,
      });
    });
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

  const saveEditorContent = async () => {
    if (editingSubtaskId) {
      const trimmed = details.trim();
      if (!trimmed) {
        Alert.alert('Aviso', 'Escreva o conteúdo da subtarefa.');
        return;
      }
      const nextSubtasks = subtasks.map(s => (
        s.id === editingSubtaskId ? { ...s, title: trimmed } : s
      ));
      if (!await persistTask(savedDetails, nextSubtasks)) return;
      setSubtasks(nextSubtasks);
      finishSubtaskEdit('✓ Subtarefa atualizada e tarefa salva.');
      return;
    }
    if (!await persistTask(details, subtasks)) return;
    setSavedDetails(details);
    setDetailsConsumed(false);
    setEditorStatus('✓ Descrição geral e tarefa salvas.');
  };

  const saveTaskWithoutEditor = async () => {
    if (!await persistTask(savedDetails, subtasks)) return;
    navigation.goBack();
  };

  const beginEditorGesture = (event) => {
    editorTouchRef.current = {
      pageY: event.nativeEvent.pageY,
      screenY: screenScrollYRef.current,
    };
  };

  const shouldMoveEditorGestureToScreen = (event) => {
    const deltaY = event.nativeEvent.pageY - editorTouchRef.current.pageY;
    if (Math.abs(deltaY) < 6) return false;

    const contentHeight = editorContentHeightRef.current;
    const editorHeight = 218;
    const atTop = editorScrollYRef.current <= 1;
    const atBottom = editorScrollYRef.current + editorHeight >= contentHeight - 1;
    const hasNoInnerScroll = contentHeight <= editorHeight + 1;

    return hasNoInnerScroll || (atTop && deltaY > 0) || (atBottom && deltaY < 0);
  };

  const moveScreenFromEditor = (event) => {
    const deltaY = event.nativeEvent.pageY - editorTouchRef.current.pageY;
    screenScrollRef.current?.scrollTo({
      y: Math.max(0, editorTouchRef.current.screenY - deltaY),
      animated: false,
    });
  };

  const toggleSubtask = async (id) => {
    const nextSubtasks = subtasks.map(s => (
      s.id === id ? { ...s, completed: !s.completed } : s
    ));
    if (!await persistTask(savedDetails, nextSubtasks)) return;
    setSubtasks(nextSubtasks);
  };

  const removeSubtask = async (id) => {
    const nextSubtasks = subtasks.filter(s => s.id !== id);
    if (!await persistTask(savedDetails, nextSubtasks)) return;
    setSubtasks(nextSubtasks);
    if (editingSubtaskId === id) {
      finishSubtaskEdit('Subtarefa removida.');
    }
    if (selectedSubtaskId === id) {
      setSelectedSubtaskId(null);
    }
  };

  return (
    <>
    <ScrollView
      ref={screenScrollRef}
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={styles.scrollContent}
      keyboardShouldPersistTaps="handled"
      nestedScrollEnabled
      onScroll={({ nativeEvent }) => {
        screenScrollYRef.current = nativeEvent.contentOffset.y;
      }}
      scrollEventThrottle={16}
    >
      {/* Título da Tarefa */}
      <TextInput
        label="Nome da tarefa *"
        value={title}
        onChangeText={setTitle}
        placeholder="Ex: Pagar fatura do cartão"
        mode="outlined"
        outlineStyle={styles.roundedInputOutline}
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
                <Text variant="bodyMedium" style={{ color: '#b5b5b5', marginBottom: 4 }}>
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

          <Button
            mode="contained"
            icon="content-save-outline"
            onPress={saveTaskWithoutEditor}
            loading={isSaving}
            disabled={isSaving || Boolean(editingSubtaskId)}
            style={styles.saveTaskButton}
          >
            Salvar tarefa
          </Button>
        </Card.Content>
      </Card>

      {/* Editor visual de descrição e subtarefas */}
      <Card
        style={styles.cardSection}
        onLayout={({ nativeEvent }) => {
          detailsSectionYRef.current = nativeEvent.layout.y;
        }}
      >
        <Card.Content>
          <Text variant="titleMedium" style={[styles.sectionTitle, styles.editorTitle]}>
            Detalhes da Tarefa
          </Text>

          <RichToolbar
            editor={richEditorRef}
            actions={EDITOR_ACTIONS}
            iconMap={EDITOR_ICON_MAP}
            iconSize={32}
            iconGap={10}
            iconTint="#b5b5b5"
            selectedIconTint={theme.colors.primary}
            selectedButtonStyle={styles.toolbarButtonSelected}
            onInsertLink={() => setLinkDialogVisible(true)}
            style={styles.toolbarRow}
          />

          <View
            style={styles.richEditorFrame}
            onTouchStart={beginEditorGesture}
            onMoveShouldSetResponderCapture={shouldMoveEditorGestureToScreen}
            onResponderMove={moveScreenFromEditor}
          >
            <RichEditor
              ref={richEditorRef}
              initialContentHTML={markdownToEditorHtml(initialDetails)}
              initialHeight={220}
              useContainer={false}
              scrollEnabled
              placeholder="Escreva a descrição geral ou uma subtarefa..."
              onChange={handleEditorChange}
              onHeightChange={(height) => {
                editorContentHeightRef.current = height;
              }}
              onScroll={({ nativeEvent }) => {
                editorScrollYRef.current = nativeEvent.contentOffset.y;
              }}
              scrollEventThrottle={16}
              pasteAsPlainText
              defaultHttps
              style={styles.richEditor}
              editorStyle={RICH_EDITOR_STYLE}
            />
          </View>

          <View style={styles.editorActions}>
            <Button
              mode="outlined"
              icon="content-save-outline"
              onPress={saveEditorContent}
              loading={isSaving}
              disabled={isSaving}
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
                loading={isSaving}
                disabled={isSaving || !details.trim()}
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
              <View style={styles.subtaskActionsRow}>
                <Checkbox
                  status={s.completed ? 'checked' : 'unchecked'}
                  onPress={() => toggleSubtask(s.id)}
                  color={theme.colors.primary}
                  disabled={isSaving}
                />
                <View style={styles.subtaskActionsSpacer} />
                <IconButton
                  icon="pencil-outline"
                  size={20}
                  disabled={isSaving}
                  onPress={() => editSubtask(s, Boolean(editingSubtaskId))}
                />
                <IconButton
                  icon="delete-outline"
                  size={20}
                  disabled={isSaving}
                  iconColor={theme.colors.error}
                  onPress={() => removeSubtask(s.id)}
                />
              </View>
              <TouchableOpacity
                style={styles.subtaskMarkdownContainer}
                activeOpacity={0.75}
                onPress={() => selectSubtask(s)}
              >
                <Markdown style={s.completed ? completedMarkdownStyles : subtaskMarkdownStyles}>
                  {s.title}
                </Markdown>
              </TouchableOpacity>
            </View>
          ))}
        </Card.Content>
      </Card>

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

    <Portal>
      <Dialog visible={linkDialogVisible} onDismiss={() => setLinkDialogVisible(false)}>
        <Dialog.Title>Adicionar link</Dialog.Title>
        <Dialog.Content>
          <TextInput
            label="Endereço"
            value={linkUrl}
            onChangeText={setLinkUrl}
            mode="outlined"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
          />
        </Dialog.Content>
        <Dialog.Actions>
          <Button onPress={() => setLinkDialogVisible(false)}>Cancelar</Button>
          <Button onPress={insertEditorLink} disabled={!linkUrl.trim()}>Adicionar</Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
    </>
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
    backgroundColor: '#151515',
  },
  roundedInputOutline: {
    borderRadius: 12,
  },
  saveTaskButton: {
    marginTop: 14,
  },
  cardSection: {
    backgroundColor: '#151515',
    marginBottom: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#292929',
    elevation: 0,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  switchLabel: {
    fontWeight: '600',
    color: '#f5f5f5',
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
    backgroundColor: '#151515',
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
  sectionTitle: {
    fontWeight: '700',
    color: '#f5f5f5',
  },
  editorTitle: {
    marginBottom: 10,
  },
  toolbarRow: {
    backgroundColor: '#222222',
    borderRadius: 8,
    marginBottom: 8,
    elevation: 0,
  },
  toolbarLabel: {
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
  toolbarButtonSelected: {
    backgroundColor: '#404040',
    borderRadius: 6,
  },
  richEditorFrame: {
    backgroundColor: '#101010',
    height: 220,
    borderWidth: 1,
    borderColor: '#404040',
    borderRadius: 8,
    overflow: 'hidden',
  },
  richEditor: {
    height: 218,
    backgroundColor: '#101010',
  },
  editorActions: {
    gap: 6,
    marginTop: 10,
  },
  editorStatus: {
    color: '#a3a3a3',
    textAlign: 'center',
    marginTop: 2,
  },
  subtaskItemRow: {
    width: '100%',
    paddingVertical: 4,
    paddingHorizontal: 4,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#303030',
    borderRadius: 10,
    backgroundColor: '#151515',
  },
  subtaskActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 42,
  },
  subtaskActionsSpacer: {
    flex: 1,
  },
  subtaskItemSelected: {
    borderColor: '#a3a3a3',
    borderWidth: 2,
    backgroundColor: '#242424',
  },
  subtaskMarkdownContainer: {
    width: '100%',
    paddingHorizontal: 10,
    paddingBottom: 6,
    minHeight: 42,
  },
});

const markdownStyles = {
  body: {
    color: '#d4d4d4',
    fontSize: 14,
    lineHeight: 20,
  },
  heading1: {
    color: '#fafafa',
    fontWeight: '700',
    fontSize: 18,
    marginVertical: 4,
  },
  heading2: {
    color: '#f5f5f5',
    fontWeight: '600',
    fontSize: 16,
    marginVertical: 4,
  },
  code_inline: {
    backgroundColor: '#2a2a2a',
    borderRadius: 4,
    paddingHorizontal: 4,
  },
  link: {
    color: '#86efac',
  },
};

const subtaskMarkdownStyles = {
  ...markdownStyles,
  body: {
    ...markdownStyles.body,
    color: '#e5e5e5',
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
    color: '#737373',
    textDecorationLine: 'line-through',
  },
};

const EDITOR_ACTIONS = [
  actions.setBold,
  actions.setItalic,
  actions.insertBulletsList,
  actions.heading1,
  actions.heading2,
  actions.insertLink,
];

const EDITOR_ICON_MAP = {
  [actions.setBold]: ({ tintColor }) => (
    <Text style={[styles.toolbarLabel, { color: tintColor, fontWeight: '800' }]}>N</Text>
  ),
  [actions.setItalic]: ({ tintColor }) => (
    <Text style={[styles.toolbarLabel, { color: tintColor, fontStyle: 'italic', fontWeight: '600' }]}>I</Text>
  ),
  [actions.insertBulletsList]: ({ tintColor }) => (
    <Text style={[styles.toolbarLabel, { color: tintColor }]}>Lista</Text>
  ),
  [actions.heading1]: ({ tintColor }) => (
    <Text style={[styles.toolbarLabel, { color: tintColor }]}>H1</Text>
  ),
  [actions.heading2]: ({ tintColor }) => (
    <Text style={[styles.toolbarLabel, { color: tintColor }]}>H2</Text>
  ),
  [actions.insertLink]: ({ tintColor }) => (
    <Text style={[styles.toolbarLabel, { color: tintColor }]}>Link</Text>
  ),
};

const RICH_EDITOR_STYLE = {
  backgroundColor: '#101010',
  color: '#f5f5f5',
  caretColor: '#f5f5f5',
  placeholderColor: '#737373',
  contentCSSText: 'font-size: 16px; line-height: 1.45; padding: 10px 12px;',
};
