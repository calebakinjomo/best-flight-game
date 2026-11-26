// Aeroridge — Canyon Run: the game itself.
// One clear job: own the loop, the screens (title, flying, crashed, landed),
// the mission rules (rings, fuel, landing) and the chase camera.
var AR = window.AR || (window.AR = {});

(function () {
  var C = AR.CONFIG;
  var renderer, scene, camera, world, plane, rings;
  var state = null;
  var clock = { last: 0 };
  var shotMode = null;

  function init() {
    var canvas = document.getElementById('game');
    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(C.fovBase, window.innerWidth / window.innerHeight, 0.5, 9000);
    camera.position.set(0, 8, -130);
    camera.lookAt(0, 4, 0);

    world = AR.buildWorld(scene);
    plane = AR.createPlane(scene);
    rings = AR.createRings(scene);
    state = {
      screen: 'title',
      plane: plane,
      score: 0,
      ringsPassed: 0,
      time: 0,
      throttle: 0,
      best: 0,
      shake: 0,
      landedBonus: 0,
      landedReason: '',
    };
    AR.initHud();
    AR.initInput({
      onKey: onKey,
      onWheel: function (dir) {
        if (state.screen === 'fly') state.throttle = AR.clamp(state.throttle + dir * 0.08, 0, 1);
      },
    });
    window.addEventListener('resize', onResize);
    document.getElementById('startBtn').addEventListener('click', startGame);
    document.getElementById('restartBtn').addEventListener('click', restartGame);
    document.getElementById('againBtn').addEventListener('click', restartGame);
    document.getElementById('titleScreen').classList.add('show');
    AR.updateHud(state);
  }

  function onResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }

  function onKey(code) {
    if (code === 'Enter' || code === 'Space') {
      if (state.screen === 'title') { startGame(); return; }
      if (state.screen === 'crashed' || state.screen === 'landed') { restartGame(); return; }
    }
    if (code === 'KeyR' && (state.screen === 'fly' || state.screen === 'crashed' || state.screen === 'landed')) restartGame();
    if (code === 'KeyP' && state.screen === 'fly') setScreen('paused');
    else if (code === 'KeyP' && state.screen === 'paused') setScreen('fly');
    if (code === 'KeyM') {
      var muted = AR.toggleMute();
      AR.showBanner(muted ? 'SOUND OFF' : 'SOUND ON', 1200);
    }
  }

  function setScreen(name) {
    state.screen = name;
    ['titleScreen', 'crashScreen', 'landScreen', 'pauseScreen'].forEach(function (id) {
      document.getElementById(id).classList.remove('show');
    });
    if (name === 'title') document.getElementById('titleScreen').classList.add('show');
    if (name === 'crashed') document.getElementById('crashScreen').classList.add('show');
    if (name === 'landed') document.getElementById('landScreen').classList.add('show');
    if (name === 'paused') document.getElementById('pauseScreen').classList.add('show');
  }

  function startGame() {
    AR.ensureAudio();
    resetMission();
    setScreen('fly');
    state.throttle = 0.55;
    AR.showBanner('TAKE OFF — FLY THE 11 RINGS, THEN LAND', 3000);
  }

  function restartGame() {
    AR.ensureAudio();
    resetMission();
    setScreen('fly');
    state.throttle = 0.55;
  }

  function resetMission() {
    AR.resetPlane(plane);
    AR.resetRings(rings);
    state.score = 0;
    state.ringsPassed = 0;
    state.time = 0;
    state.throttle = 0;
    state.shake = 0;
    state.landedBonus = 0;
    state.landedReason = '';
  }

  function onRunway(plane) {
    return Math.abs(plane.pos.x - AR.RUNWAY.x) < AR.RUNWAY.width / 2 + 2 &&
      Math.abs(plane.pos.z - AR.RUNWAY.z) < AR.RUNWAY.length / 2;
  }

  // The touchdown rule, shared by live play and the staged landing shot:
  // 'land' when the plane is gentle and level over the strip, 'crash-terrain'
  // or 'crash-ground' when it meets the ground any other way, null otherwise.
  function checkTouchdown(plane) {
    var groundH = AR.heightAt(plane.pos.x, plane.pos.z);
    var clearance = plane.pos.y - groundH;
    if (plane.onGround || clearance >= 1.6) return null;
    var gentle = Math.abs(plane.verticalSpeed) < 7 && plane.speed < 58 &&
      Math.abs(plane.pitch) < 0.18 && Math.abs(plane.roll) < 0.28;
    if (onRunway(plane) && gentle) return 'land';
    return (clearance < 0.4 || Math.abs(plane.verticalSpeed) > 12) ? 'crash-terrain' : 'crash-ground';
  }

  function updateFly(dt) {
    state.time += dt;
    // Throttle ramps with Shift / Control.
    var input = AR.readInput(state.throttle);
    if (input.keys.ShiftLeft || input.keys.ShiftRight) state.throttle = AR.clamp(state.throttle + 0.6 * dt, 0, 1);
    if (input.keys.ControlLeft || input.keys.ControlRight) state.throttle = AR.clamp(state.throttle - 0.6 * dt, 0, 1);
    input.throttle = state.throttle;

    if (plane.onGround) {
      // Rolling: stay on the ground until fast enough and pulling up.
      input.pitch = Math.max(0, input.pitch);
      plane.roll = 0;
      if (plane.speed > 48 && input.pitch > 0.1) {
        plane.onGround = false;
      }
    }
    AR.stepPlane(plane, input, dt);
    if (plane.onGround) {
      plane.pos.y = AR.heightAt(plane.pos.x, plane.pos.z) + 1.5;
      AR.syncMesh(plane);
    }

    // Rings.
    if (AR.checkRing(rings, plane.pos)) {
      state.ringsPassed += 1;
      state.score += C.ringScore;
      AR.chime();
      if (state.ringsPassed >= AR.WAYPOINTS.length) {
        AR.showBanner('COURSE COMPLETE — LAND ON THE RUNWAY!', 4000);
      } else {
        AR.showBanner('RING ' + state.ringsPassed + ' / ' + AR.WAYPOINTS.length + '  +100', 1600);
      }
    }

    // Ground contact: one shared touchdown rule.
    var touch = checkTouchdown(plane);
    if (touch === 'land') landPlane();
    else if (touch === 'crash-terrain') crashPlane('terrain');
    else if (touch === 'crash-ground') crashPlane('ground');
    if (plane.onGround && plane.pos.y - AR.heightAt(plane.pos.x, plane.pos.z) > 3) plane.onGround = false;

    AR.setEngine(state.throttle, plane.speed);
    updateCamera(dt);
    AR.updateHud(state);
  }

  function landPlane() {
    plane.onGround = true;
    plane.pos.y = AR.heightAt(plane.pos.x, plane.pos.z) + 1.5;
    var complete = state.ringsPassed >= AR.WAYPOINTS.length;
    var fuelBonus = Math.round(plane.fuel * 2);
    var timeBonus = complete ? Math.max(0, Math.round(600 - state.time)) : 0;
    state.landedBonus = (complete ? C.landingBonus : 100) + fuelBonus + timeBonus;
    state.score += state.landedBonus;
    state.landedReason = complete
      ? 'MISSION COMPLETE — all 11 rings, safe on the runway.'
      : 'Landed early — ' + state.ringsPassed + ' of 11 rings flown.';
    AR.fanfare();
    document.getElementById('landTitle').textContent = complete ? 'TOUCHDOWN — MISSION COMPLETE!' : 'TOUCHDOWN — LANDED EARLY';
    document.getElementById('landText').textContent = state.landedReason;
    document.getElementById('landScore').textContent =
      'SCORE ' + state.score + '  •  landing ' + state.landedBonus +
      ' (base ' + (complete ? C.landingBonus : 100) + ' + fuel ' + fuelBonus + ' + time ' + timeBonus + ')' +
      '  •  ' + AR.fmtTime(state.time);
    if (state.score > state.best) state.best = state.score;
    setScreen('landed');
    AR.updateHud(state);
  }

  function crashPlane(cause) {
    state.shake = 1;
    AR.thud();
    document.getElementById('crashText').textContent =
      cause === 'terrain'
        ? 'You flew into the mountains. The canyon is not forgiving — but the rings are still waiting.'
        : 'You hit the ground too hard. Flare gently, keep the wings level, and mind your speed.';
    document.getElementById('crashScore').textContent =
      'SCORE ' + state.score + '  •  ' + state.ringsPassed + ' / ' + AR.WAYPOINTS.length + ' rings  •  ' + AR.fmtTime(state.time);
    setScreen('crashed');
  }

  function updateCamera(dt) {
    var fwd = new THREE.Vector3(
      Math.sin(plane.heading) * Math.cos(plane.pitch),
      Math.sin(plane.pitch),
      Math.cos(plane.heading) * Math.cos(plane.pitch));
    var target = new THREE.Vector3().copy(plane.pos)
      .addScaledVector(fwd, -C.camDistance)
      .add(new THREE.Vector3(0, C.camHeight, 0));
    var k = 1 - Math.exp(-4.5 * dt);
    camera.position.lerp(target, k);
    var look = new THREE.Vector3().copy(plane.pos).addScaledVector(fwd, 26);
    look.y += 1;
    if (state.shake > 0) {
      camera.position.x += (Math.random() - 0.5) * state.shake * 1.6;
      camera.position.y += (Math.random() - 0.5) * state.shake * 1.6;
      state.shake = Math.max(0, state.shake - dt * 1.4);
    }
    camera.lookAt(look);
    var fov = C.fovBase + plane.speed * 0.14;
    if (Math.abs(camera.fov - fov) > 0.4) {
      camera.fov = fov;
      camera.updateProjectionMatrix();
    }
  }

  function updateTitleCamera(dt, time) {
    // Slow orbit around the parked plane on the runway.
    var a = time * 0.12;
    camera.position.set(Math.sin(a) * 26, 7 + Math.sin(time * 0.3) * 1.5, plane.pos.z + Math.cos(a) * 26);
    camera.lookAt(plane.pos.x, 3, plane.pos.z + 10);
    if (Math.abs(camera.fov - 55) > 0.4) {
      camera.fov = 55;
      camera.updateProjectionMatrix();
    }
  }

  function loop(now) {
    requestAnimationFrame(loop);
    var dt = Math.min(0.05, (now - clock.last) / 1000 || 0.016);
    clock.last = now;
    var time = now / 1000;
    world.clouds.forEach(function (cloud, i) {
      cloud.position.x += dt * (2 + (i % 3));
      if (cloud.position.x > 1250) cloud.position.x = -1250;
    });
    AR.animateRings(rings, time);
    if (state.screen === 'fly') updateFly(dt);
    else if (state.screen === 'title') updateTitleCamera(dt, time);
    else if (state.screen === 'landed') {
      // Roll out down the runway, along the landing heading.
      plane.speed = Math.max(0, plane.speed - 22 * dt);
      plane.pos.x += Math.sin(plane.heading) * plane.speed * dt;
      plane.pos.z += Math.cos(plane.heading) * plane.speed * dt;
      plane.pos.y = AR.heightAt(plane.pos.x, plane.pos.z) + 1.5;
      AR.syncMesh(plane);
      updateCamera(dt);
      AR.updateHud(state);
    } else if (state.screen === 'crashed') {
      updateCamera(dt);
    }
    renderer.render(scene, camera);
  }

  // Shared with shots.js so the staged landing flies the real touchdown rule.
  AR.checkTouchdown = function (p) { return checkTouchdown(p); };
  AR.landPlane = function () { landPlane(); };
  AR.crashPlane = function (cause) { crashPlane(cause); };

  // Entry point. In shot mode (?shot=takeoff|ring|ridge|landed) the game is
  // staged by shots.js and rendered once, frozen, for the screenshot.
  AR.boot = function () {
    init();
    var params = new URLSearchParams(window.location.search);
    var shot = params.get('shot');
    if (shot) {
      shotMode = shot;
      AR.stageShot(shot, state, plane, rings, updateCamera);
      renderer.render(scene, camera);
      return;
    }
    clock.last = performance.now();
    requestAnimationFrame(loop);
  };
})();
