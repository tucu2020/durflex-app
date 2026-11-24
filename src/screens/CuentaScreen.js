import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, StyleSheet, TouchableOpacity, SafeAreaView,
  ScrollView, Alert, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Colors } from '../utils/colors';
import {
  registrar, iniciarSesion, cerrarSesion, getUsuarioGuardado, estaLogueado,
  eliminarCuenta,
} from '../api/client';
import { sincronizar, hayPendientes, ultimaSincronizacion } from '../api/sync';

function fechaLinda(iso) {
  if (!iso) return 'Nunca';
  const d = new Date(iso);
  return d.toLocaleDateString('es-AR') + ' a las ' + d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
}

export default function CuentaScreen() {
  const [cargando, setCargando]   = useState(true);
  const [usuario, setUsuario]     = useState(null);
  const [modo, setModo]           = useState('login'); // login | registro
  const [email, setEmail]         = useState('');
  const [pass, setPass]           = useState('');
  const [nombre, setNombre]       = useState('');
  const [ocupado, setOcupado]     = useState(false);
  const [pendientes, setPendientes] = useState(0);
  const [ultima, setUltima]       = useState('');
  const [confirmarBorrado, setConfirmarBorrado] = useState(false);
  const [passBorrar, setPassBorrar] = useState('');

  const refrescar = useCallback(async () => {
    setCargando(true);
    try {
      if (await estaLogueado()) {
        setUsuario(await getUsuarioGuardado());
        setPendientes(await hayPendientes());
        setUltima(await ultimaSincronizacion());
      } else {
        setUsuario(null);
      }
    } catch (e) { }
    setCargando(false);
  }, []);

  useEffect(() => { refrescar(); }, [refrescar]);

  async function entrar() {
    const mail = email.trim().toLowerCase();
    if (!mail || !pass) { Alert.alert('Faltan datos', 'Completá el email y la contraseña.'); return; }
    if (modo === 'registro' && pass.length < 6) {
      Alert.alert('Contraseña corta', 'Tiene que tener al menos 6 caracteres.');
      return;
    }
    setOcupado(true);
    try {
      const u = modo === 'registro'
        ? await registrar({ email: mail, password: pass, nombre })
        : await iniciarSesion({ email: mail, password: pass });
      setUsuario(u);
      setPass('');
      await refrescar();
      Alert.alert('Listo', 'Cuenta conectada. Ya podés sincronizar tus datos.');
    } catch (e) {
      Alert.alert('No se pudo entrar', e.message);
    } finally {
      setOcupado(false);
    }
  }

  async function salir() {
    Alert.alert('Cerrar sesión', 'Tus datos siguen guardados en el teléfono. Vas a poder volver a entrar cuando quieras.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Cerrar sesión', style: 'destructive',
        onPress: async () => { await cerrarSesion(); setUsuario(null); },
      },
    ]);
  }

  async function eliminar() {
    if (!passBorrar) { Alert.alert('Falta la contraseña', 'Ingresá tu contraseña para confirmar.'); return; }
    Alert.alert(
      'Eliminar cuenta',
      'Esto borra tu cuenta y todos tus datos de la nube de forma permanente. Esta acción no se puede deshacer. ¿Continuar?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar definitivamente', style: 'destructive',
          onPress: async () => {
            setOcupado(true);
            try {
              await eliminarCuenta({ password: passBorrar });
              setUsuario(null);
              setConfirmarBorrado(false);
              setPassBorrar('');
              Alert.alert('Cuenta eliminada', 'Tu cuenta y tus datos en la nube se borraron. Los datos que tengas en este teléfono siguen disponibles sin cuenta.');
            } catch (e) {
              Alert.alert('No se pudo eliminar', e.message);
            } finally {
              setOcupado(false);
            }
          },
        },
      ],
    );
  }

  async function sync() {
    setOcupado(true);
    try {
      const r = await sincronizar();
      await refrescar();
      const partes = [];
      if (r.subidos)      partes.push(r.subidos + ' enviados');
      if (r.nuevos)       partes.push(r.nuevos + ' nuevos');
      if (r.actualizados) partes.push(r.actualizados + ' actualizados');
      Alert.alert('Sincronizado',
        partes.length ? partes.join(', ') + '.' : 'Ya estaba todo al día.');
    } catch (e) {
      Alert.alert('No se pudo sincronizar', e.message);
    } finally {
      setOcupado(false);
    }
  }

  if (cargando) {
    return (
      <SafeAreaView style={[styles.safe, styles.centro]}>
        <ActivityIndicator size="large" color={Colors.text} />
      </SafeAreaView>
    );
  }

  // ---------- Sesion iniciada ----------
  if (usuario) {
    return (
      <SafeAreaView style={styles.safe}>
        <ScrollView contentContainerStyle={{ padding: 16 }}>
          <View style={styles.card}>
            <Text style={styles.avatar}>👤</Text>
            <Text style={styles.nombre}>{usuario.nombre || 'Mi cuenta'}</Text>
            <Text style={styles.email}>{usuario.email}</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.tituloCard}>Copia en la nube</Text>

            <View style={styles.fila}>
              <Text style={styles.etiqueta}>Última sincronización</Text>
              <Text style={styles.valor}>{fechaLinda(ultima)}</Text>
            </View>

            <View style={styles.fila}>
              <Text style={styles.etiqueta}>Sin subir</Text>
              <Text style={[styles.valor, pendientes ? styles.valorPend : null]}>
                {pendientes ? pendientes + ' cambios' : 'Todo al día'}
              </Text>
            </View>

            <TouchableOpacity
              style={[styles.boton, ocupado && styles.botonOff]}
              onPress={sync}
              disabled={ocupado}
            >
              {ocupado
                ? <ActivityIndicator color={Colors.text} />
                : <Text style={styles.botonTexto}>Sincronizar ahora</Text>}
            </TouchableOpacity>

            <Text style={styles.ayuda}>
              Podés cargar animales sin señal. Cuando tengas internet, tocá este botón
              y se guarda todo en la nube.
            </Text>
          </View>

          <TouchableOpacity style={styles.botonSalir} onPress={salir}>
            <Text style={styles.botonSalirTexto}>Cerrar sesión</Text>
          </TouchableOpacity>

          <View style={styles.cardPeligro}>
            <Text style={styles.tituloPeligro}>Eliminar cuenta</Text>
            <Text style={styles.ayuda}>
              Borra tu cuenta y todos tus datos de la nube de forma permanente.
              No se puede deshacer. Los datos de este teléfono no se borran.
            </Text>

            {!confirmarBorrado ? (
              <TouchableOpacity
                style={styles.botonPeligro}
                onPress={() => setConfirmarBorrado(true)}
              >
                <Text style={styles.botonPeligroTexto}>Eliminar mi cuenta</Text>
              </TouchableOpacity>
            ) : (
              <>
                <Text style={styles.label}>Ingresá tu contraseña para confirmar</Text>
                <TextInput
                  style={styles.input}
                  value={passBorrar}
                  onChangeText={setPassBorrar}
                  placeholder="Tu contraseña"
                  secureTextEntry
                  autoCapitalize="none"
                />
                <TouchableOpacity
                  style={[styles.botonPeligro, ocupado && styles.botonOff]}
                  onPress={eliminar}
                  disabled={ocupado}
                >
                  {ocupado
                    ? <ActivityIndicator color="#FFF" />
                    : <Text style={styles.botonPeligroTexto}>Eliminar definitivamente</Text>}
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.cambiar}
                  onPress={() => { setConfirmarBorrado(false); setPassBorrar(''); }}
                >
                  <Text style={styles.cambiarTexto}>Cancelar</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ---------- Sin sesion ----------
  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled">
          <View style={styles.card}>
            <Text style={styles.tituloCard}>
              {modo === 'registro' ? 'Crear cuenta' : 'Iniciar sesión'}
            </Text>
            <Text style={styles.ayuda}>
              Con una cuenta, tus animales quedan guardados en la nube. Si cambiás
              de teléfono o se te pierde, no perdés nada.
            </Text>

            {modo === 'registro' && (
              <>
                <Text style={styles.label}>Nombre</Text>
                <TextInput
                  style={styles.input}
                  value={nombre}
                  onChangeText={setNombre}
                  placeholder="Cómo te llamás"
                  autoCapitalize="words"
                />
              </>
            )}

            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="tumail@ejemplo.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />

            <Text style={styles.label}>Contraseña</Text>
            <TextInput
              style={styles.input}
              value={pass}
              onChangeText={setPass}
              placeholder={modo === 'registro' ? 'Mínimo 6 caracteres' : 'Tu contraseña'}
              secureTextEntry
              autoCapitalize="none"
            />

            <TouchableOpacity
              style={[styles.boton, ocupado && styles.botonOff]}
              onPress={entrar}
              disabled={ocupado}
            >
              {ocupado
                ? <ActivityIndicator color={Colors.text} />
                : <Text style={styles.botonTexto}>
                    {modo === 'registro' ? 'Crear mi cuenta' : 'Entrar'}
                  </Text>}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cambiar}
              onPress={() => setModo(modo === 'registro' ? 'login' : 'registro')}
            >
              <Text style={styles.cambiarTexto}>
                {modo === 'registro'
                  ? 'Ya tengo cuenta, quiero entrar'
                  : 'No tengo cuenta, quiero crear una'}
              </Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.nota}>
            La app funciona igual sin cuenta. Todo se guarda en el teléfono.
            La cuenta sirve para tener una copia de seguridad.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: Colors.background },
  centro: { justifyContent: 'center', alignItems: 'center' },

  card: {
    backgroundColor: Colors.surface, borderRadius: 14, padding: 18,
    marginBottom: 14, borderWidth: 1, borderColor: Colors.border,
  },
  avatar: { fontSize: 44, textAlign: 'center' },
  nombre: { fontSize: 20, fontWeight: '700', color: Colors.text, textAlign: 'center', marginTop: 6 },
  email:  { fontSize: 14, color: Colors.textMuted, textAlign: 'center', marginTop: 2 },

  tituloCard: { fontSize: 17, fontWeight: '700', color: Colors.text, marginBottom: 8 },

  fila: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  etiqueta:   { fontSize: 14, color: Colors.textLight, flex: 1, marginRight: 12 },
  valor:      { fontSize: 14, fontWeight: '600', color: Colors.text, flexShrink: 1, textAlign: 'right' },
  valorPend:  { color: Colors.vacuna },

  label: { fontSize: 13, color: Colors.textLight, marginTop: 12, marginBottom: 4, fontWeight: '600' },
  input: {
    borderWidth: 1, borderColor: Colors.border, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 11, fontSize: 16,
    color: Colors.text, backgroundColor: '#FFF',
  },

  boton: {
    backgroundColor: Colors.primary, borderRadius: 12,
    paddingVertical: 15, alignItems: 'center', marginTop: 18,
  },
  botonOff:   { opacity: 0.6 },
  botonTexto: { fontSize: 16, fontWeight: '700', color: Colors.text },

  cambiar:      { marginTop: 14, alignItems: 'center' },
  cambiarTexto: { fontSize: 14, color: Colors.textMuted, textDecorationLine: 'underline' },

  botonSalir:      { alignItems: 'center', paddingVertical: 14 },
  botonSalirTexto: { fontSize: 15, color: Colors.alerta, fontWeight: '600' },

  ayuda: { fontSize: 13, color: Colors.textMuted, lineHeight: 19, marginTop: 10 },
  nota:  { fontSize: 12, color: Colors.textMuted, textAlign: 'center', paddingHorizontal: 20, lineHeight: 18 },

  cardPeligro: {
    backgroundColor: Colors.surface, borderRadius: 14, padding: 18,
    marginTop: 8, marginBottom: 24, borderWidth: 1, borderColor: '#E0A0A0',
  },
  tituloPeligro: { fontSize: 16, fontWeight: '700', color: '#C0392B', marginBottom: 4 },
  botonPeligro: {
    backgroundColor: '#C0392B', borderRadius: 12,
    paddingVertical: 14, alignItems: 'center', marginTop: 14,
  },
  botonPeligroTexto: { fontSize: 15, fontWeight: '700', color: '#FFF' },
});
