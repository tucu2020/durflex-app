import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, RefreshControl,
  TouchableOpacity, SafeAreaView, ScrollView, Alert,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { getStats, getUltimosAnimales, getSesiones, getAnimalesByFecha } from '../db/database';
import { formatSenasaLine, categoriaNombre } from '../utils/formatters';
import { Colors } from '../utils/colors';
import StatCard from '../components/StatCard';
import AnimalCard from '../components/AnimalCard';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { utils as XLSXUtils, write as XLSXWrite } from 'xlsx';

const MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

function fechaCorta(isoDate) {
  if (!isoDate) return '';
  const [y, m, d] = isoDate.split('-');
  return `${d} ${MESES[parseInt(m, 10) - 1]} ${y}`;
}

export default function InicioScreen() {
  const navigation = useNavigation();
  const [stats, setStats] = useState({
    totalAnimales: 0, pendientesSync: 0, totalEstablecimientos: 0,
    alertas: 0, registradosHoy: 0,
  });
  const [ultimosAnimales, setUltimosAnimales] = useState([]);
  const [sesiones, setSesiones]               = useState([]);
  const [refreshing, setRefreshing]           = useState(false);
  const [exportingSesion, setExportingSesion] = useState(null);

  const cargarDatos = useCallback(async () => {
    const [s, animales, ses] = await Promise.all([
      getStats(), getUltimosAnimales(10), getSesiones(8),
    ]);
    setStats(s);
    setUltimosAnimales(animales);
    setSesiones(ses);
  }, []);

  useFocusEffect(useCallback(() => { cargarDatos(); }, [cargarDatos]));

  async function onRefresh() {
    setRefreshing(true);
    await cargarDatos();
    setRefreshing(false);
  }

  async function exportarSesion(fecha) {
    setExportingSesion(fecha);
    try {
      const animales = await getAnimalesByFecha(fecha);
      if (!animales.length) { Alert.alert('Sin datos', 'No hay animales en esa sesión.'); return; }

      const headers = ['Caravana','Categoría','Sexo','Raza','Peso (kg)','Establecimiento','RENSPA'];
      const rows = animales.map((a) => [
        a.caravana,
        categoriaNombre(a.categoria),
        a.sexo === 'macho' ? 'Macho' : a.sexo === 'hembra' ? 'Hembra' : '',
        a.raza || '',
        a.peso ?? '',
        a.establecimiento_nombre || '',
        a.renspa || '',
      ]);
      const ws  = XLSXUtils.aoa_to_sheet([headers, ...rows]);
      const wb  = XLSXUtils.book_new();
      XLSXUtils.book_append_sheet(wb, ws, 'Sesión');
      const wbout = XLSXWrite(wb, { type: 'base64', bookType: 'xlsx' });
      const uri   = `${FileSystem.documentDirectory}Sesion_${fecha}.xlsx`;
      await FileSystem.writeAsStringAsync(uri, wbout, { encoding: 'base64' });
      await Sharing.shareAsync(uri, {
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        dialogTitle: `Exportar sesión ${fecha}`,
        UTI: 'com.microsoft.excel.xlsx',
      });
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setExportingSesion(null);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Botón registrar — #F5E100 fondo, #2C2600 texto */}
        <View style={styles.topAction}>
          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => navigation.navigate('Animales', { screen: 'RegistroAnimal' })}
          >
            <Text style={styles.addBtnText}>+ Registrar animal</Text>
          </TouchableOpacity>
        </View>

        {/* Stats */}
        <Text style={styles.sectionTitle}>Resumen del día</Text>
        <View style={styles.statsRow}>
          <StatCard label="Registrados hoy" value={stats.registradosHoy} accent />
          <StatCard label="Total animales"  value={stats.totalAnimales} />
        </View>
        <View style={styles.statsRow}>
          <StatCard label="Campos"   value={stats.totalEstablecimientos} />
          <StatCard label="Sin sync" value={stats.pendientesSync} />
          <StatCard label="Alertas"  value={stats.alertas} />
        </View>

        {/* Últimos registros */}
        <Text style={styles.sectionTitle}>Últimos registros</Text>
        {ultimosAnimales.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyIcon}>🐄</Text>
            <Text style={styles.emptyText}>Aún no hay animales registrados.</Text>
            <Text style={styles.emptyHint}>Usá el botón "+ Registrar animal" para agregar el primero.</Text>
          </View>
        ) : (
          ultimosAnimales.map((a) => (
            <AnimalCard
              key={a.id} animal={a}
              onPress={() => navigation.navigate('Animales', { screen: 'DetalleAnimal', params: { id: a.id } })}
            />
          ))
        )}

        {/* Sesiones */}
        {sesiones.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Sesiones de trabajo</Text>
            {sesiones.map((s) => (
              <View key={s.fecha} style={styles.sesionCard}>
                <View style={styles.sesionInfo}>
                  <Text style={styles.sesionFecha}>{fechaCorta(s.fecha)}</Text>
                  <Text style={styles.sesionSub}>
                    {s.total_animales} animal{s.total_animales !== 1 ? 'es' : ''}
                    {s.establecimientos_nombres ? ` · ${s.establecimientos_nombres}` : ''}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.sesionExportBtn}
                  onPress={() => exportarSesion(s.fecha)}
                  disabled={!!exportingSesion}
                >
                  <Text style={styles.sesionExportText}>
                    {exportingSesion === s.fecha ? '...' : '↗ Excel'}
                  </Text>
                </TouchableOpacity>
              </View>
            ))}
          </>
        )}

        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },

  topAction: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 4, alignItems: 'flex-end' },
  addBtn:     { backgroundColor: Colors.primary, borderRadius: 20, paddingHorizontal: 18, paddingVertical: 10, borderWidth: 2, borderColor: Colors.text },
  addBtnText: { color: Colors.text, fontWeight: '800', fontSize: 14 },

  sectionTitle: { fontSize: 14, fontWeight: '800', color: Colors.text, marginTop: 20, marginBottom: 8, marginHorizontal: 20, textTransform: 'uppercase', letterSpacing: 0.4 },
  statsRow:     { flexDirection: 'row', marginHorizontal: 12 },

  emptyBox:  { alignItems: 'center', paddingVertical: 36, marginHorizontal: 20, backgroundColor: Colors.surface, borderRadius: 12, borderWidth: 1, borderColor: Colors.border },
  emptyIcon: { fontSize: 48, marginBottom: 8 },
  emptyText: { fontSize: 15, fontWeight: '600', color: Colors.text },
  emptyHint: { fontSize: 13, color: Colors.textMuted, marginTop: 4, textAlign: 'center', paddingHorizontal: 20 },

  sesionCard:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: Colors.surface, borderRadius: 12, marginHorizontal: 16, marginBottom: 6, padding: 14, borderWidth: 1, borderColor: Colors.border, elevation: 1 },
  sesionInfo:      { flex: 1 },
  sesionFecha:     { fontSize: 15, fontWeight: '700', color: Colors.text },
  sesionSub:       { fontSize: 12, color: Colors.textMuted, marginTop: 3 },
  sesionExportBtn: { backgroundColor: Colors.primary, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: Colors.primaryDark },
  sesionExportText:{ fontSize: 12, fontWeight: '700', color: Colors.text },
});
