import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TextInput, StyleSheet, TouchableOpacity,
  SafeAreaView, ScrollView, Alert, ActivityIndicator, Modal, FlatList,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useBLE } from '../hooks/useBLE';
import { getEstablecimientos, insertAnimal, getAnimalByCaravana } from '../db/database';
import { Colors } from '../utils/colors';
import Picker from '../components/Picker';

const CATEGORIAS = [
  { value: 'ternero',    label: 'Ternero' },
  { value: 'novillo',    label: 'Novillo' },
  { value: 'vaquillona', label: 'Vaquillona' },
  { value: 'vaca',       label: 'Vaca' },
  { value: 'toro',       label: 'Toro' },
];
const SEXOS = [{ value: 'macho', label: 'Macho' }, { value: 'hembra', label: 'Hembra' }];

// El ISO valido tiene 15 digitos. Algunos lectores (ALR300) agregan extras al final.
function normalizar(v) {
  const d = String(v || '').replace(/\D/g, '');
  if (d.length > 15 && d.length < 30) return d.slice(0, 15);
  return d;
}
function ultimos4(v) {
  return String(v || '').replace(/\D/g, '').slice(-4);
}

export default function LoteScreen() {
  const navigation = useNavigation();

  const [fase, setFase]       = useState('leyendo');
  const [buffer, setBuffer]   = useState('');
  const [lista, setLista]     = useState([]);
  const [estabs, setEstabs]   = useState([]);
  const [comun, setComun]     = useState({ establecimiento_id: '', categoria: '', sexo: '' });
  const [saving, setSaving]   = useState(false);
  const [mensaje, setMensaje] = useState(null);
  const [showBLE, setShowBLE] = useState(false);
  const [escuchando, setEscuchando] = useState(false);

  const inputRef = useRef(null);
  const listaRef = useRef([]);
  const timerRef = useRef(null);

  const {
    scanning, devices, connected, lastRead, error: bleError,
    startScan, stopScan, connectDevice, disconnect, clearLastRead,
  } = useBLE();

  useEffect(() => { listaRef.current = lista; }, [lista]);

  useEffect(() => {
    getEstablecimientos().then((rows) =>
      setEstabs(rows.map((e) => ({ value: e.id, label: e.nombre })))
    );
    return () => clearTimeout(timerRef.current);
  }, []);

  const agregar = useCallback(async (raw) => {
    const c = normalizar(raw);
    if (!c || c.length < 10) return;

    if (listaRef.current.some((x) => x.caravana === c)) {
      setMensaje({ tipo: 'error', texto: 'Ya escaneada en esta sesion - ' + c });
      return;
    }

    let yaEnBase = false;
    try { yaEnBase = !!(await getAnimalByCaravana(c)); } catch (e) {}

    setLista((prev) =>
      prev.some((x) => x.caravana === c)
        ? prev
        : [{ caravana: c, visual: ultimos4(c), yaEnBase }, ...prev]
    );
    setMensaje(
      yaEnBase
        ? { tipo: 'aviso', texto: 'Ya existe en la base - ' + c }
        : { tipo: 'ok', texto: 'Agregada - ' + c }
    );
  }, []);

  useEffect(() => {
    if (lastRead) {
      agregar(lastRead);
      clearLastRead();
      setShowBLE(false);
    }
  }, [lastRead, clearLastRead, agregar]);

  function onChangeBuffer(v) {
    setBuffer(v);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      if (v && v.replace(/\D/g, '').length >= 10) {
        agregar(v);
        setBuffer('');
      }
    }, 350);
  }

  function activarLectura() {
    inputRef.current?.focus();
  }

  function quitar(caravana) {
    setLista((prev) => prev.filter((x) => x.caravana !== caravana));
  }

  function limpiarTodo() {
    if (!lista.length) return;
    Alert.alert('Vaciar lista', 'Borrar las ' + lista.length + ' lecturas?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Vaciar', style: 'destructive', onPress: () => { setLista([]); setMensaje(null); } },
    ]);
  }

  function finalizarLectura() {
    if (!lista.length) {
      Alert.alert('Sin lecturas', 'Todavia no escaneaste ninguna caravana.');
      return;
    }
    setFase('datos');
  }

  const nuevas = lista.filter((x) => !x.yaEnBase);

  async function guardarLote() {
    if (!comun.categoria) { Alert.alert('Falta la categoria', 'Elegi la categoria del lote.'); return; }
    if (!comun.sexo)      { Alert.alert('Falta el sexo', 'Elegi el sexo del lote.'); return; }
    if (!nuevas.length)   { Alert.alert('Nada para guardar', 'Todas las caravanas ya estan registradas.'); return; }

    setSaving(true);
    try {
      for (const item of nuevas) {
        await insertAnimal({
          caravana: item.caravana,
          caravana_visual: item.visual,
          establecimiento_id: comun.establecimiento_id || null,
          peso: null, edad: null,
          categoria: comun.categoria,
          estado_reproductivo: null, raza: null,
          sexo: comun.sexo,
          fecha_nacimiento: null, observaciones: null,
          estado: 'ok',
        });
      }
      Alert.alert('Lote guardado', 'Se registraron ' + nuevas.length + ' animales.', [
        { text: 'Listo', onPress: () => navigation.goBack() },
      ]);
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 40 }}>

        {fase === 'leyendo' ? (
          <>
            <TouchableOpacity activeOpacity={0.9} style={styles.scanCard} onPress={activarLectura}>
              <View style={styles.scanIconBox}>
                <Text style={styles.scanIcon}>📡</Text>
              </View>

              <Text style={styles.scanTitle}>
                {escuchando ? 'Esperando lectura del microchip' : 'Lectura pausada'}
              </Text>

              {escuchando ? (
                <View style={styles.scanRow}>
                  <ActivityIndicator size="small" color={Colors.text} />
                  <Text style={styles.scanSub}>{'  '}Pasa el baston por la caravana...</Text>
                </View>
              ) : (
                <Text style={styles.scanSubOff}>Toca aca para activar la lectura</Text>
              )}

              <TextInput
                ref={inputRef}
                style={styles.scanInput}
                value={buffer}
                onChangeText={onChangeBuffer}
                onFocus={() => setEscuchando(true)}
                onBlur={() => setEscuchando(false)}
                autoFocus
                autoCorrect={false}
              />

              {connected ? (
                <View style={styles.bleRow}>
                  <Text style={styles.bleOk}>🔵 {connected.name}</Text>
                  <TouchableOpacity onPress={disconnect}>
                    <Text style={styles.bleLink}>Desconectar</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity style={styles.bleBtn} onPress={() => { setShowBLE(true); startScan(); }}>
                  <Text style={styles.bleBtnText}>🔗 Conectar baston por Bluetooth</Text>
                </TouchableOpacity>
              )}

              {!!mensaje && (
                <Text style={[
                  styles.msg,
                  mensaje.tipo === 'ok' && styles.msgOk,
                  mensaje.tipo === 'aviso' && styles.msgAviso,
                  mensaje.tipo === 'error' && styles.msgError,
                ]}>
                  {mensaje.tipo === 'ok' ? '✓ ' : '⚠️ '}{mensaje.texto}
                </Text>
              )}
            </TouchableOpacity>

            <View style={styles.contadorRow}>
              <Text style={styles.contador}>
                {lista.length} leidas{lista.length > 0 ? ' - ' + nuevas.length + ' nuevas' : ''}
              </Text>
              {lista.length > 0 && (
                <TouchableOpacity onPress={limpiarTodo}>
                  <Text style={styles.limpiar}>Vaciar</Text>
                </TouchableOpacity>
              )}
            </View>

            {lista.map((item) => (
              <View key={item.caravana} style={[styles.item, item.yaEnBase && styles.itemDup]}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemCaravana}>{item.caravana}</Text>
                  <Text style={styles.itemVisual}>
                    visual: {item.visual}{item.yaEnBase ? ' - ya registrada' : ''}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => quitar(item.caravana)} style={styles.quitarBtn}>
                  <Text style={styles.quitarTxt}>✕</Text>
                </TouchableOpacity>
              </View>
            ))}

            {lista.length === 0 && (
              <Text style={styles.vacio}>Todavia no escaneaste ninguna caravana.</Text>
            )}

            <TouchableOpacity style={styles.finBtn} onPress={finalizarLectura}>
              <Text style={styles.finBtnText}>FINALIZAR LECTURA</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <View style={styles.resumen}>
              <Text style={styles.resumenNum}>{nuevas.length}</Text>
              <Text style={styles.resumenTxt}>
                animales para registrar
                {lista.length - nuevas.length > 0 ? ' (' + (lista.length - nuevas.length) + ' ya estaban)' : ''}
              </Text>
            </View>

            <View style={styles.comunBox}>
              <Text style={styles.comunTitulo}>Datos para todo el lote</Text>

              <Picker
                label="Categoria *"
                value={comun.categoria}
                options={CATEGORIAS}
                onChange={(v) => setComun((p) => ({ ...p, categoria: v }))}
                placeholder="Seleccionar categoria..."
              />
              <Picker
                label="Sexo *"
                value={comun.sexo}
                options={SEXOS}
                onChange={(v) => setComun((p) => ({ ...p, sexo: v }))}
                placeholder="Seleccionar sexo..."
              />
              <Picker
                label="Campo"
                value={comun.establecimiento_id}
                options={[{ value: '', label: 'Sin establecimiento' }, ...estabs]}
                onChange={(v) => setComun((p) => ({ ...p, establecimiento_id: v }))}
                placeholder="Seleccionar campo..."
              />

              <TouchableOpacity style={styles.saveBtn} onPress={guardarLote} disabled={saving}>
                {saving
                  ? <ActivityIndicator color={Colors.primary} />
                  : <Text style={styles.saveBtnText}>Guardar {nuevas.length} animales</Text>
                }
              </TouchableOpacity>

              <TouchableOpacity onPress={() => setFase('leyendo')} style={styles.volverBtn}>
                <Text style={styles.volverTxt}>← Volver a escanear</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </ScrollView>

      <Modal visible={showBLE} animationType="slide" transparent>
        <View style={styles.overlay}>
          <SafeAreaView style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Conectar baston</Text>
              <TouchableOpacity onPress={() => { stopScan(); setShowBLE(false); }}>
                <Text style={styles.sheetClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <View style={{ padding: 16 }}>
              {!!bleError && <Text style={styles.bleError}>⚠️ {bleError}</Text>}
              <TouchableOpacity style={styles.buscarBtn} onPress={scanning ? stopScan : startScan}>
                <Text style={styles.buscarBtnText}>
                  {scanning ? 'Buscando...' : '🔍 Buscar dispositivos'}
                </Text>
              </TouchableOpacity>
              {scanning && <ActivityIndicator style={{ marginTop: 12 }} color={Colors.text} />}
              <FlatList
                style={{ maxHeight: 320, marginTop: 12 }}
                data={devices}
                keyExtractor={(d) => d.id}
                renderItem={({ item }) => (
                  <TouchableOpacity style={styles.bleDevice} onPress={() => connectDevice(item.id)}>
                    <Text style={styles.bleDeviceName}>{item.bonded ? '★ ' : ''}{item.name}</Text>
                    <Text style={styles.bleDeviceId}>{item.id}</Text>
                  </TouchableOpacity>
                )}
                ListEmptyComponent={
                  !scanning ? <Text style={styles.vacio}>Toca "Buscar dispositivos".</Text> : null
                }
              />
            </View>
          </SafeAreaView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },

  scanCard: {
    margin: 16, padding: 20, backgroundColor: Colors.surface,
    borderRadius: 16, borderWidth: 2, borderColor: Colors.text,
    alignItems: 'center', elevation: 3,
  },
  scanIconBox: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center',
    marginBottom: 12, borderWidth: 2, borderColor: Colors.text,
  },
  scanIcon:   { fontSize: 34 },
  scanTitle:  { fontSize: 17, fontWeight: '800', color: Colors.text, textAlign: 'center' },
  scanRow:    { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
  scanSub:    { fontSize: 13, color: Colors.textLight },
  scanSubOff: { fontSize: 13, color: Colors.alerta, marginTop: 6, fontWeight: '600' },
  scanInput: {
    width: '100%', marginTop: 14,
    backgroundColor: Colors.background, borderWidth: 1, borderColor: Colors.border,
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10,
    fontSize: 16, color: Colors.text, fontFamily: 'monospace', textAlign: 'center',
  },

  bleRow:  { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 12 },
  bleOk:   { fontSize: 13, fontWeight: '700', color: Colors.ok },
  bleLink: { fontSize: 13, fontWeight: '700', color: Colors.alerta },
  bleBtn:  { marginTop: 12, paddingVertical: 8, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1, borderColor: Colors.border },
  bleBtnText: { fontSize: 13, fontWeight: '700', color: Colors.textLight },

  msg:      { fontSize: 13, fontWeight: '700', marginTop: 12, textAlign: 'center' },
  msgOk:    { color: Colors.ok },
  msgAviso: { color: '#E65100' },
  msgError: { color: Colors.alerta },

  contadorRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginHorizontal: 16, marginBottom: 8,
  },
  contador: { fontSize: 14, fontWeight: '800', color: Colors.textLight },
  limpiar:  { fontSize: 13, fontWeight: '700', color: Colors.alerta },

  item: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 16, marginBottom: 6, padding: 12,
    backgroundColor: Colors.surface, borderRadius: 10,
    borderWidth: 1, borderColor: Colors.border,
  },
  itemDup:      { backgroundColor: '#FFF3E0', borderColor: '#FFB74D' },
  itemCaravana: { fontSize: 15, fontWeight: '700', color: Colors.text, fontFamily: 'monospace' },
  itemVisual:   { fontSize: 11, color: Colors.textMuted, marginTop: 2 },
  quitarBtn:    { paddingHorizontal: 8, paddingVertical: 4 },
  quitarTxt:    { fontSize: 16, color: Colors.alerta, fontWeight: '800' },

  vacio: { textAlign: 'center', color: Colors.textMuted, fontSize: 13, marginTop: 16, marginHorizontal: 16 },

  finBtn: {
    margin: 16, marginTop: 24, backgroundColor: Colors.text,
    borderRadius: 12, paddingVertical: 16, alignItems: 'center',
  },
  finBtnText: { color: Colors.primary, fontWeight: '900', fontSize: 16, letterSpacing: 0.5 },

  resumen: { alignItems: 'center', marginTop: 24, marginBottom: 8 },
  resumenNum: { fontSize: 44, fontWeight: '900', color: Colors.text },
  resumenTxt: { fontSize: 14, color: Colors.textLight, marginTop: 2 },

  comunBox: {
    margin: 16, padding: 16,
    backgroundColor: Colors.surface, borderRadius: 14,
    borderWidth: 1, borderColor: Colors.border,
  },
  comunTitulo: { fontSize: 15, fontWeight: '800', color: Colors.text, marginBottom: 12 },

  saveBtn:     { backgroundColor: Colors.text, borderRadius: 12, paddingVertical: 15, alignItems: 'center', marginTop: 8 },
  saveBtnText: { color: Colors.primary, fontWeight: '800', fontSize: 16 },
  volverBtn:   { alignItems: 'center', paddingVertical: 12 },
  volverTxt:   { color: Colors.textLight, fontWeight: '700', fontSize: 13 },

  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet:   { backgroundColor: Colors.background, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '80%' },
  sheetHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 16, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  sheetTitle: { fontSize: 17, fontWeight: '800', color: Colors.text },
  sheetClose: { fontSize: 20, color: Colors.textLight },
  bleError:   { color: Colors.alerta, fontSize: 12, marginBottom: 10, fontWeight: '600' },
  buscarBtn:  { backgroundColor: Colors.primary, borderRadius: 12, paddingVertical: 14, alignItems: 'center', borderWidth: 2, borderColor: Colors.text },
  buscarBtnText: { fontSize: 15, fontWeight: '800', color: Colors.text },
  bleDevice:  { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.border },
  bleDeviceName: { fontSize: 15, fontWeight: '700', color: Colors.text },
  bleDeviceId:   { fontSize: 11, color: Colors.textMuted, marginTop: 2 },
});
