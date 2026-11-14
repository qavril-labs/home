// 3D hero scene for the homepage: every module orbits one ledger core, and pulses of data
// travel from each module into the core, the way every sale, bill and pay run posts to one book.
// Loaded only on desktops that allow motion and have WebGL. The CSS scene stays underneath as the fallback.
import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js";

function hasWebGL() {
  try {
    const canvas = document.createElement("canvas");
    return !!(canvas.getContext("webgl2") || canvas.getContext("webgl"));
  } catch (error) {
    return false;
  }
}

export function mount(container) {
  if (!container || !hasWebGL()) return Promise.reject(new Error("WebGL is not available"));
  const host = container.parentElement;

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
  camera.position.set(0, 1.4, 8.2);
  camera.lookAt(0, 0, 0);

  scene.add(new THREE.AmbientLight(0xffffff, 0.75));
  const key = new THREE.DirectionalLight(0xffffff, 1.3);
  key.position.set(3, 5, 5);
  scene.add(key);
  const glow = new THREE.PointLight(0xc6ff3d, 9, 10);
  scene.add(glow);
  const pink = new THREE.PointLight(0xff4fa3, 5, 14);
  pink.position.set(-4, -2, 3);
  scene.add(pink);

  // The ledger core: a faceted gem with a wireframe shell.
  const core = new THREE.Group();
  const gem = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.95, 1),
    new THREE.MeshStandardMaterial({ color: 0xc6ff3d, emissive: 0x3a5200, metalness: 0.3, roughness: 0.25, flatShading: true }),
  );
  const shell = new THREE.Mesh(
    new THREE.IcosahedronGeometry(1.35, 1),
    new THREE.MeshBasicMaterial({ color: 0x8b6bff, wireframe: true, transparent: true, opacity: 0.55 }),
  );
  core.add(gem, shell);
  scene.add(core);

  // Six modules on a tilted orbit, one per brand colour.
  const colours = [0xffe14d, 0xff4fa3, 0x3de8ff, 0x8b6bff, 0xc6ff3d, 0xff8a3d];
  const orbit = new THREE.Group();
  orbit.rotation.x = 0.42;
  scene.add(orbit);
  const radius = 2.9;
  const nodes = colours.map((colour, index) => {
    const angle = (index / colours.length) * Math.PI * 2;
    const node = new THREE.Mesh(
      new THREE.BoxGeometry(0.62, 0.62, 0.62),
      new THREE.MeshStandardMaterial({ color: colour, metalness: 0.2, roughness: 0.3 }),
    );
    node.position.set(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
    orbit.add(node);
    // A thin spoke from the module to the core.
    const spoke = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), node.position.clone()]),
      new THREE.LineBasicMaterial({ color: colour, transparent: true, opacity: 0.35 }),
    );
    orbit.add(spoke);
    return { node, colour, angle };
  });

  const track = new THREE.Mesh(
    new THREE.TorusGeometry(radius, 0.015, 10, 200),
    new THREE.MeshBasicMaterial({ color: 0x8b6bff, transparent: true, opacity: 0.6 }),
  );
  track.rotation.x = Math.PI / 2;
  orbit.add(track);

  // Data pulses: small spheres that travel from a module into the core, then restart.
  const pulses = [];
  for (let i = 0; i < 18; i += 1) {
    const source = nodes[i % nodes.length];
    const pulse = new THREE.Mesh(
      new THREE.SphereGeometry(0.07, 12, 12),
      new THREE.MeshBasicMaterial({ color: source.colour }),
    );
    orbit.add(pulse);
    pulses.push({ pulse, source, offset: Math.random(), speed: 0.35 + Math.random() * 0.35 });
  }

  // Background star dust.
  const count = 260;
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i += 1) {
    const r = 4.2 + Math.random() * 3;
    const a = Math.random() * Math.PI * 2;
    positions[i * 3] = Math.cos(a) * r;
    positions[i * 3 + 1] = (Math.random() - 0.5) * 5;
    positions[i * 3 + 2] = Math.sin(a) * r;
  }
  const dustGeometry = new THREE.BufferGeometry();
  dustGeometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const dust = new THREE.Points(dustGeometry, new THREE.PointsMaterial({ color: 0x8b6bff, size: 0.045, transparent: true, opacity: 0.6 }));
  scene.add(dust);

  // The whole scene leans toward the pointer.
  const aim = { x: 0, y: 0 };
  const eased = { x: 0, y: 0 };
  window.addEventListener(
    "pointermove",
    (event) => {
      const box = host.getBoundingClientRect();
      aim.x = ((event.clientX - box.left) / box.width - 0.5) * 2;
      aim.y = ((event.clientY - box.top) / box.height - 0.5) * 2;
    },
    { passive: true },
  );

  const clock = new THREE.Clock();
  let visible = true;
  let frame = 0;

  function resize() {
    const width = container.clientWidth;
    const height = container.clientHeight;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }

  function tick() {
    frame = 0;
    if (!visible || document.hidden) return;
    const time = clock.getElapsedTime();
    eased.x += (aim.x - eased.x) * 0.06;
    eased.y += (aim.y - eased.y) * 0.06;

    orbit.rotation.y = time * 0.22 + eased.x * 0.5;
    orbit.rotation.x = 0.42 + eased.y * 0.18;
    gem.rotation.y = time * 0.6;
    gem.rotation.x = time * 0.25;
    shell.rotation.y = -time * 0.3;
    const beat = 1 + Math.sin(time * 2.4) * 0.04;
    core.scale.setScalar(beat);
    glow.intensity = 8 + Math.sin(time * 2.4) * 2;

    nodes.forEach(({ node }, index) => {
      node.rotation.x = time * 0.8 + index;
      node.rotation.y = time * 0.6 + index;
      node.position.y = Math.sin(time * 1.4 + index) * 0.18;
    });
    pulses.forEach((p) => {
      const t = (time * p.speed + p.offset) % 1;
      p.pulse.position.copy(p.source.node.position).multiplyScalar(1 - t);
      p.pulse.scale.setScalar(1 - t * 0.5);
    });
    dust.rotation.y = time * 0.04;
    renderer.render(scene, camera);
    frame = requestAnimationFrame(tick);
  }

  new ResizeObserver(resize).observe(container);
  resize();

  // Stop rendering when the scene is off screen or the tab is hidden.
  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    if (visible && !frame) tick();
  }).observe(container);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && visible && !frame) tick();
  });

  tick();
  host.classList.add("is-3d");
  return Promise.resolve();
}
