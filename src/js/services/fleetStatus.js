import { formatMileage, getMaintenanceStatus } from '../utils/utils.js';

export function equipmentReading(eq) {
  if (eq.type === 'reefer') return eq.currentHours == null ? 'Hours not recorded' : `${formatMileage(eq.currentHours)} hrs`;
  if (eq.type === 'trailer') return 'Tracked by service date';
  return eq.currentMileage == null ? 'Mileage not recorded' : `${formatMileage(eq.currentMileage)} mi`;
}

export function equipmentStatus(eq, items) {
  const enabled = items.filter((item) => item.enabled);
  if (!enabled.length) return { label: 'No schedule set', className: 'badge-neutral' };
  const statuses = enabled.map((item) => serviceStatus(item, eq));
  if (statuses.some((s) => s.status === 'overdue')) return { label: 'Overdue', className: 'badge-red' };
  if (statuses.some((s) => s.status === 'due-soon')) return { label: 'Due soon', className: 'badge-yellow' };
  const missingBaseline = enabled.some((item) =>
    (item.timeInterval && !item.lastServiceDate) ||
    (item.mileageInterval && (item.lastServiceMileage == null || eq.currentMileage == null))
  );
  if (missingBaseline) return { label: 'Service history needed', className: 'badge-neutral' };
  return { label: 'On track', className: 'badge-green' };
}

export function serviceStatus(item, eq) {
  if (!item.enabled) return { status: 'disabled', reason: 'Paused' };
  const reading = eq.type === 'tractor' ? eq.currentMileage : null;
  const known = { ...item,
    mileageInterval: item.lastServiceMileage == null || reading == null ? null : item.mileageInterval,
    timeInterval: item.lastServiceDate ? item.timeInterval : null,
  };
  const status = getMaintenanceStatus(known, reading);
  if (status.status !== 'ok') return status;
  if ((item.timeInterval && !item.lastServiceDate) || (item.mileageInterval && (item.lastServiceMileage == null || reading == null))) {
    return { status: 'unknown', reason: 'Add last service details' };
  }
  return status;
}
