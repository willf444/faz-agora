import React, { useEffect, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { Button, Card, Text, TextInput, useTheme } from 'react-native-paper';
import * as Clipboard from 'expo-clipboard';

import { supportService } from '../services/supportService';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function SupportSection() {
  const theme = useTheme();
  const [choice, setChoice] = useState(null);
  const [customAmount, setCustomAmount] = useState('');
  const [email, setEmail] = useState('');
  const [payment, setPayment] = useState(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const amount = choice === 'custom'
    ? Number(customAmount.replace(',', '.'))
    : choice;
  const validAmount = Number.isFinite(amount) && amount >= 1 && amount <= 1000;
  const validEmail = EMAIL_PATTERN.test(email.trim());

  useEffect(() => {
    if (!payment || payment.status === 'approved') return undefined;

    const timer = setInterval(async () => {
      try {
        const result = await supportService.getStatus(payment.id, payment.statusKey);
        if (result.status === 'approved') {
          setPayment(current => ({ ...current, status: 'approved' }));
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
        <Text variant="titleMedium" style={styles.title}>O Faz está sendo útil para você?</Text>
        <Text variant="bodySmall" style={styles.description}>
          Ele é gratuito, sem anúncios, sem rastreamento e sem venda de dados. Suas tarefas ficam no seu aparelho ou no servidor WebDAV escolhido por você.
        </Text>
        <Text variant="bodyMedium" style={styles.invitation}>
          Considere apoiar o projeto e ajudar a mantê-lo vivo.
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
  card: { backgroundColor: '#ffffff', borderRadius: 12, marginTop: 16 },
  title: { fontWeight: '700', marginBottom: 5 },
  description: { color: '#64748b', lineHeight: 18 },
  invitation: { marginTop: 9, marginBottom: 14 },
  amountRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  amountButton: { flex: 1 },
  input: { backgroundColor: '#ffffff', marginBottom: 7 },
  emailHint: { color: '#64748b', marginBottom: 12 },
  error: { marginTop: 10 },
  paymentBox: { alignItems: 'stretch', marginTop: 14 },
  qrCode: { width: 210, height: 210, alignSelf: 'center', marginBottom: 8 },
  waiting: { color: '#64748b', textAlign: 'center', marginBottom: 8 },
  pixCode: { backgroundColor: '#ffffff', maxHeight: 92, marginBottom: 10 },
  successBox: { backgroundColor: '#dcfce7', borderRadius: 10, padding: 14, marginTop: 14 },
  successTitle: { color: '#166534', fontWeight: '700', marginBottom: 3 },
});
