import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Apartment, apartmentAppearance, MARKER_KEYS, MARKER_LABELS, STATUS } from './model';
import { ApartmentMarkerIcon } from './ApartmentMarkerIcon';
import { C } from './theme';

const GAP = 3;
const COLUMNS = 6;

export function ApartmentGrid({
  apartments,
  onOpen,
}: {
  apartments: Apartment[];
  onOpen: (apartment: Apartment) => void;
}) {
  const [width, setWidth] = useState(0);
  const rows = useMemo(() => {
    const grouped = new Map<number, Apartment[]>();
    for (const apartment of apartments) {
      const row = grouped.get(apartment.floor) ?? [];
      row.push(apartment);
      grouped.set(apartment.floor, row);
    }
    return [...grouped.entries()]
      .sort(([a], [b]) => b - a)
      .map(([floor, items]) => ({
        floor,
        columns: Math.max(4, Math.min(COLUMNS, items.length)),
        lines: (() => {
          items.sort((a, b) => a.number.localeCompare(b.number, 'ru', { numeric: true }));
          return Array.from({ length: Math.ceil(items.length / COLUMNS) }, (_, index) =>
            items.slice(index * COLUMNS, (index + 1) * COLUMNS),
          );
        })(),
      }));
  }, [apartments]);

  if (!rows.length) return null;

  return (
    <View style={g.grid} onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
      {(width > 0 ? rows : []).map(({ floor, lines, columns }) => (
        <View key={floor} style={g.floor}>
          {lines.map((items, lineIndex) => (
            <View
              key={lineIndex}
              style={[
                g.row,
                columns === 4 && items.length < 4 && { justifyContent: 'space-evenly', gap: 0 },
              ]}
            >
              {items.map((apartment) => {
                const status = STATUS[apartment.status];
                const appearance = apartmentAppearance(apartment);
                const markers = MARKER_KEYS.filter((key) => apartment.markers[key]);
                return (
                  <Pressable
                    key={apartment.id}
                    accessibilityRole="button"
                    accessibilityLabel={`Квартира ${apartment.number}, ${status.label}${apartment.note ? ', есть заметка' : ''}`}
                    accessibilityHint={`${floor} этаж. Не застали: ${apartment.absentCount}; повтор: ${apartment.repeatCount}. ${markers.map((key) => MARKER_LABELS[key]).join('. ')}. Открыть меню квартиры.`}
                    onPress={() => onOpen(apartment)}
                    style={({ pressed }) => [
                      g.block,
                      { width: (width - GAP * (columns - 1)) / columns },
                      {
                        backgroundColor: appearance.background,
                        borderColor:
                          apartment.status === 'unvisited' ? C.line : appearance.background,
                      },
                      pressed && { opacity: 0.7 },
                    ]}
                  >
                    {!!appearance.dots && (
                      <View
                        style={g.dots}
                        pointerEvents="none"
                        accessibilityElementsHidden
                        importantForAccessibility="no-hide-descendants"
                      >
                        {Array.from({ length: Math.ceil(appearance.dots / 5) }, (_, row) => (
                          <View key={row} style={g.dotRow} testID="visit-dot-row">
                            {Array.from(
                              { length: Math.min(5, appearance.dots - row * 5) },
                              (_, dot) => (
                                <View
                                  key={dot}
                                  testID="visit-dot"
                                  style={[g.dot, appearance.completed && g.outlinedDot]}
                                />
                              ),
                            )}
                          </View>
                        ))}
                      </View>
                    )}
                    <Text
                      style={[
                        g.number,
                        { color: appearance.color },
                        appearance.dots > 0 && g.numberWithDots,
                        markers.length > 0 && g.numberWithMarkers,
                      ]}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.5}
                    >
                      {apartment.number}
                    </Text>
                    {!!markers.length && (
                      <View
                        style={g.markers}
                        pointerEvents="none"
                        accessibilityElementsHidden
                        importantForAccessibility="no-hide-descendants"
                      >
                        {markers.map((marker) => (
                          <View key={marker} testID={`apartment-marker-${marker}`}>
                            <ApartmentMarkerIcon
                              marker={marker}
                              size={9}
                              color={appearance.completed ? '#FFFFFF' : '#A32929'}
                            />
                          </View>
                        ))}
                      </View>
                    )}
                  </Pressable>
                );
              })}
              {Array.from(
                { length: columns === 4 && items.length < 4 ? 0 : columns - items.length },
                (_, index) => (
                  <View
                    key={`empty-${index}`}
                    style={[g.empty, { width: (width - GAP * (columns - 1)) / columns }]}
                  />
                ),
              )}
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

const g = StyleSheet.create({
  grid: { width: '100%', gap: 12, marginBottom: 16 },
  floor: { gap: GAP },
  row: { flexDirection: 'row', gap: GAP },
  block: {
    // Yoga treats positive `flex` as a zero basis, even with flexBasis: 'auto'.
    // Fixed-width cells must not use the flex shorthand (React Native differs from web).
    flexGrow: 0,
    flexShrink: 0,
    minWidth: 0,
    aspectRatio: 1,
    borderWidth: 1,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  empty: { flexGrow: 0, flexShrink: 0, minWidth: 0, aspectRatio: 1 },
  number: { color: C.ink, fontSize: 18, fontWeight: '600', maxWidth: '100%' },
  numberWithDots: { marginTop: 12 },
  numberWithMarkers: { fontSize: 16, lineHeight: 18, marginTop: 0 },
  markers: { position: 'absolute', bottom: 3, flexDirection: 'row', gap: 1 },
  dots: { position: 'absolute', top: 3, alignItems: 'center', gap: 1 },
  dotRow: { flexDirection: 'row', gap: 2 },
  dot: { width: 3, height: 3, borderRadius: 2, backgroundColor: '#000000' },
  outlinedDot: { borderWidth: 0.5, borderColor: '#FFFFFF' },
});
