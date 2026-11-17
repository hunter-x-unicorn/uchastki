import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppData, EMPTY_DATA, parseBackup } from './model';

const KEY = 'uchastki:data:v1';
let queue: Promise<unknown> = Promise.resolve();

export async function loadData(): Promise<AppData> {
  const raw = await AsyncStorage.getItem(KEY);
  return raw === null ? EMPTY_DATA : parseBackup(raw);
}

// Serialize writes: an older save must never overwrite a newer edit.
export function saveData(data: AppData): Promise<void> {
  const serialized = JSON.stringify(data);
  const next = queue.catch(() => undefined).then(() => AsyncStorage.setItem(KEY, serialized));
  queue = next;
  return next;
}

export async function waitForSave() {
  await queue;
}
