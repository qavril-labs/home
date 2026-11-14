import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import type { StockReplenishmentItem } from "../types";

export interface Warehouse3DProps {
  items: StockReplenishmentItem[];
}

export const Warehouse3D: React.FC<Warehouse3DProps> = ({ items }) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [isSupported, setIsSupported] = useState(true);

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
    const width = container.clientWidth || 500;
    const height = container.clientHeight || 200;

    const rootStyle = getComputedStyle(document.documentElement);
    const getTokenColor = (varName: string, fallbackVar: string) => {
      const val = rootStyle.getPropertyValue(varName).trim() || rootStyle.getPropertyValue(fallbackVar).trim();
      return new THREE.Color(val || "rgb(198, 255, 61)");
    };

    const colorHealthy = getTokenColor("--q-lime", "--q-good");
    const colorLow = getTokenColor("--q-yellow", "--q-warn");
    const colorStockout = getTokenColor("--q-orange", "--q-act");
    const colorRack = getTokenColor("--q-ink", "--q-text");

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(34, width / height, 0.1, 100);
    camera.position.set(0, 4.5, 9.2);
    camera.lookAt(0, 0.5, 0);

    const ambientLight = new THREE.AmbientLight(new THREE.Color("rgb(255,255,255)"), 0.95);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(new THREE.Color("rgb(255,255,255)"), 1.25);
    dirLight.position.set(5, 10, 6);
    scene.add(dirLight);

    const warehouseGroup = new THREE.Group();
    scene.add(warehouseGroup);

    // Warehouse Floor Plinth
    const floorGeo = new THREE.BoxGeometry(8.8, 0.16, 3.4);
    const floorMat = new THREE.MeshStandardMaterial({
      color: colorRack,
      roughness: 0.85,
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.position.y = -0.08;
    warehouseGroup.add(floor);

    const binGeo = new THREE.BoxGeometry(0.95, 1, 0.95);
    binGeo.translate(0, 0.5, 0);

    const maxQty = Math.max(...items.map((it) => Math.max(it.currentStock, it.reorderPoint, 20)), 25);

    const animatedBins: { mesh: THREE.Mesh; targetScaleY: number; isAlert: boolean }[] = [];

    items.slice(0, 5).forEach((item, idx) => {
      const x = -3.2 + idx * 1.6;

      // Reorder threshold wireframe marker
      const reorderRatio = Math.max((item.reorderPoint / maxQty) * 2.2, 0.25);
      const markerGeo = new THREE.BoxGeometry(1.08, 0.05, 1.08);
      const markerMat = new THREE.MeshStandardMaterial({
        color: item.status === "healthy" ? colorHealthy : colorStockout,
        roughness: 0.4,
      });
      const marker = new THREE.Mesh(markerGeo, markerMat);
      marker.position.set(x, reorderRatio, 0);
      warehouseGroup.add(marker);

      // Stock volume column
      const targetHeight = Math.max((item.currentStock / maxQty) * 2.2, 0.14);
      const binColor =
        item.status === "stockout"
          ? colorStockout
          : item.status === "low_stock"
          ? colorLow
          : colorHealthy;

      const binMat = new THREE.MeshStandardMaterial({
        color: binColor,
        roughness: 0.35,
        metalness: 0.2,
      });
      const binMesh = new THREE.Mesh(binGeo, binMat);
      binMesh.position.set(x, 0, 0);
      binMesh.scale.y = 0.01;
      warehouseGroup.add(binMesh);

      animatedBins.push({
        mesh: binMesh,
        targetScaleY: targetHeight,
        isAlert: item.status !== "healthy",
      });
    });

    let isDragging = false;
    let prevMouseX = 0;
    let targetRotationY = -0.18;
    let currentRotationY = -0.18;

    const onMouseDown = (e: MouseEvent) => {
      isDragging = true;
      prevMouseX = e.clientX;
    };
    const onMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        targetRotationY += (e.clientX - prevMouseX) * 0.008;
        prevMouseX = e.clientX;
      }
    };
    const onMouseUp = () => {
      isDragging = false;
    };

    const domElement = renderer.domElement;
    domElement.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);

    let animId: number;
    const clock = new THREE.Clock();

    const animate = () => {
      animId = requestAnimationFrame(animate);
      if (document.hidden) return;
      const elapsed = clock.getElapsedTime();

      if (!isDragging) {
        targetRotationY += Math.sin(elapsed * 0.7) * 0.0007;
      }
      currentRotationY += (targetRotationY - currentRotationY) * 0.1;
      warehouseGroup.rotation.y = currentRotationY;

      animatedBins.forEach((b) => {
        b.mesh.scale.y += (b.targetScaleY - b.mesh.scale.y) * 0.08;
      });

      renderer.render(scene, camera);
    };

    animate();

    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener("resize", handleResize);

    return () => {
      cancelAnimationFrame(animId);
      domElement.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      window.removeEventListener("resize", handleResize);
      renderer.dispose();
      if (container.contains(domElement)) {
        container.removeChild(domElement);
      }
    };
  }, [items]);

  if (!isSupported) return null;

  return (
    <div
      data-testid="warehouse-3d-scene"
      className="relative w-full h-[180px] bg-panel/40 border-2 border-ink shadow-[4px_4px_0_var(--q-ink)] overflow-hidden select-none mb-4"
    >
      <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing" />
      <div className="absolute bottom-1.5 left-2 pointer-events-none text-[10px] font-bold text-muted bg-panel/90 px-2 py-0.5 border border-ink">
        Drag to spin · 3D Stock Warehouse (Height = Current Stock, Ring = Reorder Point)
      </div>
    </div>
  );
};
