import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TextInput, StyleSheet, TouchableOpacity, SafeAreaView,
  ScrollView, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import * as XLSX from 'xlsx';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

import { useBLE } from '../hooks/useBLE';
import { Colors } from '../utils/colors';
import {
  getEstablecimientos, getToros, insertToro,
  crearPlanillaInsem, getPlanillasInsem, deletePlanillaInsem,
  insertInsemRegistro, getInsemRegistros, deleteInsemRegistro,
} from '../db/database';

function normalizar(v) {
  const d = String(v || '').replace(/\D/g, '');
  if (d.length > 15 && d.length < 30) return d.slice(0, 15);
  return d;
}
function ultimos4(v) { return String(v || '').replace(/\D/g, '').slice(-4); }

const CATEGORIAS = [
  { value: 'vaca', label: 'Vaca' },
  { value: 'vaquillona', label: 'Vaquillona' },
];
const ESTADOS = ['1', '2', '3', '4', '5'];

export default function InseminacionScreen() {
  const [fase, setFase] = useState('lista');
  const [planillas, setPlanillas] = useState([]);
  const [planilla, setPlanilla] = useState(null);
  const [estabs, setEstabs] = useState([]);

  const recargarPlanillas = useCallback(async () => {
    setPlanillas(await getPlanillasInsem());
  }, []);
  useEffect(() => {
    recargarPlanillas();
    getEstablecimientos().then((rows) =>
      setEstabs(rows.map((e) => ({ value: e.id, label: e.nombre }))));
  }, [recargarPlanillas]);

  if (fase === 'lista') {
    return (
      <ListaPlanillas
        planillas={planillas}
        estabs={estabs}
        onAbrir={(p) => { setPlanilla(p); setFase('cargando'); }}
        onCrear={async ({ nombre, establecimiento_id }) => {
          const id = await crearPlanillaInsem({ nombre, establecimiento_id });
          await recargarPlanillas();
          setPlanilla({ id, nombre, establecimiento_id });
          setFase('cargando');
        }}
        onBorrar={async (id) => { await deletePlanillaInsem(id); recargarPlanillas(); }}
      />
    );
  }

  return (
    <CargaPlanilla
      planilla={planilla}
      onSalir={() => { setPlanilla(null); setFase('lista'); recargarPlanillas(); }}
    />
  );
}

function ListaPlanillas({ planillas, estabs, onAbrir, onCrear, onBorrar }) {
  const [nombre, setNombre] = useState('');
  const [estab, setEstab] = useState('');

  function crear() {
    if (!nombre.trim()) { Alert.alert('Falta el nombre', 'Poné un nombre a la planilla.'); return; }
    onCrear({ nombre: nombre.trim(), establecimiento_id: estab || null });
    setNombre(''); setEstab('');
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled">
          <View style={styles.card}>
            <Text style={styles.titulo}>Nueva planilla de inseminación</Text>
            <Text style={styles.label}>Nombre</Text>
            <TextInput style={styles.input} value={nombre} onChangeText={setNombre}
              placeholder="Ej: IATF Lote 1 - 17/10" />
            {estabs.length > 0 && (
              <>
                <Text style={styles.label}>Campo (opcional)</Text>
                <View style={styles.chipRow}>
                  <TouchableOpacity
                    style={[styles.chip, estab === '' && styles.chipOn]}
                    onPress={() => setEstab('')}>
                    <Text style={[styles.chipTxt, estab === '' && styles.chipTxtOn]}>Sin campo</Text>
                  </TouchableOpacity>
                  {estabs.map((e) => (
                    <TouchableOpacity key={e.value}
                      style={[styles.chip, estab === e.value && styles.chipOn]}
                      onPress={() => setEstab(e.value)}>
                      <Text style={[styles.chipTxt, estab === e.value && styles.chipTxtOn]}>{e.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}
            <TouchableOpacity style={styles.botonY} onPress={crear}>
              <Text style={styles.botonYtxt}>Crear planilla</Text>
            </TouchableOpacity>
          </View>

          <Text style={[styles.titulo, { marginLeft: 4, marginTop: 8 }]}>Planillas</Text>
          {planillas.length === 0 ? (
            <Text style={styles.vacio}>Todavía no hay planillas. Creá una arriba.</Text>
          ) : planillas.map((p) => (
            <View key={p.id} style={styles.item}>
              <TouchableOpacity style={{ flex: 1 }} onPress={() => onAbrir(p)}>
                <Text style={styles.itemTit}>{p.nombre}</Text>
                <Text style={styles.itemSub}>
                  {(p.establecimiento_nombre ? p.establecimiento_nombre + ' · ' : '')}
                  {p.total} animal{p.total === 1 ? '' : 'es'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() =>
                Alert.alert('Borrar planilla', '¿Borrar "' + p.nombre + '" y sus registros?', [
                  { text: 'Cancelar', style: 'cancel' },
                  { text: 'Borrar', style: 'destructive', onPress: () => onBorrar(p.id) },
                ])}>
                <Text style={styles.borrar}>Borrar</Text>
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function CargaPlanilla({ planilla, onSalir }) {
  const [buffer, setBuffer]   = useState('');
  const [caravana, setCaravana] = useState('');
  const [categoria, setCategoria] = useState('');
  const [semen, setSemen]     = useState('');
  const [estado, setEstado]   = useState('');
  const [celo, setCelo]       = useState('');
  const [obs, setObs]         = useState('');

  const [toros, setToros]     = useState([]);
  const [nuevoToro, setNuevoToro] = useState('');
  const [registros, setRegistros] = useState([]);
  const [escuchando, setEscuchando] = useState(false);

  const inputRef = useRef(null);
  const timerRef = useRef(null);
  const ble = useBLE();
  const lastRead = ble?.lastRead;
  const connected = ble?.connected;
  const clearLastRead = ble?.clearLastRead;

  const recargar = useCallback(async () => {
    setRegistros(await getInsemRegistros(planilla.id));
    setToros(await getToros());
  }, [planilla.id]);
  useEffect(() => { recargar(); return () => clearTimeout(timerRef.current); }, [recargar]);

  useEffect(() => {
    if (lastRead) {
      setCaravana(normalizar(lastRead));
      if (clearLastRead) clearLastRead();
    }
  }, [lastRead, clearLastRead]);

  function onChangeBuffer(v) {
    setBuffer(v);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      if (v && v.replace(/\D/g, '').length >= 10) {
        setCaravana(normalizar(v)); setBuffer('');
      }
    }, 350);
  }

  async function agregarToro() {
    const n = nuevoToro.trim();
    if (!n) return;
    await insertToro(n);
    setNuevoToro('');
    setSemen(n);
    setToros(await getToros());
  }

  function limpiarForm() {
    setCaravana(''); setCategoria(''); setSemen(''); setEstado(''); setCelo(''); setObs('');
  }

  async function guardar() {
    if (!caravana) { Alert.alert('Falta la caravana', 'Leé o escribí el N° de caravana.'); return; }
    await insertInsemRegistro(planilla.id, {
      caravana,
      caravana_visual: ultimos4(caravana),
      categoria, semen, estado_corporal: estado, celo, observaciones: obs,
    });
    limpiarForm();
    await recargar();
    inputRef.current?.focus();
  }

  async function exportar() {
    const regs = await getInsemRegistros(planilla.id);
    if (!regs.length) { Alert.alert('Sin datos', 'La planilla no tiene registros.'); return; }
    const cab = ['Caravana', 'Visual', 'Categoría', 'Semen', 'Estado corporal', 'Celo', 'Observaciones'];
    const filas = regs.map((r) => [
      r.caravana, r.caravana_visual || '',
      r.categoria === 'vaca' ? 'Vaca' : r.categoria === 'vaquillona' ? 'Vaquillona' : '',
      r.semen || '', r.estado_corporal || '',
      r.celo === 'si' ? 'Sí' : r.celo === 'no' ? 'No' : '',
      r.observaciones || '',
    ]);
    const ws = XLSX.utils.aoa_to_sheet([cab, ...filas]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Inseminación');
    const wbout = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
    const nombre = 'Inseminacion_' + (planilla.nombre || 'planilla').replace(/[^\w]+/g, '_') + '.xlsx';
    const uri = FileSystem.documentDirectory + nombre;
        await FileSystem.writeAsStringAsync(uri, wbout, { encoding: 'base64' });
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri, {
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        dialogTitle: 'Compartir planilla de inseminación',
      });
    } else {
      Alert.alert('Listo', 'Archivo guardado: ' + nombre);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={styles.topbar}>
          <TouchableOpacity onPress={onSalir}><Text style={styles.volver}>‹ Planillas</Text></TouchableOpacity>
          <Text style={styles.topTit} numberOfLines={1}>{planilla.nombre}</Text>
          <TouchableOpacity onPress={exportar}><Text style={styles.export}>Excel</Text></TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
          <TouchableOpacity activeOpacity={0.9} style={styles.scanCard} onPress={() => inputRef.current?.focus()}>
            <Text style={styles.scanIcon}>📡</Text>
            <Text style={styles.scanTitle}>{escuchando ? 'Pasá el bastón por la caravana' : 'Tocá para leer'}</Text>
            {!!caravana && <Text style={styles.carav}>{caravana}</Text>}
            {connected ? <Text style={styles.conn}>Bastón conectado</Text> : null}
            <TextInput ref={inputRef} style={styles.hidden} value={buffer}
              onChangeText={onChangeBuffer}
              onFocus={() => setEscuchando(true)} onBlur={() => setEscuchando(false)}
              autoFocus autoCorrect={false} />
          </TouchableOpacity>

          <Text style={styles.label}>N° de caravana</Text>
          <TextInput style={styles.input} value={caravana} onChangeText={(v) => setCaravana(v)}
            placeholder="Leé con el bastón o escribí" keyboardType="number-pad" />

          <Text style={styles.label}>Categoría</Text>
          <View style={styles.chipRow}>
            {CATEGORIAS.map((c) => (
              <TouchableOpacity key={c.value}
                style={[styles.chip, categoria === c.value && styles.chipOn]}
                onPress={() => setCategoria(c.value)}>
                <Text style={[styles.chipTxt, categoria === c.value && styles.chipTxtOn]}>{c.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>Semen utilizado</Text>
          <View style={styles.chipRow}>
            {toros.map((t) => (
              <TouchableOpacity key={t.id}
                style={[styles.chip, semen === t.nombre && styles.chipOn]}
                onPress={() => setSemen(t.nombre)}>
                <Text style={[styles.chipTxt, semen === t.nombre && styles.chipTxtOn]}>{t.nombre}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={styles.rowNuevo}>
            <TextInput style={[styles.input, { flex: 1, marginRight: 8 }]} value={nuevoToro}
              onChangeText={setNuevoToro} placeholder="Agregar toro / semen nuevo" />
            <TouchableOpacity style={styles.botonMini} onPress={agregarToro}>
              <Text style={styles.botonMiniTxt}>+ Agregar</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.label}>Estado corporal (1 a 5)</Text>
          <View style={styles.chipRow}>
            {ESTADOS.map((e) => (
              <TouchableOpacity key={e}
                style={[styles.chipNum, estado === e && styles.chipOn]}
                onPress={() => setEstado(e)}>
                <Text style={[styles.chipTxt, estado === e && styles.chipTxtOn]}>{e}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>¿Presenta celo?</Text>
          <View style={styles.chipRow}>
            {[['si', 'Sí'], ['no', 'No']].map(([v, l]) => (
              <TouchableOpacity key={v}
                style={[styles.chip, celo === v && styles.chipOn]}
                onPress={() => setCelo(v)}>
                <Text style={[styles.chipTxt, celo === v && styles.chipTxtOn]}>{l}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>Observaciones</Text>
          <TextInput style={[styles.input, { height: 70 }]} value={obs} onChangeText={setObs}
            placeholder="Opcional" multiline />

          <TouchableOpacity style={styles.botonY} onPress={guardar}>
            <Text style={styles.botonYtxt}>Guardar y seguir</Text>
          </TouchableOpacity>

          <Text style={[styles.titulo, { marginTop: 22 }]}>Cargados ({registros.length})</Text>
          {registros.map((r) => (
            <View key={r.id} style={styles.regItem}>
              <View style={{ flex: 1 }}>
                <Text style={styles.regCarav}>{r.caravana}</Text>
                <Text style={styles.regSub}>
                  {(r.categoria === 'vaca' ? 'Vaca' : r.categoria === 'vaquillona' ? 'Vaquillona' : '-')}
                  {r.semen ? ' · ' + r.semen : ''}
                  {r.estado_corporal ? ' · EC ' + r.estado_corporal : ''}
                  {r.celo === 'si' ? ' · Celo' : ''}
                </Text>
              </View>
              <TouchableOpacity onPress={async () => { await deleteInsemRegistro(r.id); recargar(); }}>
                <Text style={styles.borrar}>✕</Text>
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  topbar: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.header,
    paddingHorizontal: 14, paddingVertical: 12 },
  volver: { color: Colors.headerTint, fontSize: 16, fontWeight: '600' },
  topTit: { flex: 1, color: Colors.headerTint, fontSize: 16, fontWeight: '700', textAlign: 'center' },
  export: { color: Colors.headerTint, fontSize: 15, fontWeight: '700' },

  card: { backgroundColor: Colors.surface, borderRadius: 14, padding: 16, marginBottom: 16,
    borderWidth: 1, borderColor: Colors.border },
  titulo: { fontSize: 17, fontWeight: '700', color: Colors.text, marginBottom: 8 },
  label: { fontSize: 13, color: Colors.textLight, fontWeight: '600', marginTop: 14, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: Colors.border, borderRadius: 10, paddingHorizontal: 12,
    paddingVertical: 11, fontSize: 16, color: Colors.text, backgroundColor: '#fff' },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingVertical: 9, paddingHorizontal: 16, borderRadius: 20, borderWidth: 1,
    borderColor: Colors.border, backgroundColor: '#fff' },
  chipNum: { width: 48, alignItems: 'center', paddingVertical: 10, borderRadius: 12, borderWidth: 1,
    borderColor: Colors.border, backgroundColor: '#fff' },
  chipOn: { backgroundColor: Colors.primary, borderColor: Colors.primaryDark },
  chipTxt: { fontSize: 14, color: Colors.textLight, fontWeight: '600' },
  chipTxtOn: { color: Colors.text },

  rowNuevo: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  botonMini: { backgroundColor: Colors.text, borderRadius: 10, paddingVertical: 11, paddingHorizontal: 14 },
  botonMiniTxt: { color: Colors.primary, fontWeight: '700' },

  botonY: { backgroundColor: Colors.primary, borderRadius: 12, paddingVertical: 15, alignItems: 'center', marginTop: 20 },
  botonYtxt: { fontSize: 16, fontWeight: '700', color: Colors.text },

  scanCard: { backgroundColor: Colors.surface, borderRadius: 14, padding: 18, alignItems: 'center',
    borderWidth: 1, borderColor: Colors.border, marginBottom: 8 },
  scanIcon: { fontSize: 32 },
  scanTitle: { fontSize: 15, color: Colors.textLight, marginTop: 6, fontWeight: '600' },
  carav: { fontSize: 22, fontWeight: '800', color: Colors.text, marginTop: 8, letterSpacing: 1 },
  conn: { fontSize: 12, color: Colors.ok, marginTop: 4 },
  hidden: { height: 1, width: 1, opacity: 0 },

  item: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface, borderRadius: 12,
    padding: 14, marginBottom: 10, borderWidth: 1, borderColor: Colors.border },
  itemTit: { fontSize: 16, fontWeight: '700', color: Colors.text },
  itemSub: { fontSize: 13, color: Colors.textMuted, marginTop: 2 },
  borrar: { color: Colors.alerta, fontWeight: '700', paddingHorizontal: 8 },
  vacio: { color: Colors.textMuted, textAlign: 'center', padding: 24 },

  regItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface, borderRadius: 10,
    padding: 12, marginBottom: 8, borderWidth: 1, borderColor: Colors.border },
  regCarav: { fontSize: 15, fontWeight: '700', color: Colors.text, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  regSub: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
});