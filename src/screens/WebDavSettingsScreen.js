import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { Button, Card, Switch, Text, TextInput, useTheme } from 'react-native-paper';

import { notificationService } from '../services/notificationService';
import { webDavService } from '../services/webDavService';
import SupportSection from '../components/SupportSection';

export default function WebDavSettingsScreen({ navigation }) {
  const theme = useTheme();
  const [url, setUrl] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [hasPassword, setHasPassword] = useState(false);
  const [autoSync, setAutoSync] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    webDavService.getConfig().then(config => {
      setUrl(config.url);
      setUsername(config.username);
      setHasPassword(config.hasPassword);
      setAutoSync(config.autoSync);
    });
  }, []);

  const saveAndSync = async () => {
    setSaving(true);
    try {
      await webDavService.saveConfig({ url, username, password, autoSync });
      const result = await webDavService.sync();
      if (result.changed) await notificationService.rescheduleTasks(result.tasks);
      setHasPassword(true);
      setPassword('');
      Alert.alert(
        'Sincronização concluída',
        result.uploaded ? 'As tarefas locais e remotas foram mescladas.' : 'As tarefas já estavam atualizadas.',
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } catch (error) {
      Alert.alert('Falha no WebDAV', error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Card style={styles.card}>
        <Card.Content>
          <Text variant="titleMedium" style={styles.title}>Sincronização WebDAV</Text>
          <Text variant="bodySmall" style={styles.description}>
            Informe a URL do seu servidor WebDAV. O arquivo task.json será criado automaticamente na primeira sincronização.
          </Text>

          <TextInput
            label="URL do servidor WebDAV"
            placeholder="https://servidor/caminho"
            value={url}
            onChangeText={setUrl}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            mode="outlined"
            style={styles.input}
          />
          <TextInput
            label="Usuário"
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            autoCorrect={false}
            mode="outlined"
            style={styles.input}
          />
          <TextInput
            label={hasPassword ? 'Senha (deixe vazia para manter)' : 'Senha'}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            mode="outlined"
            style={styles.input}
          />

          <View style={styles.switchRow}>
            <View style={styles.switchText}>
              <Text variant="bodyLarge">Sincronizar ao abrir</Text>
              <Text variant="bodySmall" style={styles.hint}>
                O botão de sync na tela inicial continuará disponível.
              </Text>
            </View>
            <Switch value={autoSync} onValueChange={setAutoSync} />
          </View>

          {url.startsWith('http://') && (
            <Text variant="bodySmall" style={{ color: theme.colors.error, marginBottom: 10 }}>
              HTTP não protege sua senha. Prefira sempre uma URL HTTPS.
            </Text>
          )}

          <Button
            mode="contained"
            icon="cloud-sync-outline"
            loading={saving}
            disabled={saving || !url.trim() || !username.trim() || (!password && !hasPassword)}
            onPress={saveAndSync}
          >
            Salvar e sincronizar
          </Button>
        </Card.Content>
      </Card>
      <SupportSection />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16 },
  card: {
    backgroundColor: '#151515',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#292929',
  },
  title: { fontWeight: '700', marginBottom: 4 },
  description: { color: '#a3a3a3', marginBottom: 14 },
  input: { backgroundColor: '#151515', marginBottom: 12 },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  switchText: { flex: 1, paddingRight: 12 },
  hint: { color: '#a3a3a3', marginTop: 2 },
});
