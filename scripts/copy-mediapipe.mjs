// Copies the MediaPipe vision WASM runtime from node_modules into public/ so it
// is served from our own domain, version-matched with the installed package.
import { cpSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const src = join(process.cwd(), "node_modules/@mediapipe/tasks-vision/wasm");
const dest = join(process.cwd(), "public/mediapipe/wasm");
if (!existsSync(src)) {
  console.warn("[mediapipe] wasm folder not found, skipping copy");
  process.exit(0);
}
mkdirSync(dest, { recursive: true });
for (const f of ["vision_wasm_internal.js", "vision_wasm_internal.wasm", "vision_wasm_nosimd_internal.js", "vision_wasm_nosimd_internal.wasm"]) {
  cpSync(join(src, f), join(dest, f));
}
console.log("[mediapipe] wasm copied to public/mediapipe/wasm");
