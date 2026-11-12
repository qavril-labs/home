import * as THREE from "three";
import { formatMoney } from "../lib/currency";

export interface MoneyCityTrendRow {
  month: string;
  sales?: string | number;
  revenue?: string | number;
  expenses?: string | number;
  salesRaw?: number;
  expensesRaw?: number;
}

export interface MoneyCityData {
  currencySymbol?: string;
  totals: {
    cash: string | number;
    revenue?: string | number;
    expenses?: string | number;
    profit?: string | number;
  };
  trend: MoneyCityTrendRow[];
}

export interface MoneyCityInstance {
  update: (data: MoneyCityData) => void;
  destroy: () => void;
}

// Token colours from design/tokens.css:
// series-in: #6250d6, series-out: #eb6834, cash: #c6ff3d
const SALES_COLOR = 0x6250d6;
const EXPENSES_COLOR = 0xeb6834;
const CASH_COLOR = 0xc6ff3d;
const PLINTH_COLOR = 0x16122e; // Dark neo-brutal panel
const ACCENT_LIGHT = 0xff4fa3; // Pink rim light

/**
 * Checks WebGL capability
 */
export function hasWebGL(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const canvas = document.createElement("canvas");
    return !!(
      window.WebGLRenderingContext &&
      (canvas.getContext("webgl2") || canvas.getContext("webgl") || (canvas.getContext("experimental-webgl") as any))
    );
  } catch {
    return false;
  }
}

/**
 * Validates 3D eligibility:
 * Desktop only: fine pointer + motion allowed + WebGL support per UI contract
 */
export function is3DSupported(): boolean {
  if (typeof window === "undefined") return false;
  const webgl = hasWebGL();
  const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  const motionOk = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  return webgl && finePointer && motionOk;
}

export function mountMoneyCity(
  container: HTMLElement,
  initialData: MoneyCityData,
  onHoverCallback?: (info: { label: string; amount: string; x: number; y: number } | null) => void
): MoneyCityInstance {
  if (!container || !hasWebGL()) {
    throw new Error("WebGL is not available or container is missing");
  }

  // Ensure container is positioned for canvas and tooltips
  container.style.position = "relative";

  // Create renderer
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "default" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.setSize(container.clientWidth || 560, container.clientHeight || 260, false);
  renderer.domElement.style.width = "100%";
  renderer.domElement.style.height = "100%";
  renderer.domElement.style.display = "block";
  renderer.domElement.setAttribute("aria-label", "Interactive 3D Money City visualization showing sales, expenses, and cash");
  container.appendChild(renderer.domElement);

  // Tooltip DOM element inside container
  const tooltip = document.createElement("div");
  tooltip.className = "absolute hidden pointer-events-none z-30 px-2.5 py-1 text-xs font-bold bg-panel text-text border-line shadow-sm";
  tooltip.style.transform = "translate(-50%, -120%)";
  container.appendChild(tooltip);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);

  // Lighting
  const ambient = new THREE.AmbientLight(0xffffff, 0.85);
  scene.add(ambient);

  const sun = new THREE.DirectionalLight(0xffffff, 1.25);
  sun.position.set(4, 8, 6);
  scene.add(sun);

  const rim = new THREE.PointLight(ACCENT_LIGHT, 3.5, 25);
  rim.position.set(-6, 3, -4);
  scene.add(rim);

  const city = new THREE.Group();
  scene.add(city);

  // Floor grid / plinth
  const plinth = new THREE.Mesh(
    new THREE.BoxGeometry(9.6, 0.12, 3.4),
    new THREE.MeshStandardMaterial({ color: PLINTH_COLOR, roughness: 0.8, metalness: 0.1 })
  );
  plinth.position.y = -0.06;
  city.add(plinth);

  // Column meshes
  interface ColumnRecord {
    mesh: THREE.Mesh;
    target: number;
    monthIndex: number;
    series: 0 | 1; // 0 = sales, 1 = expenses
    monthName: string;
    amount: string;
  }

  const columns: ColumnRecord[] = [];
  const columnGeometry = new THREE.BoxGeometry(0.42, 1, 0.42);
  columnGeometry.translate(0, 0.5, 0); // bottom origin

  const salesMaterial = new THREE.MeshStandardMaterial({
    color: SALES_COLOR,
    roughness: 0.35,
    metalness: 0.2,
  });

  const expensesMaterial = new THREE.MeshStandardMaterial({
    color: EXPENSES_COLOR,
    roughness: 0.35,
    metalness: 0.2,
  });

  // Six months columns
  for (let i = 0; i < 6; i += 1) {
    const x = -3.6 + i * 1.25;
    // Sales (series-in)
    const salesMesh = new THREE.Mesh(columnGeometry, salesMaterial.clone());
    salesMesh.position.set(x - 0.24, 0, 0.2);
    salesMesh.scale.y = 0.001;
    city.add(salesMesh);
    columns.push({
      mesh: salesMesh,
      target: 0.001,
      monthIndex: i,
      series: 0,
      monthName: "",
      amount: "0.00",
    });

    // Expenses (series-out)
    const expensesMesh = new THREE.Mesh(columnGeometry, expensesMaterial.clone());
    expensesMesh.position.set(x + 0.24, 0, 0.2);
    expensesMesh.scale.y = 0.001;
    city.add(expensesMesh);
    columns.push({
      mesh: expensesMesh,
      target: 0.001,
      monthIndex: i,
      series: 1,
      monthName: "",
      amount: "0.00",
    });
  }

  // Coin stack for cash
  const coins = new THREE.Group();
  coins.position.set(4.15, 0, 0.2);
  city.add(coins);

  const coinGeometry = new THREE.CylinderGeometry(0.42, 0.42, 0.11, 32);
  const coinMaterial = new THREE.MeshStandardMaterial({
    color: CASH_COLOR,
    metalness: 0.6,
    roughness: 0.25,
    emissive: 0x233300,
  });

  let coinTarget = 0;
  let currentCashStr = "0.00";
  let currentCurrencySym = "$";

  // Label sprites
  function createTextSprite(text: string, color: string): THREE.Sprite {
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.font = "700 32px 'Space Grotesk', system-ui, sans-serif";
      ctx.fillStyle = color;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(text, 128, 32);
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false })
    );
    sprite.scale.set(1.6, 0.4, 1);
    return sprite;
  }

  const labelSprites: THREE.Sprite[] = [];

  function updateLabels(names: string[]) {
    labelSprites.forEach((s) => city.remove(s));
    labelSprites.length = 0;

    names.slice(0, 6).forEach((name, i) => {
      const s = createTextSprite(name, "#c9c3ea");
      s.position.set(-3.6 + i * 1.25, 0.05, 1.55);
      city.add(s);
      labelSprites.push(s);
    });

    const cashLabel = createTextSprite("Cash", "#c6ff3d");
    cashLabel.position.set(4.15, 0.05, 1.55);
    city.add(cashLabel);
    labelSprites.push(cashLabel);
  }

  // Update logic
  function update(data: MoneyCityData) {
    if (!data) return;
    currentCurrencySym = data.currencySymbol || "$";
    const trend = data.trend || [];
    const monthNames = trend.map((r) => r.month || "");
    updateLabels(monthNames);

    const cashNum = parseFloat(String(data.totals.cash || "0")) || 0;
    currentCashStr = String(data.totals.cash || "0");

    const pairs = trend.slice(0, 6).map((r) => {
      const s = parseFloat(String(r.sales ?? r.revenue ?? r.salesRaw ?? 0)) || 0;
      const e = parseFloat(String(r.expenses ?? r.expensesRaw ?? 0)) || 0;
      return [s, e] as [number, number];
    });

    const allValues = pairs.flat();
    const maxVal = Math.max(1, cashNum, ...allValues);

    columns.forEach((c) => {
      const pair = pairs[c.monthIndex];
      const monthRow = trend[c.monthIndex];
      if (pair && monthRow) {
        const val = pair[c.series];
        c.target = Math.max(0.001, (val / maxVal) * 2.1);
        c.monthName = monthRow.month;
        c.amount = String(c.series === 0 ? monthRow.sales ?? monthRow.revenue ?? val : monthRow.expenses ?? val);
      } else {
        c.target = 0.001;
        c.monthName = "";
        c.amount = "0.00";
      }
    });

    coinTarget = Math.min(24, Math.max(0, Math.round((cashNum / maxVal) * 20)));
  }

  // Initialize with initialData
  update(initialData);

  // Resize handler
  function resize() {
    const w = container.clientWidth || 560;
    const h = container.clientHeight || 260;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.position.set(0, 3.3, 8.6 * Math.max(1, 1.9 / camera.aspect));
    camera.lookAt(0, 0.8, 0);
    camera.updateProjectionMatrix();
  }

  // Drag interaction
  let dragging = false;
  let lastX = 0;
  let yaw = -0.35;
  let yawVelocity = 0;

  renderer.domElement.style.cursor = "grab";

  const onPointerDown = (e: PointerEvent) => {
    dragging = true;
    lastX = e.clientX;
    renderer.domElement.setPointerCapture(e.pointerId);
    renderer.domElement.style.cursor = "grabbing";
    tooltip.classList.add("hidden");
    onHoverCallback?.(null);
  };

  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();

  const onPointerMove = (e: PointerEvent) => {
    if (dragging) {
      yawVelocity = (e.clientX - lastX) * 0.006;
      yaw += yawVelocity;
      lastX = e.clientX;
      return;
    }

    // Hover tooltip via Raycasting
    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);

    // Test columns
    const columnMeshes = columns.map((c) => c.mesh);
    const colIntersects = raycaster.intersectObjects(columnMeshes);

    if (colIntersects.length > 0) {
      const hit = colIntersects[0];
      const match = columns.find((c) => c.mesh === hit.object);
      if (match && match.monthName) {
        const typeStr = match.series === 0 ? "Sales" : "Expenses";
        const text = `${match.monthName} · ${typeStr}: ${formatMoney(match.amount, currentCurrencySym)}`;
        tooltip.textContent = text;
        tooltip.style.left = `${e.clientX - rect.left}px`;
        tooltip.style.top = `${e.clientY - rect.top}px`;
        tooltip.classList.remove("hidden");
        onHoverCallback?.({ label: `${match.monthName} ${typeStr}`, amount: match.amount, x: e.clientX, y: e.clientY });
        return;
      }
    }

    // Test coins
    const coinIntersects = raycaster.intersectObjects(coins.children);
    if (coinIntersects.length > 0) {
      const text = `Cash on hand: ${formatMoney(currentCashStr, currentCurrencySym)}`;
      tooltip.textContent = text;
      tooltip.style.left = `${e.clientX - rect.left}px`;
      tooltip.style.top = `${e.clientY - rect.top}px`;
      tooltip.classList.remove("hidden");
      onHoverCallback?.({ label: "Cash on hand", amount: currentCashStr, x: e.clientX, y: e.clientY });
      return;
    }

    // No hit
    tooltip.classList.add("hidden");
    onHoverCallback?.(null);
  };

  const onPointerUp = () => {
    dragging = false;
    renderer.domElement.style.cursor = "grab";
  };

  const onPointerLeave = () => {
    dragging = false;
    tooltip.classList.add("hidden");
    onHoverCallback?.(null);
  };

  renderer.domElement.addEventListener("pointerdown", onPointerDown);
  renderer.domElement.addEventListener("pointermove", onPointerMove);
  renderer.domElement.addEventListener("pointerup", onPointerUp);
  renderer.domElement.addEventListener("pointercancel", onPointerUp);
  renderer.domElement.addEventListener("pointerleave", onPointerLeave);

  // ResizeObserver
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(container);
  resize();

  // Visibility and animation loop
  let visible = true;
  let animFrameId = 0;
  const clock = new THREE.Clock();

  const intersectionObserver = new IntersectionObserver(([entry]) => {
    visible = !!entry?.isIntersecting;
    if (visible && !animFrameId) tick();
  });
  intersectionObserver.observe(container);

  const onVisibilityChange = () => {
    if (!document.hidden && visible && !animFrameId) tick();
  };
  document.addEventListener("visibilitychange", onVisibilityChange);

  function tick() {
    animFrameId = 0;
    if (!visible || document.hidden) return;

    const t = clock.getElapsedTime();

    if (!dragging) {
      yawVelocity *= 0.92;
      yaw += yawVelocity + Math.sin(t * 0.4) * 0.0012;
    }
    city.rotation.y = yaw;

    // Smooth ease columns to target heights
    columns.forEach((c) => {
      c.mesh.scale.y += (c.target - c.mesh.scale.y) * 0.08;
    });

    // Animate coin drop
    if (coins.children.length < coinTarget && Math.floor(t * 30) % 2 === 0) {
      const coin = new THREE.Mesh(coinGeometry, coinMaterial);
      coin.position.y = 4;
      (coin.userData as any).rest = coins.children.length * 0.115 + 0.055;
      coins.add(coin);
    }
    while (coins.children.length > coinTarget) {
      const last = coins.children[coins.children.length - 1];
      if (last) coins.remove(last);
    }
    coins.children.forEach((coin) => {
      const restY = (coin.userData as any).rest || 0;
      coin.position.y += (restY - coin.position.y) * 0.2;
    });
    coins.rotation.y = t * 0.6;

    renderer.render(scene, camera);
    animFrameId = requestAnimationFrame(tick);
  }

  // Start animation loop
  tick();

  // Destroy cleanup
  const destroy = () => {
    if (animFrameId) cancelAnimationFrame(animFrameId);
    resizeObserver.disconnect();
    intersectionObserver.disconnect();
    document.removeEventListener("visibilitychange", onVisibilityChange);

    renderer.domElement.removeEventListener("pointerdown", onPointerDown);
    renderer.domElement.removeEventListener("pointermove", onPointerMove);
    renderer.domElement.removeEventListener("pointerup", onPointerUp);
    renderer.domElement.removeEventListener("pointercancel", onPointerUp);
    renderer.domElement.removeEventListener("pointerleave", onPointerLeave);

    columnGeometry.dispose();
    coinGeometry.dispose();
    plinth.geometry.dispose();
    salesMaterial.dispose();
    expensesMaterial.dispose();
    coinMaterial.dispose();
    renderer.dispose();

    if (renderer.domElement.parentElement === container) {
      container.removeChild(renderer.domElement);
    }
    if (tooltip.parentElement === container) {
      container.removeChild(tooltip);
    }
  };

  return { update, destroy };
}
