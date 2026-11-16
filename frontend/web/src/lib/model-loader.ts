import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

// Cache for loaded GLTF models
const modelCache = new Map<string, THREE.Group>();

/**
 * Loads a GLTF/GLB model from URL with memory caching and error resilience.
 * Returns null if file is missing, allowing procedural fallback to activate.
 */
export async function loadGlbModel(url: string): Promise<THREE.Group | null> {
  if (modelCache.has(url)) {
    const cached = modelCache.get(url);
    return cached ? cached.clone() : null;
  }

  const loader = new GLTFLoader();
  try {
    const gltf = await loader.loadAsync(url);
    const scene = gltf.scene;
    modelCache.set(url, scene);
    return scene.clone();
  } catch {
    // Graceful fallback to procedural Blender-style geometry
    return null;
  }
}

/**
 * Procedural Euro-Pallet Prop (EPAL 1200x800mm industrial standard)
 * 5 top deckboards, 3 bottom runners, 9 spacer blocks.
 */
export function createPalletProp(): THREE.Group {
  const pallet = new THREE.Group();
  pallet.name = "EuroPalletProp";

  const woodMat = new THREE.MeshStandardMaterial({
    color: 0x9c7042, // Rich aged pine wood
    roughness: 0.85,
    metalness: 0.05,
  });

  const blockMat = new THREE.MeshStandardMaterial({
    color: 0x7a532d,
    roughness: 0.9,
  });

  // 9 Wooden Spacer Blocks (145x145x78mm scaled)
  const blockGeo = new THREE.BoxGeometry(0.14, 0.08, 0.14);
  const blockX = [-0.35, 0, 0.35];
  const blockZ = [-0.35, 0, 0.35];

  blockX.forEach((x) => {
    blockZ.forEach((z) => {
      const block = new THREE.Mesh(blockGeo, blockMat);
      block.position.set(x, 0.04, z);
      pallet.add(block);
    });
  });

  // 3 Bottom Stringer Runners
  const runnerGeo = new THREE.BoxGeometry(0.14, 0.025, 0.86);
  blockX.forEach((x) => {
    const runner = new THREE.Mesh(runnerGeo, woodMat);
    runner.position.set(x, 0.0125, 0);
    pallet.add(runner);
  });

  // 5 Top Deckboards
  const deckGeo = new THREE.BoxGeometry(0.86, 0.025, 0.13);
  const deckZ = [-0.36, -0.18, 0, 0.18, 0.36];
  deckZ.forEach((z) => {
    const deck = new THREE.Mesh(deckGeo, woodMat);
    deck.position.set(0, 0.0925, z);
    pallet.add(deck);
  });

  return pallet;
}

/**
 * Procedural Industrial AGV / Forklift Robot Prop
 * Includes chassis, counterweight, upright mast, dual forks, and flashing amber beacon.
 */
export function createAgvForkliftProp(): THREE.Group {
  const agv = new THREE.Group();
  agv.name = "AgvForkliftProp";

  const bodyMat = new THREE.MeshStandardMaterial({
    color: 0xf59e0b, // Industrial safety amber/yellow
    roughness: 0.4,
    metalness: 0.3,
  });

  const darkMat = new THREE.MeshStandardMaterial({
    color: 0x1f2937,
    roughness: 0.6,
    metalness: 0.4,
  });

  const forkMat = new THREE.MeshStandardMaterial({
    color: 0x6b7280,
    roughness: 0.2,
    metalness: 0.8,
  });

  // Main chassis body
  const chassisGeo = new THREE.BoxGeometry(0.9, 0.45, 1.2);
  const chassis = new THREE.Mesh(chassisGeo, bodyMat);
  chassis.position.set(0, 0.35, -0.2);
  agv.add(chassis);

  // Counterweight back
  const weightGeo = new THREE.BoxGeometry(0.85, 0.35, 0.35);
  const weight = new THREE.Mesh(weightGeo, darkMat);
  weight.position.set(0, 0.45, -0.65);
  agv.add(weight);

  // 4 Industrial Wheels
  const wheelGeo = new THREE.CylinderGeometry(0.14, 0.14, 0.1, 16);
  wheelGeo.rotateZ(Math.PI / 2);
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.9 });

  const wheelCoords: [number, number, number][] = [
    [-0.48, 0.14, 0.3],
    [0.48, 0.14, 0.3],
    [-0.48, 0.14, -0.6],
    [0.48, 0.14, -0.6],
  ];
  wheelCoords.forEach(([wx, wy, wz]) => {
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.position.set(wx, wy, wz);
    agv.add(wheel);
  });

  // Dual vertical mast beams
  const mastGeo = new THREE.BoxGeometry(0.06, 1.3, 0.06);
  [-0.25, 0.25].forEach((mx) => {
    const mast = new THREE.Mesh(mastGeo, darkMat);
    mast.position.set(mx, 0.8, 0.45);
    agv.add(mast);
  });

  // Dual lifting forks
  const forkGeo = new THREE.BoxGeometry(0.08, 0.03, 0.85);
  [-0.18, 0.18].forEach((fx) => {
    const fork = new THREE.Mesh(forkGeo, forkMat);
    fork.position.set(fx, 0.18, 0.82);
    agv.add(fork);
  });

  // Flashing Warning Safety Beacon
  const beaconGeo = new THREE.CylinderGeometry(0.06, 0.08, 0.12, 12);
  const beaconMat = new THREE.MeshStandardMaterial({
    color: 0xff8800,
    emissive: 0xff5500,
    emissiveIntensity: 1.2,
    roughness: 0.2,
  });
  const beacon = new THREE.Mesh(beaconGeo, beaconMat);
  beacon.position.set(0, 0.64, -0.4);
  beacon.name = "SafetyBeacon";
  agv.add(beacon);

  return agv;
}

/**
 * Procedural Industrial Barcode Rack Plate
 */
export function createRackBarcodePlate(label: string): THREE.Group {
  const plateGroup = new THREE.Group();

  const plateMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    roughness: 0.5,
    metalness: 0.5,
  });

  const plate = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.08, 0.01), plateMat);
  plateGroup.add(plate);

  // High contrast barcode tag stripe
  const stripeMat = new THREE.MeshStandardMaterial({
    color: 0xc6ff3d,
    emissive: 0x224400,
    emissiveIntensity: 0.4,
  });
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.03, 0.012), stripeMat);
  stripe.position.z = 0.002;
  plateGroup.add(stripe);

  plateGroup.userData = { label };
  return plateGroup;
}
