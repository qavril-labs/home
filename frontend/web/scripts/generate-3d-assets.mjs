import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as THREE from "three";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";

// Polyfill FileReader for Node.js
if (typeof globalThis.FileReader === "undefined") {
  globalThis.FileReader = class FileReader {
    readAsArrayBuffer(blob) {
      blob.arrayBuffer().then((buf) => {
        this.result = buf;
        if (this.onload) this.onload({ target: this });
        if (this.onloadend) this.onloadend({ target: this });
      }).catch((err) => {
        if (this.onerror) this.onerror(err);
      });
    }
    readAsDataURL(blob) {
      blob.arrayBuffer().then((buf) => {
        const base64 = Buffer.from(buf).toString("base64");
        this.result = `data:${blob.type || "application/octet-stream"};base64,${base64}`;
        if (this.onload) this.onload({ target: this });
        if (this.onloadend) this.onloadend({ target: this });
      }).catch((err) => {
        if (this.onerror) this.onerror(err);
      });
    }
  };
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const outputDir = path.resolve(__dirname, "../public/models");

if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

function buildPallet() {
  const pallet = new THREE.Group();
  pallet.name = "EuroPallet";

  const woodMat = new THREE.MeshStandardMaterial({
    color: 0x9c7042,
    roughness: 0.85,
    metalness: 0.05,
  });

  const blockMat = new THREE.MeshStandardMaterial({
    color: 0x7a532d,
    roughness: 0.9,
  });

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

  const runnerGeo = new THREE.BoxGeometry(0.14, 0.025, 0.86);
  blockX.forEach((x) => {
    const runner = new THREE.Mesh(runnerGeo, woodMat);
    runner.position.set(x, 0.0125, 0);
    pallet.add(runner);
  });

  const deckGeo = new THREE.BoxGeometry(0.86, 0.025, 0.13);
  const deckZ = [-0.36, -0.18, 0, 0.18, 0.36];
  deckZ.forEach((z) => {
    const deck = new THREE.Mesh(deckGeo, woodMat);
    deck.position.set(0, 0.0925, z);
    pallet.add(deck);
  });

  return pallet;
}

function buildAgv() {
  const agv = new THREE.Group();
  agv.name = "AgvForklift";

  const bodyMat = new THREE.MeshStandardMaterial({
    color: 0xf59e0b,
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

  const chassisGeo = new THREE.BoxGeometry(0.9, 0.45, 1.2);
  const chassis = new THREE.Mesh(chassisGeo, bodyMat);
  chassis.position.set(0, 0.35, -0.2);
  agv.add(chassis);

  const weightGeo = new THREE.BoxGeometry(0.85, 0.35, 0.35);
  const weight = new THREE.Mesh(weightGeo, darkMat);
  weight.position.set(0, 0.45, -0.65);
  agv.add(weight);

  const wheelGeo = new THREE.CylinderGeometry(0.14, 0.14, 0.1, 16);
  wheelGeo.rotateZ(Math.PI / 2);
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.9 });

  [
    [-0.48, 0.14, 0.3],
    [0.48, 0.14, 0.3],
    [-0.48, 0.14, -0.6],
    [0.48, 0.14, -0.6],
  ].forEach(([wx, wy, wz]) => {
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.position.set(wx, wy, wz);
    agv.add(wheel);
  });

  const mastGeo = new THREE.BoxGeometry(0.06, 1.3, 0.06);
  [-0.25, 0.25].forEach((mx) => {
    const mast = new THREE.Mesh(mastGeo, darkMat);
    mast.position.set(mx, 0.8, 0.45);
    agv.add(mast);
  });

  const forkGeo = new THREE.BoxGeometry(0.08, 0.03, 0.85);
  [-0.18, 0.18].forEach((fx) => {
    const fork = new THREE.Mesh(forkGeo, forkMat);
    fork.position.set(fx, 0.18, 0.82);
    agv.add(fork);
  });

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

const exporter = new GLTFExporter();

async function exportAsset(group, baseName) {
  console.log(`Starting export for ${baseName}...`);
  const glb = await exporter.parseAsync(group, { binary: true });
  const glbPath = path.join(outputDir, `${baseName}.glb`);
  fs.writeFileSync(glbPath, Buffer.from(glb));
  console.log(`Exported binary ${baseName}.glb (${fs.statSync(glbPath).size} bytes)`);
}

async function main() {
  console.log("Generating production GLTF 3D assets...");
  await exportAsset(buildPallet(), "pallet");
  await exportAsset(buildAgv(), "agv_forklift");
  console.log("GLTF 3D assets generated successfully.");
}

const keepAlive = setInterval(() => {}, 100);
main().then(() => {
  clearInterval(keepAlive);
  process.exit(0);
}).catch((err) => {
  clearInterval(keepAlive);
  console.error("Asset generation error:", err);
  process.exit(1);
});
