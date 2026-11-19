import React, { useState } from 'react';
import { Modal, Text, View } from 'react-native';
import { Button, s } from './ui';
export function UpdatePrompt({
  visible,
  onApply,
  onLater,
}: {
  visible: boolean;
  onApply: () => Promise<void>;
  onLater: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={() => {
        if (!busy) onLater();
      }}
    >
      <View style={s.dialogBackdrop}>
        <View accessibilityViewIsModal style={s.dialog}>
          <Text accessibilityRole="header" style={s.sheetTitle}>
            Доступно обновление
          </Text>
          <Text style={[s.body, { marginVertical: 20 }]}>
            Новая версия уже загружена. Обновите приложение, чтобы применить изменения.
          </Text>
          {!!error && <Text style={s.error}>{error}</Text>}
          <View style={{ gap: 10 }}>
            <Button
              title={busy ? 'Обновляем…' : 'Обновить сейчас'}
              disabled={busy}
              onPress={() => {
                setBusy(true);
                setError('');
                void onApply().catch(() => {
                  setError('Не удалось применить обновление. Повторите попытку.');
                  setBusy(false);
                });
              }}
            />
            <Button title="Позже" secondary disabled={busy} onPress={onLater} />
          </View>
        </View>
      </View>
    </Modal>
  );
}
