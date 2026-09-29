// Fictional equipment and service history. Intervals illustrate the workflow;
// they are not manufacturer recommendations. Dates stay relative to demo setup.
export function createDemoData(now = new Date()) {
  const ago = (days) => {
    const date = new Date(now);
    date.setDate(date.getDate() - days);
    return date.toISOString();
  };
  const equipment = [
    { id: 1, unitNumber: '101', type: 'tractor', year: '2020', make: 'Freightliner', model: 'Cascadia', engineSize: 'Detroit DD15', currentMileage: 482150, mileageUpdatedAt: ago(1), notes: 'Regional dry van. Engine replaced at 410,000 miles; chassis mileage retained.' },
    { id: 2, unitNumber: '104', type: 'tractor', year: '2019', make: 'Kenworth', model: 'T680', engineSize: 'Cummins X15', currentMileage: 612400, mileageUpdatedAt: ago(18), notes: 'Mileage reading needs an update before the next trip.' },
    { id: 3, unitNumber: 'T-201', type: 'trailer', year: '2021', make: 'Great Dane', model: 'Dry van', currentMileage: null, mileageUpdatedAt: null, notes: '53-foot dry van. Maintenance tracked by service dates.' },
    { id: 4, unitNumber: 'R-301', type: 'reefer', year: '2022', make: 'Thermo King', model: 'Precedent', currentMileage: null, currentHours: 8420, mileageUpdatedAt: ago(2), notes: 'Refrigeration unit. Hour meter tracked separately from truck mileage.' },
    { id: 5, unitNumber: '107', type: 'tractor', year: '2023', make: 'Peterbilt', model: '579', currentMileage: 84120, mileageUpdatedAt: ago(0), notes: 'Recently added. Set up the maintenance schedule before putting this unit to work.' },
  ].map((eq) => ({ ...eq, createdAt: ago(120), updatedAt: ago(0), photo: null }));
  const maintenance = [
    { id: 1, equipmentId: 1, name: 'Oil & filter change', category: 'PM-A', mileageInterval: 15000, timeInterval: 90, lastServiceMileage: 465000, lastServiceDate: ago(75).slice(0, 10) },
    { id: 2, equipmentId: 2, name: 'Brake inspection', category: 'PM-B', mileageInterval: 30000, timeInterval: 180, lastServiceMileage: 585000, lastServiceDate: ago(130).slice(0, 10) },
    { id: 3, equipmentId: 3, name: 'Annual inspection', category: 'Annual', mileageInterval: null, timeInterval: 365, lastServiceMileage: null, lastServiceDate: ago(320).slice(0, 10) },
    { id: 4, equipmentId: 4, name: 'Reefer oil & filter', category: 'PM-A', mileageInterval: null, timeInterval: 90, lastServiceMileage: null, lastServiceDate: ago(30).slice(0, 10) },
  ].map((item) => ({ ...item, enabled: true, description: 'Illustrative demo schedule. Verify intervals for your own equipment.', createdAt: ago(120) }));
  const records = maintenance.map((item, index) => ({
    id: index + 1, equipmentId: item.equipmentId, serviceType: item.name,
    date: item.lastServiceDate, mileage: item.lastServiceMileage,
    hours: item.equipmentId === 4 ? 8160 : null,
    shopName: 'Sample fleet shop', cost: [425, 180, 150, 210][index],
    notes: 'Sample service record for the interactive demo.', createdAt: ago(30),
  }));
  return { version: 1, equipment, maintenance, records, settings: [{ key: 'app', demoInitialized: true, geminiApiKey: '', ocrEnabled: false }] };
}
