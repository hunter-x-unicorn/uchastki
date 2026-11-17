import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  EMPTY_DATA,
  allApartments,
  createDemo,
  createEntrance,
  parseBackup,
  serializeBackup,
  stats,
  updateApartment,
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
