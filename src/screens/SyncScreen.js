import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Alert,
  ActivityIndicator, FlatList, SafeAreaView, ScrollView,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { getEstablecimientos, getAnimalesPendientes, marcarSincronizados } from '../db/database';
import { Colors } from '../utils/colors';

export default function SyncScreen() {
  const [establecimientos, setEstablecimientos] = useState([]);
  const [pendientes, setPendientes] = useState([]);
  const [syncing, setSyncing] = useState(false);
  const [ultimaSync, setUltimaSync] = useState(null);

  useFocusEffect(
    useCallback(() => { cargar(); }, [])
  );

  async function cargar() {
    const [ests, pend] = await Promise.all([getEstablecimientos(), getAnimalesPendientes()]);
    setEstablecimientos(ests);
    setPendientes(pend);
  }

  async function sincronizarTodo() {
    if (pendientes.length === 0) {
      Alert.alert('Al día', 'No hay registros pendientes de sincronización.');
      return;
    }
    setSyncing(true);
    try {
      // Sin Supabase configurado: simulamos sync local marcando como sincronizados
      // Para conectar a Supabase, reemplazá este bloque con las llamadas al cliente de Supabase
      await new Promise((resolve) => setTimeout(resolve, 1500));
      const ids = pendientes.map((a) => a.id);
      await marcarSincronizados(ids);
      setUltimaSync(new Date().toLocaleString('es-AR'));
      await cargar();
      Alert.alert('Sincronización completa', `${ids.length} animal${ids.length === 1 ? '' : 'es'} sincronizado${ids.length === 1 ? '' : 's'}.`);
    } catch (e) {
      Alert.alert('Error de sincronización', e.message);
    } finally {
      setSyncing(false);
    }
  }

  const totalPendientes = pendientes.length;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Estado global */}
        <View style={[styles.statusBox, totalPendientes === 0 ? styles.statusOk : styles.statusPending]}>
          <Text style={styles.statusIcon}>{totalPendientes === 0 ? '✓' : '⏳'}</Text>
          <View>
            <Text style={styles.statusTitle}>
              {totalPendientes === 0 ? 'Todo sincronizado' : `${totalPendientes} pendiente${totalPendientes !== 1 ? 's' : ''}`}
            </Text>
            {ultimaSync && <Text style={styles.statusSub}>Última sync: {ultimaSync}</Text>}
          </View>
        </View>

        {/* Botón sincronizar */}
        <TouchableOpacity
          style={[styles.syncBtn, syncing && styles.syncBtnDisabled]}
          onPress={sincronizarTodo}
          disabled={syncing}
        >
          {syncing ? (
            <View style={styles.syncBtnInner}>
              <ActivityIndicator color={Colors.primary} size="small" />
              <Text style={styles.syncBtnText}>  Sincronizando...</Text>
            </View>
          ) : (
            <Text style={styles.syncBtnText}>↑ Sincronizar ahora</Text>
          )}
        </TouchableOpacity>

        {/* Por establecimiento */}
        <Text style={styles.sectionTitle}>Estado por establecimiento</Text>

        {establecimientos.map((est) => {
          const pendEst = pendientes.filter((p) => p.establecimiento_id === est.id).length;
          const sincrEst = (est.total_animales || 0) - pendEst;
          return (
            <View key={est.id} style={styles.estCard}>
              <View style={styles.estHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.estNombre}>{est.nombre}</Text>
                  {est.renspa && <Text style={styles.estRenspa}>RENSPA: {est.renspa}</Text>}
                </View>
                <View style={[styles.estBadge, pendEst === 0 ? styles.badgeOk : styles.badgePending]}>
                  <Text style={styles.estBadgeText}>{pendEst === 0 ? '✓ OK' : `⏳ ${pendEst}`}</Text>
                </View>
              </View>
              <View style={styles.estStats}>
                <Text style={styles.estStat}>Total: {est.total_animales ?? 0}</Text>
                <Text style={[styles.estStat, { color: Colors.ok }]}>Sync: {sincrEst}</Text>
                {pendEst > 0 && <Text style={[styles.estStat, { color: Colors.vacuna }]}>Pendientes: {pendEst}</Text>}
              </View>
            </View>
          );
        })}

        {establecimientos.length === 0 && (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No hay establecimientos registrados</Text>
          </View>
        )}

        {/* Info Supabase */}
        <View style={styles.infoBox}>
          <Text style={styles.infoTitle}>Conexión Supabase</Text>
          <Text style={styles.infoText}>
            Para activar la sincronización en la nube, configurá tu proyecto Supabase en el archivo{' '}
            <Text style={styles.mono}>src/db/supabase.js</Text> con tu URL y anon key.
            Los datos offline se guardan localmente y se sincronizan cuando haya conexión.
          </Text>
        </View>

        {/* Pendientes detalle */}
        {pendientes.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Registros pendientes ({pendientes.length})</Text>
            {pendientes.map((a) => (
              <View key={a.id} style={styles.pendienteRow}>
                <Text style={styles.pendienteCaravana}>{a.caravana}</Text>
                <Text style={styles.pendienteEst}>{a.establecimiento_nombre || 'Sin est.'}</Text>
              </View>
            ))}
          </>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  statusBox: {
    flexDirection: 'row', alignItems: 'center',
    margin: 16, borderRadius: 14, padding: 18, gap: 14,
  },
  statusOk: { backgroundColor: '#E8F5E9', borderWidth: 1, borderColor: '#A5D6A7' },
  statusPending: { backgroundColor: '#FFF8E1', borderWidth: 1, borderColor: Colors.border },
  statusIcon: { fontSize: 32 },
  statusTitle: { fontSize: 17, fontWeight: '700', color: Colors.text },
  statusSub: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  syncBtn: {
    backgroundColor: Colors.text, borderRadius: 14, marginHorizontal: 16,
    padding: 16, alignItems: 'center', marginBottom: 8,
  },
  syncBtnDisabled: { backgroundColor: Colors.textMuted },
  syncBtnInner: { flexDirection: 'row', alignItems: 'center' },
  syncBtnText: { color: Colors.primary, fontWeight: '800', fontSize: 16 },
  sectionTitle: {
    fontSize: 16, fontWeight: '700', color: Colors.text,
    marginHorizontal: 16, marginTop: 16, marginBottom: 8,
  },
  estCard: {
    backgroundColor: Colors.surface, borderRadius: 12, marginHorizontal: 16,
    marginBottom: 8, padding: 14, borderWidth: 1, borderColor: Colors.border,
    elevation: 1,
  },
  estHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 },
  estNombre: { fontSize: 15, fontWeight: '700', color: Colors.text },
  estRenspa: { fontSize: 11, color: Colors.textMuted, marginTop: 2 },
  estBadge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  badgeOk: { backgroundColor: '#E8F5E9' },
  badgePending: { backgroundColor: '#FFF8E1' },
  estBadgeText: { fontSize: 12, fontWeight: '700', color: Colors.text },
  estStats: { flexDirection: 'row', gap: 16 },
  estStat: { fontSize: 13, color: Colors.textLight, fontWeight: '500' },
  empty: { alignItems: 'center', paddingTop: 40 },
  emptyText: { fontSize: 14, color: Colors.textMuted },
  infoBox: {
    backgroundColor: '#FFFDE7', borderRadius: 12, margin: 16,
    padding: 14, borderWidth: 1, borderColor: Colors.border,
  },
  infoTitle: { fontSize: 13, fontWeight: '700', color: Colors.textLight, marginBottom: 6 },
  infoText: { fontSize: 13, color: Colors.textLight, lineHeight: 20 },
  mono: { fontFamily: 'monospace', fontSize: 12 },
  pendienteRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  pendienteCaravana: { fontSize: 14, fontWeight: '600', color: Colors.text },
  pendienteEst: { fontSize: 13, color: Colors.textMuted },
});
