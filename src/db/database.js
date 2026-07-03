import * as SQLite from 'expo-sqlite';

let db;

export async function getDatabase() {
  if (!db) {
    db = await SQLite.openDatabaseAsync('ganadoapp.db');
    await initDatabase(db);
  }
  return db;
}

async function initDatabase(db) {
  await db.execAsync(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS establecimientos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      renspa TEXT,
      cuig TEXT,
      provincia TEXT,
      partido TEXT,
      localidad TEXT,
      propietario TEXT,
      telefono TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      synced INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS animales (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      caravana TEXT NOT NULL,
      establecimiento_id INTEGER,
      peso REAL,
      edad INTEGER,
      categoria TEXT CHECK(categoria IN ('ternero','novillo','vaquillona','vaca','toro')),
      estado_reproductivo TEXT,
      raza TEXT,
      sexo TEXT CHECK(sexo IN ('macho','hembra')),
      fecha_nacimiento TEXT,
      observaciones TEXT,
      estado TEXT DEFAULT 'ok' CHECK(estado IN ('ok','vacuna','alerta')),
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      synced INTEGER DEFAULT 0,
      FOREIGN KEY (establecimiento_id) REFERENCES establecimientos(id)
    );

    CREATE TABLE IF NOT EXISTS usuarios_establecimiento (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      establecimiento_id INTEGER NOT NULL,
      nombre TEXT NOT NULL,
      email TEXT,
      rol TEXT DEFAULT 'operador',
      FOREIGN KEY (establecimiento_id) REFERENCES establecimientos(id)
    );

    CREATE TABLE IF NOT EXISTS planillas_iatf (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      establecimiento_id INTEGER,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (establecimiento_id) REFERENCES establecimientos(id)
    );

    CREATE TABLE IF NOT EXISTS planilla_iatf_animales (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      planilla_id INTEGER NOT NULL,
      caravana TEXT NOT NULL,
      FOREIGN KEY (planilla_id) REFERENCES planillas_iatf(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_animales_establecimiento ON animales(establecimiento_id);
    CREATE INDEX IF NOT EXISTS idx_animales_caravana ON animales(caravana);
    CREATE INDEX IF NOT EXISTS idx_animales_synced ON animales(synced);
  `);
}

// ── Animales ──────────────────────────────────────────────────

export async function insertAnimal(animal) {
  const db = await getDatabase();
  const result = await db.runAsync(
    `INSERT INTO animales (caravana, establecimiento_id, peso, edad, categoria,
      estado_reproductivo, raza, sexo, fecha_nacimiento, observaciones, estado)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      animal.caravana, animal.establecimiento_id, animal.peso, animal.edad,
      animal.categoria, animal.estado_reproductivo, animal.raza, animal.sexo,
      animal.fecha_nacimiento, animal.observaciones, animal.estado || 'ok',
    ]
  );
  return result.lastInsertRowId;
}

export async function updateAnimal(id, animal) {
  const db = await getDatabase();
  await db.runAsync(
    `UPDATE animales SET caravana=?, establecimiento_id=?, peso=?, edad=?, categoria=?,
      estado_reproductivo=?, raza=?, sexo=?, fecha_nacimiento=?, observaciones=?,
      estado=?, updated_at=datetime('now'), synced=0 WHERE id=?`,
    [
      animal.caravana, animal.establecimiento_id, animal.peso, animal.edad,
      animal.categoria, animal.estado_reproductivo, animal.raza, animal.sexo,
      animal.fecha_nacimiento, animal.observaciones, animal.estado || 'ok', id,
    ]
  );
}

export async function getAnimales(establecimientoId = null) {
  const db = await getDatabase();
  if (establecimientoId) {
    return await db.getAllAsync(
      `SELECT a.*, e.nombre as establecimiento_nombre
       FROM animales a LEFT JOIN establecimientos e ON a.establecimiento_id = e.id
       WHERE a.establecimiento_id = ? ORDER BY a.created_at DESC`,
      [establecimientoId]
    );
  }
  return await db.getAllAsync(
    `SELECT a.*, e.nombre as establecimiento_nombre
     FROM animales a LEFT JOIN establecimientos e ON a.establecimiento_id = e.id
     ORDER BY a.created_at DESC`
  );
}

export async function getAnimalById(id) {
  const db = await getDatabase();
  return await db.getFirstAsync(
    `SELECT a.*, e.nombre as establecimiento_nombre
     FROM animales a LEFT JOIN establecimientos e ON a.establecimiento_id = e.id
     WHERE a.id = ?`,
    [id]
  );
}

export async function deleteAnimal(id) {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM animales WHERE id = ?', [id]);
}

export async function getUltimosAnimales(limit = 10) {
  const db = await getDatabase();
  return await db.getAllAsync(
    `SELECT a.*, e.nombre as establecimiento_nombre
     FROM animales a LEFT JOIN establecimientos e ON a.establecimiento_id = e.id
     ORDER BY a.created_at DESC LIMIT ?`,
    [limit]
  );
}

// ── Establecimientos ──────────────────────────────────────────

export async function insertEstablecimiento(est) {
  const db = await getDatabase();
  const result = await db.runAsync(
    `INSERT INTO establecimientos (nombre, renspa, cuig, provincia, partido, localidad, propietario, telefono)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [est.nombre, est.renspa ?? null, est.cuig ?? null, est.provincia ?? null,
     est.partido ?? null, est.localidad ?? null, est.propietario ?? null, est.telefono ?? null]
  );
  return result.lastInsertRowId;
}

export async function updateEstablecimiento(id, est) {
  const db = await getDatabase();
  await db.runAsync(
    `UPDATE establecimientos SET nombre=?, renspa=?, cuig=?, provincia=?, partido=?,
      localidad=?, propietario=?, telefono=?, updated_at=datetime('now'), synced=0 WHERE id=?`,
    [est.nombre, est.renspa ?? null, est.cuig ?? null, est.provincia ?? null,
     est.partido ?? null, est.localidad ?? null, est.propietario ?? null, est.telefono ?? null, id]
  );
}

export async function getEstablecimientos() {
  const db = await getDatabase();
  return await db.getAllAsync(
    `SELECT e.*,
       COUNT(a.id) as total_animales,
       SUM(CASE WHEN a.synced=0 THEN 1 ELSE 0 END) as pendientes_sync
     FROM establecimientos e
     LEFT JOIN animales a ON e.id = a.establecimiento_id
     GROUP BY e.id ORDER BY e.nombre`
  );
}

export async function getEstablecimientoById(id) {
  const db = await getDatabase();
  return await db.getFirstAsync('SELECT * FROM establecimientos WHERE id = ?', [id]);
}

export async function deleteEstablecimiento(id) {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM establecimientos WHERE id = ?', [id]);
}

// ── Stats ─────────────────────────────────────────────────────

export async function getStats() {
  const db = await getDatabase();
  const hoy = new Date().toISOString().split('T')[0];
  const [totalAnimales, pendientesSync, totalEstablecimientos, alertas, registradosHoy] =
    await Promise.all([
      db.getFirstAsync('SELECT COUNT(*) as count FROM animales'),
      db.getFirstAsync('SELECT COUNT(*) as count FROM animales WHERE synced = 0'),
      db.getFirstAsync('SELECT COUNT(*) as count FROM establecimientos'),
      db.getFirstAsync("SELECT COUNT(*) as count FROM animales WHERE estado IN ('vacuna','alerta')"),
      db.getFirstAsync("SELECT COUNT(*) as count FROM animales WHERE date(created_at) = ?", [hoy]),
    ]);
  return {
    totalAnimales: totalAnimales?.count ?? 0,
    pendientesSync: pendientesSync?.count ?? 0,
    totalEstablecimientos: totalEstablecimientos?.count ?? 0,
    alertas: alertas?.count ?? 0,
    registradosHoy: registradosHoy?.count ?? 0,
  };
}

// ── Sync helpers ──────────────────────────────────────────────

export async function marcarSincronizados(ids) {
  if (!ids.length) return;
  const db = await getDatabase();
  const placeholders = ids.map(() => '?').join(',');
  await db.runAsync(
    `UPDATE animales SET synced=1, updated_at=datetime('now') WHERE id IN (${placeholders})`, ids
  );
}

export async function getAnimalesPendientes() {
  const db = await getDatabase();
  return await db.getAllAsync(
    `SELECT a.*, e.nombre as establecimiento_nombre, e.renspa
     FROM animales a LEFT JOIN establecimientos e ON a.establecimiento_id = e.id
     WHERE a.synced = 0`
  );
}

// ── Usuarios establecimiento ──────────────────────────────────

export async function getUsuariosEstablecimiento(establecimientoId) {
  const db = await getDatabase();
  return await db.getAllAsync(
    'SELECT * FROM usuarios_establecimiento WHERE establecimiento_id = ?', [establecimientoId]
  );
}

export async function insertUsuario(usuario) {
  const db = await getDatabase();
  const result = await db.runAsync(
    'INSERT INTO usuarios_establecimiento (establecimiento_id, nombre, email, rol) VALUES (?, ?, ?, ?)',
    [usuario.establecimiento_id, usuario.nombre, usuario.email, usuario.rol || 'operador']
  );
  return result.lastInsertRowId;
}

export async function deleteUsuario(id) {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM usuarios_establecimiento WHERE id = ?', [id]);
}

// ── Planillas IATF ────────────────────────────────────────────

export async function getPlanillasIATF() {
  const db = await getDatabase();
  return await db.getAllAsync(
    `SELECT p.*, e.nombre as establecimiento_nombre,
       COUNT(pa.id) as total_animales
     FROM planillas_iatf p
     LEFT JOIN establecimientos e ON p.establecimiento_id = e.id
     LEFT JOIN planilla_iatf_animales pa ON p.id = pa.planilla_id
     GROUP BY p.id ORDER BY p.created_at DESC`
  );
}

export async function insertPlanillaIATF(planilla) {
  const db = await getDatabase();
  const result = await db.runAsync(
    'INSERT INTO planillas_iatf (nombre, establecimiento_id) VALUES (?, ?)',
    [planilla.nombre, planilla.establecimiento_id ?? null]
  );
  return result.lastInsertRowId;
}

export async function deletePlanillaIATF(id) {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM planillas_iatf WHERE id = ?', [id]);
}

export async function getAnimalesIATF(planillaId) {
  const db = await getDatabase();
  return await db.getAllAsync(
    'SELECT * FROM planilla_iatf_animales WHERE planilla_id = ? ORDER BY id',
    [planillaId]
  );
}

export async function insertAnimalIATF(planillaId, caravana) {
  const db = await getDatabase();
  await db.runAsync(
    'INSERT INTO planilla_iatf_animales (planilla_id, caravana) VALUES (?, ?)',
    [planillaId, caravana]
  );
}

export async function deleteAnimalIATF(id) {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM planilla_iatf_animales WHERE id = ?', [id]);
}

// ── Settings ──────────────────────────────────────────────────

export async function getSetting(key, defaultValue = '') {
  const db = await getDatabase();
  const row = await db.getFirstAsync('SELECT value FROM settings WHERE key = ?', [key]);
  return row?.value ?? defaultValue;
}

export async function setSetting(key, value) {
  const db = await getDatabase();
  await db.runAsync(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value',
    [key, value]
  );
}

// ── Sesiones ──────────────────────────────────────────────────

export async function getSesiones(limit = 15) {
  const db = await getDatabase();
  return await db.getAllAsync(
    `SELECT
       date(a.created_at) as fecha,
       COUNT(a.id) as total_animales,
       GROUP_CONCAT(DISTINCT e.nombre) as establecimientos_nombres
     FROM animales a
     LEFT JOIN establecimientos e ON a.establecimiento_id = e.id
     GROUP BY date(a.created_at)
     ORDER BY fecha DESC
     LIMIT ?`,
    [limit]
  );
}

export async function getAnimalesByFecha(fecha) {
  const db = await getDatabase();
  return await db.getAllAsync(
    `SELECT a.*, e.nombre as establecimiento_nombre, e.renspa
     FROM animales a LEFT JOIN establecimientos e ON a.establecimiento_id = e.id
     WHERE date(a.created_at) = ?
     ORDER BY a.created_at`,
    [fecha]
  );
}
