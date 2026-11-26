// Aeroridge — Canyon Run: the cockpit instruments.
// One clear job: turn the plane's state into the lit HUD — altitude, speed,
// heading, fuel, score, the artificial horizon and the compass strip.
var AR = window.AR || (window.AR = {});

(function () {
  var els = {};
  var horizonCtx = null;
  var compassCtx = null;

  function $(id) { return document.getElementById(id); }

  function initHud() {
    ['alt', 'spd', 'hdg', 'vsi', 'score', 'rings', 'time', 'fuelFill', 'fuelText',
     'banner', 'throttleFill', 'warn'].forEach(function (id) { els[id] = $(id); });
    horizonCtx = $('horizon').getContext('2d');
    compassCtx = $('compass').getContext('2d');
  }

  function fmtTime(seconds) {
    var m = Math.floor(seconds / 60);
    var s = Math.floor(seconds % 60);
    return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
  }

  function headingLabel(deg) {
    var names = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    return names[Math.round(deg / 45) % 8];
  }

  function drawHorizon(pitch, roll) {
    var ctx = horizonCtx;
    var w = 170, h = 170, cx = w / 2, cy = h / 2;
    ctx.save();
    ctx.clearRect(0, 0, w, h);
    ctx.beginPath();
    ctx.arc(cx, cy, 82, 0, Math.PI * 2);
    ctx.clip();
    ctx.translate(cx, cy);
    ctx.rotate(-roll);
    var pitchPx = AR.clamp(pitch, -0.6, 0.6) * 140;
    ctx.translate(0, pitchPx);
    // Sky and ground.
    ctx.fillStyle = '#3f8fd2';
    ctx.fillRect(-120, -220, 240, 220);
    ctx.fillStyle = '#7a5a34';
    ctx.fillRect(-120, 0, 240, 220);
    // Horizon line and pitch ladder.
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-120, 0); ctx.lineTo(120, 0); ctx.stroke();
    ctx.lineWidth = 1;
    [-40, -20, 20, 40].forEach(function (py) {
      ctx.beginPath(); ctx.moveTo(-24, py); ctx.lineTo(24, py); ctx.stroke();
    });
    ctx.restore();
    // Fixed aircraft symbol and bezel.
    ctx.save();
    ctx.strokeStyle = '#ffd34d';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cx - 34, cy); ctx.lineTo(cx - 8, cy);
    ctx.moveTo(cx + 8, cy); ctx.lineTo(cx + 34, cy);
    ctx.moveTo(cx, cy); ctx.lineTo(cx, cy + 8);
    ctx.stroke();
    ctx.strokeStyle = '#e8f2ff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cx, cy, 82, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  function drawCompass(headingDeg) {
    var ctx = compassCtx;
    var w = 360, h = 30;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(8, 18, 32, 0.55)';
    ctx.fillRect(0, 0, w, h);
    var labels = { 0: 'N', 45: 'NE', 90: 'E', 135: 'SE', 180: 'S', 225: 'SW', 270: 'W', 315: 'NW' };
    ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.textAlign = 'center';
    // Ticks every 15 degrees, anchored to the current heading.
    for (var d = -180; d <= 180; d += 15) {
      var deg = ((Math.round(headingDeg) + d) % 360 + 360) % 360;
      var x = w / 2 + d * 2.4;
      if (x < 0 || x > w) continue;
      var major = deg % 45 === 0;
      ctx.strokeStyle = major ? '#ffd34d' : '#9fc3e8';
      ctx.lineWidth = major ? 2 : 1;
      ctx.beginPath(); ctx.moveTo(x, major ? 4 : 10); ctx.lineTo(x, 18); ctx.stroke();
    }
    // Cardinal labels, placed by their true offset from the heading.
    for (var c = 0; c < 360; c += 45) {
      var off = AR.angleDiff(headingDeg * Math.PI / 180, c * Math.PI / 180) * 180 / Math.PI;
      var lx = w / 2 + off * 2.4;
      if (lx < 8 || lx > w - 8) continue;
      ctx.fillStyle = '#ffffff';
      ctx.fillText(labels[c], lx, 28);
    }
    // Centre marker.
    ctx.fillStyle = '#ffd34d';
    ctx.beginPath();
    ctx.moveTo(w / 2 - 6, 0); ctx.lineTo(w / 2 + 6, 0); ctx.lineTo(w / 2, 7);
    ctx.fill();
  }

  function updateHud(state) {
    var plane = state.plane;
    var altFt = Math.max(0, Math.round((plane.pos.y - AR.heightAt(plane.pos.x, plane.pos.z)) * 3.281));
    var agl = plane.pos.y - AR.heightAt(plane.pos.x, plane.pos.z);
    els.alt.textContent = Math.round(plane.pos.y * 3.281) + ' FT';
    els.spd.textContent = Math.round(plane.speed * 1.944) + ' KT';
    var hdg = ((plane.heading * 180 / Math.PI) % 360 + 360) % 360;
    els.hdg.textContent = String(Math.round(hdg)).padStart(3, '0') + '° ' + headingLabel(hdg);
    var vsi = Math.round(plane.verticalSpeed * 196.85);
    els.vsi.textContent = (vsi >= 0 ? '+' : '') + vsi + ' FPM';
    els.score.textContent = String(state.score);
    els.rings.textContent = state.ringsPassed + ' / ' + AR.WAYPOINTS.length;
    els.time.textContent = fmtTime(state.time);
    els.fuelFill.style.width = Math.round(plane.fuel) + '%';
    els.fuelText.textContent = 'FUEL ' + Math.round(plane.fuel) + '%';
    els.fuelFill.className = plane.fuel < 25 ? 'fill low' : 'fill';
    els.throttleFill.style.width = Math.round(plane.throttle * 100) + '%';
    drawHorizon(plane.pitch, plane.roll);
    drawCompass(hdg);

    var warn = '';
    if (state.screen === 'fly') {
      if (plane.speed < AR.CONFIG.stallSpeed && !plane.onGround) warn = '⚠ STALL — ADD THROTTLE';
      else if (plane.fuel < 25) warn = '⚠ LOW FUEL';
      else if (agl < 12 && !plane.onGround) warn = '⚠ PULL UP';
    }
    els.warn.textContent = warn;
  }

  function showBanner(text, ms) {
    els.banner.textContent = text;
    els.banner.classList.add('show');
    clearTimeout(showBanner._t);
    showBanner._t = setTimeout(function () { els.banner.classList.remove('show'); }, ms || 2200);
  }

  AR.initHud = initHud;
  AR.updateHud = updateHud;
  AR.showBanner = showBanner;
  AR.fmtTime = fmtTime;
})();
