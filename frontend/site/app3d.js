// 3D "money city" for the dashboard header. Each month is a pair of columns (sales, expenses) and a
// coin stack beside them shows cash. Built from the same overview data as the flat chart, which stays
// on the page as the accessible version. Loaded only on desktops that allow motion and have WebGL.
import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js";

// Same validated colours as the 2D chart: violet for sales, orange for expenses.
const SALES = 0x6250d6;
const EXPENSES = 0xeb6834;
const CASH = 0xc6ff3d;

function hasWebGL() {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch (e) {
    return false;
  }
}

export function mount(container, data, labels) {
  if (!container || !hasWebGL()) throw new Error("WebGL is not available");

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
  scene.add(new THREE.AmbientLight(0xffffff, 0.8));
  const sun = new THREE.DirectionalLight(0xffffff, 1.2);
  sun.position.set(4, 8, 6);
  scene.add(sun);
  const rim = new THREE.PointLight(0xff4fa3, 4, 20);
  rim.position.set(-6, 3, -4);
  scene.add(rim);

  const city = new THREE.Group();
  scene.add(city);

  // Floor grid: a plinth with month lines, so heights read against a baseline.
  const plinth = new THREE.Mesh(
    new THREE.BoxGeometry(9.4, 0.12, 3.2),
    new THREE.MeshStandardMaterial({ color: 0x16122e, roughness: 0.8 }),
  );
  plinth.position.y = -0.06;
  city.add(plinth);

  const columns = [];
  const columnGeometry = new THREE.BoxGeometry(0.42, 1, 0.42);
  columnGeometry.translate(0, 0.5, 0);
  for (let i = 0; i < 6; i += 1) {
    const x = -3.6 + i * 1.25;
    for (const [j, colour] of [[0, SALES], [1, EXPENSES]]) {
      const mesh = new THREE.Mesh(columnGeometry, new THREE.MeshStandardMaterial({ color: colour, roughness: 0.35, metalness: 0.15 }));
      mesh.position.set(x + (j === 0 ? -0.24 : 0.24), 0, 0.2);
      mesh.scale.y = 0.001;
      city.add(mesh);
      columns.push({ mesh, target: 0.001, month: i, series: j });
    }
  }

  // Coin stack for cash, at the right end.
  const coins = new THREE.Group();
  coins.position.set(4.15, 0, 0.2);
  city.add(coins);
  const coinGeometry = new THREE.CylinderGeometry(0.42, 0.42, 0.11, 32);
  const coinMaterial = new THREE.MeshStandardMaterial({ color: CASH, metalness: 0.55, roughness: 0.25, emissive: 0x233300 });
  let coinTarget = 0;

  // Floating month labels and value tags drawn as sprites from canvas text.
  function textSprite(text, colour) {
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext("2d");
    ctx.font = "700 34px Space Grotesk, sans-serif";
    ctx.fillStyle = colour;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, 128, 32);
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(canvas), transparent: true, depthWrite: false }));
    sprite.scale.set(1.6, 0.4, 1);
    return sprite;
  }
  const monthSprites = [];
  function setLabels(names) {
    monthSprites.forEach((s) => city.remove(s));
    monthSprites.length = 0;
    names.forEach((name, i) => {
      const s = textSprite(name, "#c9c3ea");
      s.position.set(-3.6 + i * 1.25, 0.05, 1.55);
      city.add(s);
      monthSprites.push(s);
    });
    const cashLabel = textSprite("Cash", "#c6ff3d");
    cashLabel.position.set(4.15, 0.05, 1.55);
    city.add(cashLabel);
    monthSprites.push(cashLabel);
  }

  // Heights are scaled to the largest value on screen, so the tallest column is always 2.1 units.
  function update(next) {
    const values = next.trend.map((r) => [parseFloat(r.revenue), parseFloat(r.expenses)]);
    const cash = Math.max(parseFloat(next.totals.cash), 0);
    const max = Math.max(1, cash, ...values.flat());
    columns.forEach((c) => {
      c.target = Math.max(0.001, (values[c.month][c.series] / max) * 2.1);
    });
    coinTarget = Math.round((cash / max) * 22);
  }

  setLabels(labels);
  update(data);

  // Drag to rotate; it eases back toward a gentle idle sway when released.
  let dragging = false;
  let lastX = 0;
  let yaw = -0.35;
  let yawVelocity = 0;
  renderer.domElement.style.cursor = "grab";
  renderer.domElement.addEventListener("pointerdown", (e) => {
    dragging = true;
    lastX = e.clientX;
    renderer.domElement.setPointerCapture(e.pointerId);
    renderer.domElement.style.cursor = "grabbing";
  });
  renderer.domElement.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    yawVelocity = (e.clientX - lastX) * 0.006;
    yaw += yawVelocity;
    lastX = e.clientX;
  });
  const release = () => {
    dragging = false;
    renderer.domElement.style.cursor = "grab";
  };
  renderer.domElement.addEventListener("pointerup", release);
  renderer.domElement.addEventListener("pointercancel", release);

  function resize() {
    const w = container.clientWidth;
    const h = container.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.position.set(0, 3.3, 8.6 * Math.max(1, 1.9 / camera.aspect));
    camera.lookAt(0, 0.8, 0);
    camera.updateProjectionMatrix();
  }

  const clock = new THREE.Clock();
  let visible = true;
  let frame = 0;
  function tick() {
    frame = 0;
    if (!visible || document.hidden) return;
    const t = clock.getElapsedTime();
    if (!dragging) {
      yawVelocity *= 0.92;
      yaw += yawVelocity + Math.sin(t * 0.4) * 0.0012;
    }
    city.rotation.y = yaw;
    // Columns ease toward their targets, so new entries visibly grow the city.
    columns.forEach((c) => {
      c.mesh.scale.y += (c.target - c.mesh.scale.y) * 0.08;
    });
    // Coins drop in one at a time until the stack matches cash.
    if (coins.children.length < coinTarget && Math.floor(t * 30) % 2 === 0) {
      const coin = new THREE.Mesh(coinGeometry, coinMaterial);
      coin.position.y = 4;
      coin.userData.rest = coins.children.length * 0.115 + 0.055;
      coins.add(coin);
    }
    while (coins.children.length > coinTarget) coins.remove(coins.children[coins.children.length - 1]);
    coins.children.forEach((coin) => {
      coin.position.y += (coin.userData.rest - coin.position.y) * 0.2;
    });
    coins.rotation.y = t * 0.6;
    renderer.render(scene, camera);
    frame = requestAnimationFrame(tick);
  }

  new ResizeObserver(resize).observe(container);
  resize();
  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    if (visible && !frame) tick();
  }).observe(container);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && visible && !frame) tick();
  });
  tick();

  return { update };
}
