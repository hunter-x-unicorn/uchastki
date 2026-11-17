import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import {
  Apartment,
  ApartmentStatus,
  Entrance,
  STATUS,
  Territory,
  createEntrance,
  id,
} from './model';
import { Button, C, Field, Icon, Sheet, s } from './ui';

export type Editor =
  | { kind: 'territory'; existing?: Territory }
  | { kind: 'entrance'; existing?: Entrance }
  | { kind: 'apartment'; existing?: Apartment };

export function EntityEditor({
  editor,
  territory,
  entrance,
  onClose,
  onSave,
  onDelete,
}: {
  editor: Editor;
  territory?: Territory;
  entrance?: Entrance;
  onClose: () => void;
  onSave: (value: Territory | Entrance | Apartment) => void;
  onDelete: () => void;
}) {
  const existing = editor.existing;
  const apartment = editor.kind === 'apartment' ? editor.existing : undefined;
  const [name, setName] = useState(
    editor.kind === 'apartment'
      ? ''
      : (editor.existing?.name ??
          (editor.kind === 'entrance' ? `Подъезд ${(territory?.entrances.length ?? 0) + 1}` : '')),
  );
  const [address, setAddress] = useState(
    editor.kind === 'territory' ? (editor.existing?.address ?? '') : '',
  );
  const [floors, setFloors] = useState('5');
  const [firstFloor, setFirstFloor] = useState('1');
  const [perFloor, setPerFloor] = useState('4');
  const nextNumber =
    (entrance?.apartments.reduce(
      (max, a) => (/^\d+$/.test(a.number) ? Math.max(max, Number(a.number)) : max),
      0,
    ) ?? 0) + 1;
  const [number, setNumber] = useState(
    apartment?.number ?? (editor.kind === 'entrance' ? '1' : String(nextNumber)),
  );
  const [floor, setFloor] = useState(String(apartment?.floor ?? 1));
  const [status, setStatus] = useState<ApartmentStatus>(apartment?.status ?? 'unvisited');
  const [note, setNote] = useState(apartment?.note ?? '');
  const [error, setError] = useState('');
  function save() {
    try {
      if (editor.kind === 'territory') {
        if (!name.trim()) throw new Error('Укажите название участка.');
        onSave({
          id: existing?.id ?? id(),
          name: name.trim(),
          address: address.trim(),
          entrances: editor.existing?.entrances ?? [],
        });
      } else if (editor.kind === 'entrance') {
        if (!name.trim()) throw new Error('Укажите название подъезда.');
        if (!editor.existing && [floors, firstFloor, perFloor, number].some((v) => !v.trim()))
          throw new Error('Заполните все параметры квартир.');
        onSave(
          editor.existing
            ? { ...editor.existing, name: name.trim() }
            : createEntrance({
                name,
                floors: Number(floors),
                firstFloor: Number(firstFloor),
                perFloor: Number(perFloor),
                firstNumber: Number(number),
              }),
        );
      } else {
        if (!number.trim() || number.trim().length > 30)
          throw new Error('Укажите номер квартиры, не длиннее 30 символов.');
        if (
          !floor.trim() ||
          !Number.isInteger(Number(floor)) ||
          Number(floor) < -5 ||
          Number(floor) > 100
        )
          throw new Error('Этаж должен быть целым числом от −5 до 100.');
        if (
          entrance?.apartments.some(
            (a) =>
              a.id !== apartment?.id &&
              a.number.toLocaleLowerCase('ru') === number.trim().toLocaleLowerCase('ru'),
          )
        )
          throw new Error('Квартира с таким номером уже есть в этом подъезде.');
        onSave({
          id: apartment?.id ?? id(),
          number: number.trim(),
          floor: Number(floor),
          status,
          note: note.trim(),
          updatedAt:
            apartment &&
            apartment.number === number.trim() &&
            apartment.floor === Number(floor) &&
            apartment.status === status &&
            apartment.note === note.trim()
              ? apartment.updatedAt
              : new Date().toISOString(),
        });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Проверьте введённые данные.');
    }
  }
  const title =
    editor.kind === 'territory'
      ? existing
        ? 'Редактировать участок'
        : 'Новый участок'
      : editor.kind === 'entrance'
        ? existing
          ? 'Редактировать подъезд'
          : 'Новый подъезд'
        : apartment
          ? `Квартира ${apartment.number}`
          : 'Новая квартира';
  return (
    <Sheet
      title={title}
      subtitle={editor.kind === 'apartment' ? `${entrance?.name} · ${territory?.name}` : undefined}
      onClose={onClose}
    >
      {editor.kind === 'territory' && (
        <>
          <Field
            label="Название участка"
            value={name}
            onChangeText={setName}
            placeholder="Например, Центральный"
          />
          <Field
            label="Адрес или описание"
            value={address}
            onChangeText={setAddress}
            placeholder="Улица и дом или границы участка"
          />
        </>
      )}
      {editor.kind === 'entrance' && (
        <>
          <Field
            label="Название подъезда"
            value={name}
            onChangeText={setName}
            placeholder="Например, дом 12 · подъезд 1"
          />
          {!existing && (
            <>
              <View style={s.infoBox}>
                <Icon name="sparkles-outline" color={C.green} />
                <Text style={s.infoText}>
                  Квартиры создадутся автоматически. Позже можно изменить номер и этаж каждой
                  квартиры.
                </Text>
              </View>
              <View style={s.fieldRow}>
                <View style={s.flex}>
                  <Field
                    label="Количество этажей"
                    value={floors}
                    onChangeText={setFloors}
                    numeric
                  />
                </View>
                <View style={s.flex}>
                  <Field
                    label="Первый этаж"
                    value={firstFloor}
                    onChangeText={setFirstFloor}
                    numeric
                  />
                </View>
              </View>
              <View style={s.fieldRow}>
                <View style={s.flex}>
                  <Field
                    label="Квартир на этаже"
                    value={perFloor}
                    onChangeText={setPerFloor}
                    numeric
                  />
                </View>
                <View style={s.flex}>
                  <Field label="Первая квартира" value={number} onChangeText={setNumber} numeric />
                </View>
              </View>
              <Text style={[s.smallMuted, { marginBottom: 24 }]}>
                Нумерация идёт подряд, начиная с первого этажа.
                {Number(floors) > 0 &&
                Number(perFloor) > 0 &&
                Number(floors) * Number(perFloor) <= 5000
                  ? ` Будет создано квартир: ${Number(floors) * Number(perFloor)}.`
                  : ''}
              </Text>
            </>
          )}
        </>
      )}
      {editor.kind === 'apartment' && (
        <>
          <View style={s.fieldRow}>
            <View style={s.flex}>
              <Field
                label="Номер квартиры"
                value={number}
                onChangeText={setNumber}
                placeholder="Можно с буквой: 12А"
              />
            </View>
            <View style={s.flex}>
              <Field label="Этаж" value={floor} onChangeText={setFloor} numeric />
            </View>
          </View>
          <Text style={[s.fieldLabel, { marginBottom: 12 }]}>Результат обхода</Text>
          <View style={s.statusOptions}>
            {(['unvisited', 'visited', 'absent'] as const).map((value) => (
              <Pressable
                key={value}
                accessibilityRole="radio"
                accessibilityState={{ checked: status === value }}
                onPress={() => setStatus(value)}
                style={[
                  s.statusOption,
                  status === value && {
                    borderColor: STATUS[value].color,
                    backgroundColor: STATUS[value].background,
                  },
                ]}
              >
                <Icon
                  name={
                    value === 'visited'
                      ? 'checkmark-circle-outline'
                      : value === 'absent'
                        ? 'time-outline'
                        : 'ellipse-outline'
                  }
                  size={21}
                  color={STATUS[value].color}
                />
                <Text style={[s.body, s.flex, status === value && { fontWeight: '600' }]}>
                  {STATUS[value].label}
                </Text>
                {status === value && (
                  <Icon name="checkmark" color={STATUS[value].color} size={19} />
                )}
              </Pressable>
            ))}
          </View>
          <Field
            label="Дополнительные сведения"
            value={note}
            onChangeText={setNote}
            multiline
            placeholder="Например, когда зайти повторно или как работает домофон"
          />
          {apartment?.updatedAt && (
            <Text style={[s.smallMuted, { marginBottom: 20 }]}>
              Последнее изменение:{' '}
              {new Date(apartment.updatedAt).toLocaleString('ru-RU', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </Text>
          )}
        </>
      )}
      {!!error && (
        <Text accessibilityRole="alert" style={s.error}>
          {error}
        </Text>
      )}
      <Button
        title={
          existing
            ? 'Сохранить изменения'
            : editor.kind === 'entrance'
              ? 'Создать подъезд и квартиры'
              : editor.kind === 'territory'
                ? 'Создать участок'
                : 'Добавить квартиру'
        }
        icon="checkmark"
        onPress={save}
      />
      {existing && (
        <Pressable accessibilityRole="button" onPress={onDelete} style={s.deleteButton}>
          <Icon name="trash-outline" size={17} color={C.red} />
          <Text style={s.deleteText}>
            {editor.kind === 'territory'
              ? 'Удалить участок'
              : editor.kind === 'entrance'
                ? 'Удалить подъезд'
                : 'Удалить квартиру'}
          </Text>
        </Pressable>
      )}
    </Sheet>
  );
}
