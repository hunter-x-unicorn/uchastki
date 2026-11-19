import React, { useState } from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import * as Linking from 'expo-linking';
import { Button, C, Sheet, s } from './ui';
export const DOWNLOAD_PAGE = 'https://github.com/hunter-x-unicorn/uchastki/releases/latest';
export function SharePanel({ onClose }: { onClose: () => void }) {
  const [instruction, setInstruction] = useState<'android' | 'ios' | null>(null);
  const [error, setError] = useState('');
  const open = (url: string) => {
    void Linking.openURL(url).catch(() =>
      setError('Не удалось открыть ссылку. Проверьте подключение к интернету.'),
    );
  };
  return (
    <Sheet title="Поделиться приложением" onClose={onClose}>
      <Text style={[s.body, { textAlign: 'center', marginBottom: 16 }]}>
        Отсканируйте QR-код камерой другого телефона
      </Text>
      <Image
        source={require('../assets/share-qr.png')}
        style={{ width: 220, height: 220, alignSelf: 'center', maxWidth: '100%' }}
        resizeMode="contain"
        accessibilityLabel="QR-код страницы скачивания для Android и iPhone"
      />
      <View style={{ gap: 14, marginVertical: 20 }}>
        {(
          [
            ['android', 'Инструкция для Android'],
            ['ios', 'Инструкция для iPhone'],
          ] as const
        ).map(([value, label]) => (
          <Pressable
            key={value}
            accessibilityRole="button"
            onPress={() => setInstruction(instruction === value ? null : value)}
            style={{ minHeight: 44, justifyContent: 'center' }}
          >
            <Text style={{ color: C.accent, textAlign: 'center', textDecorationLine: 'underline' }}>
              {label}
            </Text>
          </Pressable>
        ))}
      </View>
      {instruction === 'android' && (
        <Text style={[s.body, { marginBottom: 20 }]}>
          {
            '1. Откройте страницу скачивания и выберите APK.\n2. Откройте файл и разрешите установку для браузера, если Android запросит.\n3. После установки обновления загружаются внутри приложения. При обновлении APK устанавливайте поверх текущей версии.'
          }
        </Text>
      )}
      {instruction === 'ios' && (
        <>
          <Text style={[s.body, { marginBottom: 20 }]}>
            {
              'Для бесплатной установки нужен компьютер Windows или Mac.\n1. Скачайте IPA на компьютер.\n2. Установите Sideloadly с официального сайта и подключите iPhone кабелем.\n3. Перетащите IPA в Sideloadly, выберите телефон и войдите в свой Apple Account в Sideloadly.\n4. Подтвердите доверие разработчику и режим разработчика на iPhone, если система запросит.\nБесплатная подпись действует 7 дней. Включите автоматическое продление в Sideloadly: компьютер и телефон должны быть доступны для повторной подписи. Загрузка IPA в Safari сама приложение не устанавливает.'
            }
          </Text>
          <Button
            title="Официальный сайт Sideloadly"
            secondary
            onPress={() => open('https://sideloadly.io/')}
          />
        </>
      )}
      {!!error && <Text style={s.error}>{error}</Text>}
      <View style={{ marginTop: 14 }}>
        <Button title="Открыть страницу скачивания" onPress={() => open(DOWNLOAD_PAGE)} />
      </View>
    </Sheet>
  );
}
