// Aeroridge — Canyon Run: shared constants and the mission course.
// One clear job: every number that tunes the game lives here.
var AR = window.AR || (window.AR = {});

AR.CONFIG = {
  // World
  worldSizeX: 2400,
  worldSizeZ: 2600,
  worldCentreZ: 950,
  terrainSegments: 180,
  // Flight
  minSpeed: 28, // m/s at idle throttle
  maxSpeed: 100, // m/s at full throttle
  maxRoll: 1.05, // radians of bank
  maxPitch: 0.55, // radians of climb/descent
  stallSpeed: 42, // m/s: below this the plane sinks
  turnRate: 0.85, // heading change per second at full bank
  fuelMax: 100,
  fuelBurnIdle: 0.12, // fuel per second at idle
  fuelBurnFull: 0.35, // fuel per second at full throttle
  // Mission
  ringRadius: 13,
  ringScore: 100,
  landingBonus: 400,
  // Camera
  camDistance: 15,
  camHeight: 5,
  fovBase: 62,
};

AR.WAYPOINTS = [
  { x: 0, y: 55, z: 320 },
  { x: 160, y: 80, z: 420 },
  { x: -60, y: 100, z: 780 },
  { x: 200, y: 120, z: 1120 },
  { x: 60, y: 105, z: 1480 },
  { x: -140, y: 130, z: 1780 },
  { x: 40, y: 115, z: 2050 },
  { x: -160, y: 100, z: 1700 },
  { x: 60, y: 85, z: 1300 },
  { x: -80, y: 75, z: 900 },
  { x: 0, y: 65, z: 500 },
];

AR.RUNWAY = {
  x: 0,
  z: 0,
  length: 300,
  width: 16,
  heading: Math.PI, // land heading south, toward -Z
};

AR.PLANE_START = { x: 0, y: 2, z: -110, heading: 0 };

// Small helpers shared by the modules.
AR.clamp = function (v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; };
AR.lerp = function (a, b, t) { return a + (b - a) * t; };
AR.smoothstep = function (a, b, x) {
  var t = AR.clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
// Shortest signed angle from a to b, in (-PI, PI].
AR.angleDiff = function (a, b) {
  var d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
};
// Deterministic seeded random (mulberry32) for clouds and decoration.
AR.mulberry32 = function (seed) {
  var s = seed >>> 0;
  return function () {
    s = (s + 0x6D2B79F5) >>> 0;
    var t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};
