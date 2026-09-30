
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js';

// SCENE
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x07140e);
scene.fog = new THREE.Fog(0x07140e, 20, 45);

const camera = new THREE.PerspectiveCamera(
  48, innerWidth / innerHeight, 0.1, 100
);
camera.position.set(0, 10, 19);
camera.lookAt(0, 1, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;
document.body.prepend(renderer.domElement);

// LIGHTS
scene.add(new THREE.HemisphereLight(0xc8f6df, 0x203c2a, 2));

const light = new THREE.DirectionalLight(0xffffff, 3);
light.position.set(-5, 12, 7);
light.castShadow = true;
scene.add(light);

// MATERIALS
const green = new THREE.MeshStandardMaterial({ color: 0x197449 });
const white = new THREE.MeshStandardMaterial({ color: 0xe7f8e9 });
const yellow = new THREE.MeshStandardMaterial({ color: 0xd7ff54 });
const orange = new THREE.MeshStandardMaterial({ color: 0xf1a35c });
const dark = new THREE.MeshStandardMaterial({ color: 0x123b29 });

// BOX HELPER
function box(w, h, d, material, x, y, z) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d), material
  );
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);
  return mesh;
}

// FLOOR AND COURT
box(200, 0.2, 200, dark, 0, -0.2, 0);
box(9, 0.1, 18, green, 0, -0.08, 0);

function line(x1, z1, x2, z2) {
  const length = Math.hypot(x2 - x1, z2 - z1);
  const mesh = box(0.045, 0.025, length, white,
    (x1 + x2) / 2, 0, (z1 + z2) / 2);
  mesh.rotation.y = -Math.atan2(x2 - x1, z2 - z1);
}

line(-4.3, -8.5, 4.3, -8.5);
line(-4.3, 8.5, 4.3, 8.5);
line(-4.3, -8.5, -4.3, 8.5);
line(4.3, -8.5, 4.3, 8.5);
line(-4.3, 0, 4.3, 0);
line(-2.1, -8.5, -2.1, 8.5);
line(2.1, -8.5, 2.1, 8.5);

// NET
const netMaterial = new THREE.MeshBasicMaterial({
  color: 0xdce9de,
  wireframe: true
});
const net = new THREE.Mesh(
  new THREE.PlaneGeometry(9, 1.3, 35, 8),
  netMaterial
);
net.position.set(0, 1.5, 0);
scene.add(net);

box(0.1, 2, 0.1, white, -4.5, 1, 0);
box(0.1, 2, 0.1, white, 4.5, 1, 0);

// SIMPLE 3D PLAYER
function createPlayer(color, z) {
  const group = new THREE.Group();
  scene.add(group);
  group.position.set(0, 0, z);

  const body = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.3, 0.65, 5, 10),
    color
  );
  body.position.y = 1.25;
  group.add(body);

  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.22, 16, 16),
    new THREE.MeshStandardMaterial({ color: 0xc28b68 })
  );
  head.position.y = 1.95;
  group.add(head);

  for (const x of [-0.14, 0.14]) {
    const leg = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.1, 0.45, 4, 8),
      dark
    );
    leg.position.set(x, 0.55, 0);
    group.add(leg);
  }

  // RACKET
  const racket = new THREE.Group();
  racket.position.set(0.45, 1.4, -0.1);
  group.add(racket);

  const handle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.025, 0.035, 0.6, 8),
    yellow
  );
  handle.position.y = 0.35;
  racket.add(handle);

  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.24, 0.035, 8, 24),
    white
  );
  ring.position.y = 0.75;
  racket.add(ring);

  return { group, racket };
}

const player = createPlayer(yellow, 5.7);
const cpu = createPlayer(orange, -5.7);
cpu.group.rotation.y = Math.PI;

// SHUTTLECOCK
const shuttle = new THREE.Group();
scene.add(shuttle);

const cork = new THREE.Mesh(
  new THREE.SphereGeometry(0.11, 12, 10),
  white
);
cork.position.y = 0.05;
shuttle.add(cork);

const feather = new THREE.Mesh(
  new THREE.ConeGeometry(0.17, 0.35, 12),
  white
);
feather.rotation.x = Math.PI;
feather.position.y = -0.12;
shuttle.add(feather);

// GAME VARIABLES
let you = 0;
let opponent = 0;
let playing = false;
let inFlight = false;
let lastHit = 0;
let shotBy = 'you';

const velocity = new THREE.Vector3();
const keys = {};

const youScore = document.getElementById('you');
const cpuScore = document.getElementById('cpu');
const status = document.getElementById('status');
const intro = document.getElementById('intro');

// KEYBOARD
window.addEventListener('keydown', event => {
  keys[event.key.toLowerCase()] = true;

  if (event.code === 'Space') {
    event.preventDefault();
    hitShuttle();
  }
});

window.addEventListener('keyup', event => {
  keys[event.key.toLowerCase()] = false;
});

// RESET RALLY
function resetRally() {
  inFlight = false;
  shuttle.position.set(
    player.group.position.x + 0.3,
    2.2,
    player.group.position.z - 0.8
  );
  velocity.set(0, 0, 0);
  status.textContent = 'READY FOR THE NEXT SHOT';
}

// SCORE
function scorePoint(winner) {
  if (!playing) return;

  if (winner === 'you') you++;
  else opponent++;

  youScore.textContent = you;
  cpuScore.textContent = opponent;

  if (you >= 7 || opponent >= 7) {
    playing = false;
    intro.style.display = 'grid';

    document.querySelector('.tag').textContent = 'MATCH COMPLETE';
    document.querySelector('h1').innerHTML =
      you > opponent
        ? 'YOU <br><span>WIN!</span>'
        : 'NEXT <br><span>TIME.</span>';

    document.querySelector('.card > p:not(.tag)').textContent =
      `Final score: ${you} - ${opponent}`;

    document.getElementById('start').textContent = 'PLAY AGAIN →';
    return;
  }

  resetRally();
}

// HIT
function hitShuttle() {
  if (!playing) return;
  if (performance.now() - lastHit < 350) return;

  lastHit = performance.now();

  if (!inFlight) {
    inFlight = true;
    shotBy = 'you';

    shuttle.position.set(
      player.group.position.x,
      2.2,
      player.group.position.z - 0.6
    );

    velocity.set(
      (cpu.group.position.x - player.group.position.x) * 0.3,
      5.8,
      -10
    );

    status.textContent = 'SHUTTLE IN PLAY';
  } else if (
    shotBy === 'cpu' &&
    shuttle.position.z > 2.3 &&
    shuttle.position.z < 8.5 &&
    shuttle.position.y < 3.2 &&
    Math.abs(shuttle.position.x - player.group.position.x) < 2
  ) {
    shotBy = 'you';
    velocity.set(
      (cpu.group.position.x - player.group.position.x) * 0.4,
      5.8,
      -10
    );
    status.textContent = 'NICE RETURN!';
  }
}

document.getElementById('hit').addEventListener('click', hitShuttle);

// START
function startGame() {
  you = 0;
  opponent = 0;
  youScore.textContent = 0;
  cpuScore.textContent = 0;

  player.group.position.set(0, 0, 5.7);
  cpu.group.position.set(0, 0, -5.7);

  intro.style.display = 'none';
  playing = true;
  status.textContent = 'MATCH IN PROGRESS';

  resetRally();
}

document.getElementById('start').addEventListener('click', startGame);

document.getElementById('reset').addEventListener('click', () => {
  startGame();
});

// ANIMATION
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);

  const dt = Math.min(clock.getDelta(), 0.04);

  if (playing) {
    // PLAYER MOVEMENT
    let x = 0;
    let z = 0;

    if (keys.a || keys.arrowleft) x--;
    if (keys.d || keys.arrowright) x++;
    if (keys.w || keys.arrowup) z--;
    if (keys.s || keys.arrowdown) z++;

    const length = Math.hypot(x, z) || 1;
    x /= length;
    z /= length;

    player.group.position.x = THREE.MathUtils.clamp(
      player.group.position.x + x * 5 * dt,
      -3.7, 3.7
    );

    player.group.position.z = THREE.MathUtils.clamp(
      player.group.position.z + z * 5 * dt,
      2.1, 8
    );

    // CPU FOLLOWS SHUTTLE
    if (inFlight && shotBy === 'you') {
      cpu.group.position.x = THREE.MathUtils.damp(
        cpu.group.position.x,
        THREE.MathUtils.clamp(shuttle.position.x, -3.4, 3.4),
        2.2, dt
      );
    }

    // SHUTTLE PHYSICS
    if (inFlight) {
      velocity.y -= 8.5 * dt;
      shuttle.position.addScaledVector(velocity, dt);

      if (
        shotBy === 'you' &&
        shuttle.position.z < -2.5 &&
        shuttle.position.y > 1.0 &&
        Math.abs(shuttle.position.x - cpu.group.position.x) < 1.2 &&
        shuttle.position.y < 3.4
      ) {
        // CPU returns the shot
        shotBy = 'cpu';
        velocity.set(
          (player.group.position.x - cpu.group.position.x) * 0.4,
          5.5,
          9.5
        );
        status.textContent = 'CPU RETURN! HIT AGAIN!';
      }

      if (shuttle.position.y < 0.1) {
        scorePoint(
          shuttle.position.z < 0
            ? 'you'
            : shotBy === 'cpu' ? 'you' : 'cpu'
        );
      }

      if (shuttle.position.z < -8.6) {
        scorePoint('you');
      }

      if (shuttle.position.z > 8.6) {
        scorePoint('cpu');
      }
    }
  } else {
    shuttle.position.y = 2.2 + Math.sin(performance.now() * 0.002) * 0.1;
  }

  // CAMERA
  camera.position.x = THREE.MathUtils.damp(
    camera.position.x,
    player.group.position.x * 0.15,
    1.5, dt
  );
  camera.lookAt(0, 1, 0);

  renderer.render(scene, camera);
}

animate();

// RESIZE
window.addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});
