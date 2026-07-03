import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '../utils/colors';

export default function StatCard({ label, value, accent }) {
  return (
    <View style={[styles.card, accent && styles.cardAccent]}>
      <Text style={[styles.value, accent && styles.valueAccent]}>{value}</Text>
      <Text style={[styles.label, accent && styles.labelAccent]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 14,
    margin: 4,
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardAccent: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primaryDark,
  },
  value: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.text,
  },
  valueAccent: {
    color: Colors.text,
  },
  label: {
    fontSize: 10,
    color: Colors.textMuted,
    marginTop: 2,
    textAlign: 'center',
    fontWeight: '500',
  },
  labelAccent: {
    color: Colors.textLight,
  },
});
