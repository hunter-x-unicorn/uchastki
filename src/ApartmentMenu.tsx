import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  Apartment,
  ApartmentMarker,
  MARKER_KEYS,
  MARKER_LABELS,
  STATUS,
  VisitResult,
} from './model';
import { ApartmentMarkerIcon } from './ApartmentMarkerIcon';
import { C, IconButton, s } from './ui';

export function ApartmentMenu({
  apartment,
  onClose,
  onResult,
  onEdit,
  onToggleMarker,
  onAction,
}: {
  apartment: Apartment;
  onClose: () => void;
  onResult: (result: VisitResult) => void;
  onEdit: () => void;
  onToggleMarker: (marker: ApartmentMarker) => void;
  onAction: (action: 'delete' | 'clear' | 'split') => void;
}) {
  const [actions, setActions] = useState(false);
  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <View style={s.dialogBackdrop}>
        <Pressable
          accessibilityLabel="Закрыть меню квартиры"
          onPress={onClose}
          style={StyleSheet.absoluteFill}
        />
        <View style={m.card}>
          <View style={m.header}>
            <Text accessibilityRole="header" style={[s.sheetTitle, s.flex]}>
              Квартира {apartment.number}
            </Text>
            <IconButton
              name="ellipsis-horizontal"
              label="Меню квартиры"
              onPress={() => setActions(!actions)}
            />
          </View>
          <ScrollView style={m.scroll} contentContainerStyle={m.body}>
            {actions ? (
              <View style={m.actions}>
                {(
                  [
                    ['Изменить', onEdit],
                    ['Разделить', () => onAction('split')],
                    ['Очистить посещения', () => onAction('clear')],
                    ['Удалить квартиру', () => onAction('delete')],
                  ] as const
                ).map(([label, action]) => (
                  <Pressable
                    key={label}
                    accessibilityRole="button"
                    onPress={action}
                    style={[s.statusOption, { minHeight: 48 }]}
                  >
                    <Text style={[s.body, label === 'Удалить квартиру' && { color: C.red }]}>
                      {label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            ) : (
              <>
                <View style={m.actions}>
                  {(
                    [
                      ['absent', 'refused'],
                      ['repeat', 'called'],
                    ] as const
                  ).map((row, index) => (
                    <View key={index} style={m.actionRow}>
                      {row.map((result) => (
                        <Pressable
                          key={result}
                          accessibilityRole="button"
                          accessibilityLabel={STATUS[result].label}
                          onPress={() => onResult(result)}
                          style={({ pressed }) => [
                            m.action,
                            { backgroundColor: STATUS[result].background },
                            pressed && { opacity: 0.7 },
                          ]}
                        >
                          <Text style={m.actionText}>{STATUS[result].label}</Text>
                        </Pressable>
                      ))}
                    </View>
                  ))}
                </View>
                <View style={m.markers}>
                  {MARKER_KEYS.map((marker) => {
                    const active = apartment.markers[marker];
                    return (
                      <View key={marker} style={m.markerColumn}>
                        <Pressable
                          accessibilityRole="checkbox"
                          accessibilityLabel={MARKER_LABELS[marker]}
                          accessibilityState={{ checked: active }}
                          aria-checked={active}
                          onPress={() => (marker === 'pencil' ? onEdit() : onToggleMarker(marker))}
                          style={({ pressed }) => [
                            m.markerButton,
                            active && m.markerActive,
                            pressed && { opacity: 0.7 },
                          ]}
                        >
                          <ApartmentMarkerIcon
                            marker={marker}
                            size={27}
                            color={active ? '#FFFFFF' : '#717781'}
                          />
                        </Pressable>
                        <Text style={m.markerLabel}>
                          {marker === 'pencil' ? 'Карандаш' : MARKER_LABELS[marker]}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              </>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const m = StyleSheet.create({
  card: {
    width: '100%',
    maxWidth: 340,
    maxHeight: '94%',
    flexShrink: 1,
    borderRadius: 21,
    padding: 20,
    backgroundColor: C.bg,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 18 },
  actions: { gap: 10 },
  actionRow: { flexDirection: 'row', gap: 10 },
  action: {
    flex: 1,
    minWidth: 0,
    minHeight: 56,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 6,
  },
  actionText: { fontSize: 14, fontWeight: '600', color: '#151515', textAlign: 'center' },
  scroll: { flexShrink: 1 },
  body: { paddingBottom: 2 },
  markers: { flexDirection: 'row', gap: 8, marginTop: 18 },
  markerColumn: { flex: 1, minWidth: 0, alignItems: 'center' },
  markerButton: {
    width: '100%',
    aspectRatio: 1,
    minHeight: 44,
    backgroundColor: '#E2E4E8',
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markerActive: { backgroundColor: '#CF4141' },
  markerLabel: {
    fontSize: 10,
    lineHeight: 13,
    color: C.mutedStrong,
    textAlign: 'center',
    marginTop: 5,
  },
  counts: { textAlign: 'center', color: C.mutedStrong, fontSize: 12, marginVertical: 18 },
});
