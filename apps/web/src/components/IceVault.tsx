/**
 * The hero's 3D piece: a gold Zcash coin frozen in a block of ice, under a low winter
 * sun. The ice starts frosted over and clears as the headline thaws and as you scroll,
 * until the coin is plainly visible: the money was there, untouchable, all along.
 */

import { useEffect, useMemo, useRef, useState, type MutableRefObject } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment, Lightformer, MeshTransmissionMaterial, RoundedBox } from "@react-three/drei";
import * as THREE from "three";

export type Thaw = MutableRefObject<{ intro: number; scroll: number }>;

// The headline sits over the canvas, so the canvas never sees the pointer itself.
const pointer = { x: 0, y: 0 };
if (typeof window !== "undefined") {
  window.addEventListener(
    "pointermove",
    (e) => {
      pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
      pointer.y = -((e.clientY / window.innerHeight) * 2 - 1);
    },
    { passive: true },
  );
}

export default function IceVault({ thaw }: { thaw: Thaw }) {
  const host = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(true);

  useEffect(() => {
    const io = new IntersectionObserver(([e]) => setActive(e.isIntersecting), { rootMargin: "80px" });
    io.observe(host.current!);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={host} className="ice-canvas" aria-hidden="true">
      <Canvas
        frameloop={active ? "always" : "never"}
        dpr={[1, 1.75]}
        gl={{ antialias: true, alpha: false, powerPreference: "high-performance" }}
        camera={{ position: [0, 0, 7], fov: 30 }}
      >
        <Scene thaw={thaw} />
      </Canvas>
    </div>
  );
}

function useLayout() {
  const { viewport, size } = useThree();
  const wide = size.width >= 900;
  const scale = wide ? Math.min(1.05, viewport.height / 5.6) : Math.min(0.7, viewport.width / 4.4);
  const x = wide ? viewport.width * 0.27 : 0;
  const y = wide ? -0.05 : -viewport.height * 0.2;
  return { wide, scale, x, y, viewport, size };
}

function Scene({ thaw }: { thaw: Thaw }) {
  const { wide, scale, x, y, viewport, size } = useLayout();
  const scene = useThree((s) => s.scene);

  // The sky is painted into the scene itself, so the ice has something to refract:
  // a pale winter gradient with a low gold sun right behind the block.
  const sky = useMemo(() => {
    const w = Math.max(64, Math.round(size.width / 3));
    const h = Math.max(64, Math.round(size.height / 3));
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const g = c.getContext("2d")!;
    const v = g.createLinearGradient(0, 0, 0, h);
    v.addColorStop(0, "#c6daec");
    v.addColorStop(0.55, "#dde9f4");
    v.addColorStop(1, "#f2f6fa");
    g.fillStyle = v;
    g.fillRect(0, 0, w, h);
    const sx = (0.5 + x / viewport.width) * w;
    const sy = (0.5 - (y + 0.35 * scale) / viewport.height) * h;
    const r = Math.max(w, h) * (wide ? 0.32 : 0.5);
    const sun = g.createRadialGradient(sx, sy, 0, sx, sy, r);
    sun.addColorStop(0, "rgba(255, 214, 120, 0.95)");
    sun.addColorStop(0.18, "rgba(250, 196, 92, 0.55)");
    sun.addColorStop(0.5, "rgba(255, 190, 150, 0.16)");
    sun.addColorStop(1, "rgba(255, 190, 150, 0)");
    g.fillStyle = sun;
    g.fillRect(0, 0, w, h);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }, [size.width, size.height, x, y, scale, wide, viewport.width, viewport.height]);

  useEffect(() => {
    scene.background = sky;
    return () => sky.dispose();
  }, [scene, sky]);

  return (
    <>
      <ambientLight intensity={0.7} />
      <directionalLight position={[3, 4, 5]} intensity={1.6} color="#fff4dc" />
      <Environment resolution={256} frames={1}>
        <Lightformer form="rect" intensity={3} position={[0, 4, 3]} scale={[8, 1.4, 1]} color="#ffffff" />
        <Lightformer form="rect" intensity={2} position={[-5, 0, 2]} rotation-y={Math.PI / 2} scale={[6, 3, 1]} color="#d6e8ff" />
        <Lightformer form="rect" intensity={2.4} position={[5, -1, 2]} rotation-y={-Math.PI / 2} scale={[6, 2, 1]} color="#ffd88a" />
        <Lightformer form="ring" intensity={1.6} position={[0, 0, -6]} scale={6} color="#ffe2a8" />
      </Environment>
      <group position={[x, y, 0]} scale={scale}>
        <Block thaw={thaw} />
      </group>
    </>
  );
}

function Block({ thaw }: { thaw: Thaw }) {
  const group = useRef<THREE.Group>(null);
  const coin = useRef<THREE.Group>(null);
  const ice = useRef<THREE.MeshPhysicalMaterial & { distortion: number; chromaticAberration: number }>(null);
  const smoothed = useRef(0);
  const { size } = useThree();
  const light = size.width < 700;

  const face = useMemo(() => coinFace(), []);
  const bubbles = useMemo(() => {
    const pts: [number, number, number, number][] = [];
    for (let i = 0; i < 46; i++) {
      pts.push([(Math.random() - 0.5) * 1.7, (Math.random() - 0.5) * 1.7, (Math.random() - 0.5) * 1.7, 0.012 + Math.random() * 0.03]);
    }
    return pts;
  }, []);

  useFrame((state, dt) => {
    const t = state.clock.elapsedTime;
    const target = Math.min(1, Math.max(thaw.current.intro * 0.55, thaw.current.scroll));
    smoothed.current += (target - smoothed.current) * Math.min(1, dt * 2.2);
    const k = smoothed.current;

    if (ice.current) {
      ice.current.roughness = THREE.MathUtils.lerp(0.26, 0.03, k);
      ice.current.distortion = THREE.MathUtils.lerp(0.55, 0.12, k);
      ice.current.chromaticAberration = THREE.MathUtils.lerp(0.02, 0.08, k);
    }
    if (group.current) {
      const px = pointer.x;
      const py = pointer.y;
      group.current.rotation.y = THREE.MathUtils.lerp(group.current.rotation.y, 0.5 + Math.sin(t * 0.25) * 0.12 + px * 0.25 + k * 0.6, 0.06);
      group.current.rotation.x = THREE.MathUtils.lerp(group.current.rotation.x, 0.32 - py * 0.18 - k * 0.12, 0.06);
      group.current.position.y = Math.sin(t * 0.8) * 0.06;
    }
    if (coin.current) {
      coin.current.rotation.y = t * (0.35 + k * 0.9);
      coin.current.position.z = k * 0.35;
    }
  });

  return (
    <group ref={group}>
      <RoundedBox args={[2.2, 2.2, 2.2]} radius={0.26} smoothness={6} renderOrder={2}>
        <MeshTransmissionMaterial
          ref={ice as never}
          samples={light ? 3 : 6}
          resolution={light ? 256 : 512}
          thickness={1.4}
          roughness={0.26}
          ior={1.31}
          chromaticAberration={0.02}
          anisotropicBlur={0.25}
          distortion={0.55}
          distortionScale={0.35}
          temporalDistortion={0.04}
          transmission={1}
          color="#eef6ff"
          attenuationColor="#e3effc"
          attenuationDistance={6}
          clearcoat={1}
          clearcoatRoughness={0.2}
        />
      </RoundedBox>

      <group ref={coin} rotation={[0.18, 0, -0.22]}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.62, 0.62, 0.13, 72]} />
          <meshStandardMaterial attach="material-0" color="#d99a1e" emissive="#a86b00" emissiveIntensity={0.35} metalness={0.7} roughness={0.32} />
          <meshStandardMaterial attach="material-1" map={face} emissive="#f6b637" emissiveMap={face} emissiveIntensity={0.3} metalness={0.6} roughness={0.3} />
          <meshStandardMaterial attach="material-2" map={face} emissive="#f6b637" emissiveMap={face} emissiveIntensity={0.3} metalness={0.6} roughness={0.3} />
        </mesh>
      </group>

      {bubbles.map(([bx, by, bz, r], i) => (
        <mesh key={i} position={[bx, by, bz]}>
          <sphereGeometry args={[r, 10, 10]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.55} />
        </mesh>
      ))}
    </group>
  );
}

/** The coin's face: gold, a raised rim and the Zcash Z with its two ticks. */
function coinFace(): THREE.CanvasTexture {
  const s = 512;
  const c = document.createElement("canvas");
  c.width = c.height = s;
  const g = c.getContext("2d")!;
  const gold = g.createRadialGradient(s * 0.38, s * 0.32, 10, s / 2, s / 2, s / 2);
  gold.addColorStop(0, "#ffe9a8");
  gold.addColorStop(0.45, "#f6b637");
  gold.addColorStop(1, "#b97a0c");
  g.fillStyle = gold;
  g.fillRect(0, 0, s, s);

  g.strokeStyle = "rgba(122, 75, 0, 0.55)";
  g.lineWidth = 12;
  g.beginPath();
  g.arc(s / 2, s / 2, s * 0.42, 0, Math.PI * 2);
  g.stroke();

  g.lineCap = "square";
  g.lineJoin = "miter";
  g.strokeStyle = "#6e4300";
  g.lineWidth = 44;
  g.beginPath();
  g.moveTo(168, 172);
  g.lineTo(344, 172);
  g.lineTo(168, 340);
  g.lineTo(344, 340);
  g.stroke();
  g.beginPath();
  g.moveTo(256, 104);
  g.lineTo(256, 160);
  g.moveTo(256, 352);
  g.lineTo(256, 408);
  g.stroke();

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}
