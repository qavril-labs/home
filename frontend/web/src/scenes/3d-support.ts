/**
 * Checks WebGL capability without loading Three.js
 */
export function hasWebGL(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const canvas = document.createElement("canvas");
    return !!(
      window.WebGLRenderingContext &&
      (canvas.getContext("webgl2") ||
        canvas.getContext("webgl") ||
        (canvas.getContext("experimental-webgl") as any))
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
