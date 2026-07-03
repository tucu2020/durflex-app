import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  Alert, SafeAreaView,
} from 'react-native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { getAnimalById, deleteAnimal } from '../db/database';
import { Colors } from '../utils/colors';
import EstadoBadge from '../components/EstadoBadge';
import { formatFecha, formatPeso, categoriaNombre } from '../utils/formatters';

function Row({ label, value }) {
  if (!value) return null;
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

export default function DetalleAnimalScreen() {
  const navigation = useNavigation();
  const { params } = useRoute();
  const [animal, setAnimal] = useState(null);

  useFocusEffect(
    useCallback(() => {
      getAnimalById(params.id).then(setAnimal);
    }, [params.id])
  );

  if (!animal) return null;

  function confirmarBorrar() {
    Alert.alert(
      'Eliminar animal',
      `¿Eliminar el animal ${animal.caravana}? Esta acción no se puede deshacer.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar', style: 'destructive',
          onPress: async () => {
            await deleteAnimal(animal.id);
            navigation.goBack();
          },
        },
      ]
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <Text style={styles.caravana}>{animal.caravana}</Text>
            <EstadoBadge estado={animal.estado} />
          </View>
          <Text style={styles.sub}>
            {categoriaNombre(animal.categoria)} · {animal.establecimiento_nombre || 'Sin establecimiento'}
          </Text>
        </View>

        <View style={styles.card}>
          <Row label="Peso" value={formatPeso(animal.peso)} />
          <Row label="Edad" value={animal.edad ? `${animal.edad} meses` : null} />
          <Row label="Sexo" value={animal.sexo === 'macho' ? 'Macho' : animal.sexo === 'hembra' ? 'Hembra' : null} />
          <Row label="Raza" value={animal.raza} />
          <Row label="Estado reproductivo" value={animal.estado_reproductivo} />
          <Row label="Fecha de nacimiento" value={formatFecha(animal.fecha_nacimiento)} />
          <Row label="Establecimiento" value={animal.establecimiento_nombre} />
          <Row label="Observaciones" value={animal.observaciones} />
          <Row label="Sincronizado" value={animal.synced ? 'Sí' : 'Pendiente'} />
          <Row label="Fecha registro" value={formatFecha(animal.created_at)} />
        </View>

        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.editBtn}
            onPress={() => navigation.navigate('RegistroAnimal', { id: animal.id })}
          >
            <Text style={styles.editBtnText}>Editar</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.deleteBtn} onPress={confirmarBorrar}>
            <Text style={styles.deleteBtnText}>Eliminar</Text>
          </TouchableOpacity>
        </View>
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  header: {
    backgroundColor: Colors.header,
    padding: 20,
  },
  headerTop: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  caravana: { fontSize: 22, fontWeight: '900', color: Colors.primary },
  sub: { fontSize: 14, color: Colors.headerTint, marginTop: 4, opacity: 0.8 },
  card: {
    margin: 16,
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    elevation: 2,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  rowLabel: { fontSize: 14, color: Colors.textMuted, flex: 1 },
  rowValue: { fontSize: 14, color: Colors.text, fontWeight: '600', flex: 2, textAlign: 'right' },
  actions: {
    flexDirection: 'row',
    marginHorizontal: 16,
    gap: 12,
  },
  editBtn: {
    flex: 1, backgroundColor: Colors.text,
    borderRadius: 12, padding: 14, alignItems: 'center',
  },
  editBtnText: { color: Colors.primary, fontWeight: '700', fontSize: 15 },
  deleteBtn: {
    flex: 1, backgroundColor: Colors.surface,
    borderRadius: 12, padding: 14, alignItems: 'center',
    borderWidth: 2, borderColor: Colors.alerta,
  },
  deleteBtnText: { color: Colors.alerta, fontWeight: '700', fontSize: 15 },
});
