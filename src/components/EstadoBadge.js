import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '../utils/colors';
import { estadoLabel } from '../utils/formatters';

const ESTADO_COLORS = {
  ok:     { bg: Colors.ok,     text: '#fff' },
  vacuna: { bg: Colors.vacuna, text: '#fff' },
  alerta: { bg: Colors.alerta, text: '#fff' },
};

export default function EstadoBadge({ estado }) {
  const c = ESTADO_COLORS[estado] || { bg: '#ccc', text: '#000' };
  return (
    <View style={[styles.badge, { backgroundColor: c.bg }]}>
      <Text style={[styles.text, { color: c.text }]}>{estadoLabel(estado)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 3,
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});
