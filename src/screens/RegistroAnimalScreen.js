import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  Alert, ActivityIndicator, Modal, FlatList, SafeAreaView, Platform,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useNavigation, useRoute } from '@react-navigation/native';
import {
  insertAnimal, updateAnimal, getAnimalById,
  getEstablecimientos, insertEstablecimiento,
} from '../db/database';
import { useBLE } from '../hooks/useBLE';
import { Colors } from '../utils/colors';
import FormField, { Input } from '../components/FormField';
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

export default function RegistroAnimalScreen() {
  const navigation = useNavigation();
  const route      = useRoute();
  const editId     = route.params?.id;

  const [form, setForm] = useState({
    caravana: '', establecimiento_id: '', peso: '', edad: '',
    categoria: '', estado_reproductivo: '', raza: '', sexo: '',
    fecha_nacimiento: '', observaciones: '', estado: 'ok',
  });
  const [errors, setErrors]             = useState({});
  const [establecimientos, setEstabs]   = useState([]);
  const [saving, setSaving]             = useState(false);
  const [showBLE, setShowBLE]           = useState(false);
  const [showDatePicker, setDatePicker] = useState(false);

  // Modal nuevo establecimiento
  const [showNuevoEst, setShowNuevoEst] = useState(false);
  const [nuevoEst, setNuevoEst]         = useState({ nombre: '', cuig: '' });

  const {
    scanning, devices, connected, lastRead, error: bleError,
    startScan, stopScan, connectDevice, disconnect, clearLastRead, isSupported,
  } = useBLE();

  useEffect(() => { cargarEstabs(); }, []);

  useEffect(() => {
    if (editId) {
      getAnimalById(editId).then((a) => {
        if (a) setForm({ ...a, peso: String(a.peso ?? ''), edad: String(a.edad ?? '') });
      });
    }
  }, [editId]);

  useEffect(() => {
    if (lastRead) {
      setForm((prev) => ({ ...prev, caravana: lastRead }));
      clearLastRead();
      setShowBLE(false);
    }
  }, [lastRead, clearLastRead]);

  async function cargarEstabs() {
    const rows = await getEstablecimientos();
    setEstabs(rows.map((e) => ({ value: e.id, label: e.nombre })));
  }

  function set(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
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

  async function guardar() {
    if (!validate()) return;
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
      navigation.goBack();
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setSaving(false);
    }
  }

  async function crearEstablecimiento() {
    if (!nuevoEst.nombre.trim()) {
      Alert.alert('Error', 'El nombre es obligatorio');
      return;
    }
    const id = await insertEstablecimiento({ nombre: nuevoEst.nombre, cuig: nuevoEst.cuig });
    await cargarEstabs();
    set('establecimiento_id', id);
    setNuevoEst({ nombre: '', cuig: '' });
    setShowNuevoEst(false);
  }

  function onDateChange(event, date) {
    if (Platform.OS === 'android') setDatePicker(false);
    if (event.type === 'dismissed') return;
    if (date) set('fecha_nacimiento', date.toISOString().split('T')[0]);
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView style={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.container}>

          {/* Caravana + BLE */}
          <FormField label="N° Caravana *" error={errors.caravana}>
            <View style={styles.row2}>
              <Input
                style={{ flex: 1 }}
                value={form.caravana}
                onChangeText={(v) => set('caravana', v)}
                placeholder="Ej: AR.14.0001.2024"
                autoCapitalize="characters"
              />
              <TouchableOpacity style={styles.bleBtn} onPress={() => setShowBLE(true)}>
                <Text style={styles.bleBtnText}>📡 RFID</Text>
              </TouchableOpacity>
            </View>
          </FormField>

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

          <TouchableOpacity style={styles.saveBtn} onPress={guardar} disabled={saving}>
            {saving
              ? <ActivityIndicator color={Colors.primary} />
              : <Text style={styles.saveBtnText}>{editId ? 'Guardar cambios' : 'Registrar animal'}</Text>
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
        <View style={styles.overlay}>
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
              <FormField label="CUIG / RENSPA">
                <Input
                  value={nuevoEst.cuig}
                  onChangeText={(v) => setNuevoEst((p) => ({ ...p, cuig: v }))}
                  placeholder="Ej: 30-12345678-9"
                />
              </FormField>
              <TouchableOpacity style={styles.saveBtn} onPress={crearEstablecimiento}>
                <Text style={styles.saveBtnText}>Crear y seleccionar</Text>
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </View>
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
