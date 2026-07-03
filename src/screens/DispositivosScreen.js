import React from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  SafeAreaView, ScrollView, ActivityIndicator, Alert,
} from 'react-native';
import { useBLE } from '../hooks/useBLE';
import { Colors } from '../utils/colors';

export default function DispositivosScreen() {
  const {
    bleState, scanning, devices, connected, lastRead,
    rawData, rawLog, error, isMock,
    startScan, stopScan, connectDevice, disconnect,
    clearLastRead, clearRawLog,
  } = useBLE();

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView showsVerticalScrollIndicator={false}>

        {/* Banner modo simulación (solo si el módulo nativo no está) */}
        {isMock && (
          <View style={styles.mockBanner}>
            <Text style={styles.mockIcon}>ℹ️</Text>
            <View style={styles.mockText}>
              <Text style={styles.mockTitle}>Modo simulación activo</Text>
              <Text style={styles.mockDesc}>
                El Bluetooth real no está disponible en este entorno (p. ej. Expo Go).
                Los datos que ves son simulados. Para usar el bastón RFID real, instalá
                un build nativo:{'\n'}
                <Text style={styles.mockCode}>eas build -p android --profile preview</Text>
              </Text>
            </View>
          </View>
        )}

        {/* Error */}
        {!!error && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>⚠️ {error}</Text>
          </View>
        )}

        {/* Estado */}
        <View style={styles.statusCard}>
          <View style={[styles.statusDot, connected ? styles.dotConnected : styles.dotOff]} />
          <View style={{ flex: 1 }}>
            <Text style={styles.statusTitle}>
              {connected ? `Conectado: ${connected.name}` : 'Sin conexión activa'}
            </Text>
            <Text style={styles.statusSub}>
              {isMock ? 'Simulado' : `Bluetooth: ${bleState}`}
            </Text>
          </View>
          {connected && (
            <TouchableOpacity style={styles.disconnectBtn} onPress={disconnect}>
              <Text style={styles.disconnectBtnText}>Desconectar</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Última caravana leída */}
        {!!lastRead && (
          <View style={styles.readCard}>
            <Text style={styles.readLabel}>ÚLTIMA CARAVANA LEÍDA</Text>
            <Text style={styles.readValue}>{lastRead}</Text>
            <View style={styles.readActions}>
              <TouchableOpacity
                style={styles.readBtn}
                onPress={() => Alert.alert('Caravana leída', lastRead)}
              >
                <Text style={styles.readBtnText}>Ver</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.readBtn, styles.readBtnGhost]} onPress={clearLastRead}>
                <Text style={styles.readBtnGhostText}>Limpiar</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Buscar */}
        <View style={styles.section}>
          <TouchableOpacity
            style={[styles.scanBtn, scanning && styles.scanBtnStop]}
            onPress={scanning ? stopScan : startScan}
          >
            {scanning
              ? <ActivityIndicator color={Colors.text} size="small" />
              : <Text style={styles.scanBtnIcon}>📡</Text>
            }
            <Text style={styles.scanBtnText}>
              {scanning ? 'Buscando...' : 'Buscar dispositivos'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Dispositivos encontrados */}
        {devices.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Dispositivos {devices.some((d) => d.bonded) ? '(★ emparejados)' : 'encontrados'}</Text>
            {devices.map((d) => (
              <TouchableOpacity
                key={d.id}
                style={[styles.deviceCard, connected?.id === d.id && styles.deviceCardActive]}
                onPress={() => connectDevice(d.id)}
              >
                <View style={styles.deviceLeft}>
                  <Text style={styles.deviceIcon}>📶</Text>
                  <View>
                    <Text style={styles.deviceName}>{d.bonded ? '★ ' : ''}{d.name}</Text>
                    <Text style={styles.deviceId}>{d.id}</Text>
                    {d.rssi != null && <Text style={styles.deviceRssi}>Señal: {d.rssi} dBm</Text>}
                  </View>
                </View>
                {connected?.id === d.id
                  ? <View style={styles.connectedBadge}><Text style={styles.connectedBadgeText}>✓ Conectado</Text></View>
                  : <Text style={styles.conectarText}>Conectar →</Text>
                }
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Panel de datos crudos (depuración del bastón real) */}
        <View style={styles.section}>
          <View style={styles.rawHeader}>
            <Text style={styles.sectionLabel}>Datos crudos del bastón</Text>
            {rawLog.length > 0 && (
              <TouchableOpacity onPress={clearRawLog}>
                <Text style={styles.rawClear}>Limpiar</Text>
              </TouchableOpacity>
            )}
          </View>
          <View style={styles.rawBox}>
            {rawLog.length === 0 ? (
              <Text style={styles.rawEmpty}>
                Sin lecturas todavía. Conectá el bastón y pasá una caravana:
                acá vas a ver, tal cual, lo que envía el lector.
              </Text>
            ) : (
              rawLog.map((r, i) => (
                <Text key={i} style={styles.rawLine} numberOfLines={2}>
                  <Text style={styles.rawTime}>{r.t}  </Text>
                  {JSON.stringify(r.texto)}
                </Text>
              ))
            )}
          </View>
          {!!rawData && (
            <Text style={styles.rawHint}>
              Último dato: {JSON.stringify(rawData)}
            </Text>
          )}
        </View>

        {/* Info */}
        <View style={styles.infoBox}>
          <Text style={styles.infoTitle}>Cómo conectar el bastón</Text>
          <Text style={styles.infoText}>
            1. Encendé el bastón y emparejalo desde Ajustes → Bluetooth de Android (si pide PIN, suele ser 0000 o 1234).{'\n'}
            2. Volvé acá y tocá “Buscar dispositivos”: debería aparecer con ★.{'\n'}
            3. Tocá para conectar y pasá una caravana electrónica. El número aparece arriba y el dato crudo, abajo.
          </Text>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },

  mockBanner: {
    flexDirection: 'row', margin: 16, padding: 14,
    backgroundColor: '#FFF8E1', borderRadius: 12,
    borderWidth: 1, borderColor: '#FFE082', gap: 10,
  },
  mockIcon: { fontSize: 22 },
  mockText: { flex: 1 },
  mockTitle: { fontSize: 14, fontWeight: '700', color: Colors.text, marginBottom: 4 },
  mockDesc: { fontSize: 12, color: Colors.textLight, lineHeight: 18 },
  mockCode: { fontFamily: 'monospace', fontSize: 11, color: Colors.text },

  errorBanner: {
    marginHorizontal: 16, marginTop: 12, padding: 12,
    backgroundColor: '#FDECEA', borderRadius: 10, borderWidth: 1, borderColor: '#F5B7B1',
  },
  errorText: { color: '#922B21', fontSize: 13, fontWeight: '600' },

  statusCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    margin: 16, padding: 16, backgroundColor: Colors.surface,
    borderRadius: 14, borderWidth: 1, borderColor: Colors.border, elevation: 2,
  },
  statusDot:      { width: 12, height: 12, borderRadius: 6 },
  dotConnected:   { backgroundColor: Colors.ok },
  dotOff:         { backgroundColor: '#ccc' },
  statusTitle:    { fontSize: 15, fontWeight: '700', color: Colors.text },
  statusSub:      { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  disconnectBtn:  { backgroundColor: Colors.alerta, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  disconnectBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },

  readCard: {
    marginHorizontal: 16, marginBottom: 8, padding: 16,
    backgroundColor: '#E8F8F0', borderRadius: 14, borderWidth: 1, borderColor: Colors.ok,
  },
  readLabel: { fontSize: 11, fontWeight: '800', color: Colors.textMuted, letterSpacing: 0.5 },
  readValue: { fontSize: 24, fontWeight: '900', color: Colors.text, marginTop: 6, fontFamily: 'monospace' },
  readActions: { flexDirection: 'row', gap: 10, marginTop: 12 },
  readBtn: { backgroundColor: Colors.text, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 8 },
  readBtnText: { color: Colors.primary, fontWeight: '800', fontSize: 13 },
  readBtnGhost: { backgroundColor: 'transparent', borderWidth: 1, borderColor: Colors.border },
  readBtnGhostText: { color: Colors.textLight, fontWeight: '700', fontSize: 13 },

  section:      { marginHorizontal: 16, marginBottom: 8 },
  sectionLabel: { fontSize: 12, fontWeight: '700', color: Colors.textMuted, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },

  scanBtn:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: Colors.primary, borderRadius: 14, padding: 16, borderWidth: 2, borderColor: Colors.text },
  scanBtnStop:  { backgroundColor: Colors.alerta, borderColor: Colors.alerta },
  scanBtnIcon:  { fontSize: 22 },
  scanBtnText:  { fontSize: 16, fontWeight: '800', color: Colors.text },

  deviceCard:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: Colors.surface, borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: Colors.border },
  deviceCardActive: { borderColor: Colors.ok, backgroundColor: '#F0FFF4' },
  deviceLeft:       { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  deviceIcon:       { fontSize: 24 },
  deviceName:       { fontSize: 14, fontWeight: '700', color: Colors.text },
  deviceId:         { fontSize: 11, color: Colors.textMuted, marginTop: 1 },
  deviceRssi:       { fontSize: 11, color: Colors.textMuted },
  connectedBadge:   { backgroundColor: Colors.ok, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  connectedBadgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  conectarText:     { fontSize: 13, color: Colors.pendiente, fontWeight: '600' },

  rawHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rawClear:  { fontSize: 12, color: Colors.alerta, fontWeight: '700' },
  rawBox:    { backgroundColor: '#1E1E1E', borderRadius: 12, padding: 12, minHeight: 60 },
  rawEmpty:  { color: '#9E9E9E', fontSize: 12, lineHeight: 18 },
  rawLine:   { color: '#8BE9A0', fontSize: 12, fontFamily: 'monospace', marginBottom: 3 },
  rawTime:   { color: '#6C7A89' },
  rawHint:   { color: Colors.textMuted, fontSize: 11, marginTop: 6, fontFamily: 'monospace' },

  infoBox:   { margin: 16, backgroundColor: '#FFFDE7', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: Colors.border },
  infoTitle: { fontSize: 12, fontWeight: '700', color: Colors.textLight, marginBottom: 6 },
  infoText:  { fontSize: 12, color: Colors.textLight, lineHeight: 20 },
});
