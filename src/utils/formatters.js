export function formatFecha(isoString) {
  if (!isoString) return '-';
  const d = new Date(isoString);
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function formatPeso(peso) {
  if (peso == null || peso === '') return '-';
  return `${Number(peso).toFixed(1)} kg`;
}

export function categoriaNombre(cat) {
  const map = {
    ternero: 'Ternero',
    novillo: 'Novillo',
    vaquillona: 'Vaquillona',
    vaca: 'Vaca',
    toro: 'Toro',
  };
  return map[cat] || cat || '-';
}

export function estadoLabel(estado) {
  const map = { ok: 'OK', vacuna: 'Vacuna', alerta: 'Alerta' };
  return map[estado] || estado || '-';
}

// ── Razas bovinas SENASA (tal cual el desplegable de SIGbiotraza) ──
export const RAZAS_SENASA = [
  'ABERDEEN ANGUS', 'BELTED GALLAWAY', 'BOSMARA', 'BRAFORD', 'BRAHMAN',
  'BRANGUS', 'CHAROLAIS', 'CRIOLLA', 'FLECKIEH-SIMENTAL', 'GANADO CRUZA',
  'HEREFORD', 'HOLANDO ARGENTINO', 'JERSEY', 'KIWI', 'LIMANGUS',
  'LIMOUSINE', 'MURRAY GREY', 'POLLED HEREFORD', 'SAN IGNACIO', 'SANTA GERTRUDIS',
  'SENANGUS', 'SENEFORD', 'SENEPOL', 'SHORTHORN-POLLED', 'SHORTHORN-LINCOLN RED',
  'SUECA ROJA Y BLANCA', 'TULI', 'WAGYU', 'OTRA RAZA BOVINA',
];

// ── Códigos de raza para el TXT de SIGSA ────────────────────────
// Confirmados desde el archivo de referencia (terneros_prueba_ALTA.txt):
//   AA, BF, BG, H, L(imousine), CH.  El resto: POR CONFIRMAR con una
// prueba real de carga en SIGSA. Mientras no haya código, se usa el
// nombre completo como respaldo.
export const RAZA_CODIGO = {
  'ABERDEEN ANGUS': 'AA',
  'BRAFORD':        'BF',
  'BRANGUS':        'BG',
  'HEREFORD':       'H',
  'LIMOUSINE':      'L',
  'CHAROLAIS':      'CH',
};

// true = TXT con código (AA...) ; false = TXT con nombre completo.
// Se define tras la prueba real de carga en SIGSA.
export const RAZA_TXT_CODIGO = true;

export function codigoRaza(raza) {
  if (!raza) return '';
  if (RAZA_TXT_CODIGO) return RAZA_CODIGO[raza] ?? raza; // código, o nombre si falta
  return raza;
}

// Genera una línea en el formato de importación SIGSA:
//   CARAVANA-SEXO-RAZA-MM/AAAA
// (15 dígitos)-(M|H|'')-(código de raza)-(mes/año de nacimiento)
export function formatSenasaLine(animal) {
  const codigo = String(animal.caravana || '').replace(/\D/g, '').slice(0, 15);
  const sexo = animal.sexo === 'macho' ? 'M' : animal.sexo === 'hembra' ? 'H' : '';
  const raza = codigoRaza(animal.raza);
  let mesAnio = '';
  const m = String(animal.fecha_nacimiento || '').match(/^(\d{4})-(\d{2})/);
  if (m) mesAnio = `${m[2]}/${m[1]}`;
  return `${codigo}-${sexo}-${raza}-${mesAnio}`;
}

// Auto-formatea un RENSPA a NN.NNN.N.NNNNN/XX mientras se tipea.
// El último segmento (productor) puede ser alfanumérico (p. ej. "/0A").
export function formatRenspa(input) {
  if (input == null) return '';
  const v = String(input).toUpperCase().replace(/[^0-9A-Z]/g, '').slice(0, 13);
  let out = v.slice(0, 2);
  if (v.length > 2)  out += '.' + v.slice(2, 5);
  if (v.length > 5)  out += '.' + v.slice(5, 6);
  if (v.length > 6)  out += '.' + v.slice(6, 11);
  if (v.length > 11) out += '/' + v.slice(11, 13);
  return out;
}
