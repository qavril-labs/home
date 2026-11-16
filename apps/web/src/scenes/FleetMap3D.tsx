import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import type { ConsignmentShipment, FleetVehicle } from "../types";
import { formatMoney } from "../lib/currency";

export interface FleetMap3DProps {
  consignments: ConsignmentShipment[];
  vehicles: FleetVehicle[];
  onSelectConsignment?: (c: ConsignmentShipment) => void;
}

export const FleetMap3D: React.FC<FleetMap3DProps> = ({
  consignments,
  vehicles,
  onSelectConsignment,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [isSupported, setIsSupported] = useState<boolean>(true);
  const [hoveredConsignment, setHoveredConsignment] = useState<ConsignmentShipment | null>(null);

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
    const width = container.clientWidth || 640;
    const height = container.clientHeight || 340;

    // 1. Scene, Camera, Renderer
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0e0e12); // Token dark surface

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(0, 55, 65);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    container.replaceChildren(renderer.domElement);

    // 2. Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
    dirLight.position.set(30, 60, 40);
    scene.add(dirLight);

    // 3. Tilted Map Grid Plane
    const grid = new THREE.GridHelper(80, 20, 0x00d4ff, 0x222230);
    grid.position.y = 0;
    scene.add(grid);

    // Base dark map plate
    const plateGeo = new THREE.PlaneGeometry(82, 82);
    const plateMat = new THREE.MeshBasicMaterial({
      color: 0x141419,
      depthWrite: false,
    });
    const plate = new THREE.Mesh(plateGeo, plateMat);
    plate.rotation.x = -Math.PI / 2;
    plate.position.y = -0.1;
    scene.add(plate);

    // Group for animated elements
    const dynamicGroup = new THREE.Group();
    scene.add(dynamicGroup);

    const raycastMeshes: { mesh: THREE.Mesh; consignment: ConsignmentShipment }[] = [];
    const pulseSpheres: { mesh: THREE.Mesh; curve: THREE.QuadraticBezierCurve3; progress: number; speed: number }[] = [];

    // Helper to map normalized coordinates [-100, 100] to 3D world space
    const toWorld = (coords: [number, number]): THREE.Vector3 => {
      const scale = 0.35;
      return new THREE.Vector3(coords[0] * scale, 0.5, -coords[1] * scale);
    };

    // 4. Build Route Arcs & Location Nodes
    consignments.forEach((consignment) => {
      const vStart = toWorld(consignment.originCoords);
      const vEnd = toWorld(consignment.destCoords);

      // Height of arc proportional to distance
      const dist = vStart.distanceTo(vEnd);
      const arcHeight = Math.max(6, dist * 0.45);
      const vMid = new THREE.Vector3()
        .addVectors(vStart, vEnd)
        .multiplyScalar(0.5);
      vMid.y = arcHeight;

      const curve = new THREE.QuadraticBezierCurve3(vStart, vMid, vEnd);
      const points = curve.getPoints(40);
      const curveGeo = new THREE.BufferGeometry().setFromPoints(points);

      // Arc Color based on status
      const arcColor =
        consignment.status === "delivered"
          ? 0xc6ff3d // Lime
          : consignment.status === "out_for_delivery"
          ? 0x00d4ff // Cyan
          : 0xff4fa3; // Pink

      const arcMat = new THREE.LineBasicMaterial({
        color: arcColor,
        linewidth: 2,
        transparent: true,
        opacity: 0.85,
      });
      const arcLine = new THREE.Line(curveGeo, arcMat);
      dynamicGroup.add(arcLine);

      // Origin Pin
      const pinGeo = new THREE.CylinderGeometry(0.8, 0.8, 0.6, 12);
      const pinMat = new THREE.MeshStandardMaterial({
        color: 0x00d4ff,
        roughness: 0.3,
        metalness: 0.6,
      });
      const originPin = new THREE.Mesh(pinGeo, pinMat);
      originPin.position.copy(vStart);
      dynamicGroup.add(originPin);

      // Destination Target Marker
      const destMat = new THREE.MeshStandardMaterial({
        color: arcColor,
        roughness: 0.2,
      });
      const destPin = new THREE.Mesh(pinGeo, destMat);
      destPin.position.copy(vEnd);
      dynamicGroup.add(destPin);

      // Clickable Raycast Marker at midpoint peak
      const hitGeo = new THREE.SphereGeometry(1.6, 12, 12);
      const hitMat = new THREE.MeshBasicMaterial({ visible: false });
      const hitSphere = new THREE.Mesh(hitGeo, hitMat);
      hitSphere.position.copy(vMid);
      dynamicGroup.add(hitSphere);
      raycastMeshes.push({ mesh: hitSphere, consignment });

      // Pulsing Transit Particle traveling along arc
      if (consignment.status !== "delivered") {
        const pulseGeo = new THREE.SphereGeometry(0.75, 8, 8);
        const pulseMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
        const pulseMesh = new THREE.Mesh(pulseGeo, pulseMat);
        dynamicGroup.add(pulseMesh);
        pulseSpheres.push({
          mesh: pulseMesh,
          curve,
          progress: Math.random(),
          speed: 0.003 + Math.random() * 0.003,
        });
      }
    });

    // 5. Build Fleet Vehicles on Ground Plane
    vehicles.forEach((veh) => {
      const pos = toWorld(veh.positionCoords);
      const vehGeo = new THREE.BoxGeometry(1.8, 1.2, 2.6);
      const vehMat = new THREE.MeshStandardMaterial({
        color: veh.status === "moving" ? 0xc6ff3d : veh.status === "loading" ? 0x00d4ff : 0xffcc00,
        roughness: 0.4,
      });
      const vehMesh = new THREE.Mesh(vehGeo, vehMat);
      vehMesh.position.set(pos.x, 0.6, pos.z);
      dynamicGroup.add(vehMesh);
    });

    // 6. Camera Drag Controls & Raycaster
    let isDragging = false;
    let prevMouseX = 0;
    let rotY = 0;

    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const onMouseDown = (e: MouseEvent) => {
      isDragging = true;
      prevMouseX = e.clientX;
    };

    const onMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      if (isDragging) {
        const deltaX = e.clientX - prevMouseX;
        rotY += deltaX * 0.006;
        prevMouseX = e.clientX;
      }

      // Check hover hit
      raycaster.setFromCamera(mouse, camera);
      const hits = raycaster.intersectObjects(raycastMeshes.map((r) => r.mesh));
      if (hits.length > 0) {
        const matched = raycastMeshes.find((r) => r.mesh === hits[0]!.object);
        if (matched) {
          setHoveredConsignment(matched.consignment);
          container.style.cursor = "pointer";
          return;
        }
      }
      setHoveredConsignment(null);
      container.style.cursor = isDragging ? "grabbing" : "grab";
    };

    const onMouseUp = () => {
      isDragging = false;
      container.style.cursor = "grab";
    };

    const onClick = () => {
      if (hoveredConsignment && onSelectConsignment) {
        onSelectConsignment(hoveredConsignment);
      }
    };

    container.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    container.addEventListener("click", onClick);

    // 7. Animation Loop
    let animId = 0;
    let clockTime = 0;

    const animate = () => {
      animId = requestAnimationFrame(animate);
      clockTime += 0.01;

      // Gentle idle sway + user rotation
      dynamicGroup.rotation.y = rotY + Math.sin(clockTime * 0.4) * 0.04;
      plate.rotation.z = -dynamicGroup.rotation.y;

      // Move transit particles
      pulseSpheres.forEach((p) => {
        p.progress += p.speed;
        if (p.progress > 1) p.progress = 0;
        const pt = p.curve.getPoint(p.progress);
        p.mesh.position.copy(pt);
      });

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      cancelAnimationFrame(animId);
      container.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      container.removeEventListener("click", onClick);
      renderer.dispose();
    };
  }, [consignments, vehicles, onSelectConsignment, hoveredConsignment]);

  if (!isSupported) {
    return (
      <div className="p-4 bg-page border-line text-xs font-mono text-muted text-center" data-testid="fleet-map-2d-fallback">
        3D WebGL motion disabled. Displaying active logistics consignments in 2D below.
      </div>
    );
  }

  return (
    <div className="relative w-full h-[340px] bg-ink border-2 border-ink shadow-[4px_4px_0_var(--q-ink)] overflow-hidden select-none" data-testid="fleet-map-3d-canvas">
      <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

      {/* Instruction Badge */}
      <div className="absolute bottom-3 left-3 pointer-events-none bg-panel/90 backdrop-blur-sm border-line px-2.5 py-1 text-[11px] font-bold text-text flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-cyan animate-pulse" />
        <span>Drag to rotate · Arcs indicate active transit routes · Pulse is freight telemetry</span>
      </div>

      {/* Legend Badge */}
      <div className="absolute top-3 right-3 pointer-events-none bg-panel/90 backdrop-blur-sm border-line px-3 py-1.5 text-[11px] font-bold flex items-center gap-3">
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 bg-pink border border-ink" />
          <span>In Transit</span>
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 bg-cyan border border-ink" />
          <span>Out for Delivery</span>
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 bg-lime border border-ink" />
          <span>Delivered</span>
        </span>
      </div>

      {/* Hover Tooltip Overlay */}
      {hoveredConsignment && (
        <div className="absolute top-3 left-3 pointer-events-none bg-panel border-2 border-ink shadow-[3px_3px_0_var(--q-ink)] p-3 text-xs space-y-1 z-20 max-w-xs">
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono font-bold text-ink bg-cyan px-1.5 py-0.5 text-[10px]">
              {hoveredConsignment.trackingNumber}
            </span>
            <span className="font-bold text-[10px] uppercase text-muted">
              {hoveredConsignment.carrier}
            </span>
          </div>
          <div className="font-bold text-text">
            {hoveredConsignment.originCity} → {hoveredConsignment.destinationCity}
          </div>
          <div className="flex justify-between items-center pt-1 border-t border-grid text-[11px]">
            <span className="text-muted">Value: {formatMoney(hoveredConsignment.value)}</span>
            <span className="font-mono text-good font-bold">ETA: {hoveredConsignment.eta}</span>
          </div>
        </div>
      )}
    </div>
  );
};
