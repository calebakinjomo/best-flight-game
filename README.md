# Aeroridge — Canyon Run

[![make.fun bounty](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)
[![rank](https://make.fun/badge/best-flight-game-20261126-0057/calebakinjomo/best-flight-game/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)
[![reward](https://make.fun/badge/best-flight-game-20261126-0057/calebakinjomo/best-flight-game/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)

A 3D flight game for the [make.fun best flight game bounty](https://make.fun/bounty/best-flight-game-20261126-0057).
Take off from Ridgefield strip in a single-prop tourer, thread **11 glowing rings**
down a canyon valley past lakes and snow-capped ridges, then bring her home and
land on the runway — before the fuel runs dry. Low and fast scores the rings;
gentle and slow wins the landing.

## Play

Open `game/index.html` in desktop Chrome (or serve `game/` with any static
server). No network request, no build step, no sign-up — just fly.

| Control | Action |
| --- | --- |
| **W / S** or **↑ / ↓** | Pitch (climb / descend) |
| **A / D** or **← / →** | Bank and turn |
| **Mouse** | Steer toward the pointer |
| **Wheel** or **Shift / Ctrl** | Throttle |
| **Space** | Airbrake |
| **P** | Pause |
| **M** | Sound on/off |
| **R** | Restart |

## The mission

- **Take off** from Ridgefield strip (the plane lifts off above ~90 kt with the nose up).
- **Fly the rings**: 11 glowing orange rings thread the valley; each one is +100
  points, turns green once flown, and the next one is marked by a light beacon.
- **Mind the fuel**: full throttle burns it fast — a dry tank means gliding home.
  Below stall speed (~82 kt) the plane sinks, and the terrain does not forgive.
- **Land**: after the last ring, line up on the runway heading south, flare
  gently, and touch down level and slow. Landing bonus: 400 base + fuel left × 2
  + time bonus. Land early and you keep the rings you flew, but no time bonus.
- **Crash** into a ridge or slam the ground and the sortie is over — press R
  and fly again.

## Instruments

The HUD is a lit cockpit: altitude (ft), airspeed (kt), heading (° magnetic),
vertical speed, an artificial horizon, a compass strip, throttle gauge, fuel
gauge, score, rings flown and mission time. Engine hum, wind, ring chimes and
the crash thud are synthesised live with WebAudio — no audio files.

## Files

- `game/index.html` — the page: canvas, lit HUD, title / crash / landing screens.
- `game/vendor/three.min.js` — Three.js r160 (vendored, minified).
- `game/src/config.js` — tuning constants and the 11-ring course.
- `game/src/noise.js` — the terrain height field: ridged mountains, the carved
  valley, the flat runway apron, and ground colours.
- `game/src/terrain.js` — the world: sky dome, terrain mesh, lakes, runway,
  hangars, control tower, windsock and drifting clouds.
- `game/src/plane.js` — the aircraft (built from primitives) and its flight
  model: throttle, bank, pitch, stall, fuel.
- `game/src/rings.js` — the ring course, the next-ring beacon and pass detection.
- `game/src/hud.js` — the lit instruments: altitude, speed, heading, attitude,
  compass, fuel and score.
- `game/src/input.js` — keyboard and mouse.
- `game/src/audio.js` — procedural WebAudio: engine, wind, chimes, thud.
- `game/src/shots.js` — staged screenshot scenes: the real flight model flown
  forward by an autopilot (`?shot=takeoff|ring|ridge|landed`), plus a full-course
  check (`?shot=full`).
- `game/src/main.js` — the loop, the screens, the mission rules and the chase camera.
- `screenshots/` — real renders of the game running in a browser.
- `main.ts` — the entry program: copies `game/` + `screenshots/` to `/output`
  and writes `/output/dossier.json`.
- `vendor/makefun-game.ts` — the kit's dossier library, unchanged.

## Screenshots

1. **Takeoff** — the tourer climbing out with ring 1 dead ahead.
2. **Ring run** — mid-valley, five rings down, the next ring ahead.
3. **Ridge turn** — banking through the far-end turn, seven rings down.
4. **Touchdown** — mission complete, safe on the runway.

## License

MIT — see [LICENSE](LICENSE).
