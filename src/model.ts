export type ApartmentStatus = 'unvisited' | 'visited' | 'absent';

export type Apartment = {
  id: string;
  number: string;
  floor: number;
  status: ApartmentStatus;
  note: string;
  updatedAt: string | null;
};

export type Entrance = { id: string; name: string; apartments: Apartment[] };
export type Territory = { id: string; name: string; address: string; entrances: Entrance[] };
export type AppData = { version: 1; territories: Territory[] };
export const EMPTY_DATA: AppData = { version: 1, territories: [] };
export const STATUS: Record<
  ApartmentStatus,
  { label: string; short: string; color: string; background: string }
> = {
  unvisited: {
    label: 'Не посещена',
    short: 'Не посещены',
    color: '#6B7069',
    background: '#F0F1ED',
  },
  visited: { label: 'Пройдена', short: 'Пройдены', color: '#3D6645', background: '#E8F0E5' },
  absent: {
    label: 'Никого не застали',
    short: 'Никого нет',
    color: '#936225',
    background: '#FBF0DD',
  },
};

export function id(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 11)}`;
}

export function stats(apartments: Apartment[]) {
  const visited = apartments.filter((a) => a.status === 'visited').length;
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
      note: '',
      updatedAt: null,
    })),
  };
}

export function updateApartment(
  data: AppData,
  territoryId: string,
  entranceId: string,
  apartmentId: string,
  patch: Partial<Pick<Apartment, 'number' | 'floor' | 'status' | 'note'>>,
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
          !['unvisited', 'visited', 'absent'].includes(a.status) ||
          !string(a.note, 10000) ||
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
          note: a.note,
          updatedAt: a.updatedAt,
        };
      });
      return { id: entranceId, name: e.name.trim(), apartments };
    });
    return { id: territoryId, name: t.name.trim(), address: t.address.trim(), entrances };
  });
  return { version: 1, territories };
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
    note: i === 6 ? 'Попробовать зайти вечером после 18:00.' : i === 2 ? 'Домофон работает.' : '',
    updatedAt: i < 7 || i === 9 ? new Date().toISOString() : null,
  }));
  return {
    version: 1,
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
