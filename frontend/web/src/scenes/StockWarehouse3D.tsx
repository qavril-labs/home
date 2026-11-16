import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import type { WarehouseStockSlot } from "../types";
import {
  loadGlbModel,
  createPalletProp,
  createAgvForkliftProp,
  createRackBarcodePlate,
} from "../lib/model-loader";

export interface StockWarehouse3DProps {
  stockSlots: WarehouseStockSlot[];
  selectedWarehouse?: string;
  onSelectSlot?: (slot: WarehouseStockSlot) => void;
}

export const StockWarehouse3D: React.FC<StockWarehouse3DProps> = ({
  stockSlots,
  selectedWarehouse,
  onSelectSlot,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [isSupported, setIsSupported] = useState(true);
  const [hoveredSlot, setHoveredSlot] = useState<WarehouseStockSlot | null>(null);

  useEffect(() => {
    const hasFinePointer = window.matchMedia("(pointer: fine)").matches;
    const allowsMotion = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let hasWebGL = false;
    try {
      const canvas = document.createElement("canvas");
      hasWebGL = !!(
        window.WebGLRenderingContext &&
        (canvas.getContext("webgl") || canvas.getContext("experimental-webgl"))
      );
    } catch {
      hasWebGL = false;
    }

    if (!hasFinePointer || !allowsMotion || !hasWebGL || !mountRef.current) {
      setIsSupported(false);
      return;
    }

    const container = mountRef.current;
    const width = container.clientWidth || 600;
    const height = container.clientHeight || 280;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(35, width / height, 0.1, 100);
    camera.position.set(0, 4.5, 9.5);
    camera.lookAt(0, 0.5, 0);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.3);
    dirLight.position.set(6, 12, 8);
    scene.add(dirLight);

    const rimLight = new THREE.DirectionalLight(0xff4fa3, 0.5);
    rimLight.position.set(-8, 3, -4);
    scene.add(rimLight);

    const warehouseGroup = new THREE.Group();
    scene.add(warehouseGroup);

    // Concrete Plinth / Floor
    const plinthGeo = new THREE.BoxGeometry(10, 0.2, 5.5);
    const plinthMat = new THREE.MeshStandardMaterial({
      color: 0x16122e,
      roughness: 0.85,
    });
    const plinth = new THREE.Mesh(plinthGeo, plinthMat);
    plinth.position.y = -0.1;
    warehouseGroup.add(plinth);

    // Filter stock by selected warehouse if specified
    const displaySlots = selectedWarehouse
      ? stockSlots.filter((s) => s.warehouseCode === selectedWarehouse)
      : stockSlots;

    // Build Shelves
    const shelfMat = new THREE.MeshStandardMaterial({
      color: 0x2b274c,
      roughness: 0.5,
      metalness: 0.2,
    });
    const frameMat = new THREE.MeshStandardMaterial({
      color: 0x4f46e5,
      roughness: 0.4,
    });

    const numBays = Math.max(3, displaySlots.length);
    const baySpacing = 1.6;
    const startX = -((numBays - 1) * baySpacing) / 2;

    const interactiveMeshes: { mesh: THREE.Mesh; slot: WarehouseStockSlot }[] = [];

    // Upright rack pillars
    for (let i = 0; i <= numBays; i++) {
      const x = startX - baySpacing / 2 + i * baySpacing;
      [-1.2, 1.2].forEach((z) => {
        const pillarGeo = new THREE.BoxGeometry(0.08, 2.8, 0.08);
        const pillar = new THREE.Mesh(pillarGeo, frameMat);
        pillar.position.set(x, 1.4, z);
        warehouseGroup.add(pillar);
      });
    }

    // Horizontal shelves
    [0.1, 1.3, 2.5].forEach((shelfY) => {
      const shelfWidth = numBays * baySpacing + 0.2;
      const shelfGeo = new THREE.BoxGeometry(shelfWidth, 0.06, 2.4);
      const shelf = new THREE.Mesh(shelfGeo, shelfMat);
      shelf.position.set(0, shelfY, 0);
      warehouseGroup.add(shelf);
    });

    // Populate pallets, barcode plates, and stock boxes
    displaySlots.forEach((slot, idx) => {
      const bayX = startX + (idx % numBays) * baySpacing;
      const isLevel2 = slot.shelf % 2 === 0;
      const shelfY = isLevel2 ? 1.33 : 0.13;

      // Wooden Euro-Pallet prop under each inventory slot
      const pallet = createPalletProp();
      pallet.position.set(bayX, shelfY, 0);
      warehouseGroup.add(pallet);

      // Barcode / Bin Label Plate on front shelf beam
      const barcodePlate = createRackBarcodePlate(slot.binLocation || `${slot.aisle}-S${slot.shelf}`);
      barcodePlate.position.set(bayX, shelfY - 0.04, 1.21);
      warehouseGroup.add(barcodePlate);

      // Stock inventory box (height reflects quantity)
      const boxHeight = Math.max(0.35, Math.min(0.9, (slot.quantity / 80) * 0.85));
      const boxGeo = new THREE.BoxGeometry(0.7, boxHeight, 0.7);
      boxGeo.translate(0, boxHeight / 2, 0);

      const isLowStock = slot.quantity <= slot.reorderPoint;
      const boxMat = new THREE.MeshStandardMaterial({
        color: isLowStock ? 0xff2a55 : 0xc6ff3d, // Red/pink alert vs vibrant lime
        emissive: isLowStock ? 0xaa0022 : 0x113300,
        emissiveIntensity: isLowStock ? 0.6 : 0.2,
        roughness: 0.35,
        metalness: 0.1,
      });

      const box = new THREE.Mesh(boxGeo, boxMat);
      box.position.set(bayX, shelfY + 0.1, 0); // Sits cleanly on the euro-pallet deck
      warehouseGroup.add(box);
      interactiveMeshes.push({ mesh: box, slot });
    });

    // Production-Grade AGV Forklift Bot Prop (Dock Transport)
    const agvGroup = new THREE.Group();
    const fallbackAgv = createAgvForkliftProp();
    agvGroup.add(fallbackAgv);
    agvGroup.position.set(startX + numBays * baySpacing * 0.5 + 0.6, 0, 1.4);
    agvGroup.rotation.y = -Math.PI / 4;
    warehouseGroup.add(agvGroup);

    // Asynchronously upgrade with custom Blender GLB model if available
    void loadGlbModel("/models/agv_forklift.glb").then((loadedAgv) => {
      if (loadedAgv) {
        agvGroup.clear();
        agvGroup.add(loadedAgv);
      }
    });

    // Raycasting & Interaction
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2(-999, -999);
    let isDragging = false;
    let prevMouseX = 0;
    let targetRotationY = 0;

    const onPointerMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      if (isDragging) {
        const deltaX = e.clientX - prevMouseX;
        targetRotationY += deltaX * 0.008;
        prevMouseX = e.clientX;
      }
    };

    const onPointerDown = (e: MouseEvent) => {
      isDragging = true;
      prevMouseX = e.clientX;
    };

    const onPointerUp = () => {
      isDragging = false;
    };

    const onClick = () => {
      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(interactiveMeshes.map((m) => m.mesh));
      if (intersects.length > 0) {
        const hit = interactiveMeshes.find((m) => m.mesh === intersects[0]?.object);
        if (hit && onSelectSlot) {
          onSelectSlot(hit.slot);
        }
      }
    };

    container.addEventListener("mousemove", onPointerMove);
    container.addEventListener("mousedown", onPointerDown);
    window.addEventListener("mouseup", onPointerUp);
    container.addEventListener("click", onClick);

    let animationFrameId: number;
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);

      // Smooth rotation damping
      warehouseGroup.rotation.y += (targetRotationY - warehouseGroup.rotation.y) * 0.1;

      // Safety Beacon Pulse animation on AGV
      const beacon = warehouseGroup.getObjectByName("SafetyBeacon") as THREE.Mesh | null;
      if (beacon && beacon.material instanceof THREE.MeshStandardMaterial) {
        beacon.material.emissiveIntensity = 0.8 + Math.sin(Date.now() * 0.008) * 0.7;
      }

      // Raycast hover check
      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(interactiveMeshes.map((m) => m.mesh));
      if (intersects.length > 0) {
        const hit = interactiveMeshes.find((m) => m.mesh === intersects[0]?.object);
        if (hit) {
          setHoveredSlot(hit.slot);
          container.style.cursor = "pointer";
        }
      } else {
        setHoveredSlot(null);
        container.style.cursor = isDragging ? "grabbing" : "grab";
      }

      renderer.render(scene, camera);
    };
    animate();

    const onResize = () => {
      if (!container) return;
      const w = container.clientWidth || 600;
      const h = container.clientHeight || 280;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("resize", onResize);
      container.removeEventListener("mousemove", onPointerMove);
      container.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("mouseup", onPointerUp);
      container.removeEventListener("click", onClick);
      if (renderer.domElement.parentElement) {
        renderer.domElement.parentElement.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, [stockSlots, selectedWarehouse, onSelectSlot]);

  if (!isSupported) {
    return (
      <div className="p-6 bg-panel border-line text-center text-sm font-bold text-muted">
        3D Warehouse View is optimized for desktop browsers with motion and WebGL enabled.
      </div>
    );
  }

  return (
    <div className="relative w-full h-[320px] bg-panel border-line overflow-hidden select-none">
      <div ref={mountRef} className="w-full h-full cursor-grab" />
      
      {/* Legend & Instructions */}
      <div className="absolute top-3 left-3 pointer-events-none flex items-center gap-3 bg-panel/90 border border-line px-3 py-1.5 shadow-sm text-xs font-bold text-text">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 bg-lime border border-ink inline-block" />
          <span>Normal Stock</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 bg-pink border border-ink inline-block animate-pulse" />
          <span>Below Reorder Point</span>
        </span>
        <span className="text-muted text-[11px] hidden sm:inline">· Drag to rotate, click box to inspect</span>
      </div>

      {/* Hover Tooltip Overlay */}
      {hoveredSlot && (
        <div className="absolute bottom-3 left-3 bg-panel border-2 border-line p-3 shadow-[3px_3px_0_var(--q-ink)] z-20 max-w-sm pointer-events-none">
          <div className="flex items-center justify-between gap-4 mb-1">
            <span className="font-mono text-xs font-bold text-pink">{hoveredSlot.sku}</span>
            <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 bg-page border border-line text-text">
              Aisle {hoveredSlot.aisle} · Shelf {hoveredSlot.shelf}
            </span>
          </div>
          <p className="font-bold text-sm text-text truncate">{hoveredSlot.itemName}</p>
          <div className="mt-2 flex items-center gap-3 text-xs">
            <div>
              <span className="text-muted text-[11px]">Quantity: </span>
              <span className={`font-black ${hoveredSlot.quantity <= hoveredSlot.reorderPoint ? "text-pink" : "text-lime"}`}>
                {hoveredSlot.quantity} {hoveredSlot.uom}
              </span>
            </div>
            <div>
              <span className="text-muted text-[11px]">Reorder At: </span>
              <span className="font-bold text-text">{hoveredSlot.reorderPoint} {hoveredSlot.uom}</span>
            </div>
            <div>
              <span className="text-muted text-[11px]">Warehouse: </span>
              <span className="font-bold text-text">{hoveredSlot.warehouseCode}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
