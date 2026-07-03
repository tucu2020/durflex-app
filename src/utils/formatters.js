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
