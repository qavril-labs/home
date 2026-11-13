import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import type { MonthlyTrend } from "../types";
import { formatMoney } from "../lib/currency";

export interface MoneyCity3DProps {
  trendData: MonthlyTrend[];
  cashAmount: string;
  currencySymbol?: string;
}

export const MoneyCity3D: React.FC<MoneyCity3DProps> = ({
  trendData,
  cashAmount,
  currencySymbol = "$",
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [isSupported, setIsSupported] = useState(true);

  useEffect(() => {
    // Check hardware / environment suitability per UI contract:
    // "Who sees it: desktops with a fine pointer that allow motion and have WebGL."
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
    const width = container.clientWidth || 400;
    const height = container.clientHeight || 180;

    // Token colors:
    const SALES_COLOR = 0x6250d6; // series-in
    const EXPENSES_COLOR = 0xeb6834; // series-out
    const CASH_COLOR = 0xc6ff3d; // lime cash
    const PLINTH_COLOR = 0x16122e; // panel dark

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(34, width / height, 0.1, 100);
    camera.position.set(0, 4.2, 8.8);
    camera.lookAt(0, 0.4, 0);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.9);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
    dirLight.position.set(5, 10, 6);
    scene.add(dirLight);

    const cityGroup = new THREE.Group();
    scene.add(cityGroup);

    // Plinth platform base
    const plinthGeo = new THREE.BoxGeometry(9.6, 0.15, 3.4);
    const plinthMat = new THREE.MeshStandardMaterial({
      color: PLINTH_COLOR,
      roughness: 0.8,
    });
    const plinth = new THREE.Mesh(plinthGeo, plinthMat);
    plinth.position.y = -0.075;
    cityGroup.add(plinth);

    // Columns for 6 months
    const columns: {
      mesh: THREE.Mesh;
      targetHeight: number;
      month: string;
      series: "sales" | "expenses";
      val: string;
    }[] = [];

    const maxVal = Math.max(
      ...trendData.map((d) => Math.max(d.salesRaw, d.expensesRaw)),
      1000
    );

    const colGeo = new THREE.BoxGeometry(0.42, 1, 0.42);
    colGeo.translate(0, 0.5, 0);

    trendData.slice(0, 6).forEach((item, i) => {
      const x = -3.4 + i * 1.18;

      // Sales Column
      const salesTarget = Math.max((item.salesRaw / maxVal) * 2.2, 0.1);
      const salesMesh = new THREE.Mesh(
        colGeo,
        new THREE.MeshStandardMaterial({
          color: SALES_COLOR,
          roughness: 0.35,
          metalness: 0.2,
        })
      );
      salesMesh.position.set(x - 0.24, 0, 0.2);
      salesMesh.scale.y = 0.01;
      cityGroup.add(salesMesh);
      columns.push({
        mesh: salesMesh,
        targetHeight: salesTarget,
        month: item.month,
        series: "sales",
        val: item.sales,
      });

      // Expense Column
      const expTarget = Math.max((item.expensesRaw / maxVal) * 2.2, 0.1);
      const expMesh = new THREE.Mesh(
        colGeo,
        new THREE.MeshStandardMaterial({
          color: EXPENSES_COLOR,
          roughness: 0.35,
          metalness: 0.2,
        })
      );
      expMesh.position.set(x + 0.24, 0, 0.2);
      expMesh.scale.y = 0.01;
      cityGroup.add(expMesh);
      columns.push({
        mesh: expMesh,
        targetHeight: expTarget,
        month: item.month,
        series: "expenses",
        val: item.expenses,
      });
    });

    // Cash Coin Stack at right side
    const coinGroup = new THREE.Group();
    coinGroup.position.set(3.9, 0, 0.2);
    cityGroup.add(coinGroup);

    const coinCount = Math.min(
      Math.max(Math.round((parseFloat(cashAmount || "0") / maxVal) * 12), 2),
      16
    );
    const coinGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.09, 24);
    const coinMat = new THREE.MeshStandardMaterial({
      color: CASH_COLOR,
      roughness: 0.25,
      metalness: 0.65,
    });

    for (let c = 0; c < coinCount; c++) {
      const coinMesh = new THREE.Mesh(coinGeo, coinMat);
      coinMesh.position.y = c * 0.1 + 0.05;
      coinGroup.add(coinMesh);
    }

    // Gentle idle sway and rotation drag
    let isDragging = false;
    let prevMouseX = 0;
    let targetRotationY = -0.15;
    let currentRotationY = -0.15;

    const onMouseDown = (e: MouseEvent) => {
      isDragging = true;
      prevMouseX = e.clientX;
    };

    const onMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        const delta = e.clientX - prevMouseX;
        targetRotationY += delta * 0.008;
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

    // Animation loop
    let animId: number;
    let clock = new THREE.Clock();

    const animate = () => {
      animId = requestAnimationFrame(animate);
      const elapsed = clock.getElapsedTime();

      // Idle sway
      if (!isDragging) {
        targetRotationY += Math.sin(elapsed * 0.8) * 0.0008;
      }
      currentRotationY += (targetRotationY - currentRotationY) * 0.1;
      cityGroup.rotation.y = currentRotationY;

      // Height transition ease
      columns.forEach((c) => {
        c.mesh.scale.y += (c.targetHeight - c.mesh.scale.y) * 0.08;
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
  }, [trendData, cashAmount]);

  if (!isSupported) {
    return (
      <div className="h-full min-h-[140px] flex flex-col justify-center items-center p-4 border border-dashed border-ink bg-page/50 text-center">
        <span className="text-xs font-bold text-muted uppercase tracking-wider">
          Ledger Pulse
        </span>
        <p className="text-xs font-medium text-text mt-1">
          Cash: <span className="text-good font-bold font-mono">{formatMoney(cashAmount, currencySymbol)}</span> · 6-Month Ledger Trend Ready
        </p>
      </div>
    );
  }

  return (
    <div className="relative w-full h-[180px] bg-panel/40 border-line shadow-sm overflow-hidden select-none">
      <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing" />
      <div className="absolute bottom-1.5 left-2 pointer-events-none text-[10px] font-bold text-muted bg-panel/80 px-2 py-0.5 border border-grid">
        Drag to spin · Columns: Sales (Violet) & Expenses (Orange) · Coins: Cash ({formatMoney(cashAmount, currencySymbol)})
      </div>
    </div>
  );
};
