// Aeroridge — Canyon Run: keyboard and mouse.
// One clear job: read the pilot's hands — arrows/WASD, W/S throttle, mouse
// steering and wheel throttle — and hand the game one clean input each frame.
var AR = window.AR || (window.AR = {});

(function () {
  var keys = {};
  var mouse = { x: 0, y: 0, active: false, lastMove: 0 };
  var callbacks = {};

  function initInput(cb) {
    callbacks = cb || {};
    window.addEventListener('keydown', function (e) {
      if (e.repeat) return;
      keys[e.code] = true;
      if (callbacks.onKey) callbacks.onKey(e.code);
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].indexOf(e.code) >= 0) e.preventDefault();
    });
    window.addEventListener('keyup', function (e) { keys[e.code] = false; });
    window.addEventListener('mousemove', function (e) {
      mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
      mouse.y = (e.clientY / window.innerHeight) * 2 - 1;
      mouse.active = true;
      mouse.lastMove = performance.now();
    });
    window.addEventListener('wheel', function (e) {
      if (callbacks.onWheel) callbacks.onWheel(e.deltaY < 0 ? 1 : -1);
    }, { passive: true });
    window.addEventListener('blur', function () { keys = {}; });
  }

  // Current flight input. Keyboard wins while a key is held; otherwise the
  // mouse steers toward where it points (recent movement only).
  function readInput(throttle) {
    var pitch = 0, roll = 0;
    var keyPitch = (keys.ArrowUp || keys.KeyW ? 1 : 0) - (keys.ArrowDown || keys.KeyS ? 1 : 0);
    var keyRoll = (keys.ArrowRight || keys.KeyD ? 1 : 0) - (keys.ArrowLeft || keys.KeyA ? 1 : 0);
    var mouseFresh = mouse.active && performance.now() - mouse.lastMove < 1500;
    if (keyPitch !== 0 || keyRoll !== 0) {
      pitch = keyPitch;
      roll = keyRoll;
    } else if (mouseFresh) {
      roll = AR.clamp(mouse.x * 1.4, -1, 1);
      pitch = AR.clamp(-mouse.y * 1.2, -1, 1);
    }
    // Throttle is owned by the game loop (Shift/Ctrl ramp it over time, the
    // wheel nudges it); here it passes through unchanged.
    return {
      pitch: pitch,
      roll: roll,
      throttle: AR.clamp(throttle, 0, 1),
      brake: !!keys.Space,
      keys: keys,
    };
  }

  AR.initInput = initInput;
  AR.readInput = readInput;
})();
