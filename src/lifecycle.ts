import {
  Apartment,
  AppData,
  ArchiveEntry,
  EMPTY_DETAILS,
  EMPTY_MARKERS,
  Entrance,
  id,
  Territory,
  updateApartment,
  parseBackup,
  serializeBackup,
} from './model';

export function archiveEntity(
  data: AppData,
  kind: ArchiveEntry['kind'],
  territoryId: string,
  entranceId?: string,
  apartmentId?: string,
): AppData {
  const territory = data.territories.find((t) => t.id === territoryId);
  const entrance = territory?.entrances.find((e) => e.id === entranceId);
  const apartment = entrance?.apartments.find((a) => a.id === apartmentId);
  const value = kind === 'territory' ? territory : kind === 'entrance' ? entrance : apartment;
  if (!value || !territory) throw new Error('Запись уже отсутствует.');
  const entry: ArchiveEntry = {
    id: id(),
    kind,
    value,
    deletedAt: new Date().toISOString(),
    territory: { id: territory.id, name: territory.name, address: territory.address },
    ...(entrance ? { entrance: { id: entrance.id, name: entrance.name } } : {}),
  };
  let next = { ...data, archive: [entry, ...data.archive] };
  if (kind === 'visits')
    return parseBackup(
      serializeBackup(
        updateApartment(next, territoryId, entranceId!, apartmentId!, {
          status: 'unvisited',
          absentCount: 0,
          repeatCount: 0,
        }),
      ),
    );
  next = {
    ...next,
    territories: next.territories.flatMap((t) => {
      if (t.id !== territoryId) return [t];
      if (kind === 'territory') return [];
      return [
        {
          ...t,
          entrances: t.entrances.flatMap((e) => {
            if (e.id !== entranceId) return [e];
            if (kind === 'entrance') return [];
            return [{ ...e, apartments: e.apartments.filter((a) => a.id !== apartmentId) }];
          }),
        },
      ];
    }),
  };
  return parseBackup(serializeBackup(next));
}

export function splitApartment(
  data: AppData,
  territoryId: string,
  entranceId: string,
  apartmentId: string,
): AppData {
  const entrance = data.territories
    .find((t) => t.id === territoryId)
    ?.entrances.find((e) => e.id === entranceId);
  const apartment = entrance?.apartments.find((a) => a.id === apartmentId);
  if (!entrance || !apartment) throw new Error('Квартира не найдена.');
  let suffix = 2;
  while (entrance.apartments.some((a) => a.number === `${apartment.number}/${suffix}`)) suffix++;
  const number = `${apartment.number}/${suffix}`;
  if (number.length > 30)
    throw new Error('Слишком длинный номер: сначала измените номер квартиры.');
  const added: Apartment = {
    id: id(),
    number,
    floor: apartment.floor,
    status: 'unvisited',
    absentCount: 0,
    repeatCount: 0,
    markers: { ...EMPTY_MARKERS },
    details: { ...EMPTY_DETAILS },
    note: '',
    updatedAt: null,
  };
  return {
    ...data,
    territories: data.territories.map((t) =>
      t.id !== territoryId
        ? t
        : {
            ...t,
            entrances: t.entrances.map((e) =>
              e.id !== entranceId ? e : { ...e, apartments: [...e.apartments, added] },
            ),
          },
    ),
  };
}

export function restoreArchive(data: AppData, entryId: string): AppData {
  const entry = data.archive.find((a) => a.id === entryId);
  if (!entry) throw new Error('Запись уже восстановлена.');
  let archive = data.archive.filter((a) => a.id !== entryId);
  let territories = [...data.territories];
  if (entry.kind === 'territory') {
    const value = entry.value as Territory;
    if (territories.some((t) => t.id === value.id)) throw new Error('Этот участок уже существует.');
    territories.push(value);
  } else {
    const parent = entry.territory!;
    let territory = territories.find((t) => t.id === parent.id) ?? { ...parent, entrances: [] };
    if (entry.kind === 'entrance') {
      const value = entry.value as Entrance;
      if (territory.entrances.some((e) => e.id === value.id))
        throw new Error('Этот подъезд уже существует.');
      territory = { ...territory, entrances: [...territory.entrances, value] };
    } else {
      const parentEntrance = entry.entrance!;
      let entrance = territory.entrances.find((e) => e.id === parentEntrance.id) ?? {
        ...parentEntrance,
        apartments: [],
      };
      const value = entry.value as Apartment;
      const existing = entrance.apartments.find((a) => a.id === value.id);
      if (
        entry.kind === 'visits' &&
        existing &&
        (existing.status !== 'unvisited' || existing.absentCount || existing.repeatCount)
      ) {
        archive = [
          { ...entry, id: id(), deletedAt: new Date().toISOString(), value: existing },
          ...archive,
        ];
      }
      if (entry.kind === 'apartment' && existing) throw new Error('Эта квартира уже существует.');
      if (
        !existing &&
        entrance.apartments.some(
          (a) => a.number.toLocaleLowerCase('ru') === value.number.toLocaleLowerCase('ru'),
        )
      )
        throw new Error('В подъезде уже есть квартира с таким номером. Сначала измените её номер.');
      entrance = {
        ...entrance,
        apartments: existing
          ? entrance.apartments.map((a) =>
              a.id === value.id
                ? {
                    ...a,
                    status: value.status,
                    absentCount: value.absentCount,
                    repeatCount: value.repeatCount,
                    updatedAt: new Date().toISOString(),
                  }
                : a,
            )
          : [...entrance.apartments, value],
      };
      territory = {
        ...territory,
        entrances: [...territory.entrances.filter((e) => e.id !== entrance.id), entrance],
      };
    }
    territories = [...territories.filter((t) => t.id !== territory.id), territory];
  }
  return parseBackup(
    serializeBackup({
      ...data,
      territories,
      archive,
    }),
  );
}
