// ============================================================
//  Durflex - Cliente de la API
// ============================================================
import { getSetting, setSetting } from '../db/database';

// Direccion del servidor. Si algun dia se migra a un subdominio,
// se cambia SOLO esta linea.
export const API_URL = 'https://durflex.com.ar/api/';

let tokenCache = null;

export async function getToken() {
  if (tokenCache !== null) return tokenCache;
  tokenCache = (await getSetting('auth_token', '')) || '';
  return tokenCache;
}

export async function setToken(t) {
  tokenCache = t || '';
  await setSetting('auth_token', tokenCache);
}

export async function getUsuarioGuardado() {
  const raw = await getSetting('auth_usuario', '');
  try { return raw ? JSON.parse(raw) : null; } catch (e) { return null; }
}

export async function setUsuarioGuardado(u) {
  await setSetting('auth_usuario', u ? JSON.stringify(u) : '');
}

export async function estaLogueado() {
  return !!(await getToken());
}

// ------------------------------------------------------------
async function pedir(accion, body = null, conToken = true) {
  const headers = { 'Content-Type': 'application/json' };
  if (conToken) {
    const t = await getToken();
    if (t) headers['Authorization'] = 'Bearer ' + t;
  }

  let resp;
  try {
    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), 30000);
    resp = await fetch(API_URL + '?a=' + accion, {
      method: 'POST',
      headers,
      body: JSON.stringify(body || {}),
      signal: ctrl.signal,
    });
    clearTimeout(timeout);
  } catch (e) {
    throw new Error('Sin conexión a internet. Probá de nuevo cuando tengas señal.');
  }

  const texto = await resp.text();
  let json;
  try {
    json = JSON.parse(texto);
  } catch (e) {
    throw new Error('El servidor respondió algo inesperado. Volvé a intentar en un rato.');
  }

  if (!json.ok) throw new Error(json.error || 'Error del servidor.');
  return json;
}

// ------------------------------------------------------------
export async function ping() {
  const r = await fetch(API_URL + '?a=ping');
  return await r.json();
}

export async function registrar({ email, password, nombre, telefono }) {
  const r = await pedir('registro', { email, password, nombre, telefono }, false);
  await setToken(r.token);
  await setUsuarioGuardado(r.usuario);
  return r.usuario;
}

export async function iniciarSesion({ email, password }) {
  const r = await pedir('login', { email, password }, false);
  await setToken(r.token);
  await setUsuarioGuardado(r.usuario);
  return r.usuario;
}

export async function cerrarSesion() {
  try { await pedir('logout'); } catch (e) { }
  await setToken('');
  await setUsuarioGuardado(null);
  await setSetting('sync_ultimo_ms', '0');
}

export async function perfil() {
  const r = await pedir('perfil');
  return r.usuario;
}

export async function enviarSync(payload) {
  return await pedir('sync', payload);
}
