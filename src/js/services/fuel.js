export const FUEL_TYPES = { diesel: 'Diesel', def: 'DEF', reefer: 'Reefer fuel' };

export function canFuelEquipment(type, equipment) {
  return type === 'reefer' ? equipment?.type === 'reefer'
    : ['diesel', 'def'].includes(type) && equipment?.type === 'tractor';
}

export function optionalNumber(value) {
  if (value == null || value === '') return null;
  if (!['number', 'string'].includes(typeof value)) return NaN;
  return Number(value);
}

export function validDate(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
    && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}

export function validateFuelEntry(data, equipment) {
  if (!Number.isSafeInteger(data.equipmentId) || data.equipmentId <= 0
      || (data.id != null && (!Number.isSafeInteger(data.id) || data.id <= 0))) {
    throw new Error('Fuel entries must use valid unit and entry IDs.');
  }
  if (!canFuelEquipment(data.fuelType, equipment)) throw new Error('Link diesel and DEF to a truck, and reefer fuel to a reefer.');
  if (!validDate(data.date)) throw new Error('Enter a valid fuel date.');
  const result = { ...data };
  for (const key of ['totalCost', 'gallons', 'pricePerGallon', 'odometer', 'hours']) {
    const n = optionalNumber(data[key]);
    if ((key === 'totalCost' && n == null) || (n != null && (!Number.isFinite(n) || n < 0))) {
      throw new Error('Enter a total cost and use valid, non-negative numbers.');
    }
    result[key] = n;
  }
  if (!Number.isSafeInteger(Math.round(result.totalCost * 100))) throw new Error('Total cost is too large.');
  result.totalCost = Math.round(result.totalCost * 100) / 100;
  result.odometer = equipment.type === 'tractor' ? result.odometer : null;
  result.hours = equipment.type === 'reefer' ? result.hours : null;
  return result;
}

export function sumCosts(items, field) {
  // Sum in cents to avoid rounding drift; tolerate legacy numeric strings.
  return items.reduce((sum, item) => {
    const n = optionalNumber(item[field]);
    return sum + (Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : 0);
  }, 0) / 100;
}

export function unitCosts(equipment, records, fuel) {
  const isTrailer = equipment?.type === 'trailer';
  const serviceSpend = sumCosts(records, 'cost');
  const fuelSpend = isTrailer ? 0 : sumCosts(fuel, 'totalCost');
  const totalSpend = Math.round((serviceSpend + fuelSpend) * 100) / 100;
  const isReefer = equipment?.type === 'reefer';
  const expenses = [
    ...records.filter(r => Number(r.cost) > 0).map(r => ({ date: r.date, reading: optionalNumber(isReefer ? r.hours : r.mileage) })),
    ...(isTrailer ? [] : fuel.filter(f => Number(f.totalCost) > 0).map(f => ({ date: f.date, reading: optionalNumber(isReefer ? f.hours : f.odometer) }))),
  ].sort((a, b) => String(a.date).localeCompare(String(b.date)));
  const firstDate = expenses[0]?.date;
  const firstReadings = expenses.filter(e => e.date === firstDate).map(e => e.reading).filter(n => Number.isFinite(n) && n >= 0);
  const baseline = firstReadings.length ? Math.min(...firstReadings) : null;
  const current = optionalNumber(isReefer ? equipment?.currentHours : equipment?.currentMileage);
  const readings = [current, ...expenses.map(e => e.reading)].filter(n => Number.isFinite(n) && n >= 0);
  const end = readings.length ? Math.max(...readings) : null;
  const distance = baseline != null && end != null ? end - baseline : 0;
  // Do not imply a lifetime rate or divide costs by an unrelated odometer.
  const consistent = baseline != null && expenses.every(e => e.reading == null || (Number.isFinite(e.reading) && e.reading >= baseline));
  const rate = !isTrailer && expenses.every(e => validDate(e.date)) && consistent && distance > 0 ? totalSpend / distance : null;
  return { serviceSpend, fuelSpend, totalSpend, rate, distance, firstDate, baseline, end };
}

export function normalizeFuelReceipt(parsed) {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed) || parsed.is_fuel_receipt !== true) {
    return { is_fuel_receipt: false, confidence: 'low' };
  }
  const result = {
    is_fuel_receipt: true,
    confidence: ['high', 'medium', 'low'].includes(parsed.confidence) ? parsed.confidence : 'low',
    date: validDate(parsed.date) ? parsed.date : null,
    fuel_type: Object.hasOwn(FUEL_TYPES, parsed.fuel_type) ? parsed.fuel_type : null,
    location: typeof parsed.location === 'string' ? parsed.location.slice(0, 300) : null,
    notes: typeof parsed.notes === 'string' ? parsed.notes.slice(0, 2000) : null,
    multiple_fuel_types: parsed.multiple_fuel_types === true,
  };
  for (const field of ['gallons', 'price_per_gallon', 'total_cost', 'odometer', 'hours']) {
    const n = optionalNumber(parsed[field]);
    result[field] = Number.isFinite(n) && n >= 0 ? n : null;
  }
  return result;
}

// One stored purchase can contain fuel for both a truck and a reefer. Legacy
// single-product records remain readable without guessing which stops belong together.
export function fuelLines(purchases) {
  return purchases.flatMap(purchase => Array.isArray(purchase.items)
    ? purchase.items.map(item => ({ ...item, id: purchase.id, date: purchase.date, createdAt: purchase.createdAt }))
    : [purchase]);
}

export function validateFuelPurchase(data, equipment) {
  if (!Object.hasOwn(data, 'items')) return validateFuelEntry(data, equipment.find(eq => eq.id === data.equipmentId));
  if (!Array.isArray(data.items) || !data.items.length || data.items.length > 3) throw new Error('Enter at least one fuel product.');
  if (data.id != null && (!Number.isSafeInteger(data.id) || data.id <= 0)) throw new Error('Invalid fuel transaction ID.');
  const types = new Set();
  let truckId = null;
  const items = data.items.map(item => {
    if (!item || types.has(item.fuelType)) throw new Error('Use one line each for Diesel, DEF, and Reefer.');
    types.add(item.fuelType);
    const validated = validateFuelEntry({ ...item, date: data.date }, equipment.find(eq => eq.id === item.equipmentId));
    if (item.fuelType !== 'reefer') {
      if (truckId != null && truckId !== item.equipmentId) throw new Error('Diesel and DEF must belong to the same truck.');
      truckId = item.equipmentId;
    }
    return {
      equipmentId: validated.equipmentId, fuelType: validated.fuelType,
      gallons: validated.gallons, pricePerGallon: validated.pricePerGallon, totalCost: validated.totalCost,
      odometer: validated.odometer, hours: validated.hours,
    };
  });
  return {
    ...(data.id != null ? { id: data.id } : {}), ...(data.createdAt ? { createdAt: data.createdAt } : {}),
    date: data.date, location: data.location || '', notes: data.notes || '', receiptImage: data.receiptImage || null,
    items, totalCost: sumCosts(items, 'totalCost'),
  };
}

export function normalizeFuelTransactionReceipt(parsed) {
  if (!parsed || parsed.is_fuel_receipt !== true || !Array.isArray(parsed.items)) return { is_fuel_receipt: false, confidence: 'low', items: [] };
  const shared = normalizeFuelReceipt(parsed);
  const types = new Set();
  const items = [];
  for (const item of parsed.items) {
    if (!item || !Object.hasOwn(FUEL_TYPES, item.fuel_type) || types.has(item.fuel_type)) return { is_fuel_receipt: false, confidence: 'low', items: [] };
    types.add(item.fuel_type);
    const normalized = normalizeFuelReceipt({ ...item, is_fuel_receipt: true });
    items.push({ fuel_type: normalized.fuel_type, gallons: normalized.gallons, price_per_gallon: normalized.price_per_gallon, total_cost: normalized.total_cost });
  }
  return { ...shared, items };
}
