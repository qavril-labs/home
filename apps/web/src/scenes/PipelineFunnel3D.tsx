import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";

export interface PipelineStageRing {
  stage: string;
  count: number;
  widthScale: number;
  tokenVar: string;
}

export interface PipelineFunnel3DProps {
  stages?: PipelineStageRing[];
}

const DEFAULT_STAGES: PipelineStageRing[] = [
  { stage: "Discovery", count: 1, widthScale: 1.4, tokenVar: "--q-cyan" },
  { stage: "Proposal", count: 1, widthScale: 1.15, tokenVar: "--q-yellow" },
  { stage: "Negotiation", count: 1, widthScale: 0.9, tokenVar: "--q-violet" },
  { stage: "Closed Won", count: 1, widthScale: 0.65, tokenVar: "--q-lime" },
];

export const PipelineFunnel3D: React.FC<PipelineFunnel3DProps> = ({ stages = DEFAULT_STAGES }) => {
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
    const height = container.clientHeight || 180;

    const rootStyle = getComputedStyle(document.documentElement);
    const getTokenColor = (varName: string) => {
      const val = rootStyle.getPropertyValue(varName).trim();
      return new THREE.Color(val || "rgb(198, 255, 61)");
    };

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(34, width / height, 0.1, 100);
    camera.position.set(0, 3.8, 7.6);
    camera.lookAt(0, 0.1, 0);

    const ambientLight = new THREE.AmbientLight(new THREE.Color("rgb(255,255,255)"), 0.95);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(new THREE.Color("rgb(255,255,255)"), 1.25);
    dirLight.position.set(4, 8, 5);
    scene.add(dirLight);

    const funnelGroup = new THREE.Group();
    scene.add(funnelGroup);

    const rings: { mesh: THREE.Mesh; targetScale: number }[] = [];

    stages.forEach((st, idx) => {
      const y = 1.0 - idx * 0.62;
      const ringGeo = new THREE.TorusGeometry(1.1, 0.16, 16, 36);
      ringGeo.rotateX(Math.PI / 2);
      const ringMat = new THREE.MeshStandardMaterial({
        color: getTokenColor(st.tokenVar),
        roughness: 0.3,
        metalness: 0.25,
      });
      const ringMesh = new THREE.Mesh(ringGeo, ringMat);
      ringMesh.position.set(0, y, 0);
      ringMesh.scale.set(0.1, 0.1, 0.1);
      funnelGroup.add(ringMesh);

      rings.push({ mesh: ringMesh, targetScale: st.widthScale });
    });

    let isDragging = false;
    let prevMouseX = 0;
    let targetRotationY = 0.2;
    let currentRotationY = 0.2;

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
        targetRotationY += Math.sin(elapsed * 0.8) * 0.0008;
      }
      currentRotationY += (targetRotationY - currentRotationY) * 0.1;
      funnelGroup.rotation.y = currentRotationY;
      funnelGroup.rotation.z = Math.sin(elapsed * 0.5) * 0.04;

      rings.forEach((r) => {
        const s = r.mesh.scale.x + (r.targetScale - r.mesh.scale.x) * 0.08;
        r.mesh.scale.set(s, s, s);
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
  }, [stages]);

  if (!isSupported) return null;

  return (
    <div
      data-testid="pipeline-funnel-3d-scene"
      className="relative w-full h-[180px] bg-panel/40 border-2 border-ink shadow-[4px_4px_0_var(--q-ink)] overflow-hidden select-none mb-4"
    >
      <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing" />
      <div className="absolute bottom-1.5 left-2 pointer-events-none text-[10px] font-bold text-muted bg-panel/90 px-2 py-0.5 border border-ink">
        Drag to spin · 3D Pipeline Funnel (Stage Rings Scaled by Deal Volume)
      </div>
    </div>
  );
};
