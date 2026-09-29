export function isDemoMode(search = globalThis.location?.search || '') {
  return new URLSearchParams(search).get('demo') === '1';
}

export function databaseName(search = globalThis.location?.search || '') {
  return isDemoMode(search) ? 'fleet-pulse-demo' : 'fleet-pulse';
}

export function landingButtonLabel(storage) {
  return storage.getItem('fleet_pulse_entered') ? 'Current dashboard' : 'Get started';
}
