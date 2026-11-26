// Aeroridge — Canyon Run: the ring course.
// One clear job: place the glowing rings along the waypoints, light the next
// one with a beacon, and tell the game when the plane flies through one.
var AR = window.AR || (window.AR = {});

(function () {
  var C = AR.CONFIG;

  function createRings(scene) {
    var rings = [];
    AR.WAYPOINTS.forEach(function (wp, i) {
      var mat = new THREE.MeshStandardMaterial({
        color: 0xff8c1a, emissive: 0xff6a00, emissiveIntensity: 0.9,
        roughness: 0.4, metalness: 0.2,
      });
      var torus = new THREE.Mesh(new THREE.TorusGeometry(C.ringRadius, 1.1, 12, 40), mat);
      torus.position.set(wp.x, wp.y, wp.z);
      // Face along the course: look at the next waypoint.
      var next = AR.WAYPOINTS[Math.min(i + 1, AR.WAYPOINTS.length - 1)];
      torus.lookAt(next.x, next.y, next.z);
      scene.add(torus);
      rings.push({ mesh: torus, mat: mat, pos: new THREE.Vector3(wp.x, wp.y, wp.z), passed: false });
    });
    // Beacon: a column of light over the next ring, so the pilot can find it.
    var beaconMat = new THREE.MeshBasicMaterial({
      color: 0xffb347, transparent: true, opacity: 0.07,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
    });
    var beacon = new THREE.Mesh(new THREE.CylinderGeometry(2, 2, 160, 12, 1, true), beaconMat);
    scene.add(beacon);
    var state = { rings: rings, beacon: beacon, next: 0, pulse: 0 };
    setNext(state, 0);
    return state;
  }

  function setNext(state, index) {
    state.next = index;
    state.rings.forEach(function (ring, i) {
      if (i < index) {
        ring.mat.color.setHex(0x2fae5f);
        ring.mat.emissive.setHex(0x1d7a3c);
        ring.mat.emissiveIntensity = 0.5;
      } else if (i === index) {
        ring.mat.color.setHex(0xff8c1a);
        ring.mat.emissive.setHex(0xff6a00);
        ring.mat.emissiveIntensity = 1.4;
      } else {
        ring.mat.color.setHex(0xff8c1a);
        ring.mat.emissive.setHex(0xff6a00);
        ring.mat.emissiveIntensity = 0.9;
      }
    });
    if (index < state.rings.length) {
      var p = state.rings[index].pos;
      state.beacon.position.set(p.x, p.y + 70, p.z);
      state.beacon.visible = true;
    } else {
      state.beacon.visible = false;
    }
  }

  // True when the plane is inside the next ring's disc.
  function checkRing(state, planePos) {
    if (state.next >= state.rings.length) return false;
    var ring = state.rings[state.next];
    var d = planePos.distanceTo(ring.pos);
    if (d < C.ringRadius) {
      ring.passed = true;
      setNext(state, state.next + 1);
      return true;
    }
    return false;
  }

  function resetRings(state) {
    state.rings.forEach(function (ring) { ring.passed = false; });
    setNext(state, 0);
  }

  // Pulse the next ring and drift the beacon so the course feels alive.
  function animateRings(state, time) {
    if (state.next < state.rings.length) {
      var s = 1 + Math.sin(time * 4) * 0.05;
      state.rings[state.next].mesh.scale.set(s, s, s);
      state.beacon.material.opacity = 0.06 + Math.sin(time * 2.5) * 0.02;
    }
  }

  AR.createRings = createRings;
  AR.checkRing = checkRing;
  AR.resetRings = resetRings;
  AR.animateRings = animateRings;
})();
