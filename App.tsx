import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import * as Updates from 'expo-updates';
import {
  Apartment,
  ApartmentStatus,
  AppData,
  EMPTY_DATA,
  Entrance,
  STATUS,
  Territory,
  allApartments,
  createDemo,
  stats,
  updateApartment,
} from './src/model';
import { loadData, saveData, waitForSave } from './src/storage';
import { exportBackup, importBackup } from './src/backup';
import { Editor, EntityEditor } from './src/EntityEditor';
import { Button, C, Empty, Icon, IconButton, Progress, Sheet, s } from './src/ui';

type Dialog = {
  title: string;
  message: string;
  action?: () => void | Promise<void>;
  actionLabel?: string;
  danger?: boolean;
};

function AppContent() {
  const { width } = useWindowDimensions();
  const [data, setData] = useState<AppData>(EMPTY_DATA);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [saveState, setSaveState] = useState<'saved' | 'saving' | 'error'>('saved');
  const router = useRouter();
  const selection = useLocalSearchParams<{ territory?: string; entrance?: string }>();
  const territoryId = typeof selection.territory === 'string' ? selection.territory : null;
  const entranceId = typeof selection.entrance === 'string' ? selection.entrance : null;
  const setTerritoryId = useCallback(
    (value: string | null) =>
      router.setParams({ territory: value ?? undefined, entrance: undefined }),
    [router],
  );
  const setEntranceId = useCallback(
    (value: string | null) => router.setParams({ entrance: value ?? undefined }),
    [router],
  );
  const [editor, setEditor] = useState<Editor | null>(null);
  const [settings, setSettings] = useState(false);
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<ApartmentStatus | 'all'>('all');
  const [descending, setDescending] = useState(false);
  const [toast, setToast] = useState('');
  const [busy, setBusy] = useState(false);
  const revision = useRef(0);
  const dataRef = useRef(data);
  const scrollRef = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const { isUpdatePending } = Updates.useUpdates();
  const territory = data.territories.find((t) => t.id === territoryId);
  const entrance = territory?.entrances.find((e) => e.id === entranceId);
  const apartments = useMemo(
    () =>
      entrance?.apartments ??
      (territory ? allApartments([territory]) : allApartments(data.territories)),
    [data, territory, entrance],
  );
  const count = stats(apartments);
  const columns = width > 900 ? 4 : width > 620 ? 3 : 2;
  const tileWidth = (Math.min(width, 1040) - 40 - 12 * (columns - 1)) / columns;

  useEffect(() => {
    loadData()
      .then((value) => {
        dataRef.current = value;
        setData(value);
        setLoaded(true);
      })
      .catch((error) => {
        setLoadError(error instanceof Error ? error.message : 'Не удалось прочитать данные.');
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
  useEffect(() => {
    if (!toast) return;
    const timeout = setTimeout(() => setToast(''), 3200);
    return () => clearTimeout(timeout);
  }, [toast]);
  useEffect(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [territoryId, entranceId]);
  const goBack = useCallback(() => {
    setQuery('');
    setFilter('all');
    if (entranceId) setEntranceId(null);
    else setTerritoryId(null);
  }, [entranceId, setEntranceId, setTerritoryId]);
  useEffect(() => {
    const listener = BackHandler.addEventListener('hardwareBackPress', () => {
      if (editor) {
        setEditor(null);
        return true;
      }
      if (settings) {
        setSettings(false);
        return true;
      }
      if (entranceId || territoryId) {
        goBack();
        return true;
      }
      return false;
    });
    return () => listener.remove();
  }, [territoryId, entranceId, editor, settings, goBack]);

  async function runExport() {
    setBusy(true);
    try {
      await exportBackup(dataRef.current);
      setToast(Platform.OS === 'web' ? 'Резервная копия скачана' : 'Резервная копия подготовлена');
    } catch (e) {
      setSettings(false);
      setDialog({
        title: 'Не удалось сохранить копию',
        message: e instanceof Error ? e.message : 'Попробуйте ещё раз.',
      });
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
        message: `В файле участков: ${incoming.territories.length}, квартир: ${allApartments(incoming.territories).length}. Текущие данные будут заменены. Если они нужны, сначала сохраните свою копию.`,
        actionLabel: 'Восстановить',
        action: () => {
          persist(incoming);
          setLoadError('');
          setTerritoryId(null);
          setEntranceId(null);
          setQuery('');
          setToast('Данные восстановлены');
        },
      });
    } catch (e) {
      setSettings(false);
      setDialog({
        title: 'Копия не загружена',
        message: `${e instanceof Error ? e.message : 'Не удалось прочитать файл.'} Текущие данные не изменены.`,
      });
    } finally {
      setBusy(false);
    }
  }
  function removeCurrent(kind: Editor['kind'], apartmentId?: string) {
    const target =
      kind === 'territory'
        ? territory?.name
        : kind === 'entrance'
          ? entrance?.name
          : `квартиру ${entrance?.apartments.find((a) => a.id === apartmentId)?.number}`;
    setEditor(null);
    setDialog({
      title: 'Удалить данные?',
      message: `Удалить «${target}»${kind !== 'apartment' ? ' и все записи внутри' : ''}? Отменить действие можно только восстановлением из резервной копии.`,
      danger: true,
      actionLabel: 'Удалить',
      action: () => {
        const latest = dataRef.current;
        if (kind === 'territory') {
          persist({
            ...latest,
            territories: latest.territories.filter((t) => t.id !== territoryId),
          });
          setTerritoryId(null);
          setEntranceId(null);
        } else if (kind === 'entrance') {
          persist({
            ...latest,
            territories: latest.territories.map((t) =>
              t.id !== territoryId
                ? t
                : { ...t, entrances: t.entrances.filter((e) => e.id !== entranceId) },
            ),
          });
          setEntranceId(null);
        } else
          persist({
            ...latest,
            territories: latest.territories.map((t) =>
              t.id !== territoryId
                ? t
                : {
                    ...t,
                    entrances: t.entrances.map((e) =>
                      e.id !== entranceId
                        ? e
                        : { ...e, apartments: e.apartments.filter((a) => a.id !== apartmentId) },
                    ),
                  },
            ),
          });
        setToast('Запись удалена');
      },
    });
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
      if (!editor.existing) setTerritoryId(item.id);
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
      if (!editor.existing) setEntranceId(item.id);
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
  function quickStatus(apartment: Apartment, status: ApartmentStatus) {
    if (territory && entrance)
      persist(
        updateApartment(dataRef.current, territory.id, entrance.id, apartment.id, { status }),
      );
  }
  const visible =
    entrance?.apartments.filter(
      (a) =>
        (filter === 'all' || a.status === filter) &&
        (!query.trim() ||
          `${a.number} ${a.note}`
            .toLocaleLowerCase('ru')
            .includes(query.trim().toLocaleLowerCase('ru'))),
    ) ?? [];
  const floors = [...new Set(visible.map((a) => a.floor))].sort((a, b) =>
    descending ? b - a : a - b,
  );
  if (!loaded)
    return (
      <View style={s.loading}>
        <ActivityIndicator color={C.green} size="large" />
        <Text style={s.muted}>Открываем участки…</Text>
      </View>
    );

  return (
    <SafeAreaView style={s.root} edges={['top', 'bottom']}>
      <StatusBar style="dark" />
      <View style={s.topbar}>
        <View style={s.topbarInner}>
          <View style={s.inline}>
            <View style={s.logo}>
              <Icon name="grid-outline" color="#FFFFFF" size={21} />
            </View>
            <View>
              <Text style={s.brand}>Участки</Text>
              <Text style={s.brandSub}>Журнал обхода</Text>
            </View>
          </View>
          <View style={s.inline}>
            <Pressable
              onPress={() => saveState === 'error' && persist(dataRef.current)}
              accessibilityRole="button"
              accessibilityLabel={
                saveState === 'error' ? 'Ошибка сохранения. Повторить' : 'Состояние сохранения'
              }
              style={s.saveBadge}
            >
              <Icon
                name={
                  saveState === 'error'
                    ? 'warning-outline'
                    : saveState === 'saving'
                      ? 'sync-outline'
                      : 'checkmark-circle-outline'
                }
                color={saveState === 'error' ? C.red : C.green}
                size={15}
              />
              <Text style={[s.saveText, saveState === 'error' && { color: C.red }]}>
                {saveState === 'error'
                  ? 'Повторить'
                  : saveState === 'saving'
                    ? 'Сохраняем'
                    : 'Сохранено'}
              </Text>
            </Pressable>
            <IconButton
              name="options-outline"
              label="Настройки и резервная копия"
              onPress={() => setSettings(true)}
            />
          </View>
        </View>
      </View>
      {isUpdatePending && (
        <Pressable
          accessibilityRole="button"
          onPress={async () => {
            try {
              await waitForSave();
              await Updates.reloadAsync();
            } catch {
              setDialog({
                title: 'Обновление отложено',
                message: 'Сначала сохраните данные и повторите попытку.',
              });
            }
          }}
          style={s.updateBanner}
        >
          <Icon name="refresh" color={C.green} size={18} />
          <Text style={s.updateText}>Новая версия готова. Нажмите, чтобы обновить.</Text>
        </Pressable>
      )}
      {loadError ? (
        <View style={[s.content, { gap: 20, paddingTop: 60 }]}>
          <Icon name="shield-outline" size={44} color={C.amber} />
          <Text style={s.title}>Данные требуют внимания</Text>
          <Text style={s.body}>
            {loadError} Исходная запись на устройстве не будет перезаписана автоматически.
          </Text>
          <Button
            title="Загрузить резервную копию"
            icon="cloud-upload-outline"
            onPress={() => void runImport()}
            disabled={busy}
          />
          <Button
            title="Начать заново"
            secondary
            onPress={() =>
              setDialog({
                title: 'Начать заново?',
                message: 'Повреждённая запись на этом устройстве будет заменена пустым журналом.',
                actionLabel: 'Начать заново',
                danger: true,
                action: () => {
                  persist(EMPTY_DATA);
                  setLoadError('');
                },
              })
            }
          />
        </View>
      ) : (
        <ScrollView
          ref={scrollRef}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: 30 }}
        >
          <View style={s.content}>
            {territory && (
              <Pressable accessibilityRole="button" onPress={goBack} style={s.back}>
                <Icon name="arrow-back" size={18} color={C.green} />
                <Text style={s.backText}>{entrance ? territory.name : 'Все участки'}</Text>
              </Pressable>
            )}
            <View style={s.pageHeading}>
              <View style={s.flex}>
                <Text style={s.eyebrow}>
                  {entrance
                    ? 'КВАРТИРЫ ПО ЭТАЖАМ'
                    : territory
                      ? 'ВАШ УЧАСТОК'
                      : 'ПОРЯДОК В КАЖДОМ ОБХОДЕ'}
                </Text>
                <Text accessibilityRole="header" style={s.title}>
                  {entrance?.name ?? territory?.name ?? 'Мои участки'}
                </Text>
                <Text style={s.subtitle}>
                  {entrance
                    ? `${territory?.name}${territory?.address ? ` · ${territory.address}` : ''}`
                    : territory
                      ? territory.address || 'Подъезды, квартиры и результаты обхода'
                      : 'Всё нужное — под рукой, даже без интернета.'}
                </Text>
              </View>
              {territory && (
                <IconButton
                  name="ellipsis-horizontal"
                  label={entrance ? 'Редактировать подъезд' : 'Редактировать участок'}
                  onPress={() =>
                    setEditor(
                      entrance
                        ? { kind: 'entrance', existing: entrance }
                        : { kind: 'territory', existing: territory },
                    )
                  }
                />
              )}
            </View>
            <View style={s.summary}>
              <View style={[s.inline, { justifyContent: 'space-between', marginBottom: 20 }]}>
                <View style={s.flex}>
                  <Text style={s.summaryEyebrow}>РЕЗУЛЬТАТЫ ОБХОДА</Text>
                  <Text style={s.summaryTitle}>
                    {count.total
                      ? `${Math.round((count.visited / count.total) * 100)}% квартир пройдено`
                      : 'Начнём с первого участка'}
                  </Text>
                </View>
                <View style={s.summaryIcon}>
                  <Icon
                    name={count.total ? 'footsteps-outline' : 'home-outline'}
                    size={25}
                    color="#DCE8CD"
                  />
                </View>
              </View>
              <View style={s.counters}>
                {[
                  { value: count.total, label: 'Всего квартир' },
                  { value: count.visited, label: 'Пройдены', dot: '#BFD6AA' },
                  { value: count.absent, label: 'Никого нет', dot: '#E4BD7E' },
                ].map((c) => (
                  <View key={c.label} style={s.counter}>
                    <Text style={s.counterValue}>{c.value}</Text>
                    <View style={s.inline}>
                      {c.dot && <View style={[s.dot, { backgroundColor: c.dot }]} />}
                      <Text style={s.counterLabel}>{c.label}</Text>
                    </View>
                  </View>
                ))}
              </View>
              {!!count.total && (
                <View style={[s.progress, { backgroundColor: '#45604B', marginTop: 20 }]}>
                  <View
                    style={{
                      width: `${(count.visited / count.total) * 100}%`,
                      backgroundColor: '#BFD6AA',
                    }}
                  />
                  <View
                    style={{
                      width: `${(count.absent / count.total) * 100}%`,
                      backgroundColor: '#E4BD7E',
                    }}
                  />
                </View>
              )}
            </View>
            <View style={s.sectionHeading}>
              <View style={s.inline}>
                <Text style={s.sectionTitle}>
                  {entrance ? 'Квартиры' : territory ? 'Подъезды' : 'Участки'}
                </Text>
                <View style={s.countBadge}>
                  <Text style={s.countBadgeText}>
                    {entrance
                      ? entrance.apartments.length
                      : territory
                        ? territory.entrances.length
                        : data.territories.length}
                  </Text>
                </View>
              </View>
              <Button
                small
                title="Добавить"
                icon="add"
                onPress={() =>
                  setEditor({ kind: entrance ? 'apartment' : territory ? 'entrance' : 'territory' })
                }
              />
            </View>
            {entrance ? (
              <>
                <View style={s.search}>
                  <Icon name="search-outline" color={C.muted} />
                  <TextInput
                    accessibilityLabel="Поиск квартиры или заметки"
                    placeholder="Номер квартиры или заметка"
                    placeholderTextColor="#92998C"
                    style={s.searchInput}
                    value={query}
                    onChangeText={setQuery}
                  />
                  {!!query && (
                    <IconButton
                      name="close-circle"
                      label="Очистить поиск"
                      onPress={() => setQuery('')}
                    />
                  )}
                </View>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={s.filters}
                >
                  {(['all', 'unvisited', 'visited', 'absent'] as const).map((value) => (
                    <Pressable
                      key={value}
                      accessibilityRole="button"
                      accessibilityState={{ selected: filter === value }}
                      onPress={() => setFilter(value)}
                      style={[s.filter, filter === value && s.filterActive]}
                    >
                      <Text style={[s.filterText, filter === value && s.filterTextActive]}>
                        {value === 'all'
                          ? `Все · ${count.total}`
                          : `${STATUS[value].short} · ${count[value]}`}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
                <View
                  style={[
                    s.inline,
                    { justifyContent: 'space-between', marginTop: 8, marginBottom: 16 },
                  ]}
                >
                  <Text style={s.smallMuted}>Нажмите на квартиру, чтобы добавить заметку</Text>
                  <IconButton
                    name={descending ? 'arrow-down' : 'arrow-up'}
                    label="Изменить порядок этажей"
                    onPress={() => setDescending(!descending)}
                  />
                </View>
                {floors.map((floor) => (
                  <View key={floor} style={s.floorSection}>
                    <View style={s.floorHeading}>
                      <Text style={s.floorTitle}>
                        {floor === 0 ? 'Цокольный этаж' : `${floor} этаж`}
                      </Text>
                      <View style={s.floorLine} />
                      <Text style={s.smallMuted}>
                        {visible.filter((a) => a.floor === floor).length} кв.
                      </Text>
                    </View>
                    <View style={s.apartmentGrid}>
                      {visible
                        .filter((a) => a.floor === floor)
                        .sort((a, b) => a.number.localeCompare(b.number, 'ru', { numeric: true }))
                        .map((a) => (
                          <View
                            key={a.id}
                            style={[
                              s.apartmentCard,
                              { width: tileWidth },
                              a.status === 'visited' && { borderColor: '#D2E0CB' },
                              a.status === 'absent' && { borderColor: '#EADABF' },
                            ]}
                          >
                            <Pressable
                              accessibilityRole="button"
                              accessibilityLabel={`Квартира ${a.number}, ${STATUS[a.status].label}${a.note ? ', есть заметка' : ''}`}
                              onPress={() => setEditor({ kind: 'apartment', existing: a })}
                              style={s.apartmentMain}
                            >
                              <View
                                style={[
                                  s.inline,
                                  { justifyContent: 'space-between', alignItems: 'flex-start' },
                                ]}
                              >
                                <View style={s.flex}>
                                  <Text style={s.apartmentLabel}>КВАРТИРА</Text>
                                  <Text style={s.apartmentNumber} numberOfLines={1}>
                                    {a.number}
                                  </Text>
                                </View>
                                {a.note ? (
                                  <View style={s.noteDot}>
                                    <Icon name="document-text-outline" size={16} color={C.green} />
                                  </View>
                                ) : (
                                  <Icon name="chevron-forward" size={16} color="#BCC3B6" />
                                )}
                              </View>
                              <View
                                style={[
                                  s.statusBadge,
                                  { backgroundColor: STATUS[a.status].background },
                                ]}
                              >
                                <View
                                  style={[
                                    s.dot,
                                    {
                                      backgroundColor: STATUS[a.status].color,
                                      width: 5,
                                      height: 5,
                                    },
                                  ]}
                                />
                                <Text
                                  numberOfLines={2}
                                  style={[s.statusLabel, { color: STATUS[a.status].color }]}
                                >
                                  {STATUS[a.status].label}
                                </Text>
                              </View>
                              {!!a.note && (
                                <Text style={s.apartmentNote} numberOfLines={2}>
                                  {a.note}
                                </Text>
                              )}
                            </Pressable>
                            <View style={s.quickActions}>
                              <Pressable
                                accessibilityRole="button"
                                accessibilityLabel={`Отметить квартиру ${a.number} пройденной`}
                                accessibilityState={{ selected: a.status === 'visited' }}
                                onPress={() => quickStatus(a, 'visited')}
                                style={[
                                  s.quickButton,
                                  a.status === 'visited' && { backgroundColor: '#E8F0E5' },
                                ]}
                              >
                                <Icon name="checkmark" size={18} color={C.green} />
                                <Text style={s.quickLabel}>Пройдена</Text>
                              </Pressable>
                              <View style={s.quickDivider} />
                              <Pressable
                                accessibilityRole="button"
                                accessibilityLabel={`Квартира ${a.number}: никого не застали`}
                                accessibilityState={{ selected: a.status === 'absent' }}
                                onPress={() => quickStatus(a, 'absent')}
                                style={[
                                  s.quickButton,
                                  a.status === 'absent' && { backgroundColor: '#FBF0DD' },
                                ]}
                              >
                                <Icon name="time-outline" size={18} color={C.amber} />
                              </Pressable>
                            </View>
                          </View>
                        ))}
                    </View>
                  </View>
                ))}
                {!floors.length && (
                  <Empty
                    icon="search-outline"
                    title={entrance.apartments.length ? 'Ничего не найдено' : 'Квартир пока нет'}
                    text={
                      entrance.apartments.length
                        ? 'Измените поиск или выберите другой статус.'
                        : 'Добавьте квартиру и укажите её этаж.'
                    }
                  >
                    {!!entrance.apartments.length && (
                      <Button
                        title="Сбросить фильтры"
                        secondary
                        onPress={() => {
                          setQuery('');
                          setFilter('all');
                        }}
                      />
                    )}
                  </Empty>
                )}
              </>
            ) : territory ? (
              <>
                {territory.entrances.map((e) => {
                  const result = stats(e.apartments);
                  const numbers = e.apartments
                    .map((a) => a.number)
                    .sort((a, b) => a.localeCompare(b, 'ru', { numeric: true }));
                  return (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Открыть ${e.name}`}
                      key={e.id}
                      onPress={() => {
                        setEntranceId(e.id);
                        setQuery('');
                        setFilter('all');
                      }}
                      style={({ pressed }) => [s.listCard, pressed && { opacity: 0.75 }]}
                    >
                      <View style={s.cardHeader}>
                        <View style={s.cardIcon}>
                          <Icon name="business-outline" size={25} color={C.green} />
                        </View>
                        <View style={s.flex}>
                          <Text style={s.cardTitle}>{e.name}</Text>
                          <Text style={s.cardSubtitle}>
                            {numbers.length
                              ? `Квартиры ${numbers[0]}–${numbers[numbers.length - 1]} · Этажей: ${new Set(e.apartments.map((a) => a.floor)).size}`
                              : 'Квартир пока нет'}
                          </Text>
                        </View>
                        <Icon name="chevron-forward" color={C.muted} />
                      </View>
                      <Progress apartments={e.apartments} />
                      <View style={s.cardFooter}>
                        <Text style={s.smallMuted}>
                          Пройдено {result.visited} из {result.total}
                        </Text>
                        <Text style={s.cardLink}>Открыть подъезд ↗</Text>
                      </View>
                    </Pressable>
                  );
                })}
                {!territory.entrances.length && (
                  <Empty
                    icon="business-outline"
                    title="Добавьте первый подъезд"
                    text={'Укажите этажи и количество квартир.\nМы создадим их автоматически.'}
                  >
                    <Button
                      title="Создать подъезд"
                      icon="add"
                      onPress={() => setEditor({ kind: 'entrance' })}
                    />
                  </Empty>
                )}
              </>
            ) : (
              <>
                {data.territories.map((t) => {
                  const all = allApartments([t]);
                  const result = stats(all);
                  return (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Открыть участок ${t.name}`}
                      key={t.id}
                      onPress={() => setTerritoryId(t.id)}
                      style={({ pressed }) => [s.listCard, pressed && { opacity: 0.75 }]}
                    >
                      <View style={s.cardHeader}>
                        <View style={s.cardIcon}>
                          <Icon name="map-outline" size={25} color={C.green} />
                        </View>
                        <View style={s.flex}>
                          <Text style={s.cardTitle}>{t.name}</Text>
                          <Text style={s.cardSubtitle}>{t.address || 'Адрес не указан'}</Text>
                        </View>
                        <Icon name="chevron-forward" color={C.muted} />
                      </View>
                      <View style={[s.inline, { gap: 18, marginBottom: 16 }]}>
                        <Text style={s.meta}>Подъездов: {t.entrances.length}</Text>
                        <Text style={s.meta}>Квартир: {result.total}</Text>
                      </View>
                      <Progress apartments={all} />
                      <View style={s.cardFooter}>
                        <Text style={s.smallMuted}>
                          Пройдено {result.visited} из {result.total}
                        </Text>
                        <Text style={s.cardLink}>Открыть участок ↗</Text>
                      </View>
                    </Pressable>
                  );
                })}
                {!data.territories.length && (
                  <Empty
                    icon="map-outline"
                    title="Здесь начинается ваш обход"
                    text={
                      'Создайте участок, добавьте подъезды\nи отмечайте результаты по квартирам.'
                    }
                  >
                    <Button
                      title="Создать первый участок"
                      icon="add"
                      onPress={() => setEditor({ kind: 'territory' })}
                    />
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => {
                        persist(createDemo());
                        setToast('Добавлен учебный участок');
                      }}
                      style={s.demoButton}
                    >
                      <Text style={s.demoText}>Открыть учебный пример</Text>
                      <Icon name="arrow-forward" size={15} color={C.muted} />
                    </Pressable>
                  </Empty>
                )}
              </>
            )}
            <View style={s.localInfo}>
              <Icon name="phone-portrait-outline" size={17} color={C.muted} />
              <Text style={s.localInfoText}>
                {'Данные хранятся на этом устройстве.\nСохраняйте резервную копию в настройках.'}
              </Text>
            </View>
          </View>
        </ScrollView>
      )}
      {!!toast && (
        <View pointerEvents="none" style={s.toast}>
          <Icon name="checkmark-circle" size={18} color="#D7EBCB" />
          <Text style={s.toastText}>{toast}</Text>
        </View>
      )}
      {editor && (
        <EntityEditor
          key={`${editor.kind}:${editor.existing?.id ?? 'new'}`}
          editor={editor}
          territory={territory}
          entrance={entrance}
          onClose={() => setEditor(null)}
          onDelete={() =>
            removeCurrent(
              editor.kind,
              editor.kind === 'apartment' ? editor.existing?.id : undefined,
            )
          }
          onSave={saveEntity}
        />
      )}
      {settings && (
        <Sheet
          title="Данные и настройки"
          subtitle="Всё хранится на вашем устройстве"
          onClose={() => setSettings(false)}
        >
          <View style={s.infoBox}>
            <Icon name="shield-checkmark-outline" size={25} color={C.green} />
            <Text style={s.infoText}>
              Приложение работает без интернета и регистрации. Автоматической синхронизации между
              телефонами нет.
            </Text>
          </View>
          <Text style={s.settingsTitle}>Резервная копия</Text>
          <Text style={[s.body, { marginBottom: 20 }]}>
            Сохраните файл с участками, статусами и заметками. Его можно перенести на другой
            телефон. При удалении приложения локальные данные могут быть потеряны.
          </Text>
          <View style={{ gap: 12 }}>
            <Button
              title={busy ? 'Подождите…' : 'Сохранить копию в файл'}
              icon="download-outline"
              onPress={() => void runExport()}
              disabled={busy || !!loadError}
            />
            <Button
              title="Восстановить из файла"
              icon="cloud-upload-outline"
              secondary
              onPress={() => void runImport()}
              disabled={busy}
            />
          </View>
          <View style={s.settingsDivider} />
          <Text style={s.settingsTitle}>Обновления</Text>
          <Text style={s.body}>
            {Updates.isEnabled
              ? 'Обновления проверяются при запуске через бесплатный сервис Expo. Готовое обновление можно применить из уведомления вверху экрана.'
              : 'В этой сборке обновления ещё не настроены. Данные и все функции обхода работают автономно.'}
          </Text>
          <Text style={[s.smallMuted, { marginTop: 14 }]}>
            На iPhone при бесплатной установке через Sideloadly подпись нужно обновлять каждые 7
            дней. Обновление приложения не продлевает подпись.
          </Text>
          <Text style={s.version}>Участки · версия 1.0.0</Text>
        </Sheet>
      )}
      {dialog && (
        <Modal visible transparent animationType="fade" onRequestClose={() => setDialog(null)}>
          <View style={s.dialogBackdrop}>
            <View accessibilityViewIsModal style={s.dialog}>
              <View style={[s.inline, { marginBottom: 14 }]}>
                <Icon
                  name={dialog.danger ? 'warning-outline' : 'information-circle-outline'}
                  color={dialog.danger ? C.red : C.green}
                  size={25}
                />
                <Text style={[s.sheetTitle, s.flex]}>{dialog.title}</Text>
              </View>
              <Text style={[s.body, { marginBottom: 24 }]}>{dialog.message}</Text>
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
