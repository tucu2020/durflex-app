import React from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { Colors } from '../utils/colors';

export default function FormField({ label, error, children, style }) {
  return (
    <View style={[styles.container, style]}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      {children}
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

export function Input({ style, ...props }) {
  return (
    <TextInput
      style={[styles.input, style]}
      placeholderTextColor={Colors.textMuted}
      {...props}
    />
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: 14 },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textLight,
    marginBottom: 6,
  },
  input: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: Colors.text,
  },
  error: {
    fontSize: 12,
    color: Colors.alerta,
    marginTop: 4,
  },
});
