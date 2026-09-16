// ============================================================
//  Durflex - Sincronizacion con el servidor
//  Regla: gana el cambio mas reciente. Nada se pisa a ciegas.
// ============================================================
import { getDatabase, getSetting, setSetting, nuevoUid } from '../db/database';
import { enviarSync, estaLogueado } from './client';

const K_LOCAL = 'sync_local_ms';     // hasta donde ya subimos (reloj del telefono)
const K_SERVER = 'sync_servidor_ms'; // hasta donde ya bajamos (reloj del servidor)
const K_FECHA = 'sync_fecha';        // texto legible para mostrar en pantalla

export async function ultimaSincronizacion() {
  return await getSetting(K_FECHA, '');
}

export async function hayPendientes() {
  const db = await getDatabase();
  const desde = Number(await getSetting(K_LOCAL, '0')) || 0;
  const a = await db.getFirstAsync('SELECT COUNT(*) n FROM animales WHERE sync_ms > ?', [desde]);
  const e = await db.getFirstAsync('SELECT COUNT(*) n FROM establecimientos WHERE sync_ms > ?', [desde]);
  const b = await db.getFirstAsync('SELECT COUNT(*) n FROM borrados WHERE ms > ?', [desde]);
  return (a?.n || 0) + (e?.n || 0) + (b?.n || 0);
}

// ------------------------------------------------------------
export async function sincronizar() {
  if (!(await estaLogueado())) {
    throw new Error('Primero iniciá sesión para poder sincronizar.');
  }

  const db = await getDatabase();
  const t0 = Date.now();
  const desdeLocal  = Number(await getSetting(K_LOCAL, '0')) || 0;
  const desdeServer = Number(await getSetting(K_SERVER, '0')) || 0;

  // ---------- Armar lo que subimos ----------
  const estabsLocal = await db.getAllAsync(
    'SELECT * FROM establecimientos WHERE sync_ms > ?', [desdeLocal]
  );
  const animalesLocal = await db.getAllAsync(
    `SELECT a.*, e.uid AS est_uid
     FROM animales a LEFT JOIN establecimientos e ON a.establecimiento_id = e.id
     WHERE a.sync_ms > ?`, [desdeLocal]
  );
  const borrados = await db.getAllAsync('SELECT * FROM borrados WHERE ms > ?', [desdeLocal]);

  const subirEstabs = estabsLocal.map((e) => ({
    uid: e.uid, nombre: e.nombre, renspa: e.renspa,
    localidad: e.localidad, provincia: e.provincia,
    updated_at: e.sync_ms, eliminado: 0,
  }));

  const subirAnimales = animalesLocal.map((a) => ({
    uid: a.uid,
    establecimiento_uid: a.est_uid || null,
    caravana: a.caravana,
    caravana_visual: a.caravana_visual,
    categoria: a.categoria,
    sexo: a.sexo,
    raza: a.raza,
    peso: a.peso,
    edad: a.edad,
    estado_reproductivo: a.estado_reproductivo,
    fecha_nacimiento: a.fecha_nacimiento,
    observaciones: a.observaciones,
    estado: a.estado,
    updated_at: a.sync_ms,
    eliminado: 0,
  }));

  // Los borrados viajan como registros marcados
  for (const b of borrados) {
    if (b.tabla === 'animales') {
      subirAnimales.push({ uid: b.uid, caravana: '0', updated_at: b.ms, eliminado: 1 });
    } else {
      subirEstabs.push({ uid: b.uid, nombre: '-', updated_at: b.ms, eliminado: 1 });
    }
  }

  // ---------- Ida y vuelta ----------
  const r = await enviarSync({
    desde: desdeServer,
    establecimientos: subirEstabs,
    animales: subirAnimales,
  });

  // ---------- Aplicar lo que baja ----------
  let nuevos = 0, actualizados = 0, eliminados = 0;

  for (const e of (r.establecimientos || [])) {
    const local = await db.getFirstAsync('SELECT id, sync_ms FROM establecimientos WHERE uid = ?', [e.uid]);

    if (Number(e.eliminado)) {
      if (local) { await db.runAsync('DELETE FROM establecimientos WHERE id = ?', [local.id]); eliminados++; }
      continue;
    }
    if (local && Number(local.sync_ms) >= Number(e.updated_at)) continue; // lo nuestro es mas nuevo

    if (local) {
      await db.runAsync(
        `UPDATE establecimientos SET nombre=?, renspa=?, localidad=?, provincia=?,
         synced=1, sync_ms=? WHERE id=?`,
        [e.nombre, e.renspa, e.localidad, e.provincia, e.updated_at, local.id]
      );
      actualizados++;
    } else {
      await db.runAsync(
        `INSERT INTO establecimientos (nombre, renspa, localidad, provincia, uid, synced, sync_ms)
         VALUES (?, ?, ?, ?, ?, 1, ?)`,
        [e.nombre, e.renspa, e.localidad, e.provincia, e.uid, e.updated_at]
      );
      nuevos++;
    }
  }

  for (const a of (r.animales || [])) {
    const local = await db.getFirstAsync('SELECT id, sync_ms FROM animales WHERE uid = ?', [a.uid]);

    if (Number(a.eliminado)) {
      if (local) { await db.runAsync('DELETE FROM animales WHERE id = ?', [local.id]); eliminados++; }
      continue;
    }
    if (local && Number(local.sync_ms) >= Number(a.updated_at)) continue;

    let estId = null;
    if (a.establecimiento_uid) {
      const e = await db.getFirstAsync('SELECT id FROM establecimientos WHERE uid = ?', [a.establecimiento_uid]);
      estId = e ? e.id : null;
    }

    const campos = [
      a.caravana, a.caravana_visual, estId, a.peso, a.edad, a.categoria,
      a.estado_reproductivo, a.raza, a.sexo, a.fecha_nacimiento,
      a.observaciones, a.estado || 'ok', a.updated_at,
    ];

    if (local) {
      await db.runAsync(
        `UPDATE animales SET caravana=?, caravana_visual=?, establecimiento_id=?, peso=?, edad=?,
         categoria=?, estado_reproductivo=?, raza=?, sexo=?, fecha_nacimiento=?, observaciones=?,
         estado=?, synced=1, sync_ms=? WHERE id=?`,
        [...campos, local.id]
      );
      actualizados++;
    } else {
      await db.runAsync(
        `INSERT INTO animales (caravana, caravana_visual, establecimiento_id, peso, edad,
         categoria, estado_reproductivo, raza, sexo, fecha_nacimiento, observaciones,
         estado, sync_ms, uid, synced)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
        [...campos, a.uid]
      );
      nuevos++;
    }
  }

  // ---------- Cerrar ----------
  await db.runAsync('DELETE FROM borrados WHERE ms <= ?', [t0]);
  await db.runAsync('UPDATE animales SET synced = 1 WHERE sync_ms <= ?', [t0]);
  await db.runAsync('UPDATE establecimientos SET synced = 1 WHERE sync_ms <= ?', [t0]);

  await setSetting(K_LOCAL, String(t0));
  await setSetting(K_SERVER, String(r.servidor_ms));
  await setSetting(K_FECHA, new Date().toISOString());

  return {
    subidos: (r.subidos?.animales || 0) + (r.subidos?.establecimientos || 0),
    nuevos, actualizados, eliminados,
  };
}
