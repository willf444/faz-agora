import React, { useEffect, useState } from 'react';
import { Image, Linking, StyleSheet, View } from 'react-native';
import { Button, Card, ProgressBar, Text, TextInput, useTheme } from 'react-native-paper';
import * as Clipboard from 'expo-clipboard';

import { supportService } from '../services/supportService';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const WHATS_MEN_URL = 'https://whats.men';
const PROJECT_URL = 'https://github.com/willf444/faz-agora';

export default function SupportSection() {
  const theme = useTheme();
  const [choice, setChoice] = useState(null);
  const [customAmount, setCustomAmount] = useState('');
  const [email, setEmail] = useState('');
  const [payment, setPayment] = useState(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [summary, setSummary] = useState({ raised: 0, goal: 500 });

  const amount = choice === 'custom'
    ? Number(customAmount.replace(',', '.'))
    : choice;
  const validAmount = Number.isFinite(amount) && amount >= 1 && amount <= 1000;
  const validEmail = EMAIL_PATTERN.test(email.trim());

  const loadSummary = async () => {
    try {
      const result = await supportService.getSummary();
      setSummary({
        raised: Math.max(0, Number(result.raised) || 0),
        goal: Math.max(1, Number(result.goal) || 500),
      });
    } catch (_) {
      // A meta continua visível mesmo quando o servidor estiver indisponível.
    }
  };

  useEffect(() => {
    loadSummary();
  }, []);

  useEffect(() => {
    if (!payment || payment.status === 'approved') return undefined;

    const timer = setInterval(async () => {
      try {
        const result = await supportService.getStatus(payment.id, payment.statusKey);
        if (result.status === 'approved') {
          setPayment(current => ({ ...current, status: 'approved' }));
          loadSummary();
        }
      } catch (_) {
        // A próxima verificação tenta novamente sem interromper o usuário.
      }
    }, 6000);

    return () => clearInterval(timer);
  }, [payment?.id, payment?.status, payment?.statusKey]);

  const selectAmount = value => {
    setChoice(value);
    setPayment(null);
    setError('');
    setCopied(false);
  };

  const createPix = async () => {
    setCreating(true);
    setError('');
    try {
      const result = await supportService.createPix(amount, email.trim());
      setPayment(result);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setCreating(false);
    }
  };

  const copyPix = async () => {
    await Clipboard.setStringAsync(payment.qrCode);
    setCopied(true);
  };

  return (
    <Card style={styles.card}>
      <Card.Content>
        <Text variant="titleMedium" style={styles.title}>Sobre o Faz agora!</Text>
        <Text variant="bodySmall" style={styles.description}>
          Este projeto é de um desenvolvedor independente e precisa da sua colaboração. Todo o código está disponível gratuitamente. Sem anúncio e sem rastreio, sua privacidade é preservada.
        </Text>
        <Text variant="bodySmall" style={styles.projectLink}>
          Link aberto do projeto:{' '}
          <Text style={styles.link} onPress={() => Linking.openURL(PROJECT_URL)}>
            github.com/willf444/faz-agora
          </Text>
        </Text>
        <Text variant="bodySmall" style={styles.developer}>Desenvolvedor: Willian Ferreira</Text>
        <Text variant="bodyMedium" style={styles.relatedTitle}>Conheça também whats.men</Text>
        <Text variant="bodySmall" style={styles.description}>
          Um link inteligente para o seu negócio. Um projeto para divulgar redes sociais e contatos.
        </Text>
        <Button mode="outlined" icon="open-in-new" onPress={() => Linking.openURL(WHATS_MEN_URL)} style={styles.relatedButton}>
          Conhecer o whats.men
        </Button>
        <Text variant="bodyMedium" style={styles.invitation}>
          Considere fazer uma doação.
        </Text>

        <Text variant="labelLarge" style={styles.goalLabel}>
          Meta mensal: R$ {summary.raised.toFixed(2).replace('.', ',')} de R$ {summary.goal.toFixed(2).replace('.', ',')}
        </Text>
        <ProgressBar
          progress={Math.min(summary.raised / summary.goal, 1)}
          color="#22c55e"
          style={styles.progress}
        />
        <Text variant="bodySmall" style={styles.costs}>
          VPS: R$ 50,00{`\n`}Domínio: R$ 5,00{`\n`}IA: R$ 100,00{`\n`}Luz: R$ 20,00{`\n`}Café pro dev :D — R$ 325,00
        </Text>

        <View style={styles.amountRow}>
          <Button mode={choice === 10 ? 'contained' : 'outlined'} onPress={() => selectAmount(10)} style={styles.amountButton}>R$ 10</Button>
          <Button mode={choice === 50 ? 'contained' : 'outlined'} onPress={() => selectAmount(50)} style={styles.amountButton}>R$ 50</Button>
          <Button mode={choice === 'custom' ? 'contained' : 'outlined'} onPress={() => selectAmount('custom')} style={styles.amountButton}>Livre</Button>
        </View>

        {choice === 'custom' && (
          <TextInput
            label="Valor do apoio"
            value={customAmount}
            onChangeText={setCustomAmount}
            keyboardType="decimal-pad"
            left={<TextInput.Affix text="R$" />}
            mode="outlined"
            style={styles.input}
          />
        )}

        {choice !== null && !payment && (
          <>
            <TextInput
              label="Seu e-mail"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              mode="outlined"
              style={styles.input}
            />
            <Text variant="bodySmall" style={styles.emailHint}>
              Necessário para gerar o Pix no Mercado Pago.
            </Text>
            <Button
              mode="contained"
              icon="qrcode"
              loading={creating}
              disabled={creating || !validAmount || !validEmail}
              onPress={createPix}
            >
              Gerar Pix
            </Button>
          </>
        )}

        {error ? <Text variant="bodySmall" style={[styles.error, { color: theme.colors.error }]}>{error}</Text> : null}

        {payment?.status === 'approved' ? (
          <View style={styles.successBox}>
            <Text variant="titleMedium" style={styles.successTitle}>Obrigado pelo seu apoio!</Text>
            <Text variant="bodyMedium">Sua contribuição ajuda a manter esse projeto.</Text>
          </View>
        ) : payment ? (
          <View style={styles.paymentBox}>
            {payment.qrCodeBase64 ? (
              <Image source={{ uri: `data:image/png;base64,${payment.qrCodeBase64}` }} style={styles.qrCode} />
            ) : null}
            <Text variant="bodySmall" style={styles.waiting}>Aguardando o pagamento...</Text>
            <TextInput value={payment.qrCode} editable={false} multiline mode="outlined" style={styles.pixCode} />
            <Button mode="contained" icon="content-copy" onPress={copyPix}>
              {copied ? 'Código copiado' : 'Copiar código Pix'}
            </Button>
          </View>
        ) : null}
      </Card.Content>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#151515',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#292929',
    marginTop: 16,
  },
  title: { fontWeight: '700', marginBottom: 5 },
  description: { color: '#a3a3a3', lineHeight: 18 },
  projectLink: { color: '#a3a3a3', marginTop: 8 },
  link: { color: '#d4d4d4', textDecorationLine: 'underline' },
  developer: { color: '#a3a3a3', marginTop: 4 },
  relatedTitle: { fontWeight: '700', marginTop: 14, marginBottom: 4 },
  relatedButton: { marginTop: 10 },
  invitation: { marginTop: 9, marginBottom: 14 },
  goalLabel: { marginBottom: 7 },
  progress: { height: 8, borderRadius: 4, marginBottom: 8 },
  costs: { color: '#a3a3a3', lineHeight: 18, marginBottom: 14 },
  amountRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  amountButton: { flex: 1 },
  input: { backgroundColor: '#151515', marginBottom: 7 },
  emailHint: { color: '#a3a3a3', marginBottom: 12 },
  error: { marginTop: 10 },
  paymentBox: { alignItems: 'stretch', marginTop: 14 },
  qrCode: { width: 210, height: 210, alignSelf: 'center', marginBottom: 8 },
  waiting: { color: '#a3a3a3', textAlign: 'center', marginBottom: 8 },
  pixCode: { backgroundColor: '#151515', maxHeight: 92, marginBottom: 10 },
  successBox: { backgroundColor: '#12301d', borderRadius: 10, padding: 14, marginTop: 14 },
  successTitle: { color: '#86efac', fontWeight: '700', marginBottom: 3 },
});
