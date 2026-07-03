import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Colors } from '../utils/colors';
import EstadoBadge from './EstadoBadge';
import { formatPeso, categoriaNombre, formatFecha } from '../utils/formatters';

export default function AnimalCard({ animal, onPress }) {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.75}>
      <View style={styles.row}>
        <View style={styles.info}>
          <Text style={styles.caravana}>{animal.caravana}</Text>
          <Text style={styles.sub}>
            {categoriaNombre(animal.categoria)} · {animal.establecimiento_nombre || 'Sin establecimiento'}
          </Text>
          <Text style={styles.meta}>
            {formatPeso(animal.peso)} · {formatFecha(animal.created_at)}
          </Text>
        </View>
        <EstadoBadge estado={animal.estado} />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 14,
    marginHorizontal: 16,
    marginVertical: 4,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.07,
    shadowRadius: 4,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  info: { flex: 1, marginRight: 8 },
  caravana: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
    letterSpacing: 0.5,
  },
  sub: {
    fontSize: 13,
    color: Colors.textLight,
    marginTop: 2,
  },
  meta: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
  },
});
