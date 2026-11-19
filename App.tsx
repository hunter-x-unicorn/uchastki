import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  Image,
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import * as Updates from 'expo-updates';
import {
  Apartment,
  ApartmentMarker,
  AppData,
  ArchiveEntry,
  EMPTY_DATA,
  Entrance,
  Territory,
  VisitResult,
  allApartments,
  createDemo,
  recordVisit,
  toggleApartmentMarker,
  updateApartment,
} from './src/model';
import { archiveEntity, restoreArchive, splitApartment } from './src/lifecycle';
import { loadData, saveData, waitForSave } from './src/storage';
import { exportBackup, importBackup } from './src/backup';
import { Editor, EntityEditor } from './src/EntityEditor';
import { ApartmentGrid } from './src/ApartmentGrid';
import { ApartmentMenu } from './src/ApartmentMenu';
import { SharePanel } from './src/SharePanel';
import { UpdatePrompt } from './src/UpdatePrompt';
import { Button, C, Empty, Icon, IconButton, Sheet, s } from './src/ui';

type Dialog = {
  title: string;
  message: string;
  action?: () => void | Promise<void>;
  actionLabel?: string;
  danger?: boolean;
};
type EntityMenu =
  | { kind: 'territory'; value: Territory }
  | { kind: 'entrance'; value: Entrance; territory: Territory };
function AppContent() {
  const [data, setData] = useState<AppData>(EMPTY_DATA);
  const dataRef = useRef(data);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [saveState, setSaveState] = useState<'saved' | 'saving' | 'error'>('saved');
  const revision = useRef(0);
  const router = useRouter();
  const params = useLocalSearchParams<{ territory?: string; entrance?: string }>();
  const territoryId = typeof params.territory === 'string' ? params.territory : undefined;
  const entranceId = typeof params.entrance === 'string' ? params.entrance : undefined;
  const territory = data.territories.find((t) => t.id === territoryId);
  const entrance = territory?.entrances.find((e) => e.id === entranceId);
  const navigate = useCallback(
    (territory?: string, entrance?: string) => router.setParams({ territory, entrance }),
    [router],
  );
  const [editor, setEditor] = useState<Editor | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = entrance?.apartments.find((a) => a.id === selectedId);
  const [menu, setMenu] = useState<EntityMenu | null>(null);
  const [settings, setSettings] = useState(false);
  const [archive, setArchive] = useState(false);
  const [share, setShare] = useState(false);
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState('');
  const [updateLater, setUpdateLater] = useState(false);
  const { isUpdatePending } = Updates.useUpdates();
  const scrollRef = useRef<React.ComponentRef<typeof ScrollView>>(null);
  useEffect(() => {
    loadData()
      .then((value) => {
        dataRef.current = value;
        setData(value);
        setLoaded(true);
      })
      .catch((error) => {
        setLoadError(String(error.message));
        setLoaded(true);
      });
  }, []);
  function persist(next: AppData) {
    dataRef.current = next;
    setData(next);
    setSaveState('saving');
    const current = ++revision.current;
    void saveData(next)
      .then(() => {
        if (revision.current === current) setSaveState('saved');
      })
      .catch(() => {
        if (revision.current === current) setSaveState('error');
      });
  }
  function safely(action: () => void) {
    try {
      action();
    } catch (error) {
      setDialog({
        title: 'Не удалось выполнить действие',
        message: error instanceof Error ? error.message : 'Попробуйте ещё раз.',
      });
    }
  }
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(''), 3000);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [territoryId, entranceId]);
  useEffect(() => {
    const listener = BackHandler.addEventListener('hardwareBackPress', () => {
      if (dialog) setDialog(null);
      else if (editor) setEditor(null);
      else if (selectedId) setSelectedId(null);
      else if (menu) setMenu(null);
      else if (share) setShare(false);
      else if (archive) setArchive(false);
      else if (settings) setSettings(false);
      else if (entrance) navigate(territoryId);
      else if (territory) navigate();
      else return false;
      return true;
    });
    return () => listener.remove();
  }, [
    dialog,
    editor,
    selectedId,
    menu,
    share,
    archive,
    settings,
    entrance,
    territory,
    territoryId,
    navigate,
  ]);
  function remove(kind: ArchiveEntry['kind'], tId: string, eId?: string, aId?: string) {
    setMenu(null);
    setSelectedId(null);
    setEditor(null);
    setDialog({
      title: kind === 'visits' ? 'Очистить посещения?' : 'Переместить в архив?',
      message:
        kind === 'visits'
          ? 'Статус и счётчики посещений будут очищены. Прежние отметки сохранятся в архиве. Заметки и сведения останутся в квартире.'
          : 'Запись и всё содержимое будут перемещены в архив. Их можно восстановить в настройках.',
      actionLabel: kind === 'visits' ? 'Очистить' : 'В архив',
      danger: true,
      action: () =>
        safely(() => {
          persist(archiveEntity(dataRef.current, kind, tId, eId, aId));
          if (kind === 'territory' && territoryId === tId) navigate();
          if (kind === 'entrance' && entranceId === eId) navigate(tId);
          setToast(kind === 'visits' ? 'Посещения очищены' : 'Перемещено в архив');
        }),
    });
  }
  function changeApartment(change: (apartment: Apartment) => Apartment) {
    if (!territory || !entrance || !selectedId) return;
    const current = dataRef.current.territories
      .find((t) => t.id === territory.id)
      ?.entrances.find((e) => e.id === entrance.id)
      ?.apartments.find((a) => a.id === selectedId);
    if (current)
      persist(
        updateApartment(dataRef.current, territory.id, entrance.id, current.id, change(current)),
      );
  }
  function markVisit(result: VisitResult) {
    changeApartment((a) => recordVisit(a, result));
    setSelectedId(null);
  }
  function toggleMarker(marker: ApartmentMarker) {
    changeApartment((a) => toggleApartmentMarker(a, marker));
  }
  function editApartment() {
    if (selected) {
      setEditor({ kind: 'apartment', existing: selected });
      setSelectedId(null);
    }
  }
  function saveEntity(value: Territory | Entrance | Apartment) {
    if (!editor) return;
    const latest = dataRef.current;
    if (editor.kind === 'territory') {
      const item = value as Territory;
      persist({
        ...latest,
        territories: editor.existing
          ? latest.territories.map((t) =>
              t.id === item.id ? { ...t, name: item.name, address: item.address } : t,
            )
          : [...latest.territories, item],
      });
      if (!editor.existing) navigate(item.id);
    } else if (editor.kind === 'entrance' && territory) {
      const item = value as Entrance;
      persist({
        ...latest,
        territories: latest.territories.map((t) =>
          t.id !== territory.id
            ? t
            : {
                ...t,
                entrances: editor.existing
                  ? t.entrances.map((e) => (e.id === item.id ? { ...e, name: item.name } : e))
                  : [...t.entrances, item],
              },
        ),
      });
      if (!editor.existing) navigate(territory.id, item.id);
    } else if (editor.kind === 'apartment' && territory && entrance) {
      const item = value as Apartment;
      persist({
        ...latest,
        territories: latest.territories.map((t) =>
          t.id !== territory.id
            ? t
            : {
                ...t,
                entrances: t.entrances.map((e) =>
                  e.id !== entrance.id
                    ? e
                    : {
                        ...e,
                        apartments: editor.existing
                          ? e.apartments.map((a) => (a.id === item.id ? item : a))
                          : [...e.apartments, item],
                      },
                ),
              },
        ),
      });
    }
    setEditor(null);
    setToast('Сохранено');
  }
  function editEntity(target: EntityMenu) {
    setMenu(null);
    if (target.kind === 'territory') {
      navigate(target.value.id);
      setEditor({ kind: 'territory', existing: target.value });
    } else {
      navigate(target.territory.id, target.value.id);
      setEditor({ kind: 'entrance', existing: target.value });
    }
  }
  async function runExport() {
    setBusy(true);
    try {
      await exportBackup(dataRef.current);
      setToast('Резервная копия подготовлена');
    } catch (error) {
      setSettings(false);
      setDialog({ title: 'Не удалось сохранить копию', message: String(error) });
    } finally {
      setBusy(false);
    }
  }
  async function runImport() {
    setBusy(true);
    try {
      const incoming = await importBackup();
      if (!incoming) return;
      setSettings(false);
      setDialog({
        title: 'Восстановить из копии?',
        message: 'Текущие участки будут сохранены в архиве, затем заменены данными из файла.',
        actionLabel: 'Восстановить',
        action: () =>
          safely(() => {
            let previous = dataRef.current;
            for (const t of previous.territories)
              previous = archiveEntity(previous, 'territory', t.id);
            const combined = [...incoming.archive, ...previous.archive];
            persist({
              ...incoming,
              archive: combined.filter(
                (entry, index) => combined.findIndex((other) => other.id === entry.id) === index,
              ),
            });
            setLoadError('');
            navigate();
            setToast('Данные восстановлены');
          }),
      });
    } catch (error) {
      setSettings(false);
      setDialog({
        title: 'Копия не загружена',
        message: error instanceof Error ? error.message : 'Не удалось прочитать файл.',
      });
    } finally {
      setBusy(false);
    }
  }
  async function applyUpdate() {
    await waitForSave();
    await Updates.reloadAsync();
  }
  if (!loaded)
    return (
      <View style={s.loading}>
        <ActivityIndicator color={C.accent} />
        <Text style={s.muted}>Открываем участки…</Text>
      </View>
    );
  return (
    <SafeAreaView style={s.root} edges={['top', 'bottom']}>
      <StatusBar style="dark" />
      <View style={s.topbar}>
        <View style={[s.topbarInner, { gap: 10, paddingHorizontal: 16 }]}>
          <Image
            source={require('./assets/icon.png')}
            style={{ width: 42, height: 42, borderRadius: 11 }}
            accessibilityLabel="Участки"
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Поделиться приложением с другими"
            onPress={() => setShare(true)}
            style={[s.flex, { minHeight: 44, justifyContent: 'center' }]}
          >
            <Text
              style={{ color: C.accentStrong, fontSize: 13, lineHeight: 17, fontWeight: '600' }}
            >
              Поделиться приложением с другими
            </Text>
          </Pressable>
          <IconButton
            name="ellipsis-horizontal"
            label="Настройки и резервная копия"
            onPress={() => setSettings(true)}
          />
        </View>
      </View>
      {loadError ? (
        <View style={[s.content, { paddingTop: 40, gap: 20 }]}>
          <Text style={s.sheetTitle}>Данные требуют внимания</Text>
          <Text style={s.body}>{loadError}</Text>
          <Button title="Загрузить резервную копию" onPress={() => void runImport()} />
        </View>
      ) : (
        <ScrollView ref={scrollRef} contentContainerStyle={{ paddingBottom: 30 }}>
          <View style={s.content}>
            {territory && (
              <View style={[s.inline, { marginVertical: 14, flexWrap: 'wrap' }]}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Все участки"
                  onPress={() => navigate()}
                  style={{ paddingVertical: 10 }}
                >
                  <Text style={s.backText}>Участки</Text>
                </Pressable>
                <Text style={s.muted}>/</Text>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => navigate(territory.id)}
                  style={{ paddingVertical: 10 }}
                >
                  <Text style={s.backText}>{territory.name}</Text>
                </Pressable>
                {entrance && (
                  <>
                    <Text style={s.muted}>/</Text>
                    <Text style={s.backText}>{entrance.name}</Text>
                  </>
                )}
              </View>
            )}
            <View style={[s.sectionHeading, { marginTop: territory ? 0 : 24 }]}>
              <Text style={s.sectionTitle}>
                {entrance ? 'Квартиры' : territory ? 'Подъезды' : 'Участки'}
              </Text>
              <View style={s.inline}>
                <Button
                  title="Добавить"
                  small
                  icon="add"
                  onPress={() =>
                    setEditor({
                      kind: entrance ? 'apartment' : territory ? 'entrance' : 'territory',
                    })
                  }
                />
                {territory && (
                  <IconButton
                    name="ellipsis-horizontal"
                    label={entrance ? 'Меню подъезда' : 'Меню участка'}
                    onPress={() =>
                      setMenu(
                        entrance
                          ? { kind: 'entrance', value: entrance, territory }
                          : { kind: 'territory', value: territory },
                      )
                    }
                  />
                )}
              </View>
            </View>
            {entrance ? (
              <>
                <ApartmentGrid
                  apartments={entrance.apartments}
                  onOpen={(a) => setSelectedId(a.id)}
                />
                {!entrance.apartments.length && (
                  <Empty
                    icon="grid-outline"
                    title="Квартир пока нет"
                    text="Добавьте квартиру и укажите её этаж."
                  />
                )}
              </>
            ) : territory ? (
              <>
                {territory.entrances.map((e) => (
                  <View key={e.id} style={[s.listCard, s.inline, { padding: 14 }]}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Открыть ${e.name}`}
                      onPress={() => navigate(territory.id, e.id)}
                      style={s.flex}
                    >
                      <Text style={s.cardTitle}>{e.name}</Text>
                      <Text style={s.cardSubtitle}>Квартир: {e.apartments.length}</Text>
                    </Pressable>
                    <IconButton
                      name="ellipsis-horizontal"
                      label={`Меню ${e.name}`}
                      onPress={() => setMenu({ kind: 'entrance', value: e, territory })}
                    />
                  </View>
                ))}
                {!territory.entrances.length && (
                  <Empty
                    icon="business-outline"
                    title="Добавьте первый подъезд"
                    text="Квартиры создадутся автоматически по этажам."
                  >
                    <Button
                      title="Создать подъезд"
                      onPress={() => setEditor({ kind: 'entrance' })}
                    />
                  </Empty>
                )}
              </>
            ) : (
              <>
                {data.territories.map((t) => (
                  <View key={t.id} style={[s.listCard, s.inline, { padding: 14 }]}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Открыть участок ${t.name}`}
                      onPress={() => navigate(t.id)}
                      style={s.flex}
                    >
                      <Text style={s.cardTitle}>{t.name}</Text>
                      <Text style={s.cardSubtitle}>
                        Подъездов: {t.entrances.length} · Квартир: {allApartments([t]).length}
                      </Text>
                    </Pressable>
                    <IconButton
                      name="ellipsis-horizontal"
                      label={`Меню участка ${t.name}`}
                      onPress={() => setMenu({ kind: 'territory', value: t })}
                    />
                  </View>
                ))}
                {!data.territories.length && (
                  <Empty
                    icon="map-outline"
                    title="Мои участки"
                    text="Создайте участок для начала обхода."
                  >
                    <Button
                      title="Создать первый участок"
                      onPress={() => setEditor({ kind: 'territory' })}
                    />
                    <Pressable
                      accessibilityRole="button"
                      onPress={() =>
                        persist({ ...dataRef.current, territories: createDemo().territories })
                      }
                      style={s.demoButton}
                    >
                      <Text style={s.demoText}>Открыть учебный пример</Text>
                    </Pressable>
                  </Empty>
                )}
              </>
            )}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Состояние сохранения"
              onPress={() => saveState === 'error' && persist(dataRef.current)}
              style={s.localInfo}
            >
              <Icon
                name={saveState === 'error' ? 'warning-outline' : 'checkmark-circle-outline'}
                size={15}
                color={saveState === 'error' ? C.red : C.muted}
              />
              <Text style={s.localInfoText}>
                {saveState === 'error'
                  ? 'Не сохранено. Нажмите для повтора'
                  : saveState === 'saving'
                    ? 'Сохраняем…'
                    : 'Сохранено на устройстве'}
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      )}
      {selected && (
        <ApartmentMenu
          key={selected.id}
          apartment={selected}
          onClose={() => setSelectedId(null)}
          onResult={markVisit}
          onEdit={editApartment}
          onToggleMarker={toggleMarker}
          onAction={(action) => {
            if (!territory || !entrance) return;
            if (action === 'split') {
              safely(() =>
                persist(splitApartment(dataRef.current, territory.id, entrance.id, selected.id)),
              );
              setSelectedId(null);
            } else
              remove(
                action === 'clear' ? 'visits' : 'apartment',
                territory.id,
                entrance.id,
                selected.id,
              );
          }}
        />
      )}
      {editor && (
        <EntityEditor
          key={`${editor.kind}:${editor.existing?.id ?? 'new'}`}
          editor={editor}
          territory={territory}
          entrance={entrance}
          onClose={() => setEditor(null)}
          onSave={saveEntity}
        />
      )}
      {menu && (
        <Sheet title={menu.value.name} onClose={() => setMenu(null)}>
          <View style={{ gap: 10 }}>
            <Button title="Переименовать" secondary onPress={() => editEntity(menu)} />
            <Button title="Изменить" secondary onPress={() => editEntity(menu)} />
            <Button
              title={menu.kind === 'territory' ? 'Удалить участок' : 'Удалить подъезд'}
              danger
              onPress={() =>
                remove(
                  menu.kind,
                  menu.kind === 'territory' ? menu.value.id : menu.territory.id,
                  menu.kind === 'entrance' ? menu.value.id : undefined,
                )
              }
            />
          </View>
        </Sheet>
      )}
      {settings && (
        <Sheet title="Данные и настройки" onClose={() => setSettings(false)}>
          <View style={{ gap: 12 }}>
            <Button
              title="Архив"
              icon="archive-outline"
              secondary
              onPress={() => {
                setSettings(false);
                setArchive(true);
              }}
            />
            <Button
              title={busy ? 'Подождите…' : 'Сохранить копию в файл'}
              disabled={busy || !!loadError}
              onPress={() => void runExport()}
            />
            <Button
              title="Восстановить из файла"
              secondary
              disabled={busy}
              onPress={() => void runImport()}
            />
            {isUpdatePending && (
              <Button
                title="Обновить приложение"
                onPress={() => {
                  setSettings(false);
                  setUpdateLater(false);
                }}
              />
            )}
          </View>
          <Text style={[s.smallMuted, { marginTop: 22 }]}>
            Посещения сохраняются без интернета. Удалённые записи находятся в архиве.
          </Text>
          <Text style={s.version}>Участки · 1.0.1</Text>
        </Sheet>
      )}
      {archive && (
        <Sheet title="Архив" onClose={() => setArchive(false)}>
          {!data.archive.length && <Text style={s.body}>Архив пуст</Text>}
          {data.archive.map((entry) => (
            <View key={entry.id} style={s.listCard}>
              <Text style={s.cardTitle}>
                {'number' in entry.value ? `Квартира ${entry.value.number}` : entry.value.name}
              </Text>
              <Text style={[s.smallMuted, { marginVertical: 10 }]}>
                {entry.kind === 'visits' ? 'Прежние посещения' : 'Удалённая запись'} ·{' '}
                {new Date(entry.deletedAt).toLocaleDateString('ru-RU')}
              </Text>
              <Button
                title="Восстановить"
                small
                secondary
                onPress={() => {
                  setArchive(false);
                  setDialog({
                    title: 'Восстановить запись?',
                    message:
                      entry.kind === 'visits'
                        ? 'Прежние статус и счётчики заменят текущие отметки. Текущие посещения сохранятся в архиве. Заметки останутся.'
                        : 'Запись вернётся в исходный участок и подъезд.',
                    actionLabel: 'Восстановить',
                    action: () =>
                      safely(() => {
                        persist(restoreArchive(dataRef.current, entry.id));
                        setToast('Восстановлено');
                      }),
                  });
                }}
              />
            </View>
          ))}
        </Sheet>
      )}
      {share && <SharePanel onClose={() => setShare(false)} />}
      {dialog && (
        <Modal visible transparent animationType="fade" onRequestClose={() => setDialog(null)}>
          <View style={s.dialogBackdrop}>
            <View accessibilityViewIsModal style={s.dialog}>
              <Text style={s.sheetTitle}>{dialog.title}</Text>
              <Text style={[s.body, { marginVertical: 22 }]}>{dialog.message}</Text>
              <View style={{ gap: 10 }}>
                {dialog.action && (
                  <Button
                    title={dialog.actionLabel ?? 'Продолжить'}
                    danger={dialog.danger}
                    onPress={() => {
                      const action = dialog.action;
                      setDialog(null);
                      void action?.();
                    }}
                  />
                )}
                <Button
                  title={dialog.action ? 'Отмена' : 'Понятно'}
                  secondary
                  onPress={() => setDialog(null)}
                />
              </View>
            </View>
          </View>
        </Modal>
      )}
      <UpdatePrompt
        visible={
          isUpdatePending &&
          !updateLater &&
          !dialog &&
          !editor &&
          !selected &&
          !menu &&
          !settings &&
          !share &&
          !archive
        }
        onApply={applyUpdate}
        onLater={() => setUpdateLater(true)}
      />
      {!!toast && (
        <View style={s.toast} pointerEvents="none">
          <Text style={s.toastText}>{toast}</Text>
        </View>
      )}
    </SafeAreaView>
  );
}
export default function App() {
  return (
    <SafeAreaProvider>
      <AppContent />
    </SafeAreaProvider>
  );
}
