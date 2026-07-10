import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity,
  SafeAreaView, Linking, TextInput, ScrollView, Alert,
} from 'react-native';
import { Colors } from '../utils/colors';
import { getSetting, setSetting } from '../db/database';
import { formatRenspa } from '../utils/formatters';

export default function MenuModal({ visible, onClose }) {
  const [tab, setTab]                 = useState('menu'); // 'menu' | 'config'
  const [operatorName, setOperName]   = useState('');
  const [defaultCUIG, setDefaultCUIG] = useState('');
  const [saving, setSaving]           = useState(false);

  useEffect(() => {
    if (visible) {
      getSetting('operator_name', '').then(setOperName);
      getSetting('default_cuig', '').then(setDefaultCUIG);
      setTab('menu');
    }
  }, [visible]);

  async function guardarConfig() {
    setSaving(true);
    await setSetting('operator_name', operatorName);
    await setSetting('default_cuig', defaultCUIG);
    setSaving(false);
    Alert.alert('Guardado', 'Configuración actualizada.');
  }

  function abrirWhatsApp() {
    Linking.openURL('https://wa.me/5491100000000?text=Hola%2C%20necesito%20soporte%20con%20Durflex').catch(() =>
      Alert.alert('Error', 'No se pudo abrir WhatsApp')
    );
  }

  function abrirEmail() {
    Linking.openURL('mailto:soporte@durflex.com.ar?subject=Soporte%20Durflex').catch(() =>
      Alert.alert('Error', 'No se pudo abrir el correo')
    );
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
      <SafeAreaView style={styles.drawer} pointerEvents="box-none">
        {/* Header */}
        <View style={styles.header}>
          {tab === 'config' ? (
            <>
              <TouchableOpacity onPress={() => setTab('menu')} style={styles.backBtn}>
                <Text style={styles.backBtnText}>← Volver</Text>
              </TouchableOpacity>
              <Text style={styles.headerTitle}>Configuración</Text>
            </>
          ) : (
            <>
              <View style={styles.brand}>
                <Text style={styles.brandName}>Durflex</Text>
                <Text style={styles.brandSub}>Registro ganadero argentino</Text>
              </View>
              <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                <Text style={styles.closeBtnText}>✕</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        <ScrollView>
          {tab === 'menu' ? (
            <View style={styles.menuItems}>

              {/* Sync / Login */}
              <TouchableOpacity style={styles.item} onPress={() =>
                Alert.alert('Sync en la nube', 'La sincronización en la nube estará disponible próximamente.')
              }>
                <Text style={styles.itemIcon}>☁️</Text>
                <View style={styles.itemContent}>
                  <Text style={styles.itemTitle}>Iniciar sesión</Text>
                  <Text style={styles.itemSub}>Sync automático en la nube</Text>
                </View>
                <Text style={styles.itemArrow}>›</Text>
              </TouchableOpacity>

              <View style={styles.divider} />

              {/* Configuración */}
              <TouchableOpacity style={styles.item} onPress={() => setTab('config')}>
                <Text style={styles.itemIcon}>⚙️</Text>
                <View style={styles.itemContent}>
                  <Text style={styles.itemTitle}>Configuración</Text>
                  <Text style={styles.itemSub}>Operador, RENSPA por defecto</Text>
                </View>
                <Text style={styles.itemArrow}>›</Text>
              </TouchableOpacity>

              <View style={styles.divider} />

              {/* Soporte WhatsApp */}
              <TouchableOpacity style={styles.item} onPress={abrirWhatsApp}>
                <Text style={styles.itemIcon}>💬</Text>
                <View style={styles.itemContent}>
                  <Text style={styles.itemTitle}>WhatsApp soporte</Text>
                  <Text style={styles.itemSub}>+54 9 11 0000-0000</Text>
                </View>
                <Text style={styles.itemArrow}>›</Text>
              </TouchableOpacity>

              {/* Soporte Email */}
              <TouchableOpacity style={styles.item} onPress={abrirEmail}>
                <Text style={styles.itemIcon}>✉️</Text>
                <View style={styles.itemContent}>
                  <Text style={styles.itemTitle}>Email soporte</Text>
                  <Text style={styles.itemSub}>soporte@durflex.com.ar</Text>
                </View>
                <Text style={styles.itemArrow}>›</Text>
              </TouchableOpacity>

              <View style={styles.divider} />

              <View style={styles.versionRow}>
                <Text style={styles.version}>Durflex v1.0.0</Text>
              </View>
            </View>
          ) : (
            <View style={styles.configPanel}>
              <Text style={styles.configLabel}>Nombre del operador</Text>
              <TextInput
                style={styles.configInput}
                value={operatorName}
                onChangeText={setOperName}
                placeholder="Ej: Juan Pérez"
                placeholderTextColor={Colors.textMuted}
              />

              <Text style={styles.configLabel}>RENSPA por defecto</Text>
              <TextInput
                style={styles.configInput}
                value={defaultCUIG}
                onChangeText={(v) => setDefaultCUIG(formatRenspa(v))}
                placeholder="Ej: 14.100.0.00123/00"
                placeholderTextColor={Colors.textMuted}
                autoCapitalize="characters"
                autoCorrect={false}
                maxLength={17}
              />

              <TouchableOpacity style={styles.saveBtn} onPress={guardarConfig} disabled={saving}>
                <Text style={styles.saveBtnText}>{saving ? 'Guardando...' : 'Guardar configuración'}</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.4)' },
  drawer: {
    position: 'absolute', top: 0, bottom: 0, right: 0,
    width: '80%', backgroundColor: Colors.surface,
    shadowColor: '#000', shadowOffset: { width: -4, height: 0 },
    shadowOpacity: 0.2, shadowRadius: 12, elevation: 20,
  },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Colors.header, padding: 20, paddingTop: 24,
  },
  brand: {},
  brandName: { fontSize: 22, fontWeight: '900', color: Colors.primary },
  brandSub:  { fontSize: 12, color: Colors.headerTint, opacity: 0.8, marginTop: 2 },
  closeBtn:  { padding: 6 },
  closeBtnText: { fontSize: 20, color: Colors.headerTint },
  backBtn:      { marginRight: 12 },
  backBtnText:  { fontSize: 14, color: Colors.headerTint, fontWeight: '600' },
  headerTitle:  { fontSize: 17, fontWeight: '700', color: Colors.headerTint, flex: 1 },

  menuItems: { paddingVertical: 8 },
  item: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16 },
  itemIcon:    { fontSize: 22, width: 36 },
  itemContent: { flex: 1 },
  itemTitle:   { fontSize: 15, fontWeight: '600', color: Colors.text },
  itemSub:     { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  itemArrow:   { fontSize: 20, color: Colors.textMuted },
  divider:     { height: 1, backgroundColor: Colors.border, marginHorizontal: 20 },
  versionRow:  { alignItems: 'center', paddingVertical: 24 },
  version:     { fontSize: 12, color: Colors.textMuted },

  configPanel: { padding: 20 },
  configLabel: { fontSize: 13, fontWeight: '600', color: Colors.textLight, marginBottom: 6, marginTop: 16 },
  configInput: {
    backgroundColor: Colors.background, borderWidth: 1, borderColor: Colors.border,
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, fontSize: 15, color: Colors.text,
  },
  saveBtn:     { backgroundColor: Colors.text, borderRadius: 12, padding: 14, alignItems: 'center', marginTop: 24 },
  saveBtnText: { color: Colors.primary, fontWeight: '800', fontSize: 15 },
});
