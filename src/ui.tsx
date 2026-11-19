import React, { createContext, useCallback, useContext, useEffect, useRef } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Apartment, stats } from './model';
import { C } from './theme';
export { C } from './theme';

type FormInput = React.ComponentRef<typeof TextInput>;
const FocusedSheetInput = createContext<(input: FormInput | null) => void>(() => {});
export type IconName = React.ComponentProps<typeof Ionicons>['name'];
export function Icon({
  name,
  size = 20,
  color = C.ink,
}: {
  name: IconName;
  size?: number;
  color?: string;
}) {
  return (
    <Ionicons
      name={name}
      size={size}
      color={color}
      accessible={false}
      aria-hidden={true}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    />
  );
}
export function Button({
  title,
  onPress,
  icon,
  secondary,
  danger,
  disabled,
  small,
}: {
  title: string;
  onPress: () => void;
  icon?: IconName;
  secondary?: boolean;
  danger?: boolean;
  disabled?: boolean;
  small?: boolean;
}) {
  const color = danger ? C.red : secondary ? C.accent : '#FFFFFF';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        s.button,
        secondary && s.secondary,
        danger && { backgroundColor: '#F9EAE6' },
        small && s.buttonSmall,
        (disabled || pressed) && { opacity: disabled ? 0.45 : 0.75 },
      ]}
    >
      {icon && <Icon name={icon} size={small ? 18 : 20} color={color} />}
      <Text style={[s.buttonText, { color }, small && { fontSize: 13 }]}>{title}</Text>
    </Pressable>
  );
}
export function IconButton({
  name,
  label,
  onPress,
}: {
  name: IconName;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={5}
      style={({ pressed }) => [s.iconButton, pressed && { opacity: 0.5 }]}
    >
      <Icon name={name} />
    </Pressable>
  );
}
export function Progress({ apartments }: { apartments: Apartment[] }) {
  const v = stats(apartments);
  return (
    <View
      style={s.progress}
      accessibilityLabel={`Пройдено ${v.visited} из ${v.total}, никого не застали в ${v.absent}`}
    >
      {!!v.visited && (
        <View style={{ width: `${(v.visited / v.total) * 100}%`, backgroundColor: C.accent }} />
      )}
      {!!v.absent && (
        <View style={{ width: `${(v.absent / v.total) * 100}%`, backgroundColor: '#DBB270' }} />
      )}
    </View>
  );
}
export function Field({
  label,
  value,
  onChangeText,
  placeholder,
  numeric,
  multiline,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  numeric?: boolean;
  multiline?: boolean;
}) {
  const inputRef = useRef<FormInput>(null);
  const trackFocus = useContext(FocusedSheetInput);
  return (
    <View style={s.field}>
      <Text style={s.fieldLabel}>{label}</Text>
      <TextInput
        ref={inputRef}
        accessibilityLabel={label}
        style={[s.input, multiline && s.textarea]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={C.placeholder}
        keyboardType={numeric ? 'numbers-and-punctuation' : 'default'}
        multiline={multiline}
        maxLength={multiline ? 10000 : numeric ? 8 : label.includes('Адрес') ? 300 : 120}
        autoCapitalize={numeric ? 'none' : 'sentences'}
        textAlignVertical={multiline ? 'top' : 'center'}
        onFocus={() => trackFocus(inputRef.current)}
        onBlur={() => trackFocus(null)}
      />
    </View>
  );
}
export function Sheet({
  title,
  subtitle,
  children,
  onClose,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  const scrollRef = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const focusedInput = useRef<FormInput | null>(null);
  const pendingFrame = useRef<number | null>(null);
  const revealInput = useCallback(() => {
    if (Platform.OS === 'web') return;
    if (pendingFrame.current !== null) cancelAnimationFrame(pendingFrame.current);
    pendingFrame.current = requestAnimationFrame(() => {
      pendingFrame.current = null;
      const input = focusedInput.current;
      if (Keyboard.isVisible() && input?.isFocused()) {
        scrollRef.current?.scrollResponderScrollNativeHandleToKeyboard(input, 16, true);
      }
    });
  }, []);
  const trackFocus = useCallback(
    (input: FormInput | null) => {
      focusedInput.current = input;
      revealInput();
    },
    [revealInput],
  );
  useEffect(() => {
    const subscription = Keyboard.addListener('keyboardDidShow', revealInput);
    return () => {
      subscription.remove();
      if (pendingFrame.current !== null) cancelAnimationFrame(pendingFrame.current);
    };
  }, [revealInput]);

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView
        style={s.modalBackdrop}
        behavior={Platform.OS === 'web' ? undefined : 'padding'}
      >
        <Pressable
          accessibilityLabel="Закрыть окно"
          onPress={onClose}
          style={StyleSheet.absoluteFill}
        />
        <SafeAreaView edges={['bottom']} style={s.sheet}>
          <View style={s.sheetHeader}>
            <View style={s.flex}>
              <Text accessibilityRole="header" style={s.sheetTitle}>
                {title}
              </Text>
              {subtitle && <Text style={s.sheetSubtitle}>{subtitle}</Text>}
            </View>
            <IconButton name="close" label="Закрыть" onPress={onClose} />
          </View>
          <ScrollView
            ref={scrollRef}
            style={s.sheetScroll}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={s.sheetBody}
            onLayout={revealInput}
          >
            <FocusedSheetInput.Provider value={trackFocus}>{children}</FocusedSheetInput.Provider>
          </ScrollView>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  );
}
export function Empty({
  icon,
  title,
  text,
  children,
}: {
  icon: IconName;
  title: string;
  text: string;
  children?: React.ReactNode;
}) {
  return (
    <View style={s.empty}>
      <View style={s.emptyIcon}>
        <Icon name={icon} size={40} color={C.accent} />
      </View>
      <Text style={s.emptyTitle}>{title}</Text>
      <Text style={s.emptyText}>{text}</Text>
      {children}
    </View>
  );
}

export const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
    backgroundColor: C.bg,
  },
  flex: { flex: 1, minWidth: 0 },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  topbar: { borderBottomWidth: 1, borderBottomColor: C.line, backgroundColor: '#FFFFFF' },
  topbarInner: {
    maxWidth: 1040,
    width: '100%',
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  logo: {
    width: 42,
    height: 42,
    backgroundColor: C.hero,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 13,
    marginRight: 3,
  },
  brand: { color: C.ink, fontSize: 18, fontWeight: '700', letterSpacing: -0.4 },
  brandSub: { color: C.muted, fontSize: 11, marginTop: 2 },
  saveBadge: { flexDirection: 'row', gap: 5, alignItems: 'center', padding: 8 },
  saveText: { fontSize: 11, color: C.accent },
  content: { width: '100%', maxWidth: 1040, alignSelf: 'center', paddingHorizontal: 20 },
  title: { fontSize: 32, lineHeight: 39, fontWeight: '700', color: C.ink, letterSpacing: -1.2 },
  back: {
    flexDirection: 'row',
    gap: 7,
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingVertical: 14,
    marginTop: 6,
    marginBottom: 10,
  },
  backText: { fontSize: 13, color: C.accent, maxWidth: 290 },
  sectionHeading: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 18,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: C.ink,
    letterSpacing: -0.5,
    flexShrink: 1,
  },
  countBadge: {
    minWidth: 25,
    height: 24,
    borderRadius: 8,
    backgroundColor: C.pale,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 7,
  },
  countBadgeText: { fontSize: 11, fontWeight: '600', color: C.accent },
  button: {
    minHeight: 49,
    paddingHorizontal: 18,
    paddingVertical: 13,
    backgroundColor: C.accent,
    borderRadius: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  buttonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
  secondary: { backgroundColor: C.pale, borderWidth: 1, borderColor: C.softLine },
  buttonSmall: { minHeight: 42, paddingHorizontal: 13, paddingVertical: 9, borderRadius: 11 },
  iconButton: {
    minWidth: 42,
    minHeight: 42,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
  },
  listCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 19,
    padding: 20,
    marginBottom: 14,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 13, marginBottom: 19 },
  cardIcon: {
    width: 49,
    height: 49,
    backgroundColor: C.soft,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 15,
  },
  cardTitle: { fontSize: 17, fontWeight: '600', color: C.ink, letterSpacing: -0.2 },
  cardSubtitle: { fontSize: 12, color: C.muted, marginTop: 6, lineHeight: 17 },
  cardFooter: { marginTop: 13, flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  cardLink: { fontSize: 11, color: C.accent, fontWeight: '600' },
  meta: {
    fontSize: 11,
    color: C.mutedStrong,
    backgroundColor: C.soft,
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  progress: {
    height: 5,
    backgroundColor: C.pale,
    borderRadius: 8,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  empty: {
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 38,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: C.softLine,
    borderRadius: 22,
    marginBottom: 10,
  },
  emptyIcon: {
    backgroundColor: C.pale,
    borderRadius: 25,
    width: 84,
    height: 84,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 23,
  },
  emptyTitle: {
    fontSize: 19,
    color: C.ink,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 10,
    letterSpacing: -0.4,
  },
  emptyText: {
    fontSize: 13,
    color: C.muted,
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: 25,
  },
  demoButton: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    marginTop: 23,
    paddingVertical: 7,
  },
  demoText: { fontSize: 12, color: C.muted },
  muted: { color: C.muted, fontSize: 14 },
  smallMuted: { fontSize: 11, color: C.muted, lineHeight: 17, flexShrink: 1 },
  body: { fontSize: 14, color: C.mutedStrong, lineHeight: 22 },
  localInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    marginTop: 29,
    marginBottom: 13,
  },
  localInfoText: { fontSize: 10, color: C.placeholder, lineHeight: 16 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: C.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  sheet: {
    flexShrink: 1,
    width: '100%',
    maxWidth: 430,
    maxHeight: '92%',
    backgroundColor: C.bg,
    borderRadius: 21,
    overflow: 'hidden',
  },
  sheetHeader: {
    flexShrink: 0,
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 24,
    paddingTop: 22,
    paddingBottom: 19,
    alignItems: 'flex-start',
    borderBottomWidth: 1,
    borderBottomColor: C.line,
  },
  sheetTitle: { fontSize: 22, fontWeight: '600', color: C.ink, letterSpacing: -0.6 },
  sheetSubtitle: { fontSize: 12, color: C.muted, lineHeight: 18, marginTop: 7 },
  sheetScroll: { flexShrink: 1 },
  sheetBody: { padding: 24, paddingBottom: 35 },
  field: { marginBottom: 20 },
  fieldLabel: { fontSize: 12, fontWeight: '600', color: C.mutedStrong, marginBottom: 9 },
  input: {
    minHeight: 49,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 11,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: C.ink,
    fontSize: 14,
    backgroundColor: '#FFFFFF',
  },
  textarea: { minHeight: 123, lineHeight: 22 },
  fieldRow: { flexDirection: 'row', gap: 14 },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: C.pale,
    padding: 16,
    borderRadius: 13,
    marginBottom: 23,
  },
  infoText: { fontSize: 12, lineHeight: 19, color: C.accentStrong, flex: 1 },
  statusOptions: { gap: 9, marginBottom: 24 },
  statusOption: {
    borderWidth: 1,
    borderColor: C.line,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 13,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },
  error: { color: C.red, fontSize: 13, lineHeight: 20, marginBottom: 17 },
  deleteButton: {
    flexDirection: 'row',
    gap: 7,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 23,
    paddingBottom: 7,
  },
  deleteText: { color: C.red, fontSize: 12 },
  settingsTitle: { color: C.ink, fontSize: 17, fontWeight: '600', marginBottom: 11 },
  settingsDivider: { height: 1, backgroundColor: C.line, marginVertical: 27 },
  version: { fontSize: 11, color: C.muted, marginTop: 26, textAlign: 'center' },
  toast: {
    position: 'absolute',
    bottom: 25,
    alignSelf: 'center',
    backgroundColor: C.hero,
    borderRadius: 13,
    paddingHorizontal: 19,
    paddingVertical: 14,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    maxWidth: '90%',
  },
  toastText: { color: '#FFFFFF', fontSize: 12 },
  dialogBackdrop: {
    flex: 1,
    backgroundColor: C.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  dialog: { backgroundColor: C.bg, borderRadius: 21, padding: 24, width: '100%', maxWidth: 430 },
  updateBanner: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    backgroundColor: C.pale,
    padding: 13,
  },
  updateText: { fontSize: 12, color: C.accent, flexShrink: 1 },
});
