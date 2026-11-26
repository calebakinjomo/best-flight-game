// Aeroridge — Canyon Run: the aircraft and how it flies.
// One clear job: build the plane from primitives, and step its flight model
// (throttle, bank, pitch, stall, fuel) forward in time.
var AR = window.AR || (window.AR = {});

(function () {
  var C = AR.CONFIG;

  // A sporty single-prop tourer, built from primitives: orange and white,
  // glass canopy, spinning prop, lit nav lights. It points down local +Z.
  function buildPlaneMesh() {
    var group = new THREE.Group();
    var orange = new THREE.MeshPhongMaterial({ color: 0xe8641b, shininess: 60 });
    var white = new THREE.MeshPhongMaterial({ color: 0xf2f0ea, shininess: 60 });
    var dark = new THREE.MeshPhongMaterial({ color: 0x22262b, shininess: 40 });
    var glass = new THREE.MeshPhongMaterial({ color: 0x18324e, shininess: 160, specular: 0xaaddff });

    var fuselage = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.55, 4.6, 12), orange);
    fuselage.rotation.x = Math.PI / 2;
    fuselage.position.z = -0.4;
    group.add(fuselage);
    var nose = new THREE.Mesh(new THREE.ConeGeometry(0.85, 1.6, 12), white);
    nose.rotation.x = Math.PI / 2;
    nose.position.z = 2.7;
    group.add(nose);
    var canopy = new THREE.Mesh(new THREE.SphereGeometry(0.72, 14, 10), glass);
    canopy.scale.set(1, 0.85, 1.9);
    canopy.position.set(0, 0.62, 0.7);
    group.add(canopy);
    var wing = new THREE.Mesh(new THREE.BoxGeometry(11, 0.18, 2.3), white);
    wing.position.set(0, -0.15, 0.4);
    group.add(wing);
    [-5.5, 5.5].forEach(function (x) {
      var tip = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.2, 2.3), orange);
      tip.position.set(x, -0.15, 0.4);
      group.add(tip);
    });
    var tailplane = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.14, 1.3), white);
    tailplane.position.set(0, 0.15, -2.5);
    group.add(tailplane);
    var fin = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.7, 1.5), orange);
    fin.position.set(0, 0.85, -2.5);
    group.add(fin);
    // Propeller: hub + two blades, spins with speed.
    var prop = new THREE.Group();
    var bladeMat = new THREE.MeshPhongMaterial({ color: 0x1c1e22, shininess: 30 });
    [-1, 1].forEach(function (s) {
      var blade = new THREE.Mesh(new THREE.BoxGeometry(0.28, 2.6, 0.12), bladeMat);
      blade.position.y = s * 1.3;
      prop.add(blade);
    });
    var spinner = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.7, 10), orange);
    spinner.rotation.x = Math.PI / 2;
    spinner.position.z = 0.35;
    prop.add(spinner);
    prop.position.z = 3.55;
    group.add(prop);
    // Landing gear.
    [-1.4, 1.4].forEach(function (x) {
      var leg = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 1.1, 8), dark);
      leg.position.set(x, -0.95, 0.9);
      group.add(leg);
      var wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.3, 12), dark);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(x, -1.5, 0.9);
      group.add(wheel);
    });
    // Nav lights, lit: red port, green starboard, white tail.
    var lights = [
      { color: 0xff2222, x: -5.5, y: -0.15, z: 0.4 },
      { color: 0x22ff44, x: 5.5, y: -0.15, z: 0.4 },
      { color: 0xffffff, x: 0, y: 0.2, z: -2.9 },
    ];
    lights.forEach(function (l) {
      var bulb = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6),
        new THREE.MeshBasicMaterial({ color: l.color }));
      bulb.position.set(l.x, l.y, l.z);
      group.add(bulb);
    });
    group.userData.prop = prop;
    return group;
  }

  function createPlane(scene) {
    var mesh = buildPlaneMesh();
    scene.add(mesh);
    var s = AR.PLANE_START;
    var plane = {
      mesh: mesh,
      pos: new THREE.Vector3(s.x, s.y, s.z),
      heading: s.heading,
      pitch: 0,
      roll: 0,
      speed: 0,
      throttle: 0,
      fuel: C.fuelMax,
      verticalSpeed: 0,
      onGround: true,
    };
    return plane;
  }

  function resetPlane(plane) {
    var s = AR.PLANE_START;
    plane.pos.set(s.x, s.y, s.z);
    plane.heading = s.heading;
    plane.pitch = 0;
    plane.roll = 0;
    plane.speed = 0;
    plane.throttle = 0;
    plane.fuel = C.fuelMax;
    plane.verticalSpeed = 0;
    plane.onGround = true;
    syncMesh(plane);
  }

  function syncMesh(plane) {
    var m = plane.mesh;
    m.position.copy(plane.pos);
    m.rotation.order = 'YXZ';
    m.rotation.y = plane.heading;
    m.rotation.x = -plane.pitch;
    m.rotation.z = -plane.roll;
    m.userData.prop.rotation.z += 0.25 + plane.speed * 0.06;
  }

  // Step the flight model. `input` is { pitch, roll, throttle, brake } with
  // pitch/roll in [-1, 1] and throttle in [0, 1]. Returns an event string or ''.
  function stepPlane(plane, input, dt) {
    // Throttle and fuel.
    if (plane.fuel <= 0) input.throttle = 0;
    plane.throttle = AR.clamp(input.throttle, 0, 1);
    plane.fuel = Math.max(0, plane.fuel - (C.fuelBurnIdle + plane.throttle * (C.fuelBurnFull - C.fuelBurnIdle)) * dt);

    // Speed chases the throttle setting; the brake drags it down.
    var target = C.minSpeed + plane.throttle * (C.maxSpeed - C.minSpeed);
    if (input.brake) target *= 0.55;
    plane.speed += (target - plane.speed) * Math.min(1, 0.45 * dt);

    // Bank and pitch ease toward the pilot's demand.
    var rollTarget = input.roll * C.maxRoll;
    var authority = plane.speed < 20 ? plane.speed / 20 : 1;
    var pitchTarget = input.pitch * C.maxPitch * authority;
    plane.roll += (rollTarget - plane.roll) * Math.min(1, 4 * dt);
    plane.pitch += (pitchTarget - plane.pitch) * Math.min(1, 3 * dt);

    // A banked wing turns the nose.
    plane.heading += Math.sin(plane.roll) * C.turnRate * (plane.speed / 55) * dt;

    // Move along the nose; below stall speed the plane sinks.
    var cp = Math.cos(plane.pitch), sp = Math.sin(plane.pitch);
    var vx = Math.sin(plane.heading) * cp * plane.speed;
    var vz = Math.cos(plane.heading) * cp * plane.speed;
    var vy = sp * plane.speed;
    if (plane.speed < C.stallSpeed) vy -= (C.stallSpeed - plane.speed) * 0.4;
    plane.verticalSpeed = vy;
    plane.pos.x += vx * dt;
    plane.pos.y += vy * dt;
    plane.pos.z += vz * dt;

    // Soft world edge: the valley is the whole game.
    plane.pos.x = AR.clamp(plane.pos.x, -1150, 1150);
    plane.pos.z = AR.clamp(plane.pos.z, -330, 2230);
    if (plane.pos.y > 420) plane.pos.y = 420;

    syncMesh(plane);
    return '';
  }

  AR.buildPlaneMesh = buildPlaneMesh;
  AR.createPlane = createPlane;
  AR.resetPlane = resetPlane;
  AR.stepPlane = stepPlane;
  AR.syncMesh = syncMesh;
})();
