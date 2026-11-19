import { C } from './theme';

export type ApartmentStatus = 'unvisited' | 'visited' | 'absent' | 'refused' | 'repeat' | 'called';
export type VisitResult = 'absent' | 'refused' | 'repeat' | 'called';
export const MARKER_KEYS = ['noIntercom', 'noBell', 'noPhone', 'pencil'] as const;
export type ApartmentMarker = (typeof MARKER_KEYS)[number];
export type ApartmentMarkers = Record<ApartmentMarker, boolean>;
export const EMPTY_MARKERS: ApartmentMarkers = {
  noIntercom: false,
  noBell: false,
  noPhone: false,
  pencil: false,
};
export const MARKER_LABELS: Record<ApartmentMarker, string> = {
  noIntercom: 'Нет домофона',
  noBell: 'Нет звонка',
  noPhone: 'Нет телефона',
  pencil: 'Отметка карандашом',
};
export const EMPTY_DETAILS = { name: '', phone: '', preferredTime: '' };

export type Apartment = {
  id: string;
  number: string;
  floor: number;
  status: ApartmentStatus;
  absentCount: number;
  repeatCount: number;
  markers: ApartmentMarkers;
  note: string;
  details: typeof EMPTY_DETAILS;
  updatedAt: string | null;
};

export type Entrance = { id: string; name: string; apartments: Apartment[] };
export type Territory = { id: string; name: string; address: string; entrances: Entrance[] };
export type ArchiveEntry = {
  id: string;
  kind: 'territory' | 'entrance' | 'apartment' | 'visits';
  deletedAt: string;
  territory?: Pick<Territory, 'id' | 'name' | 'address'>;
  entrance?: Pick<Entrance, 'id' | 'name'>;
  value: Territory | Entrance | Apartment;
};
export type AppData = { version: 1; territories: Territory[]; archive: ArchiveEntry[] };
export const EMPTY_DATA: AppData = { version: 1, territories: [], archive: [] };
export const STATUS: Record<
  ApartmentStatus,
  { label: string; short: string; color: string; background: string }
> = {
  unvisited: {
    label: 'Не посещена',
    short: 'Не посещены',
    color: C.muted,
    background: C.soft,
  },
  visited: {
    label: 'Пройдена',
    short: 'Пройдены',
    color: C.accentStrong,
    background: C.visitedBackground,
  },
  absent: {
    label: 'Не застали',
    short: 'Не застали',
    color: '#484848',
    background: '#BDBDBD',
  },
  refused: {
    label: 'Отказ',
    short: 'Отказ',
    color: '#771E1E',
    background: '#E86565',
  },
  repeat: {
    label: 'Повтор',
    short: 'Повтор',
    color: '#18582D',
    background: '#6EBB80',
  },
  called: {
    label: 'Позвонил',
    short: 'Позвонил',
    color: C.accentStrong,
    background: '#A8C4EA',
  },
};

export function toggleApartmentMarker(apartment: Apartment, marker: ApartmentMarker): Apartment {
  return {
    ...apartment,
    markers: { ...apartment.markers, [marker]: !apartment.markers[marker] },
    updatedAt: new Date().toISOString(),
  };
}

export function recordVisit(apartment: Apartment, result: VisitResult): Apartment {
  return {
    ...apartment,
    status: result,
    absentCount: apartment.absentCount + (result === 'absent' ? 1 : 0),
    repeatCount: apartment.repeatCount + (result === 'repeat' ? 1 : 0),
    updatedAt: new Date().toISOString(),
  };
}

export function apartmentAppearance(apartment: Apartment) {
  const count =
    apartment.status === 'absent'
      ? apartment.absentCount
      : apartment.status === 'repeat'
        ? apartment.repeatCount
        : 0;
  const completed = count >= 10;
  return {
    background: completed
      ? apartment.status === 'absent'
        ? '#161616'
        : '#B8860B'
      : STATUS[apartment.status].background,
    color: completed ? '#FFFFFF' : '#151515',
    dots: Math.min(count, 10),
    completed,
  };
}

export function id(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 11)}`;
}

export function stats(apartments: Apartment[]) {
  const visited = apartments.filter((a) =>
    ['visited', 'repeat', 'refused', 'called'].includes(a.status),
  ).length;
  const absent = apartments.filter((a) => a.status === 'absent').length;
  return {
    total: apartments.length,
    visited,
    absent,
    unvisited: apartments.length - visited - absent,
  };
}

export function allApartments(territories: Territory[]): Apartment[] {
  return territories.flatMap((t) => t.entrances.flatMap((e) => e.apartments));
}

export type EntranceLayout = {
  name: string;
  floors: number;
  firstFloor: number;
  perFloor: number;
  firstNumber: number;
};

export function createEntrance(layout: EntranceLayout): Entrance {
  const { name, floors, firstFloor, perFloor, firstNumber } = layout;
  if (!name.trim()) throw new Error('Укажите название подъезда.');
  if (!Number.isInteger(floors) || floors < 1 || floors > 100)
    throw new Error('Количество этажей: от 1 до 100.');
  if (!Number.isInteger(firstFloor) || firstFloor < -5 || firstFloor > 100)
    throw new Error('Первый этаж: от −5 до 100.');
  if (firstFloor + floors - 1 > 100) throw new Error('Последний этаж не может быть выше 100.');
  if (!Number.isInteger(perFloor) || perFloor < 1 || perFloor > 50)
    throw new Error('Квартир на этаже: от 1 до 50.');
  if (!Number.isInteger(firstNumber) || firstNumber < 1 || firstNumber > 999999)
    throw new Error('Номер первой квартиры: от 1 до 999999.');
  return {
    id: id(),
    name: name.trim(),
    apartments: Array.from({ length: floors * perFloor }, (_, i) => ({
      id: id(),
      number: String(firstNumber + i),
      floor: firstFloor + Math.floor(i / perFloor),
      status: 'unvisited',
      absentCount: 0,
      repeatCount: 0,
      markers: { ...EMPTY_MARKERS },
      note: '',
      details: { ...EMPTY_DETAILS },
      updatedAt: null,
    })),
  };
}

export function updateApartment(
  data: AppData,
  territoryId: string,
  entranceId: string,
  apartmentId: string,
  patch: Partial<
    Pick<
      Apartment,
      'number' | 'floor' | 'status' | 'note' | 'absentCount' | 'repeatCount' | 'markers' | 'details'
    >
  >,
): AppData {
  return {
    ...data,
    territories: data.territories.map((t) =>
      t.id !== territoryId
        ? t
        : {
            ...t,
            entrances: t.entrances.map((e) =>
              e.id !== entranceId
                ? e
                : {
                    ...e,
                    apartments: e.apartments.map((a) =>
                      a.id !== apartmentId
                        ? a
                        : { ...a, ...patch, updatedAt: new Date().toISOString() },
                    ),
                  },
            ),
          },
    ),
  };
}

export function serializeBackup(data: AppData): string {
  return JSON.stringify(
    { ...data, application: 'uchastki', exportedAt: new Date().toISOString() },
    null,
    2,
  );
}

/** Validate the entire backup before it can replace any local data. */
export function parseBackup(text: string): AppData {
  if (text.length > 10 * 1024 * 1024) throw new Error('Файл слишком большой. Максимум — 10 МБ.');
  let value: any;
  try {
    value = JSON.parse(text);
  } catch {
    throw new Error('Не удалось прочитать JSON-файл резервной копии.');
  }
  if (!value || value.version !== 1 || !Array.isArray(value.territories))
    throw new Error('Это не резервная копия «Участков» поддерживаемой версии.');
  const seen = new Set<string>();
  let apartmentCount = 0;
  const string = (v: unknown, max: number) => typeof v === 'string' && v.length <= max;
  const identity = (v: unknown) => {
    if (!string(v, 120) || !(v as string).trim() || seen.has(v as string))
      throw new Error('В копии есть неверные или повторяющиеся идентификаторы.');
    seen.add(v as string);
    return v as string;
  };
  if (value.territories.length > 1000) throw new Error('В копии слишком много участков.');
  const territories: Territory[] = value.territories.map((t: any) => {
    if (
      !t ||
      !string(t.name, 120) ||
      !t.name.trim() ||
      !string(t.address, 300) ||
      !Array.isArray(t.entrances) ||
      t.entrances.length > 1000
    )
      throw new Error('В копии неверные сведения об участке.');
    const territoryId = identity(t.id);
    const entrances: Entrance[] = t.entrances.map((e: any) => {
      if (!e || !string(e.name, 120) || !e.name.trim() || !Array.isArray(e.apartments))
        throw new Error('В копии неверные сведения о подъезде.');
      const entranceId = identity(e.id);
      const numbers = new Set<string>();
      const apartments: Apartment[] = e.apartments.map((a: any) => {
        apartmentCount++;
        if (apartmentCount > 50000) throw new Error('В копии больше 50 000 квартир.');
        if (
          !a ||
          !string(a.number, 30) ||
          !a.number.trim() ||
          !Number.isInteger(a.floor) ||
          a.floor < -5 ||
          a.floor > 100 ||
          !['unvisited', 'visited', 'absent', 'refused', 'repeat', 'called'].includes(a.status) ||
          ![a.absentCount, a.repeatCount].every(
            (count) => count === undefined || (Number.isSafeInteger(count) && count >= 0),
          ) ||
          (a.markers !== undefined &&
            (!a.markers ||
              typeof a.markers !== 'object' ||
              Array.isArray(a.markers) ||
              !MARKER_KEYS.every(
                (key) => a.markers[key] === undefined || typeof a.markers[key] === 'boolean',
              ))) ||
          !string(a.note, 10000) ||
          (a.details !== undefined &&
            (!a.details ||
              typeof a.details !== 'object' ||
              !['name', 'phone', 'preferredTime'].every(
                (key) => a.details[key] === undefined || string(a.details[key], 300),
              ))) ||
          !(
            a.updatedAt === null ||
            (string(a.updatedAt, 50) && Number.isFinite(Date.parse(a.updatedAt)))
          )
        )
          throw new Error('В копии неверные сведения о квартире.');
        const number = a.number.trim();
        if (numbers.has(number.toLocaleLowerCase('ru')))
          throw new Error('В подъезде найдены квартиры с одинаковым номером.');
        numbers.add(number.toLocaleLowerCase('ru'));
        return {
          id: identity(a.id),
          number,
          floor: a.floor,
          status: a.status,
          // Backups and phone data created before visit counters remain readable.
          absentCount: a.absentCount ?? (a.status === 'absent' ? 1 : 0),
          repeatCount: a.repeatCount ?? (a.status === 'repeat' ? 1 : 0),
          markers: {
            noIntercom: a.markers?.noIntercom ?? false,
            noBell: a.markers?.noBell ?? false,
            noPhone: a.markers?.noPhone ?? false,
            pencil: a.markers?.pencil ?? false,
          },
          note: a.note,
          details: {
            name: a.details?.name ?? '',
            phone: a.details?.phone ?? '',
            preferredTime: a.details?.preferredTime ?? '',
          },
          updatedAt: a.updatedAt,
        };
      });
      return { id: entranceId, name: e.name.trim(), apartments };
    });
    return { id: territoryId, name: t.name.trim(), address: t.address.trim(), entrances };
  });
  if (
    value.archive !== undefined &&
    (!Array.isArray(value.archive) || value.archive.length > 10000)
  )
    throw new Error('В копии неверный архив.');
  const archiveIds = new Set<string>();
  const archive: ArchiveEntry[] = (value.archive ?? []).map((entry: any) => {
    if (
      !entry ||
      !string(entry.id, 120) ||
      !entry.id.trim() ||
      archiveIds.has(entry.id) ||
      !['territory', 'entrance', 'apartment', 'visits'].includes(entry.kind) ||
      !string(entry.deletedAt, 50) ||
      !Number.isFinite(Date.parse(entry.deletedAt)) ||
      !entry.value
    )
      throw new Error('В копии неверная архивная запись.');
    archiveIds.add(entry.id);
    const t = entry.territory;
    const e = entry.entrance;
    if (
      entry.kind !== 'territory' &&
      (!t ||
        !string(t.id, 120) ||
        !t.id.trim() ||
        !string(t.name, 120) ||
        !t.name.trim() ||
        !string(t.address, 300))
    )
      throw new Error('В архиве не указан участок.');
    if (
      ['apartment', 'visits'].includes(entry.kind) &&
      (!e || !string(e.id, 120) || !e.id.trim() || !string(e.name, 120) || !e.name.trim())
    )
      throw new Error('В архиве не указан подъезд.');
    const wrapped =
      entry.kind === 'territory'
        ? entry.value
        : {
            ...t,
            entrances: [
              entry.kind === 'entrance' ? entry.value : { ...e, apartments: [entry.value] },
            ],
          };
    const parsed = parseBackup(JSON.stringify({ version: 1, territories: [wrapped] }))
      .territories[0];
    apartmentCount += allApartments([parsed]).length;
    if (apartmentCount > 50000) throw new Error('В копии и архиве больше 50 000 квартир.');
    return {
      id: entry.id,
      kind: entry.kind,
      deletedAt: entry.deletedAt,
      ...(t ? { territory: { id: t.id, name: t.name, address: t.address } } : {}),
      ...(e ? { entrance: { id: e.id, name: e.name } } : {}),
      value:
        entry.kind === 'territory'
          ? parsed
          : entry.kind === 'entrance'
            ? parsed.entrances[0]
            : parsed.entrances[0].apartments[0],
    };
  });
  return { version: 1, territories, archive };
}

export function createDemo(): AppData {
  const entrance = createEntrance({
    name: 'Подъезд 1',
    floors: 5,
    firstFloor: 1,
    perFloor: 4,
    firstNumber: 1,
  });
  entrance.apartments = entrance.apartments.map((a, i) => ({
    ...a,
    status: i < 6 ? 'visited' : i === 6 || i === 9 ? 'absent' : 'unvisited',
    absentCount: i === 6 || i === 9 ? 1 : 0,
    note: i === 6 ? 'Попробовать зайти вечером после 18:00.' : i === 2 ? 'Домофон работает.' : '',
    updatedAt: i < 7 || i === 9 ? new Date().toISOString() : null,
  }));
  return {
    version: 1,
    archive: [],
    territories: [
      {
        id: id(),
        name: 'Пример участка',
        address: 'Учебные данные · можно удалить',
        entrances: [entrance],
      },
    ],
  };
}
