import { Platform } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';
import { File, Paths } from 'expo-file-system';
import { AppData, parseBackup, serializeBackup } from './model';

export async function exportBackup(data: AppData): Promise<void> {
  const name = `uchastki-${new Date().toISOString().slice(0, 10)}.json`;
  const content = serializeBackup(data);
  if (Platform.OS === 'web') {
    const url = URL.createObjectURL(new Blob([content], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return;
  }
  const file = new File(Paths.cache, name);
  await file.write(content);
  if (!(await Sharing.isAvailableAsync()))
    throw new Error('На устройстве недоступно сохранение через меню «Поделиться».');
  await Sharing.shareAsync(file.uri, {
    mimeType: 'application/json',
    UTI: 'public.json',
    dialogTitle: 'Сохранить резервную копию',
  });
}

export async function importBackup(): Promise<AppData | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: ['application/json', 'text/plain', 'application/octet-stream'],
    copyToCacheDirectory: true,
  });
  if (result.canceled || !result.assets[0]) return null;
  const asset = result.assets[0];
  if (asset.size && asset.size > 10 * 1024 * 1024)
    throw new Error('Файл слишком большой. Максимум — 10 МБ.');
  const content =
    Platform.OS === 'web'
      ? await (await fetch(asset.uri)).text()
      : await new File(asset.uri).text();
  return parseBackup(content);
}
