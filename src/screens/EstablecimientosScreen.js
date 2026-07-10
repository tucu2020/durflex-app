import React, { useState, useCallback } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  SafeAreaView, Modal, TextInput, Alert, ScrollView,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import {
  getEstablecimientos, insertEstablecimiento, updateEstablecimiento,
  deleteEstablecimiento, getUsuariosEstablecimiento, insertUsuario, deleteUsuario,
} from '../db/database';
import { Colors } from '../utils/colors';
import { formatRenspa } from '../utils/formatters';
import FormField, { Input } from '../components/FormField';

const EST_EMPTY = {
  nombre: '', renspa: '', provincia: '', partido: '',
  localidad: '', propietario: '', telefono: '',
};

export default function EstablecimientosScreen() {
  const [establecimientos, setEstablecimientos] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editando, setEditando] = useState(null);
  const [form, setForm] = useState(EST_EMPTY);
  const [detalle, setDetalle] = useState(null);
  const [usuarios, setUsuarios] = useState([]);
  const [nuevoUsuario, setNuevoUsuario] = useState({ nombre: '', email: '', rol: 'operador' });
  const [showAddUser, setShowAddUser] = useState(false);

  useFocusEffect(useCallback(() => { cargar(); }, []));

  async function cargar() {
    setEstablecimientos(await getEstablecimientos());
  }

  function abrirCrear() {
    setEditando(null);
    setForm(EST_EMPTY);
    setModalVisible(true);
  }

  function abrirEditar(est) {
    setEditando(est.id);
    setForm({ ...est });
    setModalVisible(true);
  }

  async function guardar() {
    if (!form.nombre.trim()) { Alert.alert('Error', 'El nombre es obligatorio'); return; }
    if (editando) {
      await updateEstablecimiento(editando, form);
    } else {
      await insertEstablecimiento(form);
    }
    setModalVisible(false);
    cargar();
  }

  async function eliminar(id) {
    Alert.alert('Eliminar establecimiento', '¿Estás seguro? Se eliminarán todos los animales asociados.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: async () => {
        await deleteEstablecimiento(id);
        cargar();
        if (detalle?.id === id) setDetalle(null);
      }},
    ]);
  }

  async function abrirDetalle(est) {
    setDetalle(est);
    const us = await getUsuariosEstablecimiento(est.id);
    setUsuarios(us);
  }

  async function agregarUsuario() {
    if (!nuevoUsuario.nombre.trim()) return;
    await insertUsuario({ ...nuevoUsuario, establecimiento_id: detalle.id });
    const us = await getUsuariosEstablecimiento(detalle.id);
    setUsuarios(us);
    setNuevoUsuario({ nombre: '', email: '', rol: 'operador' });
    setShowAddUser(false);
  }

  async function eliminarUsuario(id) {
    await deleteUsuario(id);
    const us = await getUsuariosEstablecimiento(detalle.id);
    setUsuarios(us);
  }

  function set(k, v) { setForm((p) => ({ ...p, [k]: v })); }

  return (
    <SafeAreaView style={styles.safe}>
      <FlatList
        data={establecimientos}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.card} onPress={() => abrirDetalle(item)}>
            <View style={styles.cardTop}>
              <View style={{ flex: 1 }}>
                <Text style={styles.nombre}>{item.nombre}</Text>
                {item.renspa ? <Text style={styles.renspa}>RENSPA: {item.renspa}</Text> : null}
                {item.localidad ? <Text style={styles.meta}>{item.localidad}{item.provincia ? `, ${item.provincia}` : ''}</Text> : null}
              </View>
              <View style={styles.badge}>
                <Text style={styles.badgeNum}>{item.total_animales}</Text>
                <Text style={styles.badgeLabel}>animales</Text>
              </View>
            </View>
            {item.pendientes_sync > 0 && (
              <Text style={styles.syncPendiente}>⏳ {item.pendientes_sync} pendientes de sync</Text>
            )}
            <View style={styles.cardActions}>
              <TouchableOpacity onPress={() => abrirEditar(item)} style={styles.actionBtn}>
                <Text style={styles.actionBtnText}>Editar</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => eliminar(item.id)} style={[styles.actionBtn, styles.actionBtnDelete]}>
                <Text style={[styles.actionBtnText, { color: Colors.alerta }]}>Eliminar</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>🚜</Text>
            <Text style={styles.emptyText}>No hay establecimientos registrados</Text>
          </View>
        }
        contentContainerStyle={{ paddingBottom: 100, paddingTop: 8 }}
        showsVerticalScrollIndicator={false}
      />

      <TouchableOpacity style={styles.fab} onPress={abrirCrear}>
        <Text style={styles.fabText}>＋</Text>
      </TouchableOpacity>

      {/* Modal crear/editar */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <SafeAreaView style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>{editando ? 'Editar establecimiento' : 'Nuevo establecimiento'}</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Text style={styles.close}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={{ padding: 16 }} keyboardShouldPersistTaps="handled">
              <FormField label="Nombre *"><Input value={form.nombre} onChangeText={(v) => set('nombre', v)} placeholder="Nombre del campo" /></FormField>
              <FormField label="RENSPA"><Input value={form.renspa} onChangeText={(v) => set('renspa', formatRenspa(v))} placeholder="Ej: 14.100.0.00123/00" autoCapitalize="characters" autoCorrect={false} maxLength={17} /></FormField>
              <FormField label="Provincia"><Input value={form.provincia} onChangeText={(v) => set('provincia', v)} placeholder="Provincia" /></FormField>
              <FormField label="Partido"><Input value={form.partido} onChangeText={(v) => set('partido', v)} placeholder="Partido" /></FormField>
              <FormField label="Localidad"><Input value={form.localidad} onChangeText={(v) => set('localidad', v)} placeholder="Localidad" /></FormField>
              <FormField label="Propietario"><Input value={form.propietario} onChangeText={(v) => set('propietario', v)} placeholder="Nombre del propietario" /></FormField>
              <FormField label="Teléfono"><Input value={form.telefono} onChangeText={(v) => set('telefono', v)} placeholder="+54 9 11 ..." keyboardType="phone-pad" /></FormField>
              <TouchableOpacity style={styles.saveBtn} onPress={guardar}>
                <Text style={styles.saveBtnText}>{editando ? 'Guardar cambios' : 'Crear establecimiento'}</Text>
              </TouchableOpacity>
              <View style={{ height: 32 }} />
            </ScrollView>
          </SafeAreaView>
        </KeyboardAvoidingView>
      </Modal>

      {/* Modal detalle con usuarios */}
      <Modal visible={!!detalle} animationType="slide" transparent>
        <View style={styles.overlay}>
          <SafeAreaView style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>{detalle?.nombre}</Text>
              <TouchableOpacity onPress={() => setDetalle(null)}>
                <Text style={styles.close}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={{ padding: 16 }}>
              {detalle?.renspa && <Text style={styles.detalleRow}>RENSPA: {detalle.renspa}</Text>}
              {detalle?.propietario && <Text style={styles.detalleRow}>Propietario: {detalle.propietario}</Text>}
              {detalle?.localidad && <Text style={styles.detalleRow}>Ubicación: {detalle.localidad}, {detalle.provincia}</Text>}
              {detalle?.telefono && <Text style={styles.detalleRow}>Tel: {detalle.telefono}</Text>}

              <View style={styles.usersSection}>
                <View style={styles.usersSectionHeader}>
                  <Text style={styles.usersTitle}>Usuarios ({usuarios.length})</Text>
                  <TouchableOpacity onPress={() => setShowAddUser(true)} style={styles.addUserBtn}>
                    <Text style={styles.addUserBtnText}>+ Agregar</Text>
                  </TouchableOpacity>
                </View>
                {usuarios.map((u) => (
                  <View key={u.id} style={styles.userRow}>
                    <View>
                      <Text style={styles.userName}>{u.nombre}</Text>
                      {u.email && <Text style={styles.userEmail}>{u.email}</Text>}
                      <Text style={styles.userRol}>{u.rol}</Text>
                    </View>
                    <TouchableOpacity onPress={() => eliminarUsuario(u.id)}>
                      <Text style={styles.userDelete}>✕</Text>
                    </TouchableOpacity>
                  </View>
                ))}
                {usuarios.length === 0 && <Text style={styles.noUsers}>Sin usuarios asignados</Text>}
              </View>

              {showAddUser && (
                <View style={styles.addUserForm}>
                  <Input value={nuevoUsuario.nombre} onChangeText={(v) => setNuevoUsuario((p) => ({ ...p, nombre: v }))} placeholder="Nombre *" style={{ marginBottom: 8 }} />
                  <Input value={nuevoUsuario.email} onChangeText={(v) => setNuevoUsuario((p) => ({ ...p, email: v }))} placeholder="Email" keyboardType="email-address" style={{ marginBottom: 8 }} />
                  <TouchableOpacity style={styles.saveBtn} onPress={agregarUsuario}>
                    <Text style={styles.saveBtnText}>Agregar usuario</Text>
                  </TouchableOpacity>
                </View>
              )}
              <View style={{ height: 40 }} />
            </ScrollView>
          </SafeAreaView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  card: {
    backgroundColor: Colors.surface, borderRadius: 14, margin: 8,
    marginHorizontal: 16, padding: 16, borderWidth: 1, borderColor: Colors.border,
    elevation: 2,
  },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start' },
  nombre: { fontSize: 17, fontWeight: '700', color: Colors.text },
  renspa: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  meta: { fontSize: 13, color: Colors.textLight, marginTop: 2 },
  badge: { alignItems: 'center', backgroundColor: Colors.primary, borderRadius: 10, padding: 8, minWidth: 60 },
  badgeNum: { fontSize: 20, fontWeight: '900', color: Colors.text },
  badgeLabel: { fontSize: 10, color: Colors.textLight },
  syncPendiente: { fontSize: 12, color: Colors.vacuna, marginTop: 6 },
  cardActions: { flexDirection: 'row', gap: 8, marginTop: 12, borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: 10 },
  actionBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8, backgroundColor: Colors.background, borderWidth: 1, borderColor: Colors.border },
  actionBtnDelete: { borderColor: Colors.alerta },
  actionBtnText: { fontSize: 13, color: Colors.textLight, fontWeight: '600' },
  empty: { alignItems: 'center', paddingTop: 60 },
  emptyIcon: { fontSize: 48, marginBottom: 8 },
  emptyText: { fontSize: 15, color: Colors.textMuted },
  fab: {
    position: 'absolute', bottom: 24, right: 24, width: 56, height: 56,
    borderRadius: 28, backgroundColor: Colors.primary, justifyContent: 'center',
    alignItems: 'center', elevation: 6, borderWidth: 2, borderColor: Colors.text,
  },
  fabText: { fontSize: 28, color: Colors.text, lineHeight: 32 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: Colors.surface, borderTopLeftRadius: 20,
    borderTopRightRadius: 20, maxHeight: '85%',
  },
  sheetHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', padding: 18,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  sheetTitle: { fontSize: 18, fontWeight: '700', color: Colors.text },
  close: { fontSize: 20, color: Colors.textMuted, padding: 4 },
  saveBtn: {
    backgroundColor: Colors.text, borderRadius: 12, padding: 14,
    alignItems: 'center', marginTop: 8,
  },
  saveBtnText: { color: Colors.primary, fontWeight: '800', fontSize: 15 },
  detalleRow: { fontSize: 14, color: Colors.textLight, marginBottom: 6 },
  usersSection: {
    marginTop: 16, backgroundColor: Colors.background,
    borderRadius: 12, padding: 14, borderWidth: 1, borderColor: Colors.border,
  },
  usersSectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  usersTitle: { fontSize: 15, fontWeight: '700', color: Colors.text },
  addUserBtn: { backgroundColor: Colors.primary, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 5 },
  addUserBtnText: { fontSize: 13, fontWeight: '700', color: Colors.text },
  userRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', paddingVertical: 8,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  userName: { fontSize: 14, fontWeight: '600', color: Colors.text },
  userEmail: { fontSize: 12, color: Colors.textMuted },
  userRol: { fontSize: 11, color: Colors.ok, fontWeight: '600', marginTop: 2 },
  userDelete: { fontSize: 18, color: Colors.alerta, padding: 4 },
  noUsers: { fontSize: 13, color: Colors.textMuted, textAlign: 'center', padding: 8 },
  addUserForm: { marginTop: 12, padding: 12, backgroundColor: Colors.surface, borderRadius: 10 },
});
