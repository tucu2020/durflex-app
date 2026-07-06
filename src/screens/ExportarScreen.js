import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Alert,
  ActivityIndicator, SafeAreaView, ScrollView, Modal, FlatList,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import {
  getAnimales, getEstablecimientos,
  getPlanillasIATF, insertPlanillaIATF, deletePlanillaIATF,
  getAnimalesIATF, insertAnimalIATF, deleteAnimalIATF,
} from '../db/database';
import { formatSenasaLine, formatFecha, categoriaNombre } from '../utils/formatters';
import { Colors } from '../utils/colors';
import { utils as XLSXUtils, write as XLSXWrite } from 'xlsx';
import FormField, { Input } from '../components/FormField';
import Picker from '../components/Picker';

// ── helpers Excel ─────────────────────────────────────────────

// Convierte array de objetos a AOA (array of arrays) para aoa_to_sheet
function toAOA(objects) {
  if (!objects.length) return [[]];
  const keys = Object.keys(objects[0]);
  return [keys, ...objects.map((o) => keys.map((k) => o[k] ?? ''))];
}

function makeWb(sheets) {
  const wb = XLSXUtils.book_new();
  sheets.forEach(({ name, data }) => {
    XLSXUtils.book_append_sheet(wb, XLSXUtils.aoa_to_sheet(toAOA(data)), name);
  });
  return XLSXWrite(wb, { type: 'base64', bookType: 'xlsx' });
}

async function compartirXlsx(wbout, nombre) {
  const uri = `${FileSystem.documentDirectory}${nombre}.xlsx`;
  // Usar string 'base64' directamente — FileSystem.EncodingType puede ser undefined en algunas versiones
  await FileSystem.writeAsStringAsync(uri, wbout, { encoding: 'base64' });
  await Sharing.shareAsync(uri, {
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    dialogTitle: `Exportar ${nombre}`,
    UTI: 'com.microsoft.excel.xlsx',
  });
  return uri;
}

// ── Componente principal ──────────────────────────────────────

export default function ExportarScreen() {
  const [loading, setLoading]               = useState(null);
  const [establecimientos, setEstabs]       = useState([]);
  const [filtroEstId, setFiltroEstId]       = useState('');
  const [planillasIATF, setPlanillasIATF]   = useState([]);
  const [showNuevaIATF, setShowNuevaIATF]   = useState(false);
  const [showDetalleIATF, setShowDetIATF]   = useState(null); // planilla obj
  const [animalesIATF, setAnimalesIATF]     = useState([]);
  const [nuevaIATF, setNuevaIATF]           = useState({ nombre: '', establecimiento_id: '' });
  const [nuevaCaravana, setNuevaCaravana]   = useState('');

  useFocusEffect(useCallback(() => { cargar(); }, []));

  async function cargar() {
    const [ests, iatf] = await Promise.all([getEstablecimientos(), getPlanillasIATF()]);
    setEstabs(ests);
    setPlanillasIATF(iatf);
  }

  const estOptions = [{ value: '', label: 'Todos los campos' },
    ...establecimientos.map((e) => ({ value: e.id, label: e.nombre }))];

  async function getAnimalesFiltrados() {
    return getAnimales(filtroEstId || null);
  }

  // ── Exportaciones base ──────────────────────────────────────

  async function exportarExcel() {
    setLoading('excel');
    try {
      const [animales, ests] = await Promise.all([getAnimalesFiltrados(), getEstablecimientos()]);
      const estMap = Object.fromEntries(ests.map((e) => [e.id, e]));
      const fecha  = new Date().toISOString().split('T')[0];

      const wbout = makeWb([
        {
          name: 'Animales',

          data: animales.map((a) => ({
            'Caravana': a.caravana,
            'Categoría': categoriaNombre(a.categoria),
            'Sexo': a.sexo === 'macho' ? 'Macho' : a.sexo === 'hembra' ? 'Hembra' : '',
            'Raza': a.raza || '',
            'Peso (kg)': a.peso ?? '',
            'Edad (meses)': a.edad ?? '',
            'Fecha Nacimiento': a.fecha_nacimiento || '',
            'Estado reproductivo': a.estado_reproductivo || '',
            'Estado sanitario': a.estado || '',
            'Establecimiento': a.establecimiento_nombre || '',
            'RENSPA': estMap[a.establecimiento_id]?.renspa || '',
            'Observaciones': a.observaciones || '',
            'Fecha registro': formatFecha(a.created_at),
            'Sincronizado': a.synced ? 'Sí' : 'No',
          })),
        },
        {
          name: 'Establecimientos',
          data: ests.map((e) => ({
            'Nombre': e.nombre, 'RENSPA': e.renspa || '', 'CUIG': e.cuig || '',
            'Provincia': e.provincia || '', 'Partido': e.partido || '',
            'Localidad': e.localidad || '', 'Propietario': e.propietario || '',
            'Total animales': e.total_animales,
          })),
        },
      ]);
      await compartirXlsx(wbout, `Durflex_${fecha}`);
    } catch (e) { Alert.alert('Error', e.message); }
    finally { setLoading(null); }
  }

  async function exportarSenasa() {
    setLoading('senasa');
    try {
      const animales = await getAnimalesFiltrados();
      if (!animales.length) { Alert.alert('Sin datos', 'No hay animales para exportar.'); return; }
      const fecha    = new Date().toISOString().split('T')[0];
      const contenido = animales.map(formatSenasaLine).join(';') + '\n';
      const uri = `${FileSystem.documentDirectory}SENASA_${fecha}.txt`;
      await FileSystem.writeAsStringAsync(uri, contenido); // UTF-8 por defecto
      await Sharing.shareAsync(uri, { mimeType: 'text/plain', dialogTitle: 'Exportar SENASA', UTI: 'public.plain-text' });
    } catch (e) { Alert.alert('Error', e.message); }
    finally { setLoading(null); }
  }

  // ── Planillas de trabajo ────────────────────────────────────

  async function exportarPlanilla(tipo) {
    setLoading(tipo);
    try {
      const animales = await getAnimalesFiltrados();
      const fecha    = new Date().toISOString().split('T')[0];
      let sheets;

      if (tipo === 'existencias') {
        sheets = [{
          name: 'Existencias',
          data: animales.map((a) => ({
            'Caravana': a.caravana,
            'Categoría': categoriaNombre(a.categoria),
            'Sexo': a.sexo === 'macho' ? 'Macho' : a.sexo === 'hembra' ? 'Hembra' : '',
            'Raza': a.raza || '',
            'Peso (kg)': a.peso ?? '',
            'Estado reproductivo': a.estado_reproductivo || '',
            'Estado sanitario': a.estado || '',
            'Establecimiento': a.establecimiento_nombre || '',
          })),
        }];
      } else if (tipo === 'vacunaciones') {
        sheets = [{
          name: 'Vacunaciones',
          data: animales.map((a) => ({
            'Caravana': a.caravana,
            'Establecimiento': a.establecimiento_nombre || '',
            'Fecha vacunación': '',
            'Vacuna aplicada': '',
            'Dosis (ml)': '',
            'Vía aplicación': '',
            'Operador': '',
            'Observaciones': '',
          })),
        }];
      } else if (tipo === 'diagnostico') {
        sheets = [{
          name: 'Diagnóstico',
          data: animales.map((a) => ({
            'Caravana': a.caravana,
            'Establecimiento': a.establecimiento_nombre || '',
            'Fecha': '',
            'Diagnóstico': '',
            'Tratamiento': '',
            'Medicamento': '',
            'Dosis': '',
            'Veterinario': '',
            'Observaciones': '',
          })),
        }];
      } else if (tipo === 'sangrados') {
        sheets = [{
          name: 'Sangrados',
          data: animales.map((a) => ({
            'Caravana': a.caravana,
            'Establecimiento': a.establecimiento_nombre || '',
            'Fecha sangrado': '',
            'Técnico': '',
            'Laboratorio': '',
            'Tipo análisis': '',
            'Resultado': '',
            'Observaciones': '',
          })),
        }];
      }

      const nombre = `${tipo.charAt(0).toUpperCase() + tipo.slice(1)}_${fecha}`;
      await compartirXlsx(makeWb(sheets), nombre);
    } catch (e) { Alert.alert('Error', e.message); }
    finally { setLoading(null); }
  }

  // ── IATF ────────────────────────────────────────────────────

  async function crearPlanillaIATF() {
    if (!nuevaIATF.nombre.trim()) { Alert.alert('Error', 'Ingresá un nombre para la planilla'); return; }
    await insertPlanillaIATF({ nombre: nuevaIATF.nombre, establecimiento_id: nuevaIATF.establecimiento_id || null });
    setNuevaIATF({ nombre: '', establecimiento_id: '' });
    setShowNuevaIATF(false);
    cargar();
  }

  async function eliminarPlanillaIATF(id) {
    Alert.alert('Eliminar planilla', '¿Eliminar esta planilla IATF?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: async () => { await deletePlanillaIATF(id); cargar(); } },
    ]);
  }

  async function abrirDetalleIATF(planilla) {
    setShowDetIATF(planilla);
    setAnimalesIATF(await getAnimalesIATF(planilla.id));
  }

  async function agregarCaravanaIATF() {
    if (!nuevaCaravana.trim()) return;
    await insertAnimalIATF(showDetalleIATF.id, nuevaCaravana.trim().toUpperCase());
    setAnimalesIATF(await getAnimalesIATF(showDetalleIATF.id));
    setNuevaCaravana('');
  }

  async function quitarCaravanaIATF(id) {
    await deleteAnimalIATF(id);
    setAnimalesIATF(await getAnimalesIATF(showDetalleIATF.id));
  }

  async function exportarIATF(planilla) {
    setLoading('iatf_' + planilla.id);
    try {
      const animales = await getAnimalesIATF(planilla.id);
      const fecha    = new Date().toISOString().split('T')[0];
      const wbout = makeWb([{
        name: 'IATF',
        data: animales.map((a) => ({
          'Caravana': a.caravana,
          'Fecha sincronización': '',
          'Fecha IATF': '',
          'Protocolo': '',
          'Implante': '',
          'Benzoato': '',
          'Progesterona': '',
          'Retiro implante': '',
          'PGF2α': '',
          'Inducción': '',
          'IATF': '',
          'Técnico IA': '',
          'Toro semen': '',
          'Diagnóstico preñez': '',
          'Fecha diagnóstico': '',
          'Observaciones': '',
        })),
      }]);
      await compartirXlsx(wbout, `IATF_${planilla.nombre.replace(/\s+/g, '_')}_${fecha}`);
    } catch (e) { Alert.alert('Error', e.message); }
    finally { setLoading(null); }
  }

  // ── Render helpers ──────────────────────────────────────────

  function ExportCard({ icon, title, desc, loadKey, onPress }) {
    const isLoading = loading === loadKey;
    return (
      <View style={styles.card}>
        <View style={styles.cardIcon}><Text style={styles.iconText}>{icon}</Text></View>
        <View style={styles.cardContent}>
          <Text style={styles.cardTitle}>{title}</Text>
          {desc ? <Text style={styles.cardDesc}>{desc}</Text> : null}
        </View>
        <TouchableOpacity style={styles.exportBtn} onPress={onPress} disabled={!!loading}>
          {isLoading
            ? <ActivityIndicator color={Colors.text} size="small" />
            : <Text style={styles.exportBtnText}>Exportar</Text>
          }
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>

        {/* Filtro establecimiento */}
        <View style={styles.filtroBox}>
          <Text style={styles.filtroLabel}>Filtrar por campo</Text>
          <Picker
            label="Campo"
            value={filtroEstId}
            options={estOptions}
            onChange={setFiltroEstId}
            placeholder="Todos los campos"
          />
        </View>

        {/* ── Exportaciones base ── */}
        <Text style={styles.sectionTitle}>Exportaciones</Text>
        <ExportCard icon="📊" title="Excel general" loadKey="excel"
          desc="Todos los registros + establecimientos en .xlsx"
          onPress={exportarExcel} />
        <ExportCard icon="📋" title="SENASA / SIGbiotraza" loadKey="senasa"
          desc={`Formato TXT: CODIGO-SEXO-RAZA-FECHANAC;...`}
          onPress={exportarSenasa} />

        {/* ── Planillas de trabajo ── */}
        <Text style={styles.sectionTitle}>Planillas de trabajo</Text>
        <View style={styles.planillasGrid}>
          {[
            { key: 'existencias', icon: '🐄', title: 'Existencias',   desc: 'Inventario con categoría y peso' },
            { key: 'vacunaciones',icon: '💉', title: 'Vacunaciones',  desc: 'Planilla para registrar vacunas' },
            { key: 'diagnostico', icon: '🩺', title: 'Diagnóstico',   desc: 'Diagnóstico y tratamiento' },
            { key: 'sangrados',   icon: '🔬', title: 'Sangrados',     desc: 'Análisis y resultados lab.' },
          ].map(({ key, icon, title, desc }) => (
            <TouchableOpacity
              key={key}
              style={styles.planillaCard}
              onPress={() => exportarPlanilla(key)}
              disabled={!!loading}
            >
              {loading === key
                ? <ActivityIndicator color={Colors.text} />
                : <Text style={styles.planillaIcon}>{icon}</Text>
              }
              <Text style={styles.planillaTitle}>{title}</Text>
              <Text style={styles.planillaDesc}>{desc}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Planillas IATF ── */}
        <View style={styles.iatfHeader}>
          <Text style={styles.sectionTitle}>Planillas IATF</Text>
          <TouchableOpacity style={styles.iatfNewBtn} onPress={() => setShowNuevaIATF(true)}>
            <Text style={styles.iatfNewBtnText}>+ Crear</Text>
          </TouchableOpacity>
        </View>

        {planillasIATF.length === 0 ? (
          <View style={styles.iatfEmpty}>
            <Text style={styles.iatfEmptyText}>No hay planillas IATF creadas.</Text>
          </View>
        ) : (
          planillasIATF.map((p) => (
            <View key={p.id} style={styles.iatfCard}>
              <TouchableOpacity style={styles.iatfCardMain} onPress={() => abrirDetalleIATF(p)}>
                <View>
                  <Text style={styles.iatfCardTitle}>{p.nombre}</Text>
                  <Text style={styles.iatfCardSub}>
                    {p.establecimiento_nombre || 'Sin campo'} · {p.total_animales} animales · {formatFecha(p.created_at)}
                  </Text>
                </View>
              </TouchableOpacity>
              <View style={styles.iatfCardActions}>
                <TouchableOpacity
                  style={styles.iatfExportBtn}
                  onPress={() => exportarIATF(p)}
                  disabled={!!loading}
                >
                  {loading === 'iatf_' + p.id
                    ? <ActivityIndicator color={Colors.text} size="small" />
                    : <Text style={styles.iatfExportBtnText}>↗ Excel</Text>
                  }
                </TouchableOpacity>
                <TouchableOpacity style={styles.iatfDeleteBtn} onPress={() => eliminarPlanillaIATF(p.id)}>
                  <Text style={styles.iatfDeleteBtnText}>✕</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}

        {/* Info SENASA */}
        <View style={styles.infoBox}>
          <Text style={styles.infoTitle}>Formato SENASA / SIGbiotraza</Text>
          <Text style={styles.infoText}>
            Estructura: <Text style={styles.mono}>CARAVANA-SEXO-RAZA-AAAAMMDD</Text>{'\n'}
            Registros separados por punto y coma (;) en una sola línea.
          </Text>
        </View>
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* ── Modal nueva planilla IATF ─────────────────── */}
      <Modal visible={showNuevaIATF} animationType="slide" transparent>
        <View style={styles.overlay}>
          <SafeAreaView style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Nueva planilla IATF</Text>
              <TouchableOpacity onPress={() => setShowNuevaIATF(false)}>
                <Text style={styles.sheetClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <View style={{ padding: 20 }}>
              <FormField label="Nombre de la planilla *">
                <Input
                  value={nuevaIATF.nombre}
                  onChangeText={(v) => setNuevaIATF((p) => ({ ...p, nombre: v }))}
                  placeholder="Ej: IATF Lote 1 - Abril 2025"
                  autoFocus
                />
              </FormField>
              <FormField label="Campo (opcional)">
                <Picker
                  label="Campo"
                  value={nuevaIATF.establecimiento_id}
                  options={estOptions}
                  onChange={(v) => setNuevaIATF((p) => ({ ...p, establecimiento_id: v }))}
                  placeholder="Sin campo asignado"
                />
              </FormField>
              <TouchableOpacity style={styles.saveBtn} onPress={crearPlanillaIATF}>
                <Text style={styles.saveBtnText}>Crear planilla</Text>
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </View>
      </Modal>

      {/* ── Modal detalle planilla IATF ───────────────── */}
      <Modal visible={!!showDetalleIATF} animationType="slide" transparent>
        <View style={styles.overlay}>
          <SafeAreaView style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>{showDetalleIATF?.nombre}</Text>
              <TouchableOpacity onPress={() => setShowDetIATF(null)}>
                <Text style={styles.sheetClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.iatfDetalleInput}>
              <Input
                value={nuevaCaravana}
                onChangeText={setNuevaCaravana}
                placeholder="Ingresá número de caravana..."
                autoCapitalize="characters"
                style={{ flex: 1 }}
                onSubmitEditing={agregarCaravanaIATF}
                returnKeyType="done"
              />
              <TouchableOpacity style={styles.iatfAddBtn} onPress={agregarCaravanaIATF}>
                <Text style={styles.iatfAddBtnText}>+ Agregar</Text>
              </TouchableOpacity>
            </View>
            <FlatList
              data={animalesIATF}
              keyExtractor={(i) => String(i.id)}
              style={{ maxHeight: 340 }}
              ListEmptyComponent={<Text style={styles.iatfDetalleEmpty}>Sin animales en esta planilla</Text>}
              renderItem={({ item }) => (
                <View style={styles.iatfAnimalRow}>
                  <Text style={styles.iatfAnimalCaravana}>{item.caravana}</Text>
                  <TouchableOpacity onPress={() => quitarCaravanaIATF(item.id)}>
                    <Text style={styles.iatfAnimalDel}>✕</Text>
                  </TouchableOpacity>
                </View>
              )}
            />
            <View style={styles.iatfDetalleFooter}>
              <Text style={styles.iatfDetalleCount}>{animalesIATF.length} animales</Text>
              <TouchableOpacity
                style={styles.iatfExportBtnLg}
                onPress={() => { setShowDetIATF(null); exportarIATF(showDetalleIATF); }}
              >
                <Text style={styles.iatfExportBtnLgText}>↗ Exportar Excel</Text>
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
  container: { padding: 16 },

  filtroBox:   { backgroundColor: Colors.surface, borderRadius: 12, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: Colors.border },
  filtroLabel: { fontSize: 12, fontWeight: '700', color: Colors.textMuted, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },

  sectionTitle: { fontSize: 15, fontWeight: '800', color: Colors.text, marginTop: 16, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },

  card:        { backgroundColor: Colors.surface, borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: Colors.border, elevation: 2, flexDirection: 'row', alignItems: 'center' },
  cardIcon:    { width: 46, height: 46, borderRadius: 12, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  iconText:    { fontSize: 22 },
  cardContent: { flex: 1, marginRight: 10 },
  cardTitle:   { fontSize: 14, fontWeight: '700', color: Colors.text },
  cardDesc:    { fontSize: 11, color: Colors.textMuted, marginTop: 3, lineHeight: 16 },
  exportBtn:   { backgroundColor: Colors.text, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 9, minWidth: 76, alignItems: 'center' },
  exportBtnText: { color: Colors.primary, fontWeight: '700', fontSize: 13 },

  planillasGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 4 },
  planillaCard:  { width: '47.5%', backgroundColor: Colors.surface, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: Colors.border, elevation: 2, alignItems: 'center' },
  planillaIcon:  { fontSize: 32, marginBottom: 6 },
  planillaTitle: { fontSize: 14, fontWeight: '700', color: Colors.text, textAlign: 'center' },
  planillaDesc:  { fontSize: 11, color: Colors.textMuted, textAlign: 'center', marginTop: 3, lineHeight: 15 },

  iatfHeader:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16, marginBottom: 8 },
  iatfNewBtn:      { backgroundColor: Colors.text, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 6 },
  iatfNewBtnText:  { color: Colors.primary, fontWeight: '700', fontSize: 13 },
  iatfEmpty:       { backgroundColor: Colors.surface, borderRadius: 12, padding: 20, alignItems: 'center', borderWidth: 1, borderColor: Colors.border },
  iatfEmptyText:   { color: Colors.textMuted, fontSize: 14 },
  iatfCard:        { backgroundColor: Colors.surface, borderRadius: 12, marginBottom: 8, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden' },
  iatfCardMain:    { padding: 14 },
  iatfCardTitle:   { fontSize: 15, fontWeight: '700', color: Colors.text },
  iatfCardSub:     { fontSize: 12, color: Colors.textMuted, marginTop: 3 },
  iatfCardActions: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: Colors.border },
  iatfExportBtn:   { flex: 1, padding: 10, alignItems: 'center', backgroundColor: '#FFFBE0' },
  iatfExportBtnText: { fontSize: 13, fontWeight: '700', color: Colors.text },
  iatfDeleteBtn:   { padding: 10, paddingHorizontal: 16, alignItems: 'center', borderLeftWidth: 1, borderLeftColor: Colors.border },
  iatfDeleteBtnText: { fontSize: 16, color: Colors.alerta },

  infoBox:   { backgroundColor: '#FFFDE7', borderRadius: 12, padding: 14, marginTop: 8, borderWidth: 1, borderColor: Colors.border },
  infoTitle: { fontSize: 12, fontWeight: '700', color: Colors.textLight, marginBottom: 6 },
  infoText:  { fontSize: 12, color: Colors.textLight, lineHeight: 18 },
  mono:      { fontFamily: 'monospace', fontSize: 11 },

  overlay:     { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet:       { backgroundColor: Colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '80%' },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 18, borderBottomWidth: 1, borderBottomColor: Colors.border },
  sheetTitle:  { fontSize: 17, fontWeight: '700', color: Colors.text },
  sheetClose:  { fontSize: 20, color: Colors.textMuted, padding: 4 },
  saveBtn:     { backgroundColor: Colors.text, borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 8 },
  saveBtnText: { color: Colors.primary, fontWeight: '800', fontSize: 15 },

  iatfDetalleInput: { flexDirection: 'row', gap: 8, padding: 16, borderBottomWidth: 1, borderBottomColor: Colors.border },
  iatfAddBtn:       { backgroundColor: Colors.primary, borderRadius: 10, paddingHorizontal: 14, justifyContent: 'center', borderWidth: 1, borderColor: Colors.primaryDark },
  iatfAddBtnText:   { fontWeight: '700', color: Colors.text, fontSize: 13 },
  iatfAnimalRow:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.border },
  iatfAnimalCaravana: { fontSize: 14, fontWeight: '600', color: Colors.text },
  iatfAnimalDel:    { fontSize: 18, color: Colors.alerta, padding: 4 },
  iatfDetalleEmpty: { textAlign: 'center', color: Colors.textMuted, padding: 24, fontSize: 14 },
  iatfDetalleFooter:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderTopWidth: 1, borderTopColor: Colors.border },
  iatfDetalleCount:   { fontSize: 14, color: Colors.textMuted },
  iatfExportBtnLg:    { backgroundColor: Colors.text, borderRadius: 10, paddingHorizontal: 18, paddingVertical: 10 },
  iatfExportBtnLgText: { color: Colors.primary, fontWeight: '700', fontSize: 14 },
});
