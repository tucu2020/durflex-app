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

// Genera línea formato SENASA/SIGbiotraza
export function formatSenasaLine(animal) {
  const codigo = animal.caravana || '';
  const sexo = animal.sexo === 'macho' ? 'M' : animal.sexo === 'hembra' ? 'H' : '';
  const raza = (animal.raza || '').toUpperCase().replace(/\s+/g, '_');
  const fechaNac = animal.fecha_nacimiento
    ? animal.fecha_nacimiento.replace(/-/g, '')
    : '';
  return `${codigo}-${sexo}-${raza}-${fechaNac}`;
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
