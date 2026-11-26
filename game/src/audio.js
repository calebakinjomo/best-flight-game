// Aeroridge — Canyon Run: procedural sound, no audio files.
// One clear job: engine hum, wind, ring chimes and the crash thud, all
// synthesised with WebAudio after the player's first gesture.
var AR = window.AR || (window.AR = {});

(function () {
  var ctx = null;
  var engineOsc1 = null, engineOsc2 = null, engineGain = null, windGain = null;
  var muted = false;
  var started = false;

  function ensureAudio() {
    if (started) return;
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      ctx = new AC();
      started = true;
      // Engine: two detuned saws through a low-pass, pitch follows throttle.
      engineOsc1 = ctx.createOscillator();
      engineOsc1.type = 'sawtooth';
      engineOsc1.frequency.value = 55;
      engineOsc2 = ctx.createOscillator();
      engineOsc2.type = 'sawtooth';
      engineOsc2.frequency.value = 82;
      var filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 420;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      engineOsc1.connect(filter);
      engineOsc2.connect(filter);
      filter.connect(engineGain);
      engineGain.connect(ctx.destination);
      engineOsc1.start();
      engineOsc2.start();
      // Wind: looped noise buffer, gain follows speed.
      var len = ctx.sampleRate * 2;
      var buf = ctx.createBuffer(1, len, ctx.sampleRate);
      var data = buf.getChannelData(0);
      for (var i = 0; i < len; i += 1) data[i] = Math.random() * 2 - 1;
      var noise = ctx.createBufferSource();
      noise.buffer = buf;
      noise.loop = true;
      var windFilter = ctx.createBiquadFilter();
      windFilter.type = 'bandpass';
      windFilter.frequency.value = 500;
      windGain = ctx.createGain();
      windGain.gain.value = 0;
      noise.connect(windFilter);
      windFilter.connect(windGain);
      windGain.connect(ctx.destination);
      noise.start();
    } catch (e) {
      started = false;
    }
  }

  function setEngine(throttle, speed) {
    if (!started || muted) return;
    var t = ctx.currentTime;
    engineGain.gain.setTargetAtTime(0.05 + throttle * 0.09, t, 0.1);
    engineOsc1.frequency.setTargetAtTime(50 + throttle * 90, t, 0.1);
    engineOsc2.frequency.setTargetAtTime(75 + throttle * 135, t, 0.1);
    windGain.gain.setTargetAtTime(Math.max(0, (speed - 30) / 70) * 0.12, t, 0.2);
  }

  function chime() {
    if (!started || muted) return;
    [880, 1174, 1568].forEach(function (freq, i) {
      var osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;
      var gain = ctx.createGain();
      var t0 = ctx.currentTime + i * 0.07;
      gain.gain.setValueAtTime(0, t0);
      gain.gain.linearRampToValueAtTime(0.22, t0 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.5);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t0);
      osc.stop(t0 + 0.55);
    });
  }

  function thud() {
    if (!started || muted) return;
    var len = ctx.sampleRate * 0.5;
    var buf = ctx.createBuffer(1, len, ctx.sampleRate);
    var data = buf.getChannelData(0);
    for (var i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    var src = ctx.createBufferSource();
    src.buffer = buf;
    var gain = ctx.createGain();
    gain.gain.value = 0.5;
    var filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 220;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    src.start();
  }

  function fanfare() {
    if (!started || muted) return;
    [523, 659, 784, 1046].forEach(function (freq, i) {
      var osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = freq;
      var gain = ctx.createGain();
      var t0 = ctx.currentTime + i * 0.12;
      gain.gain.setValueAtTime(0, t0);
      gain.gain.linearRampToValueAtTime(0.2, t0 + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.7);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t0);
      osc.stop(t0 + 0.75);
    });
  }

  function toggleMute() {
    muted = !muted;
    if (ctx) {
      if (muted) {
        engineGain.gain.value = 0;
        windGain.gain.value = 0;
      }
    }
    return muted;
  }

  AR.ensureAudio = ensureAudio;
  AR.setEngine = setEngine;
  AR.chime = chime;
  AR.thud = thud;
  AR.fanfare = fanfare;
  AR.toggleMute = toggleMute;
})();
