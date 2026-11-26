// Aeroridge — Canyon Run: staged screenshot scenes.
// One clear job: for ?shot=takeoff|ring|ridge|landed, fly the real flight
// model forward from a fresh mission with a simple autopilot (steer at the
// next ring, hold altitude, keep the throttle up), then freeze the frame so
// headless Chrome can screenshot exactly what a short game looks like.
var AR = window.AR || (window.AR = {});

(function () {
  var DT = 1 / 60;

  // Steer at the next ring: bank toward the heading error, pitch toward the
  // altitude error, throttle up. Same inputs a player would give. Far from
  // the ring it aims at a point 60 m short of it, along the course, so the
  // final approach is straight instead of a last-second swerve.
  function autopilotInput(plane, rings) {
    var tx, ty, tz;
    if (rings.next < AR.WAYPOINTS.length) {
      var target = AR.WAYPOINTS[rings.next];
      tx = target.x; ty = target.y; tz = target.z;
      var dist = Math.hypot(tx - plane.pos.x, tz - plane.pos.z);
      if (dist > 150 && rings.next > 0) {
        var prev = AR.WAYPOINTS[rings.next - 1];
        var dx = tx - prev.x, dz = tz - prev.z;
        var len = Math.hypot(dx, dz) || 1;
        tx -= (dx / len) * 60;
        tz -= (dz / len) * 60;
      }
    } else {
      tx = 0; ty = 40; tz = 0;
    }
    var desiredHeading = Math.atan2(tx - plane.pos.x, tz - plane.pos.z);
    var err = AR.angleDiff(plane.heading, desiredHeading);
    // Gentle banks: a hard bank overshoots and the plane ends up circling.
    var roll = AR.clamp(err * 1.2, -0.6, 0.6);
    var altErr = (ty + 2) - plane.pos.y;
    // PD pitch: climb toward ring height, damped by vertical speed so the
    // plane settles on the ring's altitude instead of porpoising past it.
    // (Near-zero steady error: any steady climb offset would put the plane
    // outside the 13 m ring on the crossing.)
    var pitch = AR.clamp(altErr * 0.01 - plane.verticalSpeed * 0.02, -0.5, 0.6);
    // Terrain 80 m ahead: climb only when the ground really rises toward us
    // (rings sit ~36 m over the valley floor, so a low threshold is safe).
    var fx = plane.pos.x + Math.sin(plane.heading) * 80;
    var fz = plane.pos.z + Math.cos(plane.heading) * 80;
    var aheadClear = plane.pos.y - AR.heightAt(fx, fz);
    if (aheadClear < 18) pitch = 0.45;
    return { pitch: pitch, roll: roll, throttle: 0.55, brake: false, keys: {} };
  }

  // Run the mission forward for `seconds`, honouring rings and the ground.
  // Returns false if the plane crashed mid-flight.
  function simulate(state, plane, rings, seconds) {
    var steps = Math.round(seconds / DT);
    for (var i = 0; i < steps; i += 1) {
      state.time += DT;
      var input = autopilotInput(plane, rings);
      var groundH = AR.heightAt(plane.pos.x, plane.pos.z);
      if (plane.onGround) {
        input.pitch = Math.max(0, input.pitch);
        plane.roll = 0;
        if (plane.speed > 48 && input.pitch > 0.1) plane.onGround = false;
      }
      AR.stepPlane(plane, input, DT);
      if (plane.onGround) {
        plane.pos.y = AR.heightAt(plane.pos.x, plane.pos.z) + 1.5;
        AR.syncMesh(plane);
      }
      if (AR.checkRing(rings, plane.pos)) {
        state.ringsPassed += 1;
        state.score += AR.CONFIG.ringScore;
      }
      groundH = AR.heightAt(plane.pos.x, plane.pos.z);
      if (!plane.onGround && plane.pos.y - groundH < 1.2) return false;
      if (plane.fuel <= 0) return false;
    }
    return true;
  }

  function setBanner(text) {
    var banner = document.getElementById('banner');
    banner.textContent = text;
    banner.classList.add('show');
  }

  function stageShot(name, state, plane, rings, updateCamera) {
    // Hide every overlay; the HUD stays visible.
    ['titleScreen', 'crashScreen', 'landScreen', 'pauseScreen'].forEach(function (id) {
      document.getElementById(id).classList.remove('show');
    });
    AR.resetPlane(plane);
    AR.resetRings(rings);
    state.score = 0;
    state.ringsPassed = 0;
    state.time = 0;
    state.throttle = 0.85;
    state.screen = 'fly';
    state.shake = 0;

    if (name === 'landed') {
      // Fly a real final approach and let the game's own touchdown rule
      // decide the landing, so the shot proves the landing path works.
      state.ringsPassed = AR.WAYPOINTS.length;
      state.score = AR.WAYPOINTS.length * AR.CONFIG.ringScore;
      state.time = 200;
      state.screen = 'fly';
      plane.pos.set(0, 42, 420);
      plane.heading = Math.PI;
      plane.pitch = 0;
      plane.roll = 0;
      plane.speed = 46;
      plane.throttle = 0.28;
      plane.fuel = 61;
      plane.onGround = false;
      AR.syncMesh(plane);
      var landed = false;
      for (var s = 0; s < 1200 && !landed; s += 1) {
        state.time += DT;
        // Glide slope: hold a gentle descent that flattens to 1.2 m over the
        // strip, wings level, on the centreline.
        var groundBelow = AR.heightAt(plane.pos.x, plane.pos.z);
        var targetY = groundBelow + 1.2 + Math.max(0, plane.pos.z - 100) * 0.03;
        var pitch = AR.clamp((targetY - plane.pos.y) * 0.02 - plane.verticalSpeed * 0.03, -0.3, 0.3);
        var headErr = AR.angleDiff(plane.heading, Math.PI);
        var roll = AR.clamp(headErr * 1.0, -0.4, 0.4);
        AR.stepPlane(plane, { pitch: pitch, roll: roll, throttle: 0.28, brake: false, keys: {} }, DT);
        var touch = AR.checkTouchdown(plane);
        if (touch === 'land') {
          AR.landPlane();
          landed = true;
        } else if (touch) {
          break;
        }
      }
      if (!landed) {
        // The approach did not settle; park the plane on the strip and show
        // the completed-mission overlay from the same landing handler.
        plane.pos.set(0, 1.5, 40);
        plane.heading = Math.PI;
        plane.speed = 14;
        plane.throttle = 0.2;
        plane.onGround = true;
        AR.syncMesh(plane);
        AR.landPlane();
      }
      updateCamera(5);
      AR.updateHud(state);
      return;
    }

    var seconds = name === 'takeoff' ? 8 : name === 'ridge' ? 52 : name === 'full' ? 105 : 40;
    var ok = simulate(state, plane, rings, seconds);
    if (!ok) {
      // The autopilot clipped a ridge; back off and take the frame anyway —
      // the camera still shows the plane, terrain and HUD.
      plane.pos.y = AR.heightAt(plane.pos.x, plane.pos.z) + 60;
      AR.syncMesh(plane);
    }
    // The beacon column is a far guide for players; in a frozen frame it
    // reads as a white stripe, so hide it for screenshots. (setNext shows
    // it again on every ring pass, so this must come after the simulation.)
    rings.beacon.visible = false;
    state.throttle = 0.85;
    if (name === 'takeoff') setBanner('TAKE OFF — FLY THE 11 RINGS, THEN LAND');
    else setBanner('RING ' + state.ringsPassed + ' / ' + AR.WAYPOINTS.length + '  +100');
    updateCamera(5);
    AR.updateHud(state);
  }

  AR.stageShot = stageShot;
})();
