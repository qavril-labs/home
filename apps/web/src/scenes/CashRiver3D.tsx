import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import type { CashForecastPoint } from "../types";

export interface CashRiver3DProps {
  points: CashForecastPoint[];
  scenario: "expected" | "conservative" | "optimistic";
}

export const CashRiver3D: React.FC<CashRiver3DProps> = ({ points, scenario }) => {
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
    const height = container.clientHeight || 190;

    const rootStyle = getComputedStyle(document.documentElement);
    const getTokenColor = (varName: string) => {
      const val = rootStyle.getPropertyValue(varName).trim();
      return new THREE.Color(val || "rgb(139, 107, 255)");
    };

    const colorRiver =
      scenario === "optimistic"
        ? getTokenColor("--q-lime")
        : scenario === "conservative"
        ? getTokenColor("--q-yellow")
        : getTokenColor("--q-violet");
    const colorInflow = getTokenColor("--q-cyan");
    const colorBed = getTokenColor("--q-ink");

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(34, width / height, 0.1, 100);
    camera.position.set(0, 4.4, 9.0);
    camera.lookAt(0, 0.4, 0);

    const ambientLight = new THREE.AmbientLight(new THREE.Color("rgb(255,255,255)"), 0.95);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(new THREE.Color("rgb(255,255,255)"), 1.2);
    dirLight.position.set(4, 9, 6);
    scene.add(dirLight);

    const riverGroup = new THREE.Group();
    scene.add(riverGroup);

    const bedGeo = new THREE.BoxGeometry(9.2, 0.14, 3.2);
    const bedMat = new THREE.MeshStandardMaterial({ color: colorBed, roughness: 0.85 });
    const bed = new THREE.Mesh(bedGeo, bedMat);
    bed.position.y = -0.07;
    riverGroup.add(bed);

    const getVal = (pt: CashForecastPoint) => {
      const str =
        scenario === "optimistic"
          ? pt.optimisticBalance
          : scenario === "conservative"
          ? pt.conservativeBalance
          : pt.projectedBalance;
      return Number(str.replace(/[^0-9.-]/g, "")) || 40000;
    };

    const animatedSegments: { mesh: THREE.Mesh; targetScaleZ: number; targetScaleY: number }[] = [];

    points.slice(0, 6).forEach((pt, idx) => {
      const x = -3.5 + idx * 1.4;
      const val = getVal(pt);
      const norm = Math.max(Math.min(val / 60000, 1.4), 0.35);

      const segGeo = new THREE.BoxGeometry(1.15, 0.55, 1.2);
      segGeo.translate(0, 0.275, 0);
      const segMat = new THREE.MeshStandardMaterial({
        color: idx === points.length - 1 ? colorInflow : colorRiver,
        roughness: 0.3,
        metalness: 0.25,
      });
      const segMesh = new THREE.Mesh(segGeo, segMat);
      segMesh.position.set(x, 0, 0);
      segMesh.scale.set(1, 0.1, 0.2);
      riverGroup.add(segMesh);

      animatedSegments.push({
        mesh: segMesh,
        targetScaleZ: norm * 1.4,
        targetScaleY: norm * 1.6,
      });
    });

    let isDragging = false;
    let prevMouseX = 0;
    let targetRotationY = -0.14;
    let currentRotationY = -0.14;

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
        targetRotationY += Math.sin(elapsed * 0.75) * 0.0007;
      }
      currentRotationY += (targetRotationY - currentRotationY) * 0.1;
      riverGroup.rotation.y = currentRotationY;

      animatedSegments.forEach((seg, idx) => {
        const wave = Math.sin(elapsed * 2.2 - idx * 0.7) * 0.06;
        seg.mesh.scale.z += (seg.targetScaleZ + wave - seg.mesh.scale.z) * 0.08;
        seg.mesh.scale.y += (seg.targetScaleY + wave - seg.mesh.scale.y) * 0.08;
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
  }, [points, scenario]);

  if (!isSupported) return null;

  return (
    <div
      data-testid="cash-river-3d-scene"
      className="relative w-full h-[180px] bg-panel/40 border-2 border-ink shadow-[4px_4px_0_var(--q-ink)] overflow-hidden select-none mb-4"
    >
      <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing" />
      <div className="absolute bottom-1.5 left-2 pointer-events-none text-[10px] font-bold text-muted bg-panel/90 px-2 py-0.5 border border-ink">
        Drag to spin · 3D Cash River (Ribbon Width & Height = 30/60/90-Day Liquidity)
      </div>
    </div>
  );
};
