import { test } from 'node:test';
import assert from 'node:assert/strict';
import { archiveEntity, restoreArchive, splitApartment } from '../src/lifecycle';
import {
  EMPTY_DATA,
  allApartments,
  createDemo,
  createEntrance,
  parseBackup,
  serializeBackup,
  stats,
  updateApartment,
  recordVisit,
  apartmentAppearance,
  EMPTY_MARKERS,
  toggleApartmentMarker,
} from '../src/model';

test('generates apartments floor by floor, starting at the requested number', () => {
  const e = createEntrance({
    name: 'Подъезд 2',
    floors: 3,
    firstFloor: 0,
    perFloor: 2,
    firstNumber: 41,
  });
  assert.deepEqual(
    e.apartments.map((a) => [a.number, a.floor]),
    [
      ['41', 0],
      ['42', 0],
      ['43', 1],
      ['44', 1],
      ['45', 2],
      ['46', 2],
    ],
  );
  assert.equal(new Set(e.apartments.map((a) => a.id)).size, 6);
  assert.equal(stats(e.apartments).unvisited, 6);
});
test('rejects invalid layouts before allocating apartments', () => {
  const valid = { name: 'Подъезд 1', floors: 5, firstFloor: 1, perFloor: 4, firstNumber: 1 };
  for (const patch of [
    { floors: 0 },
    { floors: 101 },
    { floors: 1.5 },
    { perFloor: -1 },
    { perFloor: 51 },
    { firstNumber: 0 },
    { firstFloor: -6 },
    { firstFloor: 99 },
    { name: ' ' },
  ])
    assert.throws(() => createEntrance({ ...valid, ...patch }));
});
test('changing status preserves the note, other apartments and source object', () => {
  const original = createDemo();
  const t = original.territories[0];
  const e = t.entrances[0];
  const a = e.apartments[6];
  const updated = updateApartment(original, t.id, e.id, a.id, { status: 'visited' });
  assert.equal(updated.territories[0].entrances[0].apartments[6].note, a.note);
  assert.equal(updated.territories[0].entrances[0].apartments[6].status, 'visited');
  assert.equal(original.territories[0].entrances[0].apartments[6].status, 'absent');
  assert.equal(updated.territories[0].entrances[0].apartments[7], e.apartments[7]);
});
test('backup round trip retains IDs, statuses, Unicode notes and timestamps', () => {
  const data = createDemo();
  data.territories[0].entrances[0].apartments[0].note = 'Позвонить после 18:00. Код: 12А 🔑';
  assert.deepEqual(parseBackup(serializeBackup(data)), data);
  assert.deepEqual(parseBackup(serializeBackup(EMPTY_DATA)), EMPTY_DATA);
});
test('corrupted, future-version and oversized backups cannot be imported', () => {
  for (const raw of [
    'not json',
    'null',
    '{}',
    '{"version":2,"territories":[]}',
    'x'.repeat(10 * 1024 * 1024 + 1),
  ])
    assert.throws(() => parseBackup(raw));
});
test('invalid status, duplicate identities and duplicate apartment numbers are rejected', () => {
  for (const change of [
    (d: any) => {
      d.territories[0].entrances[0].apartments[0].status = 'unknown';
    },
    (d: any) => {
      d.territories[0].entrances[0].apartments[0].floor = 0.5;
    },
    (d: any) => {
      d.territories[0].entrances[0].apartments[0].updatedAt = 'not a date';
    },
    (d: any) => {
      d.territories[0].entrances[0].apartments[0].id = d.territories[0].id;
    },
    (d: any) => {
      d.territories[0].entrances[0].apartments[0].number =
        d.territories[0].entrances[0].apartments[1].number;
    },
  ]) {
    const data = createDemo();
    change(data);
    assert.throws(() => parseBackup(JSON.stringify(data)));
  }
});
test('all status counters add up and reflect quick status changes', () => {
  const data = createDemo();
  const a = allApartments(data.territories);
  const c = stats(a);
  assert.deepEqual(c, { total: 20, visited: 6, absent: 2, unvisited: 12 });
  assert.equal(c.visited + c.absent + c.unvisited, c.total);
});

test('visit counters are independent, survive result changes, and change color at ten', () => {
  let apartment = createDemo().territories[0].entrances[0].apartments[19];
  apartment.note = 'Сохранить заметку';
  const original = apartment;
  for (let i = 1; i <= 10; i++) {
    apartment = recordVisit(apartment, 'absent');
    assert.equal(apartment.absentCount, i);
    assert.equal(apartmentAppearance(apartment).dots, i);
    assert.equal(apartmentAppearance(apartment).completed, i >= 10);
  }
  assert.equal(apartmentAppearance(apartment).background, '#161616');
  assert.equal(apartmentAppearance(apartment).color, '#FFFFFF');
  apartment = recordVisit(apartment, 'refused');
  assert.equal(apartmentAppearance(apartment).dots, 0);
  assert.equal(apartment.absentCount, 10);
  for (let i = 0; i < 11; i++) apartment = recordVisit(apartment, 'repeat');
  assert.equal(apartment.repeatCount, 11);
  assert.equal(apartment.absentCount, 10);
  assert.equal(apartmentAppearance(apartment).background, '#B8860B');
  assert.equal(apartmentAppearance(apartment).color, '#FFFFFF');
  assert.equal(apartmentAppearance(apartment).dots, 10);
  assert.equal(apartment.note, original.note);
  assert.equal(original.absentCount, 0);
});

test('old phone data is migrated, new counters survive backups, malformed counters are rejected', () => {
  const data = createDemo();
  const old = JSON.parse(serializeBackup(data));
  delete old.archive;
  for (const apartment of old.territories[0].entrances[0].apartments) {
    delete apartment.absentCount;
    delete apartment.repeatCount;
    delete apartment.markers;
    delete apartment.details;
  }
  const migrated = parseBackup(JSON.stringify(old));
  assert.deepEqual(migrated.archive, []);
  assert.equal(migrated.territories[0].entrances[0].apartments[6].absentCount, 1);
  assert.deepEqual(migrated.territories[0].entrances[0].apartments[6].markers, EMPTY_MARKERS);
  const entrance = data.territories[0].entrances[0];
  entrance.apartments[0] = recordVisit(recordVisit(entrance.apartments[0], 'repeat'), 'absent');
  entrance.apartments[1] = recordVisit(entrance.apartments[1], 'refused');
  assert.deepEqual(parseBackup(serializeBackup(data)), data);
  for (const count of [-1, 1.5, '2', null, Number.MAX_SAFE_INTEGER + 1]) {
    const invalid = JSON.parse(serializeBackup(data));
    invalid.territories[0].entrances[0].apartments[0].repeatCount = count;
    assert.throws(() => parseBackup(JSON.stringify(invalid)));
  }
});

test('archive keeps complete deleted hierarchies, restores children and survives a backup', () => {
  const original = createDemo();
  const territory = original.territories[0];
  const entrance = territory.entrances[0];
  const apartment = entrance.apartments[6];
  for (const kind of ['territory', 'entrance', 'apartment'] as const) {
    const archived = archiveEntity(original, kind, territory.id, entrance.id, apartment.id);
    assert.equal(archived.archive.length, 1);
    assert.equal(original.archive.length, 0);
    const restored = restoreArchive(parseBackup(serializeBackup(archived)), archived.archive[0].id);
    for (const t of restored.territories)
      for (const e of t.entrances)
        e.apartments.sort((a, b) => a.number.localeCompare(b.number, 'ru', { numeric: true }));
    assert.deepEqual(restored, original);
  }
  let archived = archiveEntity(original, 'apartment', territory.id, entrance.id, apartment.id);
  const childId = archived.archive[0].id;
  archived = archiveEntity(archived, 'territory', territory.id);
  const restoredChild = restoreArchive(archived, childId);
  assert.equal(restoredChild.territories[0].entrances[0].apartments[0].note, apartment.note);
  assert.equal(restoredChild.archive.length, 1);
});

test('clearing visits archives counters and preserves notes, detailed data and markers', () => {
  const original = createDemo();
  const t = original.territories[0],
    e = t.entrances[0],
    a = e.apartments[6];
  a.details = { name: 'Имя', phone: '123', preferredTime: 'Вечером' };
  a.markers.noBell = true;
  const cleared = archiveEntity(original, 'visits', t.id, e.id, a.id);
  const result = cleared.territories[0].entrances[0].apartments[6];
  assert.equal(result.status, 'unvisited');
  assert.equal(result.absentCount, 0);
  assert.equal(result.note, a.note);
  assert.deepEqual(result.details, a.details);
  assert.equal(result.markers.noBell, true);
  const restored = restoreArchive(cleared, cleared.archive[0].id);
  assert.equal(restored.territories[0].entrances[0].apartments[6].status, 'absent');
  assert.equal(restored.territories[0].entrances[0].apartments[6].absentCount, 1);
});

test('split creates one fresh apartment on the same floor without renumbering or copying notes', () => {
  const data = createDemo(),
    t = data.territories[0],
    e = t.entrances[0],
    a = e.apartments[0];
  let split = splitApartment(data, t.id, e.id, a.id);
  split = splitApartment(split, t.id, e.id, a.id);
  const apartments = split.territories[0].entrances[0].apartments;
  assert.equal(apartments.length, e.apartments.length + 2);
  assert.deepEqual(
    apartments.slice(-2).map((value) => value.number),
    ['1/2', '1/3'],
  );
  assert.equal(apartments.at(-1)!.floor, a.floor);
  assert.equal(apartments.at(-1)!.status, 'unvisited');
  assert.equal(apartments.at(-1)!.note, '');
  assert.deepEqual(apartments.slice(0, e.apartments.length), e.apartments);
  assert.deepEqual(parseBackup(serializeBackup(split)), split);
});

test('called result and independent markers preserve notes, visit counters and backup data', () => {
  const data = createDemo();
  const original = data.territories[0].entrances[0].apartments[6];
  let apartment = toggleApartmentMarker(original, 'noIntercom');
  apartment = toggleApartmentMarker(apartment, 'noBell');
  apartment = toggleApartmentMarker(apartment, 'noPhone');
  apartment = toggleApartmentMarker(apartment, 'pencil');
  apartment = toggleApartmentMarker(apartment, 'noBell');
  apartment = recordVisit(apartment, 'called');
  assert.deepEqual(apartment.markers, {
    noIntercom: true,
    noBell: false,
    noPhone: true,
    pencil: true,
  });
  assert.deepEqual(original.markers, EMPTY_MARKERS);
  assert.equal(apartment.status, 'called');
  assert.equal(apartment.absentCount, original.absentCount);
  assert.equal(apartment.repeatCount, original.repeatCount);
  assert.equal(apartment.note, original.note);
  data.territories[0].entrances[0].apartments[6] = apartment;
  assert.deepEqual(parseBackup(serializeBackup(data)), data);
  for (const markers of [null, true, [], { noBell: 'true' }, { pencil: 1 }]) {
    const invalid = JSON.parse(serializeBackup(data));
    invalid.territories[0].entrances[0].apartments[0].markers = markers;
    assert.throws(() => parseBackup(JSON.stringify(invalid)));
  }
});
