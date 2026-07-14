import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  Alert, ActivityIndicator, Modal, FlatList, SafeAreaView, Platform,
  KeyboardAvoidingView,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useNavigation, useRoute } from '@react-navigation/native';
import {
  insertAnimal, updateAnimal, getAnimalById, getAnimalByCaravana,
  getEstablecimientos, insertEstablecimiento,
} from '../db/database';
import { useBLE } from '../hooks/useBLE';
import { Colors } from '../utils/colors';
import FormField, { Input } from '../components/FormField';
import { formatRenspa } from '../utils/formatters';
import Picker from '../components/Picker';

const MESES = [
  'Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre',
];

function fechaEsp(isoStr) {
  if (!isoStr) return null;
  const [y, m, d] = isoStr.split('-');
  return `${d} de ${MESES[parseInt(m, 10) - 1]} de ${y}`;
}

const CATEGORIAS = [
  { value: 'ternero',   label: 'Ternero' },
  { value: 'novillo',   label: 'Novillo' },
  { value: 'vaquillona',label: 'Vaquillona' },
  { value: 'vaca',      label: 'Vaca' },
  { value: 'toro',      label: 'Toro' },
];
const SEXOS   = [{ value: 'macho', label: 'Macho' }, { value: 'hembra', label: 'Hembra' }];
const ESTADOS = [{ value: 'ok', label: 'OK' }, { value: 'vacuna', label: 'Vacuna' }, { value: 'alerta', label: 'Alerta' }];
const RAZAS   = [
  'Aberdeen Angus','Hereford','Braford','Brangus','Holando Argentino',
  'Limousin','Simmental','Shorthorn','Charolais','Otro',
].map((r) => ({ value: r, label: r }));

const FORM_EMPTY = {
  caravana: '', caravana_visual: '', establecimiento_id: '', peso: '', edad: '',
  categoria: '', estado_reproductivo: '', raza: '', sexo: '',
  fecha_nacimiento: '', observaciones: '', estado: 'ok',
};

// Ultimos 4 digitos del numero electronico (identificacion visual rapida).
function ultimos4(v) {
  return String(v || '').replace(/\D/g, '').slice(-4);
}

export default function RegistroAnimalScreen() {
  const navigation = useNavigation();
  const route      = useRoute();
  const editId     = route.params?.id;

  const [form, setForm] = useState({ ...FORM_EMPTY });
  const [visualAuto, setVisualAuto] = useState(true);
  const [duplicado, setDuplicado] = useState(null);
  const [ajustado, setAjustado] = useState(false);
  const [errors, setErrors]             = useState({});
  const [establecimientos, setEstabs]   = useState([]);
  const [saving, setSaving]             = useState(false);
  const [showBLE, setShowBLE]           = useState(false);
  const [showDatePicker, setDatePicker] = useState(false);

  // Modal nuevo establecimiento
  const [showNuevoEst, setShowNuevoEst] = useState(false);
  const [nuevoEst, setNuevoEst]         = useState({ nombre: '', renspa: '' });

  const {
    scanning, devices, connected, lastRead, error: bleError,
    startScan, stopScan, connectDevice, disconnect, clearLastRead, isSupported,
  } = useBLE();

  useEffect(() => { cargarEstabs(); }, []);

  useEffect(() => {
    if (editId) {
      getAnimalById(editId).then((a) => {
        if (a) {
          setForm({ ...a, peso: String(a.peso ?? ''), edad: String(a.edad ?? ''), caravana_visual: a.caravana_visual ?? '' });
          setVisualAuto(false);
        }
      });
    }
  }, [editId]);

  useEffect(() => {
    if (lastRead) {
      aplicarCaravana(lastRead);
      clearLastRead();
      setShowBLE(false);
    }
  }, [lastRead, clearLastRead, visualAuto]);

  // Detectar si la caravana ya está registrada
  useEffect(() => {
    const c = form.caravana.trim();
    if (!c) { setDuplicado(null); return; }
    let cancel = false;
    const t = setTimeout(async () => {
      try {
        const found = await getAnimalByCaravana(c, editId);
        if (!cancel) setDuplicado(found || null);
      } catch (e) { /* ignore */ }
    }, 350);
    return () => { cancel = true; clearTimeout(t); };
  }, [form.caravana, editId]);

  async function cargarEstabs() {
    const rows = await getEstablecimientos();
    setEstabs(rows.map((e) => ({ value: e.id, label: e.nombre })));
  }

  function set(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  }

  // Algunos lectores (p. ej. ALR300) agregan digitos extra al final.
  // El numero ISO valido tiene 15 digitos: nos quedamos con los primeros 15.
  function normalizar(v) {
    const d = String(v || '').replace(/\D/g, '');
    if (d.length > 15 && d.length < 30) {
      return { valor: d.slice(0, 15), ajustado: true };
    }
    return { valor: v, ajustado: false };
  }

  function aplicarCaravana(v) {
    const { valor, ajustado: aj } = normalizar(v);
    setAjustado(aj);
    setForm((prev) => ({
      ...prev,
      caravana: valor,
      caravana_visual: visualAuto ? ultimos4(valor) : prev.caravana_visual,
    }));
    setErrors((prev) => ({ ...prev, caravana: undefined }));
  }

  function onChangeCaravana(v) {
    aplicarCaravana(v);
  }

  function usarUltimaLectura() {
    const ult = form.caravana.replace(/\D/g, '').slice(-15);
    setAjustado(false);
    setForm((prev) => ({ ...prev, caravana: ult, caravana_visual: visualAuto ? ult.slice(-4) : prev.caravana_visual }));
  }

  function validate() {
    const e = {};
    if (!form.caravana.trim()) e.caravana = 'Ingresá el número de caravana';
    if (!form.categoria)       e.categoria = 'Seleccioná una categoría';
    if (!form.sexo)            e.sexo = 'Seleccioná el sexo';
    if (form.peso && isNaN(Number(form.peso))) e.peso = 'Peso inválido';
    if (form.edad && isNaN(Number(form.edad))) e.edad = 'Edad inválida';
    setErrors(e);
    return !Object.keys(e).length;
  }

  async function doGuardar(seguir) {
    setSaving(true);
    try {
      const data = {
        ...form,
        peso: form.peso ? Number(form.peso) : null,
        edad: form.edad ? Number(form.edad) : null,
        establecimiento_id: form.establecimiento_id || null,
      };
      if (editId) await updateAnimal(editId, data);
      else        await insertAnimal(data);
      if (seguir && !editId) {
        setForm({ ...FORM_EMPTY, establecimiento_id: form.establecimiento_id });
        setVisualAuto(true);
        setErrors({});
        setDuplicado(null);
      } else {
        navigation.goBack();
      }
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setSaving(false);
    }
  }

  async function guardar(seguir = false) {
    if (!validate()) return;
    if (duplicado && !editId) {
      Alert.alert(
        'Caravana repetida',
        'Esta caravana ya está registrada. ¿Querés registrarla igual?',
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Registrar igual', onPress: () => doGuardar(seguir) },
        ],
      );
      return;
    }
    doGuardar(seguir);
  }

  async function crearEstablecimiento() {
    if (!nuevoEst.nombre.trim()) {
      Alert.alert('Error', 'El nombre es obligatorio');
      return;
    }
    const id = await insertEstablecimiento({ nombre: nuevoEst.nombre, renspa: nuevoEst.renspa });
    await cargarEstabs();
    set('establecimiento_id', id);
    setNuevoEst({ nombre: '', renspa: '' });
    setShowNuevoEst(false);
  }

  function onDateChange(event, date) {
    if (Platform.OS === 'android') setDatePicker(false);
    if (event.type === 'dismissed') return;
    if (date) set('fecha_nacimiento', date.toISOString().split('T')[0]);
  }

  const digitos = form.caravana.replace(/\D/g, '');
  const lecturaOk = digitos.length === 15;
  const dobleLectura = digitos.length >= 30;   // dos lecturas pegadas
  const largoRaro = digitos.length > 15 && digitos.length < 30;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView style={styles.scroll} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 160 }}>
        <View style={styles.container}>

          {/* Caravana + BLE */}
          <FormField label="N° Caravana *" error={errors.caravana}>
            <View style={styles.row2}>
              <Input
                style={{ flex: 1 }}
                value={form.caravana}
                onChangeText={onChangeCaravana}
                placeholder="Nº electrónico o visual"
                autoCapitalize="characters"
              />
              <TouchableOpacity style={styles.bleBtn} onPress={() => setShowBLE(true)}>
                <Text style={styles.bleBtnText}>📡 RFID</Text>
              </TouchableOpacity>
            </View>
          </FormField>

          {dobleLectura && (
            <View style={styles.avisoDoble}>
              <Text style={styles.avisoDobleText}>⚠️ Parece doble lectura ({digitos.length} dígitos)</Text>
              <TouchableOpacity onPress={usarUltimaLectura} style={styles.avisoDobleBtn}>
                <Text style={styles.avisoDobleBtnText}>Usar la última</Text>
              </TouchableOpacity>
            </View>
          )}
          {largoRaro && (
            <View style={styles.avisoDoble}>
              <Text style={styles.avisoDobleText}>⚠️ Lectura de {digitos.length} dígitos (el ISO tiene 15)</Text>
            </View>
          )}
          {lecturaOk && (
            <Text style={styles.lecturaOk}>
              ✓ Caravana válida · visual: {ultimos4(form.caravana)}
              {ajustado ? ' · ajustada (el lector mandó dígitos de más)' : ''}
            </Text>
          )}

          <FormField label="Caravana visual (opcional)">
            <Input
              value={form.caravana_visual}
              onChangeText={(v) => { setVisualAuto(false); setForm((prev) => ({ ...prev, caravana_visual: v })); }}
              placeholder="Últimos 4 del RFID o Nº de plástico"
              autoCapitalize="characters"
            />
          </FormField>

          {duplicado && !editId && (
            <TouchableOpacity style={styles.dupCard} onPress={() => navigation.navigate('DetalleAnimal', { id: duplicado.id })}>
              <Text style={styles.dupTitle}>⚠️ Caravana ya registrada</Text>
              <Text style={styles.dupInfo}>
                {duplicado.categoria || 'Animal'}
                {duplicado.establecimiento_nombre ? ` · ${duplicado.establecimiento_nombre}` : ''}
                {duplicado.caravana_visual ? ` · visual ${duplicado.caravana_visual}` : ''}
              </Text>
              <Text style={styles.dupInfo}>Registrada el {String(duplicado.created_at || '').slice(0, 10)}</Text>
              <Text style={styles.dupLink}>Ver este animal →</Text>
            </TouchableOpacity>
          )}

          {/* Establecimiento + botón Nuevo */}
          <FormField label="Establecimiento" error={errors.establecimiento_id}>
            <View style={styles.row2}>
              <View style={{ flex: 1 }}>
                <Picker
                  label="Establecimiento"
                  value={form.establecimiento_id}
                  options={[{ value: '', label: 'Sin establecimiento' }, ...establecimientos]}
                  onChange={(v) => set('establecimiento_id', v)}
                  placeholder="Seleccionar establecimiento..."
                />
              </View>
              <TouchableOpacity style={styles.nuevoEstBtn} onPress={() => setShowNuevoEst(true)}>
                <Text style={styles.nuevoEstBtnText}>+ Nuevo</Text>
              </TouchableOpacity>
            </View>
          </FormField>

          {/* Peso / Edad */}
          <View style={styles.rowFields}>
            <FormField label="Peso (kg)" style={{ flex: 1, marginRight: 8 }} error={errors.peso}>
              <Input value={form.peso} onChangeText={(v) => set('peso', v)} placeholder="0.0" keyboardType="decimal-pad" />
            </FormField>
            <FormField label="Edad (meses)" style={{ flex: 1 }} error={errors.edad}>
              <Input value={form.edad} onChangeText={(v) => set('edad', v)} placeholder="0" keyboardType="number-pad" />
            </FormField>
          </View>

          <FormField label="Categoría *" error={errors.categoria}>
            <Picker label="Categoría" value={form.categoria} options={CATEGORIAS} onChange={(v) => set('categoria', v)} placeholder="Seleccionar categoría..." />
          </FormField>

          <FormField label="Sexo *" error={errors.sexo}>
            <Picker label="Sexo" value={form.sexo} options={SEXOS} onChange={(v) => set('sexo', v)} placeholder="Seleccionar sexo..." />
          </FormField>

          <FormField label="Raza">
            <Picker label="Raza" value={form.raza} options={RAZAS} onChange={(v) => set('raza', v)} placeholder="Seleccionar raza..." />
          </FormField>

          <FormField label="Estado reproductivo">
            <Input value={form.estado_reproductivo} onChangeText={(v) => set('estado_reproductivo', v)} placeholder="Ej: Preñada, Vacía, Servicio..." />
          </FormField>

          {/* Fecha de nacimiento — DatePicker con meses en español */}
          <FormField label="Fecha de nacimiento">
            <TouchableOpacity style={styles.dateBtn} onPress={() => setDatePicker(true)}>
              <Text style={[styles.dateBtnText, !form.fecha_nacimiento && styles.datePlaceholder]}>
                {form.fecha_nacimiento ? fechaEsp(form.fecha_nacimiento) : 'Seleccionar fecha...'}
              </Text>
              <Text style={styles.dateIcon}>📅</Text>
            </TouchableOpacity>
            {showDatePicker && (
              <DateTimePicker
                value={form.fecha_nacimiento ? new Date(form.fecha_nacimiento + 'T12:00:00') : new Date()}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                locale="es-AR"
                maximumDate={new Date()}
                onChange={onDateChange}
              />
            )}
            {/* Botón Confirmar sólo en iOS (spinner no cierra solo) */}
            {showDatePicker && Platform.OS === 'ios' && (
              <TouchableOpacity style={styles.dateConfirmBtn} onPress={() => setDatePicker(false)}>
                <Text style={styles.dateConfirmText}>Confirmar</Text>
              </TouchableOpacity>
            )}
          </FormField>

          <FormField label="Estado sanitario">
            <Picker label="Estado" value={form.estado} options={ESTADOS} onChange={(v) => set('estado', v)} placeholder="OK" />
          </FormField>

          <FormField label="Observaciones">
            <Input
              value={form.observaciones}
              onChangeText={(v) => set('observaciones', v)}
              placeholder="Notas adicionales..."
              multiline numberOfLines={3}
              style={{ height: 80, textAlignVertical: 'top' }}
            />
          </FormField>

          {!editId && (
            <TouchableOpacity style={styles.saveBtnAlt} onPress={() => guardar(true)} disabled={saving}>
              <Text style={styles.saveBtnAltText}>💾 Guardar y cargar otro</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.saveBtn} onPress={() => guardar(false)} disabled={saving}>
            {saving
              ? <ActivityIndicator color={Colors.primary} />
              : <Text style={styles.saveBtnText}>{editId ? 'Guardar cambios' : 'Registrar y volver'}</Text>
            }
          </TouchableOpacity>
          <View style={{ height: 32 }} />
        </View>
      </ScrollView>

      {/* ── Modal BLE ──────────────────────────────────── */}
      <Modal visible={showBLE} animationType="slide" transparent>
        <View style={styles.overlay}>
          <SafeAreaView style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Conectar bastón RFID</Text>
              <TouchableOpacity onPress={() => { stopScan(); setShowBLE(false); }}>
                <Text style={styles.sheetClose}>✕</Text>
              </TouchableOpacity>
            </View>

            {connected ? (
              <View style={styles.bleConnected}>
                <Text style={styles.bleConnectedText}>✓ Conectado: {connected.name}</Text>
                <Text style={styles.bleHint}>Pasá el bastón por la caravana...</Text>
                <TouchableOpacity style={styles.bleDisconnect} onPress={disconnect}>
                  <Text style={styles.bleDisconnectText}>Desconectar</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                {bleError ? <Text style={styles.bleError}>{bleError}</Text> : null}
                <TouchableOpacity
                  style={[styles.bleScanBtn, scanning && styles.bleScanBtnStop]}
                  onPress={scanning ? stopScan : startScan}
                >
                  <Text style={styles.bleScanBtnText}>
                    {scanning ? '⏹ Detener búsqueda' : '🔍 Buscar dispositivos'}
                  </Text>
                </TouchableOpacity>
                {scanning && <ActivityIndicator style={{ marginTop: 16 }} color={Colors.text} />}
                <FlatList
                  data={devices}
                  keyExtractor={(d) => d.id}
                  style={{ maxHeight: 260 }}
                  renderItem={({ item }) => (
                    <TouchableOpacity style={styles.bleDevice} onPress={() => connectDevice(item.id)}>
                      <Text style={styles.bleDeviceName}>{item.name}</Text>
                      <Text style={styles.bleDeviceId}>{item.id}</Text>
                    </TouchableOpacity>
                  )}
                  ListEmptyComponent={
                    !scanning && <Text style={styles.bleEmpty}>No se encontraron dispositivos</Text>
                  }
                />
              </>
            )}
          </SafeAreaView>
        </View>
      </Modal>

      {/* ── Modal Nuevo Establecimiento ─────────────────── */}
      <Modal visible={showNuevoEst} animationType="slide" transparent>
        <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <SafeAreaView style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Nuevo establecimiento</Text>
              <TouchableOpacity onPress={() => setShowNuevoEst(false)}>
                <Text style={styles.sheetClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <View style={{ padding: 20 }}>
              <FormField label="Nombre *">
                <Input
                  value={nuevoEst.nombre}
                  onChangeText={(v) => setNuevoEst((p) => ({ ...p, nombre: v }))}
                  placeholder="Nombre del campo"
                  autoFocus
                />
              </FormField>
              <FormField label="RENSPA">
                <Input
                  value={nuevoEst.renspa}
                  onChangeText={(v) => setNuevoEst((p) => ({ ...p, renspa: formatRenspa(v) }))}
                  placeholder="Ej: 14.100.0.00123/00"
                  autoCapitalize="characters"
                  autoCorrect={false}
                  maxLength={17}
                />
              </FormField>
              <TouchableOpacity style={styles.saveBtn} onPress={crearEstablecimiento}>
                <Text style={styles.saveBtnText}>Crear y seleccionar</Text>
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:      { flex: 1, backgroundColor: Colors.background },
  scroll:    { flex: 1 },
  container: { padding: 16 },
  row2:      { flexDirection: 'row', gap: 8, alignItems: 'center' },
  rowFields: { flexDirection: 'row' },

  bleBtn:     { backgroundColor: Colors.primary, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11, borderWidth: 1, borderColor: Colors.primaryDark },
  bleBtnText: { fontSize: 13, fontWeight: '700', color: Colors.text },

  nuevoEstBtn:     { backgroundColor: Colors.primary, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11, borderWidth: 1, borderColor: Colors.primaryDark },
  nuevoEstBtnText: { fontSize: 13, fontWeight: '700', color: Colors.text, whiteSpace: 'nowrap' },

  saveBtn:     { backgroundColor: Colors.text, borderRadius: 12, paddingVertical: 15, alignItems: 'center', marginTop: 8 },
  saveBtnText: { color: Colors.primary, fontWeight: '800', fontSize: 16 },
  saveBtnAlt:  { backgroundColor: Colors.primary, borderWidth: 2, borderColor: Colors.text, borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 8 },
  saveBtnAltText: { color: Colors.text, fontWeight: '800', fontSize: 15 },
  avisoDoble:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#FFF3E0', borderWidth: 1, borderColor: '#FFB74D', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 10, marginTop: -4 },
  avisoDobleText: { color: '#E65100', fontSize: 12, fontWeight: '600', flex: 1 },
  avisoDobleBtn: { backgroundColor: '#E65100', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, marginLeft: 8 },
  avisoDobleBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  lecturaOk:   { color: Colors.ok, fontSize: 12, fontWeight: '700', marginBottom: 10, marginTop: -4 },
  dupCard:     { backgroundColor: '#FDECEA', borderWidth: 1, borderColor: '#F5B7B1', borderRadius: 12, padding: 12, marginBottom: 12 },
  dupTitle:    { color: '#922B21', fontWeight: '800', fontSize: 14, marginBottom: 4 },
  dupInfo:     { color: '#922B21', fontSize: 12, marginTop: 1 },
  dupLink:     { color: Colors.pendiente, fontWeight: '700', fontSize: 13, marginTop: 6 },

  dateBtn:         { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  dateBtnText:     { fontSize: 15, color: Colors.text },
  datePlaceholder: { color: Colors.textMuted },
  dateIcon:        { fontSize: 16 },
  dateConfirmBtn:  { backgroundColor: Colors.text, borderRadius: 8, padding: 10, alignItems: 'center', marginTop: 8 },
  dateConfirmText: { color: Colors.primary, fontWeight: '700', fontSize: 14 },

  // Shared modal styles
  overlay:     { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet:       { backgroundColor: Colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '75%' },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 18, borderBottomWidth: 1, borderBottomColor: Colors.border },
  sheetTitle:  { fontSize: 18, fontWeight: '700', color: Colors.text },
  sheetClose:  { fontSize: 20, color: Colors.textMuted, padding: 4 },

  // BLE
  bleError:        { color: Colors.alerta, marginHorizontal: 20, marginBottom: 12, fontSize: 13 },
  bleScanBtn:      { backgroundColor: Colors.primary, borderRadius: 10, padding: 14, alignItems: 'center', margin: 20, borderWidth: 1, borderColor: Colors.primaryDark },
  bleScanBtnStop:  { backgroundColor: Colors.alerta, borderColor: Colors.alerta },
  bleScanBtnText:  { fontWeight: '700', color: Colors.text, fontSize: 15 },
  bleDevice:       { paddingVertical: 14, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: Colors.border },
  bleDeviceName:   { fontSize: 15, fontWeight: '600', color: Colors.text },
  bleDeviceId:     { fontSize: 11, color: Colors.textMuted, marginTop: 2 },
  bleEmpty:        { textAlign: 'center', color: Colors.textMuted, marginTop: 20, padding: 20 },
  bleConnected:    { alignItems: 'center', padding: 24 },
  bleConnectedText:{ fontSize: 16, fontWeight: '700', color: Colors.ok, marginBottom: 8 },
  bleHint:         { fontSize: 14, color: Colors.textLight, textAlign: 'center' },
  bleDisconnect:   { marginTop: 20, backgroundColor: Colors.alerta, borderRadius: 10, padding: 12, paddingHorizontal: 24 },
  bleDisconnectText: { color: '#fff', fontWeight: '700' },
});
