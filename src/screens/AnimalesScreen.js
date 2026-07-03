import React, { useState, useCallback } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  SafeAreaView, TextInput,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { getAnimales } from '../db/database';
import { Colors } from '../utils/colors';
import AnimalCard from '../components/AnimalCard';

const FILTROS = ['todos', 'ok', 'vacuna', 'alerta'];

export default function AnimalesScreen() {
  const navigation = useNavigation();
  const [animales, setAnimales] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [filtro, setFiltro] = useState('todos');

  useFocusEffect(
    useCallback(() => {
      getAnimales().then(setAnimales);
    }, [])
  );

  const filtrados = animales.filter((a) => {
    const matchEstado = filtro === 'todos' || a.estado === filtro;
    const q = busqueda.toLowerCase();
    const matchBusqueda =
      !q ||
      a.caravana?.toLowerCase().includes(q) ||
      a.establecimiento_nombre?.toLowerCase().includes(q) ||
      a.raza?.toLowerCase().includes(q);
    return matchEstado && matchBusqueda;
  });

  return (
    <SafeAreaView style={styles.safe}>
      {/* Barra de búsqueda */}
      <View style={styles.searchBar}>
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar por caravana, establecimiento..."
          placeholderTextColor={Colors.textMuted}
          value={busqueda}
          onChangeText={setBusqueda}
          clearButtonMode="while-editing"
        />
      </View>

      {/* Filtros de estado */}
      <View style={styles.filtros}>
        {FILTROS.map((f) => (
          <TouchableOpacity
            key={f}
            style={[styles.filtroBtn, filtro === f && styles.filtroBtnActive]}
            onPress={() => setFiltro(f)}
          >
            <Text style={[styles.filtroText, filtro === f && styles.filtroTextActive]}>
              {f === 'todos' ? 'Todos' : f.charAt(0).toUpperCase() + f.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={filtrados}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
          <AnimalCard
            animal={item}
            onPress={() => navigation.navigate('DetalleAnimal', { id: item.id })}
          />
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>
              {animales.length === 0 ? 'No hay animales registrados' : 'Sin resultados'}
            </Text>
          </View>
        }
        contentContainerStyle={{ paddingBottom: 24, paddingTop: 8 }}
        showsVerticalScrollIndicator={false}
      />

      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('RegistroAnimal')}
      >
        <Text style={styles.fabText}>＋</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  searchBar: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: Colors.header,
  },
  searchInput: {
    backgroundColor: Colors.surface,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 9,
    fontSize: 14,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  filtros: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: 6,
  },
  filtroBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  filtroBtnActive: { backgroundColor: Colors.text, borderColor: Colors.text },
  filtroText: { fontSize: 13, color: Colors.textLight, fontWeight: '500' },
  filtroTextActive: { color: Colors.primary, fontWeight: '700' },
  empty: { alignItems: 'center', paddingTop: 60 },
  emptyText: { fontSize: 15, color: Colors.textMuted },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    borderWidth: 2,
    borderColor: Colors.text,
  },
  fabText: { fontSize: 28, color: Colors.text, lineHeight: 32 },
});
