import React from 'react';
import { StyleSheet, View } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { ApartmentMarker } from './model';

const ICONS = {
  noIntercom: 'doorbell-video',
  noBell: 'bell-off-outline',
  noPhone: 'phone-off-outline',
  pencil: 'pencil-outline',
} as const;

export function ApartmentMarkerIcon({
  marker,
  size,
  color,
}: {
  marker: ApartmentMarker;
  size: number;
  color: string;
}) {
  return (
    <View
      style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      aria-hidden
    >
      <MaterialCommunityIcons name={ICONS[marker]} size={size} color={color} accessible={false} />
      {marker === 'noIntercom' && (
        <View
          style={[
            i.slash,
            { width: size * 0.85, height: Math.max(1, size * 0.065), backgroundColor: color },
          ]}
        />
      )}
    </View>
  );
}

const i = StyleSheet.create({
  slash: { position: 'absolute', transform: [{ rotate: '-45deg' }], borderRadius: 2 },
});
