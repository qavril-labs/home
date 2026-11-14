import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import type { PipelineDeal, DealStage } from "../types";
import { formatMoney } from "../lib/currency";

export interface PipelineFunnel3DProps {
  deals: PipelineDeal[];
  onSelectStage?: (stage: DealStage) => void;
}

interface StageSummary {
  stage: DealStage;
  count: number;
  totalValue: number;
  totalValueStr: string;
  color: number;
}

const STAGES: { stage: DealStage; color: number }[] = [
  { stage: "Lead", color: 0x9e9aa8 },        // Muted gray
  { stage: "Discovery", color: 0x00d4ff },   // Cyan
  { stage: "Proposal", color: 0x6250d6 },    // Violet
  { stage: "Negotiation", color: 0xff4fa3 }, // Pink
  { stage: "Closed Won", color: 0xc6ff3d },  // Lime
];

export const PipelineFunnel3D: React.FC<PipelineFunnel3DProps> = ({ deals, onSelectStage }) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [isSupported, setIsSupported] = useState(true);
  const [hoveredStage, setHoveredStage] = useState<StageSummary | null>(null);

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
    camera.position.set(0, 3.8, 9.2);
    camera.lookAt(0, 0, 0);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.25);
    dirLight.position.set(5, 10, 7);
    scene.add(dirLight);

    const rimLight = new THREE.DirectionalLight(0x00d4ff, 0.6);
    rimLight.position.set(-6, 2, -5);
    scene.add(rimLight);

    const funnelGroup = new THREE.Group();
    scene.add(funnelGroup);

    // Platform Base
    const plinthGeo = new THREE.CylinderGeometry(4.2, 4.4, 0.15, 32);
    const plinthMat = new THREE.MeshStandardMaterial({
      color: 0x16122e,
      roughness: 0.8,
    });
    const plinth = new THREE.Mesh(plinthGeo, plinthMat);
    plinth.position.y = -1.8;
    funnelGroup.add(plinth);

    // Calculate stage sums
    const stageSummaries: StageSummary[] = STAGES.map(({ stage, color }) => {
      const stageDeals = deals.filter((d) => d.stage === stage);
      const totalValue = stageDeals.reduce((sum, d) => sum + (parseFloat(d.amount) || 0), 0);
      return {
        stage,
        count: stageDeals.length,
        totalValue,
        totalValueStr: totalValue.toFixed(2),
        color,
      };
    });

    const interactiveMeshes: { mesh: THREE.Mesh; summary: StageSummary }[] = [];

    // Funnel rings stacked vertically from top to bottom
    const ringHeight = 0.52;
    const startY = 1.2;
    const radii = [
      { top: 3.2, bottom: 2.6 }, // Lead
      { top: 2.6, bottom: 2.1 }, // Discovery
      { top: 2.1, bottom: 1.6 }, // Proposal
      { top: 1.6, bottom: 1.1 }, // Negotiation
      { top: 1.1, bottom: 0.7 }, // Closed Won
    ];

    stageSummaries.forEach((summary, i) => {
      const r = radii[i] ?? { top: 1, bottom: 0.5 };
      const y = startY - i * (ringHeight + 0.12);

      const geo = new THREE.CylinderGeometry(r.top, r.bottom, ringHeight, 32);
      const mat = new THREE.MeshStandardMaterial({
        color: summary.color,
        roughness: 0.35,
        metalness: 0.15,
      });

      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.y = y;
      funnelGroup.add(mesh);

      // Neo-brutal edge ring wireframe
      const edgeGeo = new THREE.EdgesGeometry(geo);
      const edgeMat = new THREE.LineBasicMaterial({ color: 0x05040a, linewidth: 2 });
      const wire = new THREE.LineSegments(edgeGeo, edgeMat);
      mesh.add(wire);

      interactiveMeshes.push({ mesh, summary });
    });

    // Interaction & Animation
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
        if (hit && onSelectStage) {
          onSelectStage(hit.summary.stage);
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
      funnelGroup.rotation.y += (targetRotationY - funnelGroup.rotation.y) * 0.1;

      // Raycast hover check
      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(interactiveMeshes.map((m) => m.mesh));
      if (intersects.length > 0) {
        const hit = interactiveMeshes.find((m) => m.mesh === intersects[0]?.object);
        if (hit) {
          setHoveredStage(hit.summary);
          container.style.cursor = "pointer";
        }
      } else {
        setHoveredStage(null);
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
  }, [deals, onSelectStage]);

  if (!isSupported) {
    return (
      <div className="p-6 bg-panel border-line text-center text-sm font-bold text-muted">
        3D Funnel View is optimized for desktop browsers with motion and WebGL enabled.
      </div>
    );
  }

  return (
    <div className="relative w-full h-[320px] bg-panel border-line overflow-hidden select-none">
      <div ref={mountRef} className="w-full h-full cursor-grab" />

      {/* Legend */}
      <div className="absolute top-3 left-3 pointer-events-none flex items-center gap-2.5 bg-panel/90 border border-line px-3 py-1.5 shadow-sm text-xs font-bold text-text flex-wrap">
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 bg-cyan border border-ink" />
          <span>Discovery</span>
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 bg-violet border border-ink" />
          <span>Proposal</span>
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 bg-pink border border-ink" />
          <span>Negotiation</span>
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 bg-lime border border-ink" />
          <span>Won</span>
        </span>
        <span className="text-muted text-[11px] hidden sm:inline">· Drag to spin, click stage to filter</span>
      </div>

      {/* Tooltip */}
      {hoveredStage && (
        <div className="absolute bottom-3 left-3 bg-panel border-2 border-line p-3 shadow-[3px_3px_0_var(--q-ink)] z-20 max-w-sm pointer-events-none">
          <div className="flex items-center justify-between gap-4 mb-1">
            <span className="font-display font-black text-sm uppercase text-text">{hoveredStage.stage} Stage</span>
            <span className="px-2 py-0.5 bg-page border border-line text-[10px] font-bold">
              {hoveredStage.count} deals
            </span>
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-muted text-xs">Stage Total:</span>
            <span className="font-display font-black text-lg text-lime">
              {formatMoney(hoveredStage.totalValueStr, "$")}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
