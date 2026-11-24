import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity,
  SafeAreaView, Linking, TextInput, ScrollView, Alert, Image,
} from 'react-native';
import { Colors } from '../utils/colors';
import { getSetting, setSetting } from '../db/database';
import { formatRenspa } from '../utils/formatters';
import CuentaScreen from '../screens/CuentaScreen';

const LOGO = require('../../assets/logo-header.png');

function Item({ icon, title, sub, onPress }) {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.iconBox}><Text style={styles.icon}>{icon}</Text></View>
      <View style={styles.itemContent}>
        <Text style={styles.itemTitle}>{title}</Text>
        {!!sub && <Text style={styles.itemSub}>{sub}</Text>}
      </View>
      <Text style={styles.chevron}>›</Text>
    </TouchableOpacity>
  );
}

export default function MenuModal({ visible, onClose }) {
  const [tab, setTab]                 = useState('menu'); // 'menu' | 'config' | 'cuenta'
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
    Linking.openURL('https://wa.me/5491162424700?text=Hola%2C%20necesito%20soporte%20con%20Durflex').catch(() =>
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
      <View style={styles.drawer}>
        {/* Header oscuro con logo */}
        <SafeAreaView style={styles.headerSafe}>
          {tab !== 'menu' ? (
            <View style={styles.subHeader}>
              <TouchableOpacity onPress={() => setTab('menu')} style={styles.backBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Text style={styles.backBtnText}>‹ Volver</Text>
              </TouchableOpacity>
              <Text style={styles.headerTitle}>
                {tab === 'cuenta' ? 'Mi cuenta' : 'Configuración'}
              </Text>
            </View>
          ) : (
            <View style={styles.brandHeader}>
              <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Text style={styles.closeBtnText}>✕</Text>
              </TouchableOpacity>
              <Image source={LOGO} style={styles.logo} />
              <Text style={styles.brandSub}>Registro ganadero argentino</Text>
            </View>
          )}
        </SafeAreaView>

        {tab === 'cuenta' ? (
          <View style={styles.body}><CuentaScreen /></View>
        ) : (
        <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
          {tab === 'menu' ? (
            <>
              <Text style={styles.section}>CUENTA</Text>
              <Item icon="☁️" title="Mi cuenta" sub="Copia de seguridad en la nube" onPress={() => setTab('cuenta')} />
              <Item icon="⚙️" title="Configuración" sub="Operador y RENSPA por defecto" onPress={() => setTab('config')} />

              <Text style={styles.section}>AYUDA</Text>
              <Item icon="💬" title="WhatsApp soporte" sub="+54 9 11 6242-4700" onPress={abrirWhatsApp} />
              <Item icon="✉️" title="Email soporte" sub="soporte@durflex.com.ar" onPress={abrirEmail} />

              <View style={styles.footer}>
                <Text style={styles.version}>Durflex v1.0.0</Text>
                <Text style={styles.company}>LECVET S.R.L. · durflex.com.ar</Text>
              </View>
            </>
          ) : (
            <View style={styles.configCard}>
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
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.45)' },
  drawer: {
    position: 'absolute', top: 0, bottom: 0, right: 0,
    width: '84%', backgroundColor: Colors.background,
    borderTopLeftRadius: 20, borderBottomLeftRadius: 20, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: -4, height: 0 },
    shadowOpacity: 0.25, shadowRadius: 16, elevation: 20,
  },

  // Header
  headerSafe:  { backgroundColor: Colors.header },
  brandHeader: { alignItems: 'center', paddingTop: 18, paddingBottom: 18, paddingHorizontal: 20 },
  logo:        { width: 132, height: 125, resizeMode: 'contain' },
  brandSub:    { fontSize: 13, color: Colors.headerTint, opacity: 0.85, marginTop: 8, letterSpacing: 0.3 },
  closeBtn: {
    position: 'absolute', top: 14, right: 14, zIndex: 2,
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: 'rgba(245,225,0,0.15)', alignItems: 'center', justifyContent: 'center',
  },
  closeBtnText: { fontSize: 16, color: Colors.headerTint, fontWeight: '700' },
  subHeader:    { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 16 },
  backBtn:      { marginRight: 12 },
  backBtnText:  { fontSize: 16, color: Colors.headerTint, fontWeight: '600' },
  headerTitle:  { fontSize: 17, fontWeight: '700', color: Colors.headerTint, flex: 1 },

  // Cuerpo
  body:        { flex: 1 },
  bodyContent: { padding: 16, paddingBottom: 40 },
  section:     { fontSize: 11, fontWeight: '800', color: Colors.textMuted, letterSpacing: 1.2, marginTop: 10, marginBottom: 8, marginLeft: 4 },
  card: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.surface, borderRadius: 14,
    borderWidth: 1, borderColor: Colors.border,
    paddingVertical: 12, paddingHorizontal: 12, marginBottom: 10,
  },
  iconBox: {
    width: 42, height: 42, borderRadius: 12, marginRight: 12,
    backgroundColor: '#FFF8C2', alignItems: 'center', justifyContent: 'center',
  },
  icon:        { fontSize: 20 },
  itemContent: { flex: 1 },
  itemTitle:   { fontSize: 15, fontWeight: '700', color: Colors.text },
  itemSub:     { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  chevron:     { fontSize: 24, color: Colors.textMuted, marginLeft: 6 },
  footer:      { alignItems: 'center', marginTop: 24 },
  version:     { fontSize: 12, fontWeight: '700', color: Colors.textMuted },
  company:     { fontSize: 11, color: Colors.textMuted, marginTop: 2, opacity: 0.8 },

  // Configuración
  configCard: {
    backgroundColor: Colors.surface, borderRadius: 14, borderWidth: 1, borderColor: Colors.border,
    padding: 16,
  },
  configLabel: { fontSize: 13, fontWeight: '600', color: Colors.textLight, marginBottom: 6, marginTop: 12 },
  configInput: {
    backgroundColor: Colors.background, borderWidth: 1, borderColor: Colors.border,
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, fontSize: 15, color: Colors.text,
  },
  saveBtn:     { backgroundColor: Colors.text, borderRadius: 12, padding: 14, alignItems: 'center', marginTop: 24 },
  saveBtnText: { color: Colors.primary, fontWeight: '800', fontSize: 15 },
});
