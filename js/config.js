// Game data: cars, parts and events. Prices are in credits (CR).

export const CAR_MODELS = [
  { id: 'sedan',          name: 'KESTREL SEDAN',   sub: 'Everyday compact',        model: 'sedan.glb',          price: 0,     mass: 1240, drag: 0.34, grip: 1.00 },
  { id: 'kart-oobi',      name: 'OOBI KART',       sub: 'Featherweight fun',       model: 'kart-oobi.glb',      price: 4000,  mass: 460,  drag: 0.52, grip: 1.14 },
  { id: 'sedan-sports',   name: 'KESTREL GT',      sub: 'Sport sedan',             model: 'sedan-sports.glb',   price: 6500,  mass: 1170, drag: 0.32, grip: 1.08 },
  { id: 'hatchback-sports',name:'SPARROW RS',      sub: 'Hot hatch',               model: 'hatchback-sports.glb',price: 9500,  mass: 1030, drag: 0.31, grip: 1.12 },
  { id: 'van',            name: 'HAULER VAN',      sub: 'Cargo hauler',            model: 'van.glb',            price: 13000, mass: 1880, drag: 0.46, grip: 0.92 },
  { id: 'suv',            name: 'NOMAD SUV',       sub: 'All-terrain',             model: 'suv.glb',            price: 16000, mass: 1650, drag: 0.42, grip: 0.98 },
  { id: 'truck',          name: 'TITAN PICKUP',    sub: 'Workhorse',               model: 'truck.glb',          price: 21000, mass: 2050, drag: 0.45, grip: 0.94 },
  { id: 'suv-luxury',     name: 'NOMAD LUXE',      sub: 'Premium cruiser',         model: 'suv-luxury.glb',     price: 28000, mass: 1720, drag: 0.38, grip: 1.06 },
  { id: 'race',           name: 'VECTOR RACE',    sub: 'Track weapon',            model: 'race.glb',           price: 42000, mass: 960,  drag: 0.28, grip: 1.24 },
  { id: 'race-future',    name: 'VECTOR NEO',      sub: 'Prototype',               model: 'race-future.glb',    price: 68000, mass: 880,  drag: 0.25, grip: 1.32 },
];

export const ENGINES = [
  { id: 'i4',      name: '1.6L INLINE-4',  sub: '110 hp · 150 Nm · 6.2k rpm',  price: 0,     hp: 110, torque: 150, redline: 6200, mass: 120, resp: 0.60 },
  { id: 'i4t',     name: '2.0L TURBO I4',  sub: '240 hp · 320 Nm · 7.0k rpm',  price: 4500,  hp: 240, torque: 320, redline: 7000, mass: 145, resp: 0.85 },
  { id: 'v6',      name: '3.0L V6',         sub: '310 hp · 370 Nm · 7.4k rpm',  price: 10000, hp: 310, torque: 370, redline: 7400, mass: 180, resp: 0.78 },
  { id: 'motor',   name: 'E-MOTOR 400V',   sub: '400 hp · 700 Nm · instant',   price: 28000, hp: 400, torque: 700, redline: 11000,mass: 190, resp: 1.00 },
  { id: 'v8',      name: '5.0L V8',         sub: '480 hp · 560 Nm · 7.8k rpm',  price: 22000, hp: 480, torque: 560, redline: 7800, mass: 240, resp: 0.72 },
  { id: 'v10',     name: '5.2L V10',        sub: '620 hp · 600 Nm · 8.5k rpm',  price: 48000, hp: 620, torque: 600, redline: 8500, mass: 260, resp: 0.66 },
];

export const TRANSMISSIONS = [
  { id: 't5', name: '5-SPEED MANUAL',   sub: 'Balanced ratios',       price: 0,     ratios: [3.45, 2.20, 1.52, 1.12, 0.86], final: 3.90, shift: 0.22 },
  { id: 't6', name: '6-SPEED SPORT',    sub: 'Tighter shifts',         price: 4000,  ratios: [3.80, 2.40, 1.72, 1.32, 1.00, 0.80], final: 3.70, shift: 0.15 },
  { id: 't7', name: '7-SPEED DSG',      sub: 'Lightning fast',         price: 11000, ratios: [4.10, 2.65, 1.90, 1.48, 1.18, 0.96, 0.76], final: 3.50, shift: 0.08 },
  { id: 't8', name: '8-SPEED AUTO',     sub: 'Long highway gearing',  price: 14000, ratios: [4.40, 2.80, 2.05, 1.60, 1.28, 1.03, 0.84, 0.66], final: 3.30, shift: 0.12 },
];

export const DRIVETRAINS = [
  { id: 'fwd', name: 'FRONT-WHEEL DRIVE', sub: 'Stable, predictable',   price: 0,     traction: 1.06, oversteer: 0.80, accel: 1.00 },
  { id: 'rwd', name: 'REAR-WHEEL DRIVE',  sub: 'Drift happy',           price: 6000,  traction: 0.98, oversteer: 1.18, accel: 1.03 },
  { id: 'awd', name: 'ALL-WHEEL DRIVE',   sub: 'Maximum grip',          price: 15000, traction: 1.18, oversteer: 0.92, accel: 1.12 },
];

export const TIRES = [
  { id: 'street', name: 'STREET',  sub: 'All-round daily grip',  price: 0,    grip: 1.00, slip: 0.85 },
  { id: 'sport',  name: 'SPORT',   sub: '+18% cornering grip',   price: 3000, grip: 1.18, slip: 0.65 },
  { id: 'drift',  name: 'DRIFT',   sub: 'Break traction easily', price: 3800, grip: 0.84, slip: 0.30 },
  { id: 'slick',  name: 'SLICK',   sub: '+35% ultimate grip',    price: 9000, grip: 1.35, slip: 0.45 },
];

export const SUSPENSIONS = [
  { id: 'stock',   name: 'STOCK',    sub: 'Factory ride height',   price: 0,    ride: 0,     handling: 1.00 },
  { id: 'lowered', name: 'LOWERED',  sub: 'Less roll, lower CG',   price: 2600, ride: -0.09, handling: 1.10 },
  { id: 'raised',  name: 'RAISED',   sub: 'More clearance',         price: 1800, ride: 0.13,  handling: 0.92 },
];

export const WHEELS = [
  { id: 'wheel-default', name: 'OEM ALLOY',   sub: 'Factory five-spoke', price: 0,    model: 'wheel-default.glb' },
  { id: 'wheel-dark',    name: 'STEALTH',     sub: 'Matte dark finish',  price: 1600, model: 'wheel-dark.glb' },
  { id: 'wheel-racing',  name: 'RACING SPORT',sub: 'Lightweight race',   price: 3400, model: 'wheel-racing.glb' },
];

export const SPOILERS = [
  { id: 'none',      name: 'NONE',      sub: 'Clean roofline',    price: 0 },
  { id: 'ducktail',  name: 'DUCKTAIL',  sub: 'Subtle rear lift',  price: 1000 },
  { id: 'wing',      name: 'GT WING',   sub: 'Big downforce',     price: 3200 },
];

export const BODY_KITS = [
  { id: 'stock', name: 'STOCK',    sub: 'As delivered',        price: 0 },
  { id: 'sport', name: 'SPORT',    sub: 'Skirts + splitters',  price: 3600 },
  { id: 'wide',  name: 'WIDE BODY',sub: 'Wider stance',        price: 6400 },
];

export const PAINTS = [
  { id: 'p1', name: 'ICE BLUE',    color: '#3ba7ff', price: 0 },
  { id: 'p2', name: 'ARCTIC WHITE',color: '#e8f4ff', price: 0 },
  { id: 'p3', name: 'MIDNIGHT',    color: '#151b2c', price: 0 },
  { id: 'p4', name: 'RACING RED',  color: '#e0243c', price: 1200 },
  { id: 'p5', name: 'ACID LIME',   color: '#a8ef31', price: 1800 },
  { id: 'p6', name: 'HOT PINK',    color: '#ff3e9d', price: 2200 },
  { id: 'p7', name: 'GOLD',        color: '#f2b431', price: 2600 },
  { id: 'p8', name: 'PURPLE HAZE', color: '#8b5cff', price: 3000 },
];

export const ACCENTS = [
  { id: 'a1', name: 'WHITE', color: '#ffffff', price: 0 },
  { id: 'a2', name: 'BLACK', color: '#101319', price: 0 },
  { id: 'a3', name: 'CYAN',  color: '#48e6ff', price: 0 },
  { id: 'a4', name: 'PINK',  color: '#ff3e9d', price: 600 },
  { id: 'a5', name: 'LIME',  color: '#b8ff5c', price: 600 },
];

export const UNDERGLOW = [
  { id: 'off',  name: 'OFF',    sub: 'No underglow',      color: null,    price: 0 },
  { id: 'cyan', name: 'CYAN',   sub: 'Ice blue glow',     color: '#48e6ff', price: 1600 },
  { id: 'pink', name: 'PINK',   sub: 'Magenta glow',      color: '#ff3e9d', price: 1600 },
  { id: 'lime', name: 'LIME',   sub: 'Toxic green glow',  color: '#b8ff5c', price: 1600 },
];

export const TINTS = [
  { id: 't0', name: 'CLEAR', sub: 'No tint',   value: 0,    price: 0 },
  { id: 't1', name: 'LIGHT', sub: '35% tint',  value: 0.35, price: 500 },
  { id: 't2', name: 'DARK',  sub: '65% tint',  value: 0.65, price: 1200 },
];

export const TRACKS = [
  {
    id: 'sunset', name: 'SUNSET LOOP', sub: 'Fast flowing circuit', width: 17, laps: 2,
    points: [[0,0],[62,-6],[112,-46],[118,-104],[72,-145],[8,-152],[-52,-130],[-88,-84],[-78,-32],[-40,14]],
    ground: 0x1b1b26, fog: 0x1a1524, skyTop: 0x1b1038, skyBot: 0xff7a4d, accent: 0xff7a4d,
  },
  {
    id: 'industrial', name: 'INDUSTRIAL SPRINT', sub: 'Tight technical layout', width: 15, laps: 3,
    points: [[0,0],[66,-4],[116,-38],[126,-92],[92,-124],[42,-106],[12,-72],[-26,-62],[-68,-90],[-112,-58],[-104,-8],[-50,18]],
    ground: 0x1c2026, fog: 0x141b22, skyTop: 0x0b1c2b, skyBot: 0x4b6b7a, accent: 0x48e6ff,
  },
  {
    id: 'coastal', name: 'COASTAL RUN', sub: 'Long high-speed sweepers', width: 19, laps: 2,
    points: [[0,0],[78,10],[150,-20],[192,-80],[172,-150],[104,-192],[22,-182],[-52,-152],[-124,-172],[-182,-122],[-192,-52],[-142,12],[-70,32]],
    ground: 0x17251f, fog: 0x10202a, skyTop: 0x123c55, skyBot: 0xffb06b, accent: 0x7ce8c0,
  },
];

export const RIVALS = [
  { name: 'VEX',  car: 'race-future',      color: '#ff3e9d', paint: 'p6', number: '01', skill: 1.02 },
  { name: 'KAI',  car: 'race',             color: '#48e6ff', paint: 'p1', number: '11', skill: 0.99 },
  { name: 'SOL',  car: 'sedan-sports',     color: '#f2b431', paint: 'p7', number: '23', skill: 0.95 },
  { name: 'ROOK', car: 'hatchback-sports', color: '#b8ff5c', paint: 'p5', number: '44', skill: 0.92 },
  { name: 'DUST', car: 'suv',              color: '#c6d0da', paint: 'p2', number: '88', skill: 0.89 },
];

export const DEFAULT_SETUP = {
  car: 'sedan', engine: 'i4', transmission: 't5', drivetrain: 'fwd', tires: 'street',
  suspension: 'stock', wheels: 'wheel-default', spoiler: 'none', bodyKit: 'stock',
  paint: 'p1', accent: 'a1', underglow: 'off', tint: 't0', number: '07',
};

export const CATALOG = {
  car: CAR_MODELS, engine: ENGINES, transmission: TRANSMISSIONS, drivetrain: DRIVETRAINS,
  tires: TIRES, suspension: SUSPENSIONS, wheels: WHEELS, spoiler: SPOILERS, bodyKit: BODY_KITS,
  paint: PAINTS, accent: ACCENTS, underglow: UNDERGLOW, tint: TINTS,
};

export const TABS = [
  { id: 'car',          label: '01 / BODY' },
  { id: 'engine',       label: '02 / ENGINE' },
  { id: 'transmission', label: '03 / GEARBOX' },
  { id: 'drivetrain',   label: '04 / DRIVE' },
  { id: 'tires',        label: '05 / TIRES' },
  { id: 'suspension',   label: '06 / SUSPENSION' },
  { id: 'wheels',       label: '07 / WHEELS' },
  { id: 'spoiler',      label: '08 / SPOILER' },
  { id: 'bodyKit',      label: '09 / BODY KIT' },
  { id: 'paint',        label: '10 / PAINT' },
  { id: 'accent',       label: '11 / ACCENT' },
  { id: 'underglow',    label: '12 / UNDERGLOW' },
  { id: 'tint',         label: '13 / WINDOW TINT' },
  { id: 'number',       label: '14 / RACE NUMBER' },
];

export function findPart(category, id) {
  return (CATALOG[category] || []).find(p => p.id === id) || (CATALOG[category] || [])[0];
}

export function computeSpecs(setup) {
  const car = findPart('car', setup.car);
  const engine = findPart('engine', setup.engine);
  const trans = findPart('transmission', setup.transmission);
  const drive = findPart('drivetrain', setup.drivetrain);
  const tires = findPart('tires', setup.tires);
  const susp = findPart('suspension', setup.suspension);
  const spoiler = findPart('spoiler', setup.spoiler);

  const mass = car.mass + engine.mass;
  const powerToWeight = engine.hp * 1000 / mass;
  const topSpeed = (26 + Math.sqrt(engine.hp) * 1.72) * (0.94 + trans.ratios.at(-1) * 0.08);
  const quarter = 15.5 - Math.min(powerToWeight * 0.014, 7.4);
  const grip = car.grip * tires.grip * susp.handling * drive.traction * (spoiler.id === 'wing' ? 1.06 : 1);
  const handling = grip * 0.86 + (1 / (1 + mass / 2600)) * 0.34;
  return {
    hp: engine.hp, mass, topSpeed, quarter: Math.max(quarter, 7.1),
    grip, handling, redline: engine.redline, torque: engine.torque,
    resp: engine.resp, drag: car.drag, accel: drive.accel, oversteer: drive.oversteer,
    slip: tires.slip, shift: trans.shift, ratios: trans.ratios, final: trans.final,
    ride: susp.ride, drive: drive.id,
  };
}

export const REWARDS = [5500, 3600, 2400, 1500, 1100, 800];
