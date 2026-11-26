// Aeroridge — Canyon Run: terrain height field.
// One clear job: given any (x, z), answer how high the ground is, and how far
// the point is from the mission course (the valley the rings thread through).
var AR = window.AR || (window.AR = {});

(function () {
  var C = AR.CONFIG;

  function hash2(ix, iz) {
    var n = (ix * 374761393 + iz * 668265263) | 0;
    n = Math.imul(n ^ (n >>> 13), 1274126177);
    return (((n ^ (n >>> 16)) >>> 0) % 10000) / 10000;
  }
  function vnoise(x, z) {
    var ix = Math.floor(x), iz = Math.floor(z);
    var fx = x - ix, fz = z - iz;
    var sx = fx * fx * (3 - 2 * fx), sz = fz * fz * (3 - 2 * fz);
    var a = hash2(ix, iz), b = hash2(ix + 1, iz);
    var c = hash2(ix, iz + 1), d = hash2(ix + 1, iz + 1);
    return a + (b - a) * sx + (c - a) * sz + (a - b - c + d) * sx * sz;
  }
  function fbm(x, z, octaves) {
    var sum = 0, amp = 0.5, f = 1, norm = 0;
    for (var i = 0; i < octaves; i += 1) {
      sum += amp * vnoise(x * f, z * f);
      norm += amp;
      amp *= 0.5;
      f *= 2.03;
    }
    return sum / norm;
  }

  // Course polyline in the XZ plane, precomputed from the waypoints.
  var segments = [];
  for (var i = 0; i < AR.WAYPOINTS.length - 1; i += 1) {
    segments.push({ a: AR.WAYPOINTS[i], b: AR.WAYPOINTS[i + 1] });
  }

  // Closest point on the course polyline to (x, z): distance and course height.
  function courseInfo(x, z) {
    var bestD = Infinity, bestY = 70;
    for (var i = 0; i < segments.length; i += 1) {
      var a = segments[i].a, b = segments[i].b;
      var dx = b.x - a.x, dz = b.z - a.z;
      var len2 = dx * dx + dz * dz;
      var t = len2 === 0 ? 0 : ((x - a.x) * dx + (z - a.z) * dz) / len2;
      t = AR.clamp(t, 0, 1);
      var px = a.x + dx * t, pz = a.z + dz * t;
      var d = Math.hypot(x - px, z - pz);
      if (d < bestD) {
        bestD = d;
        bestY = a.y + (b.y - a.y) * t;
      }
    }
    return { dist: bestD, y: bestY };
  }

  function heightAt(x, z) {
    var base = fbm(x * 0.0035, z * 0.0035, 4) * 26;
    // Ridged mountains: single-octave noise, sharp peaks only where it nears 0.5.
    var rn = vnoise(x * 0.0016 + 7.3, z * 0.0016 + 3.1);
    var r = 1 - Math.abs(2 * rn - 1);
    var ridge = Math.pow(r, 3) * 70;
    var ci = courseInfo(x, z);
    // Valley: near the course the ground drops to just below ring height.
    var valleyMask = AR.smoothstep(650, 180, ci.dist);
    var h = base * 0.6 + ridge * (1 - valleyMask * 0.85);
    // Mountain walls at the world edges — added BEFORE the valley carve, so
    // the carve cuts a flyable corridor through them instead of the floor
    // being lifted up into the rings near the far end of the course.
    var edge = Math.max(Math.abs(x), Math.abs(z - C.worldCentreZ));
    h += AR.smoothstep(880, 1150, edge) * 90;
    h = AR.lerp(h, ci.y - 30, valleyMask * 0.85);
    // Flat apron around the runway.
    var rx = Math.max(0, Math.abs(x) - 70);
    var rz = Math.max(0, Math.abs(z) - 230);
    var rdist = Math.hypot(rx, rz);
    var flat = AR.smoothstep(90, 10, rdist);
    h = AR.lerp(h, 0, flat);
    return h;
  }

  // Colour of the ground at a point, from its height and the local noise.
  function groundColor(x, z, h) {
    var n = fbm(x * 0.02 + 11, z * 0.02 + 5, 2);
    var r, g, b;
    if (h < 4) { r = 0.76; g = 0.66; b = 0.47; } // sand / dry lake bed
    else if (h < 45) { r = 0.36 + n * 0.1; g = 0.58 + n * 0.12; b = 0.26 + n * 0.06; } // meadow
    else if (h < 75) { r = 0.32 + n * 0.08; g = 0.45 + n * 0.08; b = 0.24; } // high pasture
    else if (h < 115) { r = 0.52; g = 0.49; b = 0.44; } // rock
    else { r = 0.93; g = 0.95; b = 0.97; } // snow
    // Dry patches in the meadow.
    if (h >= 4 && h < 45 && n > 0.72) { r = 0.62; g = 0.55; b = 0.32; }
    return [r, g, b];
  }

  AR.heightAt = heightAt;
  AR.courseInfo = courseInfo;
  AR.groundColor = groundColor;
  AR.fbm = fbm;
})();
