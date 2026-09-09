import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Platform,
  Alert,
  TouchableOpacity,
  Modal,
  SafeAreaView,
  KeyboardAvoidingView,
  Keyboard,
} from 'react-native';
import {
  TextInput,
  Button,
  Text,
  useTheme,
  Divider,
  IconButton,
  Checkbox,
  Menu,
  Switch,
  Card,
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
  const richEditorRef = useRef(null);
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
  const [editorStatus, setEditorStatus] = useState(
    'Use os botões acima para salvar o conteúdo.'
  );
  const [detailsEditorOpen, setDetailsEditorOpen] = useState(false);
  const [editorOpenSnapshot, setEditorOpenSnapshot] = useState(initialDetails);
  const [editorSessionKey, setEditorSessionKey] = useState(0);
  const [keyboardVisible, setKeyboardVisible] = useState(false);

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

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSubscription = Keyboard.addListener(showEvent, () => setKeyboardVisible(true));
    const hideSubscription = Keyboard.addListener(hideEvent, () => setKeyboardVisible(false));

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

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
    setDetails(savedDetails);
    setDetailsEditorOpen(false);
    setEditorStatus('✓ Subtarefa adicionada e tarefa salva.');
  };

  const finishSubtaskEdit = (status) => {
    setEditingSubtaskId(null);
    setDetails(savedDetails);
    setDetailsEditorOpen(false);
    setLinkDialogVisible(false);
    setEditorStatus(status);
  };

  const openDetailsEditor = () => {
    if (!title.trim()) {
      Alert.alert('Aviso', 'Digite o nome da tarefa antes de abrir os detalhes.');
      return;
    }
    setEditingSubtaskId(null);
    setDetails(savedDetails);
    setEditorOpenSnapshot(savedDetails);
    setEditorSessionKey(current => current + 1);
    setEditorStatus('Edite e escolha como salvar o conteúdo.');
    setDetailsEditorOpen(true);
  };

  const editSubtask = (subtask) => {
    setSelectedSubtaskId(subtask.id);
    setEditingSubtaskId(subtask.id);
    setDetails(subtask.title);
    setEditorOpenSnapshot(subtask.title);
    setEditorSessionKey(current => current + 1);
    setEditorStatus('Editando a subtarefa selecionada.');
    setDetailsEditorOpen(true);
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
  };

  const discardEditorChanges = () => {
    setDetailsEditorOpen(false);
    setLinkDialogVisible(false);
    setEditingSubtaskId(null);
    setDetails(savedDetails);
  };

  const requestCloseDetailsEditor = () => {
    if (linkDialogVisible) {
      setLinkDialogVisible(false);
      return;
    }

    if (details.trim() === editorOpenSnapshot.trim()) {
      discardEditorChanges();
      return;
    }

    Alert.alert(
      'Descartar detalhes da tarefa?',
      'As alterações feitas no editor ainda não foram salvas.',
      [
        { text: 'Não', style: 'cancel' },
        { text: 'Sim', style: 'destructive', onPress: discardEditorChanges },
      ]
    );
  };

  const runEditorAction = (action, selected) => {
    if (action === actions.insertLink) {
      setLinkDialogVisible(true);
      return;
    }

    const editor = richEditorRef.current;
    if (!editor) return;
    const shouldReturnToParagraph = selected
      && (action === actions.heading1 || action === actions.heading2);
    editor.showAndroidKeyboard();
    editor.sendAction(
      shouldReturnToParagraph ? actions.setParagraph : action,
      'result'
    );
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
    setEditorOpenSnapshot(details);
    setDetailsEditorOpen(false);
    setEditorStatus('✓ Descrição geral e tarefa salvas.');
  };

  const saveTaskWithoutEditor = async () => {
    if (!await persistTask(savedDetails, subtasks)) return;
    navigation.goBack();
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
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={styles.scrollContent}
      keyboardShouldPersistTaps="handled"
      nestedScrollEnabled
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

      {/* O editor abre em tela inteira para não disputar a rolagem da tarefa. */}
      <TouchableOpacity activeOpacity={0.78} onPress={openDetailsEditor}>
        <Card style={styles.cardSection}>
          <Card.Content style={styles.detailsLauncherContent}>
            <View style={styles.detailsLauncherHeader}>
              <Text variant="titleMedium" style={styles.sectionTitle}>
                Detalhes da Tarefa
              </Text>
              <IconButton icon="arrow-expand" size={21} style={styles.detailsLauncherIcon} />
            </View>
            <Text variant="bodyMedium" style={styles.detailsLauncherText}>
              {savedDetails.trim()
                ? 'Toque para visualizar ou editar a descrição em tela inteira.'
                : 'Toque para escrever uma descrição ou criar uma subtarefa.'}
            </Text>
          </Card.Content>
        </Card>
      </TouchableOpacity>

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
                  onPress={() => editSubtask(s)}
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

    <Modal
      visible={detailsEditorOpen}
      animationType="slide"
      presentationStyle="fullScreen"
      statusBarTranslucent={false}
      onRequestClose={requestCloseDetailsEditor}
    >
      <SafeAreaView style={styles.fullScreenEditorSafeArea}>
        <KeyboardAvoidingView
          style={styles.fullScreenEditor}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.fullScreenHeader}>
            <IconButton
              icon="arrow-left"
              size={24}
              accessibilityLabel="Voltar"
              onPress={requestCloseDetailsEditor}
            />
            <Text variant="titleLarge" style={styles.fullScreenTitle}>
              {editingSubtaskId ? 'Editar subtarefa' : 'Detalhes da Tarefa'}
            </Text>
          </View>

          <View style={styles.fullScreenEditorFrame}>
            <RichEditor
              key={editorSessionKey}
              ref={richEditorRef}
              initialContentHTML={markdownToEditorHtml(details)}
              initialFocus
              useContainer={false}
              scrollEnabled
              nestedScrollEnabled
              placeholder="Escreva a descrição geral ou uma subtarefa..."
              onChange={handleEditorChange}
              pasteAsPlainText
              defaultHttps
              style={styles.fullScreenRichEditor}
              editorStyle={RICH_EDITOR_STYLE}
            />
          </View>

          <RichToolbar
            editor={richEditorRef}
            actions={EDITOR_ACTIONS}
            iconTint="#b5b5b5"
            selectedIconTint="#090909"
            renderAction={(action, selected) => (
              <TouchableOpacity
                key={action}
                activeOpacity={0.72}
                accessibilityRole="button"
                accessibilityLabel={EDITOR_ACCESSIBILITY_LABELS[action]}
                onPress={() => runEditorAction(action, selected)}
                style={[
                  styles.formatButton,
                  selected && styles.formatButtonSelected,
                ]}
              >
                <Text
                  style={[
                    styles.formatButtonText,
                    action === actions.setBold && styles.boldFormatButtonText,
                    selected && styles.formatButtonTextSelected,
                  ]}
                >
                  {EDITOR_LABELS[action]}
                </Text>
              </TouchableOpacity>
            )}
            style={styles.fullScreenToolbar}
            flatContainerStyle={styles.fullScreenToolbarContent}
          />

          {linkDialogVisible && (
            <View style={styles.linkPanel}>
              <TextInput
                label="Endereço do link"
                value={linkUrl}
                onChangeText={setLinkUrl}
                mode="outlined"
                autoFocus
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                style={styles.linkInput}
              />
              <View style={styles.linkActions}>
                <Button mode="text" onPress={() => setLinkDialogVisible(false)}>
                  Cancelar
                </Button>
                <Button mode="contained" onPress={insertEditorLink} disabled={!linkUrl.trim()}>
                  Adicionar
                </Button>
              </View>
            </View>
          )}

          {!keyboardVisible && (
            <View style={styles.fullScreenActions}>
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
          )}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
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
  detailsLauncherContent: {
    paddingVertical: 12,
  },
  detailsLauncherHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  detailsLauncherIcon: {
    width: 34,
    height: 34,
    margin: 0,
    backgroundColor: '#222222',
  },
  detailsLauncherText: {
    color: '#a3a3a3',
    marginTop: 5,
    lineHeight: 20,
  },
  fullScreenEditorSafeArea: {
    flex: 1,
    backgroundColor: '#090909',
  },
  fullScreenEditor: {
    flex: 1,
    backgroundColor: '#090909',
  },
  fullScreenHeader: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#292929',
    paddingRight: 12,
  },
  fullScreenTitle: {
    color: '#f5f5f5',
    fontWeight: '700',
    flex: 1,
  },
  fullScreenEditorFrame: {
    flex: 1,
    minHeight: 160,
    marginHorizontal: 12,
    marginTop: 10,
    backgroundColor: '#101010',
    borderWidth: 1,
    borderColor: '#404040',
    borderRadius: 12,
    overflow: 'hidden',
  },
  fullScreenRichEditor: {
    flex: 1,
    backgroundColor: '#101010',
  },
  fullScreenToolbar: {
    height: 48,
    marginHorizontal: 12,
    marginTop: 8,
    backgroundColor: '#222222',
    borderRadius: 10,
  },
  fullScreenToolbarContent: {
    paddingHorizontal: 4,
  },
  formatButton: {
    minWidth: 48,
    height: 40,
    marginHorizontal: 2,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  formatButtonSelected: {
    backgroundColor: '#f5f5f5',
  },
  formatButtonText: {
    color: '#d4d4d4',
    fontSize: 14,
    fontWeight: '700',
  },
  boldFormatButtonText: {
    fontWeight: '900',
  },
  formatButtonTextSelected: {
    color: '#090909',
  },
  linkPanel: {
    marginHorizontal: 12,
    marginTop: 8,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#303030',
    backgroundColor: '#151515',
  },
  linkInput: {
    backgroundColor: '#151515',
  },
  linkActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 6,
  },
  fullScreenActions: {
    gap: 6,
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 10,
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

const EDITOR_LABELS = {
  [actions.setBold]: 'N',
  [actions.setItalic]: 'I',
  [actions.insertBulletsList]: 'Lista',
  [actions.heading1]: 'H1',
  [actions.heading2]: 'H2',
  [actions.insertLink]: 'Link',
};

const EDITOR_ACCESSIBILITY_LABELS = {
  [actions.setBold]: 'Negrito',
  [actions.setItalic]: 'Itálico',
  [actions.insertBulletsList]: 'Lista',
  [actions.heading1]: 'Título H1',
  [actions.heading2]: 'Título H2',
  [actions.insertLink]: 'Adicionar link',
};

const RICH_EDITOR_STYLE = {
  backgroundColor: '#101010',
  color: '#f5f5f5',
  caretColor: '#f5f5f5',
  placeholderColor: '#737373',
  contentCSSText: 'font-size: 16px; line-height: 1.45; padding: 10px 12px;',
};
