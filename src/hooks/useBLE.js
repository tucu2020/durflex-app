import { useState, useCallback, useRef, useEffect } from 'react';
import { Platform, PermissionsAndroid } from 'react-native';

/**
 * useBLE — Lectura real de caravanas RFID vía Bluetooth clásico (SPP).
 *
 * Usa react-native-bluetooth-classic, que es Bluetooth clásico (Serial Port
 * Profile). La mayoría de los bastones lectores RFID ganaderos se emparejan
 * como un dispositivo Bluetooth normal (con PIN) y, al leer una caravana,
 * envían el número por el puerto serie. Este hook:
 *   - Lista los dispositivos ya emparejados y descubre nuevos.
 *   - Se conecta por SPP al bastón elegido.
 *   - Escucha los datos entrantes y extrae la caravana.
 *   - Guarda el dato CRUDO (raw) para poder ver textualmente qué manda el
 *     bastón la primera vez y ajustar el parseo si hiciera falta.
 *
 * Si el módulo nativo no está disponible (p. ej. corriendo en Expo Go),
 * cae automáticamente en modo simulación para que la UI siga funcionando.
 */

// --- Carga defensiva del módulo nativo -------------------------------------
let RNBluetoothClassic = null;
let nativeAvailable = false;
try {
  // require dentro de try: en Expo Go el módulo nativo no existe y tira.
  const mod = require('react-native-bluetooth-classic');
  RNBluetoothClassic = mod?.default ?? mod;
  nativeAvailable = !!(RNBluetoothClassic && typeof RNBluetoothClassic.getBondedDevices === 'function');
} catch (e) {
  nativeAvailable = false;
}

// --- Datos de simulación (fallback Expo Go) --------------------------------
const MOCK_DEVICES = [
  { id: 'mock-rfid-001', name: 'Bastón RFID HF-100', rssi: -58 },
  { id: 'mock-rfid-002', name: 'Lector RFID BT-200', rssi: -72 },
];

function randomCaravana() {
  // Simula un número ISO 11784/11785 de 15 dígitos (Argentina = 032).
  const nac = String(Math.floor(Math.random() * 1e12)).padStart(12, '0');
  return `032${nac}`;
}

/**
 * Intenta extraer una caravana de una línea cruda enviada por el lector.
 * Distintos bastones mandan formatos distintos (solo dígitos, con prefijos,
 * con separadores). Estrategia tolerante: quedarse con la secuencia más larga
 * de dígitos/puntos. Si no hay dígitos, devolver la línea limpia tal cual.
 */
export function parseCaravana(raw) {
  if (!raw) return '';
  const limpio = String(raw).replace(/[\r\n]+/g, ' ').trim();
  // Las lecturas RFID llegan como dígitos y, en muchos lectores (p. ej. el
  // Allflex XRS2i), el código de país viene separado por un espacio:
  //   "032 010005487840"  ->  032 (país) + 010005487840 (animal)
  // Unimos TODOS los dígitos para formar el número ISO completo (15 cifras).
  const soloDigitos = limpio.replace(/\D+/g, '');
  if (soloDigitos.length >= 8) return soloDigitos;
  // Si no hay suficientes dígitos, devolver la línea limpia tal cual.
  return limpio;
}

// --- Permisos de Android ----------------------------------------------------
async function pedirPermisos() {
  if (Platform.OS !== 'android') return true;
  try {
    const perms = [];
    // Android 12 (API 31)+ usa los permisos "nuevos" de Bluetooth.
    if (Platform.Version >= 31) {
      perms.push(
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
      );
    }
    // La ubicación sigue siendo necesaria para el descubrimiento en muchas versiones.
    perms.push(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);

    const res = await PermissionsAndroid.requestMultiple(perms);
    return perms.every(
      (p) => res[p] === PermissionsAndroid.RESULTS.GRANTED,
    );
  } catch (e) {
    return false;
  }
}

// ===========================================================================
export function useBLE() {
  const [scanning, setScanning]   = useState(false);
  const [devices, setDevices]     = useState([]);
  const [connected, setConnected] = useState(null);
  const [lastRead, setLastRead]   = useState('');
  const [rawData, setRawData]     = useState('');   // último dato crudo recibido
  const [rawLog, setRawLog]       = useState([]);   // historial de datos crudos
  const [error, setError]         = useState('');
  const [btState, setBtState]     = useState(nativeAvailable ? 'Unknown' : 'Mock');

  const scanTimer    = useRef(null);
  const readTimer    = useRef(null);
  const dataSub      = useRef(null);   // suscripción onDataReceived
  const disconnSub   = useRef(null);   // suscripción onDeviceDisconnected
  const readInterval = useRef(null);   // sondeo de lectura por bytes
  const deviceRef    = useRef(null);   // dispositivo conectado
  const bufferRef    = useRef('');     // acumulador de bytes crudos
  const connectingRef = useRef(false); // evita conexiones superpuestas

  // Limpieza al desmontar
  useEffect(() => {
    return () => {
      clearTimeout(scanTimer.current);
      clearTimeout(readTimer.current);
      clearInterval(readInterval.current);
      try { dataSub.current?.remove?.(); } catch (e) {}
      try { disconnSub.current?.remove?.(); } catch (e) {}
    };
  }, []);

  function pushRaw(texto) {
    setRawData(texto);
    setRawLog((prev) => [
      { t: new Date().toLocaleTimeString('es-AR'), texto },
      ...prev,
    ].slice(0, 30));
  }

  // ---------------- Escaneo ----------------
  const startScan = useCallback(async () => {
    setError('');
    setDevices([]);

    // ---- Fallback simulación ----
    if (!nativeAvailable) {
      setScanning(true);
      scanTimer.current = setTimeout(() => {
        setDevices(MOCK_DEVICES);
        setScanning(false);
      }, 1500);
      return;
    }

    // ---- Real ----
    const ok = await pedirPermisos();
    if (!ok) {
      setError('Faltan permisos de Bluetooth/Ubicación.');
      return;
    }

    try {
      const habilitado = await RNBluetoothClassic.isBluetoothEnabled();
      if (!habilitado) {
        try { await RNBluetoothClassic.requestBluetoothEnabled(); }
        catch (e) { setError('Activá el Bluetooth para continuar.'); return; }
      }

      setScanning(true);

      // 1) Emparejados: el bastón normalmente ya está vinculado desde Ajustes.
      const bonded = await RNBluetoothClassic.getBondedDevices();
      const bondedList = (bonded || []).map((d) => ({
        id: d.address, name: d.name || d.address, bonded: true, _device: d,
      }));
      setDevices(bondedList);

      // 2) Descubrimiento de nuevos (puede tardar ~10s).
      try {
        const found = await RNBluetoothClassic.startDiscovery();
        const foundList = (found || []).map((d) => ({
          id: d.address, name: d.name || d.address, bonded: false, _device: d,
        }));
        // Unir sin duplicar por address.
        setDevices((prev) => {
          const map = new Map(prev.map((x) => [x.id, x]));
          foundList.forEach((x) => { if (!map.has(x.id)) map.set(x.id, x); });
          return Array.from(map.values());
        });
      } catch (e) {
        // El descubrimiento puede fallar/estar ocupado; seguimos con los emparejados.
      }
    } catch (e) {
      setError(`Error al escanear: ${e?.message ?? e}`);
    } finally {
      setScanning(false);
    }
  }, []);

  const stopScan = useCallback(async () => {
    clearTimeout(scanTimer.current);
    setScanning(false);
    if (nativeAvailable) {
      try { await RNBluetoothClassic.cancelDiscovery(); } catch (e) {}
    }
  }, []);

  // ---------------- Conexión ----------------
  const connectDevice = useCallback(async (deviceId) => {
    setError('');

    // ---- Fallback simulación ----
    if (!nativeAvailable) {
      const device = MOCK_DEVICES.find((d) => d.id === deviceId) ?? { id: deviceId, name: 'Dispositivo' };
      setConnected({ id: device.id, name: device.name });
      readTimer.current = setTimeout(() => {
        const c = randomCaravana();
        pushRaw(c);
        setLastRead(c);
      }, 2000);
      return;
    }

    // ---- Real ----
    if (connectingRef.current) return;   // ya hay un intento en curso
    connectingRef.current = true;
    try {
      const habilitado = await RNBluetoothClassic.isBluetoothEnabled();
      if (!habilitado) { setError('Bluetooth apagado.'); return; }

      // Cortar la búsqueda: conectar durante el descubrimiento suele fallar.
      try { await RNBluetoothClassic.cancelDiscovery(); } catch (e) {}
      setScanning(false);

      // Si quedó una conexión previa colgada con este dispositivo, cerrarla.
      try {
        if (await RNBluetoothClassic.isDeviceConnected(deviceId)) {
          await RNBluetoothClassic.disconnectFromDevice(deviceId);
        }
      } catch (e) {}

      // Conexión SPP. Muchos lectores (p. ej. Allflex XRS2i) terminan la
      // lectura con retorno de carro (\r), no con salto de línea (\n). Para no
      // depender de eso, leemos por SONDEO todos los bytes disponibles y
      // separamos las lecturas por \r o \n.
      // El error 'read failed, socket might closed' suele ser intermitente:
      // reintentamos una vez tras una pausa breve.
      let device = null;
      for (let intento = 1; intento <= 2 && !device; intento++) {
        try {
          device = await RNBluetoothClassic.connectToDevice(deviceId, {
            DELIMITER: '',
            DEVICE_CHARSET: 'ascii',
          });
        } catch (e) {
          if (intento >= 2) throw e;
          try { await RNBluetoothClassic.disconnectFromDevice(deviceId); } catch (_) {}
          await new Promise((r) => setTimeout(r, 600));
        }
      }

      deviceRef.current = device;
      bufferRef.current = '';
      setConnected({ id: deviceId, name: device?.name || deviceId });
      setBtState('Connected');

      // Procesa un fragmento crudo recibido del bastón.
      const procesar = (chunk) => {
        const texto = (chunk ?? '').toString();
        if (!texto) return;
        pushRaw(texto);                       // mostrar TODO lo que llega, crudo
        bufferRef.current += texto;
        const partes = bufferRef.current.split(/[\r\n]+/);
        bufferRef.current = partes.pop();     // guardar el resto incompleto
        partes.forEach((linea) => {
          const c = parseCaravana(linea);
          if (c) setLastRead(c);
        });
      };

      // (a) Evento por si el lector sí usa delimitador.
      try {
        dataSub.current = device.onDataReceived((event) => procesar(event?.data));
      } catch (e) { /* algunos entornos no exponen el evento; seguimos con sondeo */ }

      // (b) Sondeo cada 200 ms: lee lo que haya en el buffer, sin delimitador.
      readInterval.current = setInterval(async () => {
        try {
          const disp = await device.available();
          if (disp && disp > 0) {
            const data = await device.read();
            if (data) procesar(data);
          }
        } catch (e) { /* ignorar errores de sondeo puntuales */ }
      }, 200);

      // Escuchar desconexión física del dispositivo.
      disconnSub.current = RNBluetoothClassic.onDeviceDisconnected(() => {
        clearInterval(readInterval.current);
        setConnected(null);
        setBtState('Disconnected');
        try { dataSub.current?.remove?.(); } catch (e) {}
      });
    } catch (e) {
      setError(`No se pudo conectar: ${e?.message ?? e}`);
    } finally {
      connectingRef.current = false;
    }
  }, []);

  const disconnect = useCallback(async () => {
    clearTimeout(readTimer.current);
    clearInterval(readInterval.current);
    bufferRef.current = '';
    try { dataSub.current?.remove?.(); } catch (e) {}
    try { disconnSub.current?.remove?.(); } catch (e) {}
    if (nativeAvailable && connected?.id) {
      try { await RNBluetoothClassic.disconnectFromDevice(connected.id); } catch (e) {}
    }
    deviceRef.current = null;
    setConnected(null);
    setLastRead('');
    setBtState(nativeAvailable ? 'Unknown' : 'Mock');
  }, [connected]);

  const clearLastRead = useCallback(() => setLastRead(''), []);
  const clearRawLog   = useCallback(() => { setRawLog([]); setRawData(''); }, []);

  return {
    bleState: btState,
    scanning,
    devices,
    connected,
    lastRead,
    rawData,
    rawLog,
    error,
    isSupported: nativeAvailable,
    isMock: !nativeAvailable,
    startScan,
    stopScan,
    connectDevice,
    disconnect,
    clearLastRead,
    clearRawLog,
  };
}
