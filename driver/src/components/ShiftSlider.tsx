import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useShiftStore, ShiftStatus } from '../store/shiftStore';
import { useThemeStore } from '../store/themeStore';
import { Fonts, Radius, Spacing } from '../constants/theme';
import { Power, Coffee, PowerOff } from 'lucide-react-native';

export const ShiftSlider: React.FC = () => {
  const { colors } = useThemeStore();
  const { status, isUpdating, setShiftStatus } = useShiftStore();

  const options: Array<{ key: ShiftStatus; label: string; color: string; icon: any }> = [
    { key: 'ONLINE', label: 'متصل للعمل', color: colors.success, icon: Power },
    { key: 'BREAK', label: 'استراحة', color: colors.warning, icon: Coffee },
    { key: 'OFFLINE', label: 'غير متصل', color: colors.danger, icon: PowerOff },
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.card, borderColor: colors.border }]}>
      {options.map((opt) => {
        const isActive = status === opt.key;
        const IconComponent = opt.icon;

        return (
          <TouchableOpacity
            key={opt.key}
            onPress={() => !isUpdating && setShiftStatus(opt.key)}
            disabled={isUpdating}
            activeOpacity={0.8}
            style={[
              styles.optionButton,
              isActive && {
                backgroundColor: opt.color,
                shadowColor: opt.color,
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.35,
                shadowRadius: 4,
                elevation: 3,
              },
            ]}
          >
            {isUpdating && isActive ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <View style={styles.buttonContent}>
                <IconComponent
                  size={16}
                  color={isActive ? '#FFFFFF' : colors.textSecondary}
                  strokeWidth={2.2}
                />
                <Text
                  style={[
                    styles.optionLabel,
                    {
                      color: isActive ? '#FFFFFF' : colors.textSecondary,
                      fontFamily: isActive ? Fonts.bold : Fonts.medium,
                    },
                  ]}
                >
                  {opt.label}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row-reverse',
    padding: 4,
    borderRadius: Radius.full,
    borderWidth: 1,
    marginHorizontal: Spacing.lg,
    marginVertical: Spacing.sm,
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  optionButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 2,
  },
  buttonContent: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
  },
  optionLabel: {
    fontSize: 13,
  },
});
