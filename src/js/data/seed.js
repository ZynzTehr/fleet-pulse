/**
 * Fleet Pulse — UI/UX Test Seed Fleet Dataset.
 *
 * Populates a rich, realistic fleet environment for UI/UX testing:
 *  - 6 Tractors (Freightliner, Kenworth, Peterbilt, Volvo, Mack, International) with varied odometers (84k - 754k mi)
 *  - 5 Trailers (Dry vans, Flatbed, Step deck, Tanker) tracked by calendar inspection dates
 *  - 4 Reefers (Thermo King, Carrier) with varied engine hours (1,220 - 12,680 hrs)
 *  - 16 Fuel transactions with comprehensive product combinations:
 *      * Diesel + DEF + Reefer (multi-product single fuel stops)
 *      * Just Diesel
 *      * Diesel + DEF
 *      * Just Reefer
 *    spanning both the current year across several months and the prior year.
 *  - Maintenance schedules across various interval configurations (overdue, due soon, ok, unscheduled).
 *  - Service records with shop details, costs, and historical readings.
 */

export function createSeedData(now = new Date()) {
  const ago = (days) => {
    const date = new Date(now);
    date.setDate(date.getDate() - days);
    return date.toISOString();
  };

  const dayDate = (days) => ago(days).slice(0, 10);
  const futureDate = (days) => {
    const date = new Date(now);
    date.setDate(date.getDate() + days);
    return date.toISOString().slice(0, 10);
  };

  // 15 Fleet Units
  const equipment = [
    // Tractors (6)
    {
      id: 1, unitNumber: '101', type: 'tractor', year: '2020',
      make: 'Freightliner', model: 'Cascadia', engineSize: 'Detroit DD15',
      currentMileage: 482150, mileageUpdatedAt: ago(1),
      notes: 'Regional dry van hauler. Engine replaced at 410,000 miles; chassis mileage retained.',
    },
    {
      id: 2, unitNumber: '104', type: 'tractor', year: '2019',
      make: 'Kenworth', model: 'T680', engineSize: 'Cummins X15',
      currentMileage: 612400, mileageUpdatedAt: ago(2),
      notes: 'OTR sleeper cab. Long-haul western states route.',
    },
    {
      id: 3, unitNumber: 'T-201', type: 'trailer', year: '2021',
      make: 'Great Dane', model: 'Champion 53\' Dry Van', engineSize: '',
      currentMileage: null, currentHours: null, mileageUpdatedAt: null,
      notes: '53-foot dry van. Maintenance tracked by periodic service inspection dates.',
    },
    {
      id: 4, unitNumber: 'R-301', type: 'reefer', year: '2022',
      make: 'Utility / Thermo King', model: '3000R w/ Precedent S-600', engineSize: 'TK Diesel',
      currentMileage: null, currentHours: 8420, mileageUpdatedAt: ago(1),
      notes: 'Refrigerated trailer. Reefer engine hour meter tracked independently from truck mileage.',
    },
    {
      id: 5, unitNumber: '107', type: 'tractor', year: '2023',
      make: 'Peterbilt', model: '579 Ultraloft', engineSize: 'PACCAR MX-13',
      currentMileage: 84120, mileageUpdatedAt: ago(0),
      notes: 'Recently added low-mileage late model tractor. Ready for schedule assignment.',
    },
    {
      id: 6, unitNumber: '112', type: 'tractor', year: '2021',
      make: 'Volvo', model: 'VNL 860', engineSize: 'Volvo D13TC',
      currentMileage: 235800, mileageUpdatedAt: ago(3),
      notes: 'Turbocompound fuel-efficiency spec. Dedicated I-80 corridor.',
    },
    {
      id: 7, unitNumber: '118', type: 'tractor', year: '2018',
      make: 'Mack', model: 'Anthem 70\'', engineSize: 'Mack MP8',
      currentMileage: 754200, mileageUpdatedAt: ago(4),
      notes: 'High-mileage fleet workhorse. Heavy haul transmission package.',
    },
    {
      id: 8, unitNumber: '125', type: 'tractor', year: '2022',
      make: 'International', model: 'LT625', engineSize: 'Cummins X15 Efficiency',
      currentMileage: 142600, mileageUpdatedAt: ago(5),
      notes: 'Midwest distribution route.',
    },
    // Non-reefer Trailers (4 additional)
    {
      id: 9, unitNumber: 'T-205', type: 'trailer', year: '2020',
      make: 'Utility', model: '4000D-X Composite 53\' Dry Van', engineSize: '',
      currentMileage: null, currentHours: null, mileageUpdatedAt: null,
      notes: 'General dry freight trailer with aerodynamic side skirts.',
    },
    {
      id: 10, unitNumber: 'FB-401', type: 'trailer', year: '2019',
      make: 'Fontaine', model: 'Infinity 48\' Combo Flatbed', engineSize: '',
      currentMileage: null, currentHours: null, mileageUpdatedAt: null,
      notes: 'Steel coil and machinery hauler. Equipped with bulkhead and tarp tie-downs.',
    },
    {
      id: 11, unitNumber: 'SD-501', type: 'trailer', year: '2022',
      make: 'Wabash', model: '53\' All-Aluminum Step Deck', engineSize: '',
      currentMileage: null, currentHours: null, mileageUpdatedAt: null,
      notes: 'Oversize and tall equipment transport.',
    },
    {
      id: 12, unitNumber: 'TK-601', type: 'trailer', year: '2018',
      make: 'Polar Tank', model: '42\' Stainless Food Grade Tanker', engineSize: '',
      currentMileage: null, currentHours: null, mileageUpdatedAt: null,
      notes: 'Sanitary liquid food-grade transport. Inspected per food safety regulations.',
    },
    // Reefers (3 additional)
    {
      id: 13, unitNumber: 'R-305', type: 'reefer', year: '2021',
      make: 'Great Dane / Carrier', model: 'Everest w/ Vector 8500', engineSize: 'Carrier Diesel',
      currentMileage: null, currentHours: 4150, mileageUpdatedAt: ago(2),
      notes: 'All-electric hybrid architecture reefer unit. Mid-life engine hours.',
    },
    {
      id: 14, unitNumber: 'R-310', type: 'reefer', year: '2017',
      make: 'Wabash / Thermo King', model: 'ArcticLite w/ Precedent C-600', engineSize: 'TK Diesel',
      currentMileage: null, currentHours: 12680, mileageUpdatedAt: ago(6),
      notes: 'Veteran high-hour reefer. Excellent temperature stability on frozen meat routes.',
    },
    {
      id: 15, unitNumber: 'R-315', type: 'reefer', year: '2024',
      make: 'Vanguard / Carrier', model: 'MaxiFreeze w/ X4 7500', engineSize: 'Carrier Diesel',
      currentMileage: null, currentHours: 1220, mileageUpdatedAt: ago(1),
      notes: 'New delivery reefer unit. Post 500-hour initial break-in period.',
    },
  ].map((eq) => ({ ...eq, createdAt: ago(180), updatedAt: ago(0), photo: null }));

  // Maintenance Schedules
  const maintenance = [
    { id: 1, equipmentId: 1, name: 'Oil & filter change (PM-A)', category: 'PM-A', mileageInterval: 15000, timeInterval: 90, lastServiceMileage: 465000, lastServiceDate: dayDate(75) },
    { id: 2, equipmentId: 2, name: 'Brake inspection & slack adjusters', category: 'PM-B', mileageInterval: 30000, timeInterval: 180, lastServiceMileage: 585000, lastServiceDate: dayDate(130) },
    { id: 3, equipmentId: 3, name: 'Annual DOT trailer inspection', category: 'Annual', mileageInterval: null, timeInterval: 365, lastServiceMileage: null, lastServiceDate: dayDate(320) },
    { id: 4, equipmentId: 4, name: 'Reefer oil & filter service', category: 'PM-A', mileageInterval: null, timeInterval: 90, lastServiceMileage: null, lastServiceDate: dayDate(30) },
    { id: 5, equipmentId: 6, name: 'Engine PM-A & lube service', category: 'PM-A', mileageInterval: 15000, timeInterval: 90, lastServiceMileage: 225000, lastServiceDate: dayDate(40) },
    { id: 6, equipmentId: 6, name: 'I-Shift transmission service', category: 'Drivetrain', mileageInterval: 60000, timeInterval: 365, lastServiceMileage: 200000, lastServiceDate: dayDate(200) },
    { id: 7, equipmentId: 7, name: 'Oil & lube service (PM-A)', category: 'PM-A', mileageInterval: 15000, timeInterval: 90, lastServiceMileage: 735000, lastServiceDate: dayDate(110) },
    { id: 8, equipmentId: 7, name: 'Rear differentials fluid exchange', category: 'Drivetrain', mileageInterval: 50000, timeInterval: 365, lastServiceMileage: 710000, lastServiceDate: dayDate(300) },
    { id: 9, equipmentId: 8, name: 'Oil & filter service (PM-A)', category: 'PM-A', mileageInterval: 15000, timeInterval: 90, lastServiceMileage: 139000, lastServiceDate: dayDate(25) },
    { id: 10, equipmentId: 10, name: 'Air brake & suspension inspection', category: 'Safety', mileageInterval: null, timeInterval: 180, lastServiceMileage: null, lastServiceDate: dayDate(60) },
    { id: 11, equipmentId: 11, name: 'Kingpin, deck & landing gear check', category: 'Safety', mileageInterval: null, timeInterval: 365, lastServiceMileage: null, lastServiceDate: dayDate(150) },
    { id: 12, equipmentId: 12, name: 'Food-grade sanitary seal & pressure test', category: 'Inspection', mileageInterval: null, timeInterval: 365, lastServiceMileage: null, lastServiceDate: dayDate(210) },
    { id: 13, equipmentId: 13, name: 'Carrier vector engine PM-A', category: 'PM-A', mileageInterval: null, timeInterval: 90, lastServiceMileage: null, lastServiceDate: dayDate(45) },
    { id: 14, equipmentId: 14, name: 'Compressor & belts overhaul', category: 'Major PM', mileageInterval: null, timeInterval: 180, lastServiceMileage: null, lastServiceDate: dayDate(120) },
    { id: 15, equipmentId: 15, name: 'Post-breakin refrigeration inspection', category: 'Inspection', mileageInterval: null, timeInterval: 90, lastServiceMileage: null, lastServiceDate: dayDate(20) },
  ].map((item) => ({ ...item, enabled: true, description: 'Scheduled preventive maintenance and compliance inspections.', createdAt: ago(180) }));

  // Service Records
  const records = [
    { id: 1, equipmentId: 1, serviceType: 'Oil & filter change (PM-A)', date: dayDate(75), mileage: 465000, hours: null, shopName: 'Freightliner of Sacramento', cost: 445.00, notes: 'Full synthetic 10W-30 oil with OEM Detroit filters.', createdAt: ago(75) },
    { id: 2, equipmentId: 2, serviceType: 'Brake inspection & slack adjusters', date: dayDate(130), mileage: 585000, hours: null, shopName: 'Kenworth Inland Empire', cost: 220.00, notes: 'Replaced rear drive axle brake shoes and adjusted slack.', createdAt: ago(130) },
    { id: 3, equipmentId: 3, serviceType: 'Annual DOT trailer inspection', date: dayDate(320), mileage: null, hours: null, shopName: 'Great Dane Fleet Services', cost: 165.00, notes: 'Passed Federal Annual Inspection without deficiencies. New decal applied.', createdAt: ago(320) },
    { id: 4, equipmentId: 4, serviceType: 'Reefer oil & filter service', date: dayDate(30), mileage: null, hours: 8160, shopName: 'Thermo King West', cost: 235.00, notes: 'Engine oil, fuel filter, and air cleaner replaced.', createdAt: ago(30) },
    { id: 5, equipmentId: 6, serviceType: 'Engine PM-A & lube service', date: dayDate(40), mileage: 225000, hours: null, shopName: 'Volvo Trucks Salt Lake', cost: 410.00, notes: 'Routine 15,000 mile PM with fuel water separator replacement.', createdAt: ago(40) },
    { id: 6, equipmentId: 7, serviceType: 'Oil & lube service (PM-A)', date: dayDate(110), mileage: 735000, hours: null, shopName: 'Petro Stopping Center #31', cost: 380.00, notes: 'High-mileage synthetic blend oil change.', createdAt: ago(110) },
    { id: 7, equipmentId: 8, serviceType: 'Oil & filter service (PM-A)', date: dayDate(25), mileage: 139000, hours: null, shopName: 'Rush Truck Centers - Chicago', cost: 425.00, notes: 'Factory oil service and chassis grease.', createdAt: ago(25) },
    { id: 8, equipmentId: 10, serviceType: 'Air brake & suspension inspection', date: dayDate(60), mileage: null, hours: null, shopName: 'Fontaine Trailer Repair', cost: 195.00, notes: 'Inspected gladhands, air lines, and air springs.', createdAt: ago(60) },
    { id: 9, equipmentId: 13, serviceType: 'Carrier vector engine PM-A', date: dayDate(45), mileage: null, hours: 3900, shopName: 'Carrier Transicold Phoenix', cost: 260.00, notes: 'Refrigeration unit serviced; refrigerant charge verified.', createdAt: ago(45) },
    { id: 10, equipmentId: 14, serviceType: 'Compressor & belts overhaul', date: dayDate(120), mileage: null, hours: 11800, shopName: 'Thermo King Midwest', cost: 580.00, notes: 'Drive belts replaced, compressor shaft seal inspected.', createdAt: ago(120) },
  ];

  // 16 Fuel Transactions with varied product combinations and dates:
  // - Diesel + DEF + Reefer (Transactions 1, 2, 3)
  // - Just Diesel (Transactions 4, 5, 6, 7)
  // - Diesel + DEF (Transactions 8, 9, 10, 11)
  // - Just Reefer (Transactions 12, 13, 14, 15, 16)
  const fuel = [
    // ── Diesel + DEF + Reefer (Multi-product fuel stops) ──────
    {
      id: 1,
      date: dayDate(2),
      location: 'Pilot Travel Center #392, Barstow CA',
      notes: 'Overnight stop before Cajon Pass. Fuel stop for tractor and reefer.',
      receiptImage: null,
      createdAt: ago(2),
      items: [
        { equipmentId: 1, fuelType: 'diesel', gallons: 138.4, pricePerGallon: 3.899, totalCost: 539.62, odometer: 481950, hours: null },
        { equipmentId: 1, fuelType: 'def', gallons: 11.5, pricePerGallon: 2.799, totalCost: 32.19, odometer: 481950, hours: null },
        { equipmentId: 4, fuelType: 'reefer', gallons: 34.0, pricePerGallon: 3.699, totalCost: 125.77, odometer: null, hours: 8415 },
      ],
      totalCost: 697.58,
    },
    {
      id: 2,
      date: dayDate(45),
      location: 'Love\'s Travel Stop #415, Amarillo TX',
      notes: 'I-40 corridor run. Pre-cooling reefer for produce load.',
      receiptImage: null,
      createdAt: ago(45),
      items: [
        { equipmentId: 2, fuelType: 'diesel', gallons: 152.0, pricePerGallon: 3.849, totalCost: 585.05, odometer: 610500, hours: null },
        { equipmentId: 2, fuelType: 'def', gallons: 14.0, pricePerGallon: 2.849, totalCost: 39.89, odometer: 610500, hours: null },
        { equipmentId: 13, fuelType: 'reefer', gallons: 41.5, pricePerGallon: 3.659, totalCost: 151.85, odometer: null, hours: 4110 },
      ],
      totalCost: 776.79,
    },
    {
      id: 3,
      date: dayDate(95),
      location: 'TA Travel Center, Effingham IL',
      notes: 'Cross-country frozen haul.',
      receiptImage: null,
      createdAt: ago(95),
      items: [
        { equipmentId: 6, fuelType: 'diesel', gallons: 140.2, pricePerGallon: 3.929, totalCost: 550.85, odometer: 231400, hours: null },
        { equipmentId: 6, fuelType: 'def', gallons: 12.0, pricePerGallon: 2.899, totalCost: 34.79, odometer: 231400, hours: null },
        { equipmentId: 14, fuelType: 'reefer', gallons: 38.0, pricePerGallon: 3.719, totalCost: 141.32, odometer: null, hours: 12590 },
      ],
      totalCost: 726.96,
    },

    // ── Just Diesel ───────────────────────────────────────────
    {
      id: 4,
      date: dayDate(0),
      location: 'Flying J #612, Flagstaff AZ',
      notes: 'Single fuel product stop.',
      receiptImage: null,
      createdAt: ago(0),
      items: [
        { equipmentId: 5, fuelType: 'diesel', gallons: 96.5, pricePerGallon: 3.959, totalCost: 382.04, odometer: 84100, hours: null },
      ],
      totalCost: 382.04,
    },
    {
      id: 5,
      date: dayDate(18),
      location: 'Speedway #2201, Gary IN',
      notes: 'Midwest distribution relay.',
      receiptImage: null,
      createdAt: ago(18),
      items: [
        { equipmentId: 7, fuelType: 'diesel', gallons: 124.5, pricePerGallon: 3.799, totalCost: 472.98, odometer: 753800, hours: null },
      ],
      totalCost: 472.98,
    },
    {
      id: 6,
      date: dayDate(85),
      location: 'Kwik Trip #804, Tomah WI',
      notes: 'Regional route refueling.',
      receiptImage: null,
      createdAt: ago(85),
      items: [
        { equipmentId: 8, fuelType: 'diesel', gallons: 118.0, pricePerGallon: 3.819, totalCost: 450.64, odometer: 141900, hours: null },
      ],
      totalCost: 450.64,
    },
    {
      id: 7,
      date: dayDate(315),
      location: 'Petro Stopping Center, Atlanta GA',
      notes: 'Prior year haul in south-east.',
      receiptImage: null,
      createdAt: ago(315),
      items: [
        { equipmentId: 1, fuelType: 'diesel', gallons: 130.0, pricePerGallon: 4.159, totalCost: 540.67, odometer: 455000, hours: null },
      ],
      totalCost: 540.67,
    },

    // ── Diesel + DEF ──────────────────────────────────────────
    {
      id: 8,
      date: dayDate(6),
      location: 'Love\'s Travel Stop #701, Lodi CA',
      notes: 'Pulling dry van trailer T-201. Filled diesel and bulk DEF.',
      receiptImage: null,
      createdAt: ago(6),
      items: [
        { equipmentId: 1, fuelType: 'diesel', gallons: 142.5, pricePerGallon: 3.919, totalCost: 558.46, odometer: 481500, hours: null },
        { equipmentId: 1, fuelType: 'def', gallons: 13.0, pricePerGallon: 2.799, totalCost: 36.39, odometer: 481500, hours: null },
      ],
      totalCost: 594.85,
    },
    {
      id: 9,
      date: dayDate(14),
      location: 'Pilot Travel Center #218, Cheyenne WY',
      notes: 'Pulling flatbed trailer FB-401 through mountain pass.',
      receiptImage: null,
      createdAt: ago(14),
      items: [
        { equipmentId: 2, fuelType: 'diesel', gallons: 148.0, pricePerGallon: 3.869, totalCost: 572.61, odometer: 611600, hours: null },
        { equipmentId: 2, fuelType: 'def', gallons: 15.0, pricePerGallon: 2.829, totalCost: 42.44, odometer: 611600, hours: null },
      ],
      totalCost: 615.05,
    },
    {
      id: 10,
      date: dayDate(32),
      location: 'Sapp Bros Travel Center, Omaha NE',
      notes: 'Pulling step deck SD-501 on I-80 westbound.',
      receiptImage: null,
      createdAt: ago(32),
      items: [
        { equipmentId: 6, fuelType: 'diesel', gallons: 132.8, pricePerGallon: 3.839, totalCost: 509.82, odometer: 234900, hours: null },
        { equipmentId: 6, fuelType: 'def', gallons: 10.5, pricePerGallon: 2.819, totalCost: 29.60, odometer: 234900, hours: null },
      ],
      totalCost: 539.42,
    },
    {
      id: 11,
      date: dayDate(142),
      location: 'Roady\'s Truck Stop, Boise ID',
      notes: 'Pacific Northwest regional run with dry van T-205.',
      receiptImage: null,
      createdAt: ago(142),
      items: [
        { equipmentId: 8, fuelType: 'diesel', gallons: 126.0, pricePerGallon: 3.879, totalCost: 488.75, odometer: 138500, hours: null },
        { equipmentId: 8, fuelType: 'def', gallons: 11.2, pricePerGallon: 2.859, totalCost: 32.02, odometer: 138500, hours: null },
      ],
      totalCost: 520.77,
    },

    // ── Just Reefer ───────────────────────────────────────────
    {
      id: 12,
      date: dayDate(1),
      location: 'Lineage Cold Storage, Salinas CA',
      notes: 'Pre-trip reefer tank top-off at produce loading facility.',
      receiptImage: null,
      createdAt: ago(1),
      items: [
        { equipmentId: 4, fuelType: 'reefer', gallons: 46.0, pricePerGallon: 3.689, totalCost: 169.69, odometer: null, hours: 8418 },
      ],
      totalCost: 169.69,
    },
    {
      id: 13,
      date: dayDate(16),
      location: 'Sysco Distribution Fuel Island, Denver CO',
      notes: 'Yard reefer fuel replenishment.',
      receiptImage: null,
      createdAt: ago(16),
      items: [
        { equipmentId: 13, fuelType: 'reefer', gallons: 38.5, pricePerGallon: 3.649, totalCost: 140.49, odometer: null, hours: 4145 },
      ],
      totalCost: 140.49,
    },
    {
      id: 14,
      date: dayDate(58),
      location: 'Pilot Flying J, Des Moines IA',
      notes: 'Midwest route reefer top-off.',
      receiptImage: null,
      createdAt: ago(58),
      items: [
        { equipmentId: 14, fuelType: 'reefer', gallons: 48.0, pricePerGallon: 3.729, totalCost: 178.99, odometer: null, hours: 12650 },
      ],
      totalCost: 178.99,
    },
    {
      id: 15,
      date: dayDate(165),
      location: 'Americold Logistics, Fort Worth TX',
      notes: 'Fresh produce staging.',
      receiptImage: null,
      createdAt: ago(165),
      items: [
        { equipmentId: 15, fuelType: 'reefer', gallons: 29.0, pricePerGallon: 3.699, totalCost: 107.27, odometer: null, hours: 1210 },
      ],
      totalCost: 107.27,
    },
    {
      id: 16,
      date: dayDate(290),
      location: 'Love\'s Travel Stop, Nashville TN',
      notes: 'Prior year winter run reefer fuel.',
      receiptImage: null,
      createdAt: ago(290),
      items: [
        { equipmentId: 4, fuelType: 'reefer', gallons: 35.0, pricePerGallon: 3.859, totalCost: 135.07, odometer: null, hours: 7650 },
      ],
      totalCost: 135.07,
    },
  ];

  const permits = [
    // Unit 1 (Tractor 101)
    {
      id: 1, equipmentId: 1, permitType: 'irp',
      permitNumber: 'IRP-IN-948201', jurisdiction: 'IN',
      issueDate: dayDate(125), expirationDate: futureDate(240),
      cost: 1850.00, notes: 'Apportioned 48-state cab card.',
      createdAt: ago(125), updatedAt: ago(125),
    },
    {
      id: 2, equipmentId: 1, permitType: 'ifta',
      permitNumber: 'IFTA-IN-582910', jurisdiction: 'IN',
      issueDate: dayDate(347), expirationDate: futureDate(18),
      cost: 20.00, notes: 'Current year IFTA license & decal set (expiring soon).',
      createdAt: ago(347), updatedAt: ago(347),
    },
    {
      id: 3, equipmentId: 1, permitType: 'hvut_2290',
      permitNumber: 'IRS-2290-77491', jurisdiction: 'Federal',
      issueDate: dayDate(175), expirationDate: futureDate(190),
      cost: 550.00, notes: 'IRS e-file stamped Schedule 1.',
      createdAt: ago(175), updatedAt: ago(175),
    },

    // Unit 2 (Tractor 104)
    {
      id: 4, equipmentId: 2, permitType: 'irp',
      permitNumber: 'IRP-IN-883921', jurisdiction: 'IN',
      issueDate: dayDate(185), expirationDate: futureDate(180),
      cost: 1920.00, notes: 'Full gross weight 80,000 lbs registration.',
      createdAt: ago(185), updatedAt: ago(185),
    },
    {
      id: 5, equipmentId: 2, permitType: 'ifta',
      permitNumber: 'IFTA-IN-582910', jurisdiction: 'IN',
      issueDate: dayDate(245), expirationDate: futureDate(120),
      cost: 20.00, notes: 'Fleet decal set.',
      createdAt: ago(245), updatedAt: ago(245),
    },
    {
      id: 6, equipmentId: 2, permitType: 'hvut_2290',
      permitNumber: 'IRS-2290-66281', jurisdiction: 'Federal',
      issueDate: dayDate(380), expirationDate: dayDate(15),
      cost: 550.00, notes: 'Expired tax period Schedule 1 receipt - renewal required.',
      createdAt: ago(380), updatedAt: ago(380),
    },
    {
      id: 7, equipmentId: 2, permitType: 'ny_hut',
      permitNumber: 'NY-HUT-49201', jurisdiction: 'NY',
      issueDate: dayDate(65), expirationDate: futureDate(300),
      cost: 15.00, notes: 'New York Highway Use Tax certificate of registration.',
      createdAt: ago(65), updatedAt: ago(65),
    },

    // Unit 3 (Trailer T-201)
    {
      id: 8, equipmentId: 3, permitType: 'trailer_registration',
      permitNumber: 'TR-REG-772910', jurisdiction: 'IN',
      issueDate: dayDate(255), expirationDate: futureDate(110),
      cost: 120.00, notes: 'Permanent apportioned trailer plate.',
      createdAt: ago(255), updatedAt: ago(255),
    },

    // Unit 4 (Reefer R-301)
    {
      id: 9, equipmentId: 4, permitType: 'trailer_registration',
      permitNumber: 'TR-REG-881203', jurisdiction: 'IN',
      issueDate: dayDate(280), expirationDate: futureDate(85),
      cost: 125.00, notes: 'Standard annual trailer plate.',
      createdAt: ago(280), updatedAt: ago(280),
    },
    {
      id: 10, equipmentId: 4, permitType: 'carb_tru',
      permitNumber: 'ARBER-TRU-391029', jurisdiction: 'CA',
      issueDate: dayDate(343), expirationDate: futureDate(22),
      cost: 45.00, notes: 'California ARBER TRU ATCM compliance certificate (renewal due soon).',
      createdAt: ago(343), updatedAt: ago(343),
    },

    // Unit 5 (Tractor 107) has NO permits -> tests missing mandatory credentials detection

    // Unit 6 (Tractor 112)
    {
      id: 11, equipmentId: 6, permitType: 'irp',
      permitNumber: 'IRP-IN-910248', jurisdiction: 'IN',
      issueDate: dayDate(55), expirationDate: futureDate(310),
      cost: 1780.00, notes: 'Annual cab card.',
      createdAt: ago(55), updatedAt: ago(55),
    },
    {
      id: 12, equipmentId: 6, permitType: 'ifta',
      permitNumber: 'IFTA-IN-582910', jurisdiction: 'IN',
      issueDate: dayDate(285), expirationDate: futureDate(80),
      cost: 20.00, notes: 'IFTA decal #4912.',
      createdAt: ago(285), updatedAt: ago(285),
    },
    {
      id: 13, equipmentId: 6, permitType: 'hvut_2290',
      permitNumber: 'IRS-2290-88192', jurisdiction: 'Federal',
      issueDate: dayDate(155), expirationDate: futureDate(210),
      cost: 550.00, notes: 'HVUT stamped receipt.',
      createdAt: ago(155), updatedAt: ago(155),
    },
    {
      id: 14, equipmentId: 6, permitType: 'kyu',
      permitNumber: 'KYU-882190', jurisdiction: 'KY',
      issueDate: dayDate(105), expirationDate: futureDate(260),
      cost: 0.00, notes: 'Kentucky Weight Distance Tax license.',
      createdAt: ago(105), updatedAt: ago(105),
    },

    // Unit 9 (Trailer T-205)
    {
      id: 15, equipmentId: 9, permitType: 'trailer_registration',
      permitNumber: 'TR-REG-664910', jurisdiction: 'IN',
      issueDate: dayDate(370), expirationDate: dayDate(5),
      cost: 110.00, notes: 'Trailer registration expired 5 days ago.',
      createdAt: ago(370), updatedAt: ago(370),
    },

    // Unit 10 (Trailer FB-401)
    {
      id: 16, equipmentId: 10, permitType: 'trailer_registration',
      permitNumber: 'TR-REG-552194', jurisdiction: 'IN',
      issueDate: dayDate(140), expirationDate: futureDate(225),
      cost: 120.00, notes: 'Flatbed registration.',
      createdAt: ago(140), updatedAt: ago(140),
    },

    // Unit 13 (Reefer R-305)
    {
      id: 17, equipmentId: 13, permitType: 'trailer_registration',
      permitNumber: 'TR-REG-991823', jurisdiction: 'IN',
      issueDate: dayDate(215), expirationDate: futureDate(150),
      cost: 125.00, notes: 'Trailer registration renewal active.',
      createdAt: ago(215), updatedAt: ago(215),
    },
    {
      id: 18, equipmentId: 13, permitType: 'carb_tru',
      permitNumber: 'ARBER-TRU-441098', jurisdiction: 'CA',
      issueDate: dayDate(125), expirationDate: futureDate(240),
      cost: 45.00, notes: 'Clean California ARBER compliance cert.',
      createdAt: ago(125), updatedAt: ago(125),
    },
  ];

  // Commercial Trucking Insurance Policies
  const insurance = [
    {
      id: 1, equipmentId: null, policyType: 'auto_liability',
      carrier: 'Great West Casualty Company', policyNumber: 'GWC-882104-AL',
      broker: 'Reliance Partners', effectiveDate: dayDate(120), expirationDate: futureDate(245),
      coverageLimit: 1000000, deductible: 2500, premium: 14200.00,
      notes: 'Fleet master commercial auto liability policy with statutory MCS-90 endorsement and BMC-91X filing.',
      documentImage: null, createdAt: ago(120), updatedAt: ago(120),
    },
    {
      id: 2, equipmentId: null, policyType: 'cargo',
      carrier: 'Travelers Inland Marine', policyNumber: 'TRV-904128-CG',
      broker: 'Reliance Partners', effectiveDate: dayDate(90), expirationDate: futureDate(275),
      coverageLimit: 100000, deductible: 1000, premium: 3600.00,
      notes: 'Broad-form motor truck cargo policy. Standard $100k freight broker requirement.',
      documentImage: null, createdAt: ago(90), updatedAt: ago(90),
    },
    {
      id: 3, equipmentId: null, policyType: 'general_liability',
      carrier: 'Sentry Insurance', policyNumber: 'SEN-441092-GL',
      broker: 'Cottingham & Butler', effectiveDate: dayDate(180), expirationDate: futureDate(185),
      coverageLimit: 1000000, deductible: 1000, premium: 2400.00,
      notes: '$1M Occurrence / $2M Aggregate. Covers terminal premises, dispatch, and dock loading operations.',
      documentImage: null, createdAt: ago(180), updatedAt: ago(180),
    },
    {
      id: 4, equipmentId: 1, policyType: 'physical_damage',
      carrier: 'Progressive Commercial', policyNumber: 'PGR-551023-PD',
      broker: 'Hub International', effectiveDate: dayDate(340), expirationDate: futureDate(25),
      coverageLimit: 85000, deductible: 1500, premium: 4800.00,
      notes: 'Stated vehicle value $85,000 on Unit 101. Comp & Collision policy expiring soon in 25 days.',
      documentImage: null, createdAt: ago(340), updatedAt: ago(340),
    },
    {
      id: 5, equipmentId: 2, policyType: 'physical_damage',
      carrier: 'Progressive Commercial', policyNumber: 'PGR-551024-PD',
      broker: 'Hub International', effectiveDate: dayDate(60), expirationDate: futureDate(305),
      coverageLimit: 95000, deductible: 1500, premium: 5200.00,
      notes: 'Stated vehicle value $95,000 on Unit 104 Kenworth T680.',
      documentImage: null, createdAt: ago(60), updatedAt: ago(60),
    },
    {
      id: 6, equipmentId: 4, policyType: 'reefer_breakdown',
      carrier: 'Great West Casualty Company', policyNumber: 'GWC-882104-RF',
      broker: 'Reliance Partners', effectiveDate: dayDate(120), expirationDate: futureDate(245),
      coverageLimit: 50000, deductible: 1000, premium: 1800.00,
      notes: 'Refrigeration unit breakdown endorsement covering perishable cargo spoilage on Unit R-301.',
      documentImage: null, createdAt: ago(120), updatedAt: ago(120),
    },
    {
      id: 7, equipmentId: 6, policyType: 'bobtail_ntl',
      carrier: 'Canal Insurance Company', policyNumber: 'CNL-190284-NT',
      broker: 'Direct', effectiveDate: dayDate(370), expirationDate: dayDate(5),
      coverageLimit: 1000000, deductible: 1000, premium: 1200.00,
      notes: 'Non-trucking personal conveyance liability. Expired policy awaiting annual renewal.',
      documentImage: null, createdAt: ago(370), updatedAt: ago(370),
    },
    {
      id: 8, equipmentId: null, policyType: 'trailer_interchange',
      carrier: 'Great West Casualty Company', policyNumber: 'GWC-882104-TI',
      broker: 'Reliance Partners', effectiveDate: dayDate(120), expirationDate: futureDate(245),
      coverageLimit: 30000, deductible: 1000, premium: 1500.00,
      notes: 'UIIA compliant trailer interchange coverage for non-owned interchange trailers and chassis.',
      documentImage: null, createdAt: ago(120), updatedAt: ago(120),
    },
  ];

  return {
    version: 1,
    equipment,
    maintenance,
    records,
    fuel,
    permits,
    insurance,
    settings: [{ key: 'app', demoInitialized: true, geminiApiKey: '', ocrEnabled: false }],
  };
}
