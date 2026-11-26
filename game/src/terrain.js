// Aeroridge — Canyon Run: the world you fly over.
// One clear job: build the Three.js scene — sky, terrain, lakes, runway,
// hangars, clouds and sun — from the height field in noise.js.
var AR = window.AR || (window.AR = {});

(function () {
  var C = AR.CONFIG;

  function buildSky(scene) {
    var geo = new THREE.SphereGeometry(4200, 24, 16);
    var mat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        top: { value: new THREE.Color(0x2e6fc4) },
        mid: { value: new THREE.Color(0x7fb4e6) },
        low: { value: new THREE.Color(0xd8ecff) },
      },
      vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'varying vec3 vP; uniform vec3 top; uniform vec3 mid; uniform vec3 low;' +
        'void main(){ float h = normalize(vP).y;' +
        ' vec3 c = h > 0.25 ? mix(mid, top, smoothstep(0.25, 0.9, h)) : mix(low, mid, smoothstep(-0.05, 0.25, h));' +
        ' gl_FragColor = vec4(c, 1.0); }',
    });
    var dome = new THREE.Mesh(geo, mat);
    dome.position.set(0, 0, C.worldCentreZ);
    scene.add(dome);

    scene.add(new THREE.AmbientLight(0xbcd6ff, 0.95));
    var sun = new THREE.DirectionalLight(0xfff2d8, 1.9);
    sun.position.set(-600, 900, 300);
    scene.add(sun);
    // Fill light from the opposite side so the plane's shadow side never
    // reads as a black silhouette.
    var fill = new THREE.DirectionalLight(0xdfeaff, 0.55);
    fill.position.set(700, 400, -600);
    scene.add(fill);
    var hemi = new THREE.HemisphereLight(0x9cc4ee, 0x5d7a4a, 0.65);
    scene.add(hemi);
    scene.fog = new THREE.Fog(0xcfe4f7, 700, 3400);

    // Sun disc: a soft glowing sprite made at runtime, no image file.
    var cv = document.createElement('canvas');
    cv.width = 128; cv.height = 128;
    var g = cv.getContext('2d');
    var grad = g.createRadialGradient(64, 64, 4, 64, 64, 64);
    grad.addColorStop(0, 'rgba(255,250,220,1)');
    grad.addColorStop(0.25, 'rgba(255,236,170,0.9)');
    grad.addColorStop(1, 'rgba(255,236,170,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 128, 128);
    var tex = new THREE.CanvasTexture(cv);
    var sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
    sprite.position.set(-2400, 1500, -600);
    sprite.scale.set(900, 900, 1);
    scene.add(sprite);
  }

  function buildTerrain(scene) {
    var w = C.worldSizeX, d = C.worldSizeZ;
    var geo = new THREE.PlaneGeometry(w, d, C.terrainSegments, C.terrainSegments);
    geo.rotateX(-Math.PI / 2);
    var pos = geo.attributes.position;
    var colors = new Float32Array(pos.count * 3);
    for (var i = 0; i < pos.count; i += 1) {
      var x = pos.getX(i);
      var z = pos.getZ(i) + C.worldCentreZ;
      var h = AR.heightAt(x, z);
      pos.setY(i, h);
      var col = AR.groundColor(x, z, h);
      colors[i * 3] = col[0];
      colors[i * 3 + 1] = col[1];
      colors[i * 3 + 2] = col[2];
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    var mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true }));
    mesh.position.set(0, 0, C.worldCentreZ);
    scene.add(mesh);
  }

  function buildLakes(scene) {
    var mat = new THREE.MeshPhongMaterial({ color: 0x2f7fc9, shininess: 120, specular: 0x99ccff });
    var lakes = [
      { x: -330, z: 640, r: 95 },
      { x: 360, z: 1620, r: 70 },
    ];
    lakes.forEach(function (lake) {
      var disc = new THREE.Mesh(new THREE.CircleGeometry(lake.r, 36), mat);
      disc.rotation.x = -Math.PI / 2;
      disc.position.set(lake.x, 2.5, lake.z);
      scene.add(disc);
      // Sandy shore ring.
      var shore = new THREE.Mesh(new THREE.RingGeometry(lake.r, lake.r + 14, 36),
        new THREE.MeshLambertMaterial({ color: 0xc2a878 }));
      shore.rotation.x = -Math.PI / 2;
      shore.position.set(lake.x, 2.6, lake.z);
      scene.add(shore);
    });
  }

  function buildRunway(scene) {
    var group = new THREE.Group();
    var asphalt = new THREE.Mesh(
      new THREE.BoxGeometry(AR.RUNWAY.width, 0.5, AR.RUNWAY.length),
      new THREE.MeshLambertMaterial({ color: 0x3a3f46 }));
    asphalt.position.y = 0.25;
    group.add(asphalt);
    // Centreline dashes.
    var dashMat = new THREE.MeshBasicMaterial({ color: 0xf5f5f5 });
    for (var z = -130; z <= 130; z += 22) {
      var dash = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.1, 9), dashMat);
      dash.position.set(0, 0.55, z);
      group.add(dash);
    }
    // Threshold bars at both ends.
    for (var side = -1; side <= 1; side += 2) {
      for (var k = -2; k <= 2; k += 1) {
        var bar = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.1, 10), dashMat);
        bar.position.set(k * 2.6, 0.55, side * 138);
        group.add(bar);
      }
    }
    // Edge lights, warm amber, lit.
    var lightMat = new THREE.MeshBasicMaterial({ color: 0xffc861 });
    for (var e = -140; e <= 140; e += 20) {
      [-8.6, 8.6].forEach(function (x) {
        var bulb = new THREE.Mesh(new THREE.SphereGeometry(0.45, 8, 6), lightMat);
        bulb.position.set(x, 0.9, e);
        group.add(bulb);
      });
    }
    group.position.set(AR.RUNWAY.x, 0, AR.RUNWAY.z);
    scene.add(group);

    // Hangars and a control tower beside the strip.
    var hangarMat = new THREE.MeshLambertMaterial({ color: 0xd8dde2 });
    var doorMat = new THREE.MeshLambertMaterial({ color: 0x4a6b8a });
    [[42, -150, 0], [42, -115, 0]].forEach(function (spot) {
      var hangar = new THREE.Mesh(new THREE.BoxGeometry(22, 9, 18), hangarMat);
      hangar.position.set(spot[0], 4.5, spot[1]);
      scene.add(hangar);
      var roof = new THREE.Mesh(new THREE.CylinderGeometry(9, 9, 22, 12, 1, false, 0, Math.PI),
        new THREE.MeshLambertMaterial({ color: 0x8a939c }));
      roof.rotation.z = Math.PI / 2;
      roof.rotation.y = Math.PI / 2;
      roof.position.set(spot[0], 9, spot[1]);
      scene.add(roof);
      var door = new THREE.Mesh(new THREE.BoxGeometry(16, 7, 0.4), doorMat);
      door.position.set(spot[0] - 11.1, 3.5, spot[1]);
      door.rotation.y = -Math.PI / 2;
      scene.add(door);
    });
    var tower = new THREE.Mesh(new THREE.CylinderGeometry(3, 4, 26, 10),
      new THREE.MeshLambertMaterial({ color: 0xe8e2d4 }));
    tower.position.set(-34, 13, -150);
    scene.add(tower);
    var cab = new THREE.Mesh(new THREE.CylinderGeometry(5.5, 4.5, 5, 10),
      new THREE.MeshPhongMaterial({ color: 0x2c4a66, shininess: 80 }));
    cab.position.set(-34, 28, -150);
    scene.add(cab);

    // Windsock: pole + orange cone, always pointing downwind.
    var pole = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 9, 8),
      new THREE.MeshLambertMaterial({ color: 0xdddddd }));
    pole.position.set(24, 4.5, -120);
    scene.add(pole);
    var sock = new THREE.Mesh(new THREE.ConeGeometry(1.1, 4.5, 10),
      new THREE.MeshLambertMaterial({ color: 0xff7a1a }));
    sock.rotation.z = Math.PI / 2;
    sock.position.set(26.4, 8.6, -120);
    scene.add(sock);
  }

  function buildClouds(scene) {
    var rng = AR.mulberry32(20261126);
    var mat = new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.92 });
    var clouds = [];
    for (var i = 0; i < 42; i += 1) {
      var cloud = new THREE.Group();
      var puffs = 3 + Math.floor(rng() * 3);
      for (var p = 0; p < puffs; p += 1) {
        var s = 14 + rng() * 22;
        var ball = new THREE.Mesh(new THREE.SphereGeometry(s, 10, 8), mat);
        ball.position.set((rng() - 0.5) * 60, (rng() - 0.5) * 8, (rng() - 0.5) * 30);
        ball.scale.y = 0.62;
        cloud.add(ball);
      }
      cloud.position.set((rng() - 0.5) * 2200, 200 + rng() * 110, (rng() - 0.5) * 2400 + C.worldCentreZ);
      scene.add(cloud);
      clouds.push(cloud);
    }
    return clouds;
  }

  AR.buildWorld = function (scene) {
    buildSky(scene);
    buildTerrain(scene);
    buildLakes(scene);
    buildRunway(scene);
    var clouds = buildClouds(scene);
    return { clouds: clouds };
  };
})();
