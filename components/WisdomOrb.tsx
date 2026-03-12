'use client';
// ============================================================
// WisdomOrb — Iridescent Soap-Bubble Oracle
// Soft pastel rainbow reflections, translucent glass surface,
// delicate inner sparkles, and gentle breathing animation.
// Built with Three.js via @react-three/fiber
// ============================================================

import { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { AvatarState, VisemeEvent } from '@/types';
import { VisemeInterpolator, type VisemeShape } from '@/lib/avatar/visemes';
import { AvatarStateMachine } from '@/lib/avatar/states';

interface WisdomOrbProps {
  avatarState: AvatarState;
  visemeEvents?: VisemeEvent[];
  mouthShape?: VisemeShape;
  className?: string;
}

export default function WisdomOrb({ avatarState, visemeEvents, mouthShape, className }: WisdomOrbProps) {
  return (
    <div className={`relative ${className ?? ''}`}>
      <Canvas
        camera={{ position: [0, 0, 3.8], fov: 40 }}
        gl={{ antialias: true, alpha: true, premultipliedAlpha: false }}
        style={{ background: 'transparent' }}
        dpr={[1, 2]}
      >
        <ambientLight intensity={0.3} color="#fff5ee" />
        <pointLight position={[3, 4, 5]} intensity={0.6} color="#fce4ec" />
        <pointLight position={[-4, -2, 3]} intensity={0.4} color="#e8f5e9" />
        <pointLight position={[0, -3, 4]} intensity={0.2} color="#fff3e0" />

        {/* Main iridescent sphere */}
        <BubbleOrb
          avatarState={avatarState}
          visemeEvents={visemeEvents}
          mouthShape={mouthShape}
        />

        {/* Pastel outer glow — no grey */}
        <SoftHalo avatarState={avatarState} />

        {/* Delicate sparkle particles inside */}
        <InnerSparkles avatarState={avatarState} />
      </Canvas>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// BUBBLE ORB — Iridescent soap-bubble sphere
// ────────────────────────────────────────────────────────────

function BubbleOrb({
  avatarState,
  visemeEvents,
  mouthShape,
}: {
  avatarState: AvatarState;
  visemeEvents?: VisemeEvent[];
  mouthShape?: VisemeShape;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const stateMachine = useRef(new AvatarStateMachine());
  const visemeInterpolator = useRef(new VisemeInterpolator());
  const timeRef = useRef(0);

  useMemo(() => {
    if (visemeEvents && visemeEvents.length > 0) {
      visemeInterpolator.current.loadVisemes(visemeEvents);
    }
  }, [visemeEvents]);

  const shader = useMemo(
    () => ({
      uniforms: {
        uTime: { value: 0 },
        uMorphAmount: { value: 0.02 },
        uMouthOpen: { value: 0 },
        uScale: { value: 1.0 },
        uIridescenceShift: { value: 0.0 },
        uGlowIntensity: { value: 0.4 },
      },
      vertexShader: /* glsl */ `
        uniform float uTime;
        uniform float uMorphAmount;
        uniform float uMouthOpen;
        uniform float uScale;

        varying vec3 vNormal;
        varying vec3 vWorldNormal;
        varying vec3 vViewDir;
        varying vec3 vPosition;
        varying vec2 vUv;

        // Simplex noise
        vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
        vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
        vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
        vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

        float snoise(vec3 v) {
          const vec2 C = vec2(1.0/6.0, 1.0/3.0);
          const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
          vec3 i = floor(v + dot(v, C.yyy));
          vec3 x0 = v - i + dot(i, C.xxx);
          vec3 g = step(x0.yzx, x0.xyz);
          vec3 l = 1.0 - g;
          vec3 i1 = min(g.xyz, l.zxy);
          vec3 i2 = max(g.xyz, l.zxy);
          vec3 x1 = x0 - i1 + C.xxx;
          vec3 x2 = x0 - i2 + C.yyy;
          vec3 x3 = x0 - D.yyy;
          i = mod289(i);
          vec4 p = permute(permute(permute(
            i.z + vec4(0.0, i1.z, i2.z, 1.0))
            + i.y + vec4(0.0, i1.y, i2.y, 1.0))
            + i.x + vec4(0.0, i1.x, i2.x, 1.0));
          float n_ = 0.142857142857;
          vec3 ns = n_ * D.wyz - D.xzx;
          vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
          vec4 x_ = floor(j * ns.z);
          vec4 y_ = floor(j - 7.0 * x_);
          vec4 x = x_ * ns.x + ns.yyyy;
          vec4 y = y_ * ns.x + ns.yyyy;
          vec4 h = 1.0 - abs(x) - abs(y);
          vec4 b0 = vec4(x.xy, y.xy);
          vec4 b1 = vec4(x.zw, y.zw);
          vec4 s0 = floor(b0)*2.0 + 1.0;
          vec4 s1 = floor(b1)*2.0 + 1.0;
          vec4 sh = -step(h, vec4(0.0));
          vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
          vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
          vec3 p0 = vec3(a0.xy, h.x);
          vec3 p1 = vec3(a0.zw, h.y);
          vec3 p2 = vec3(a1.xy, h.z);
          vec3 p3 = vec3(a1.zw, h.w);
          vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
          p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
          vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
          m = m * m;
          return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
        }

        void main() {
          vNormal = normalize(normalMatrix * normal);
          vWorldNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
          vPosition = position;
          vUv = uv;

          // Very gentle organic breathing deformation
          float noise = snoise(position * 2.0 + uTime * 0.3) * uMorphAmount;

          // Mouth deformation
          float mouthMask = smoothstep(-0.2, -0.7, position.y);
          float mouthDeform = mouthMask * uMouthOpen * 0.2;

          vec3 displaced = position + normal * (noise + mouthDeform);
          displaced *= uScale;

          vec4 worldPos = modelMatrix * vec4(displaced, 1.0);
          vViewDir = normalize(cameraPosition - worldPos.xyz);

          gl_Position = projectionMatrix * modelViewMatrix * vec4(displaced, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uTime;
        uniform float uIridescenceShift;
        uniform float uGlowIntensity;

        varying vec3 vNormal;
        varying vec3 vWorldNormal;
        varying vec3 vViewDir;
        varying vec3 vPosition;
        varying vec2 vUv;

        // Vivid pastel iridescence — friendly, warm, colorful
        vec3 iridescence(float angle, float shift) {
          float t = angle * 2.0 + shift;

          // Rich pastel cycling: peach → lavender → mint → sky → rose
          vec3 color;
          color.r = 0.75 + 0.25 * sin(t * 6.2831 + 0.0);
          color.g = 0.68 + 0.28 * sin(t * 6.2831 + 2.094);
          color.b = 0.78 + 0.22 * sin(t * 6.2831 + 4.189);

          // Warm peach/coral push
          color += vec3(0.12, -0.04, 0.06) * sin(t * 3.0 + 1.0);
          // Cool mint accent
          color += vec3(-0.05, 0.08, 0.06) * sin(t * 4.5 + 2.5);

          return clamp(color, 0.0, 1.0);
        }

        void main() {
          float NdotV = max(dot(normalize(vNormal), normalize(vViewDir)), 0.0);

          // ── Fresnel ──
          float fresnel = pow(1.0 - NdotV, 2.0);
          float rimLight = pow(1.0 - NdotV, 4.0);

          // ── Iridescence ──
          float iriShift = uTime * 0.1 + uIridescenceShift;

          // Layer 1: view-angle iridescence
          vec3 iriColor1 = iridescence(NdotV, iriShift);

          // Layer 2: surface-position bands (flowing color)
          float bandAngle = vPosition.y * 0.5 + vPosition.x * 0.3 + uTime * 0.07;
          vec3 iriColor2 = iridescence(bandAngle, iriShift + 0.5);

          // Layer 3: slow large-scale color drift
          float driftAngle = length(vPosition.xz) * 0.8 + uTime * 0.04;
          vec3 iriColor3 = iridescence(driftAngle, iriShift + 1.2);

          vec3 iri = iriColor1 * 0.45 + iriColor2 * 0.35 + iriColor3 * 0.2;

          // ── Base: warm pastel body (NOT grey) ──
          // Soft peach-lavender that's clearly colored
          vec3 baseColor = vec3(0.92, 0.82, 0.88);

          // Per-state base tint: each state gets a friendly color
          // idle = soft peach, listening = mint, thinking = warm gold, speaking = lavender
          vec3 stateTint =
            uIridescenceShift < 0.1 ? vec3(0.95, 0.85, 0.82)  // idle: peach
            : uIridescenceShift < 0.2 ? vec3(0.88, 0.82, 0.95) // speaking: lavender
            : uIridescenceShift < 0.4 ? vec3(0.80, 0.92, 0.88) // listening: mint
            : vec3(0.95, 0.90, 0.78);                           // thinking: warm gold

          baseColor = mix(baseColor, stateTint, 0.5);

          // ── Combine: rich iridescent surface ──
          // More iridescence everywhere, not just edges
          vec3 surfaceColor = mix(baseColor, iri, fresnel * 0.5 + 0.4);

          // Colored inner glow that pulses
          float innerGlow = 0.5 + 0.5 * sin(uTime * 1.2 + vPosition.y * 2.0);
          vec3 innerColor = mix(
            vec3(0.95, 0.85, 0.80),  // warm peach
            vec3(0.82, 0.85, 0.95),  // cool lavender
            0.5 + 0.5 * sin(uTime * 0.5)
          ) * innerGlow * 0.2 * NdotV;

          // Rim: vivid pastel glow at edges — shifts between peach and lilac
          vec3 rimTint = mix(
            vec3(1.0, 0.78, 0.72),   // warm peach
            vec3(0.85, 0.75, 1.0),   // lilac
            0.5 + 0.5 * sin(uTime * 0.6 + vPosition.y * 2.0)
          );
          vec3 rimColor = rimTint * rimLight * 0.7 * uGlowIntensity;

          // Specular highlights
          float spec1 = pow(max(dot(normalize(vNormal), normalize(vec3(0.5, 0.7, 1.0))), 0.0), 32.0);
          float spec2 = pow(max(dot(normalize(vNormal), normalize(vec3(-0.6, 0.3, 0.8))), 0.0), 48.0);
          vec3 specular = (vec3(1.0, 0.95, 0.97) * spec1 + vec3(0.95, 0.97, 1.0) * spec2) * 0.35;

          vec3 finalColor = surfaceColor + innerColor + rimColor + specular;

          // ── Alpha: much more opaque so colors read clearly ──
          float alpha = 0.55 + fresnel * 0.35 + rimLight * 0.1;
          alpha *= uGlowIntensity * 1.4;
          alpha = clamp(alpha, 0.3, 0.92);

          gl_FragColor = vec4(finalColor, alpha);
        }
      `,
    }),
    []
  );

  useFrame((_, delta) => {
    timeRef.current += delta;

    stateMachine.current.setState(avatarState);
    const visuals = stateMachine.current.update(delta);
    const currentMouth = mouthShape ?? visemeInterpolator.current.update(delta * 1000);

    if (materialRef.current) {
      const u = materialRef.current.uniforms;
      u.uTime.value = timeRef.current;
      u.uMorphAmount.value = visuals.morphAmount * 0.4; // Gentler deformation for bubble
      u.uMouthOpen.value = currentMouth.mouthOpen;
      u.uScale.value = visuals.scale;
      u.uGlowIntensity.value = visuals.glowIntensity;

      // Shift iridescence per state
      u.uIridescenceShift.value =
        avatarState === 'listening' ? 0.3
        : avatarState === 'thinking' ? 0.6
        : avatarState === 'speaking' ? 0.15
        : 0.0;
    }

    if (meshRef.current) {
      meshRef.current.rotation.y += delta * visuals.rotationSpeed * 0.4;
      meshRef.current.rotation.x = Math.sin(timeRef.current * 0.2) * 0.03;
    }
  });

  return (
    <mesh ref={meshRef}>
      <sphereGeometry args={[1.1, 64, 64]} />
      <shaderMaterial
        ref={materialRef}
        attach="material"
        args={[shader]}
        transparent
        side={THREE.FrontSide}
        depthWrite={false}
      />
    </mesh>
  );
}

// ────────────────────────────────────────────────────────────
// SOFT HALO — Dreamy outer glow
// ────────────────────────────────────────────────────────────

function SoftHalo({ avatarState }: { avatarState: AvatarState }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const timeRef = useRef(0);
  const stateMachine = useRef(new AvatarStateMachine());

  const shader = useMemo(
    () => ({
      uniforms: {
        uTime: { value: 0 },
        uIntensity: { value: 0.3 },
      },
      vertexShader: /* glsl */ `
        varying vec3 vNormal;
        varying vec3 vPosition;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          vPosition = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uTime;
        uniform float uIntensity;
        varying vec3 vNormal;
        varying vec3 vPosition;

        void main() {
          vec3 viewDir = normalize(cameraPosition - vPosition);
          float fresnel = pow(1.0 - max(dot(vNormal, viewDir), 0.0), 2.5);

          // Breathing pulse
          float pulse = 0.8 + 0.2 * sin(uTime * 0.9);

          // Rotating pastel glow — peach → rose → lavender → mint
          float angle = atan(vPosition.y, vPosition.x) + uTime * 0.15;
          vec3 color1 = vec3(1.0, 0.80, 0.75);   // peach-coral
          vec3 color2 = vec3(0.92, 0.72, 0.88);   // rose-pink
          vec3 color3 = vec3(0.78, 0.76, 1.0);    // soft lavender
          vec3 color4 = vec3(0.72, 0.94, 0.86);   // mint

          float t = 0.5 + 0.5 * sin(angle);
          float t2 = 0.5 + 0.5 * sin(angle + 1.57);
          vec3 glowColor = mix(mix(color1, color2, t), mix(color3, color4, t2), 0.5 + 0.5 * sin(uTime * 0.3));

          vec3 finalColor = glowColor * fresnel * uIntensity * pulse;

          // Softer, more colorful alpha — no grey wash
          float alpha = fresnel * 0.18 * uIntensity * pulse;
          gl_FragColor = vec4(finalColor, alpha);
        }
      `,
    }),
    []
  );

  useFrame((_, delta) => {
    timeRef.current += delta;
    stateMachine.current.setState(avatarState);
    const visuals = stateMachine.current.update(delta);

    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value = timeRef.current;
      materialRef.current.uniforms.uIntensity.value = visuals.glowIntensity;
    }

    if (meshRef.current) {
      meshRef.current.rotation.y = timeRef.current * 0.02;
    }
  });

  return (
    <mesh ref={meshRef}>
      <sphereGeometry args={[1.3, 32, 32]} />
      <shaderMaterial
        ref={materialRef}
        attach="material"
        args={[shader]}
        transparent
        side={THREE.BackSide}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  );
}

// ────────────────────────────────────────────────────────────
// INNER SPARKLES — Delicate light points floating inside
// ────────────────────────────────────────────────────────────

function InnerSparkles({ avatarState }: { avatarState: AvatarState }) {
  const pointsRef = useRef<THREE.Points>(null);
  const timeRef = useRef(0);

  const { positions, count } = useMemo(() => {
    const cnt = 25;
    const pos = new Float32Array(cnt * 3);
    for (let i = 0; i < cnt; i++) {
      // Distribute inside the sphere
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = Math.random() * 0.85;
      pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      pos[i * 3 + 2] = r * Math.cos(phi);
    }
    return { positions: pos, count: cnt };
  }, []);

  useFrame((_, delta) => {
    timeRef.current += delta;

    if (pointsRef.current) {
      pointsRef.current.rotation.y += delta * 0.08;
      pointsRef.current.rotation.x = Math.sin(timeRef.current * 0.15) * 0.05;

      const mat = pointsRef.current.material as THREE.PointsMaterial;
      // Twinkling: gentle opacity oscillation
      mat.opacity = 0.3 + Math.sin(timeRef.current * 2.5) * 0.15;

      // Brighter when active
      const brightness =
        avatarState === 'speaking' ? 0.55
        : avatarState === 'thinking' ? 0.5
        : avatarState === 'listening' ? 0.4
        : 0.3;
      mat.opacity = brightness + Math.sin(timeRef.current * 2.5) * 0.15;
    }
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={count} array={positions} itemSize={3} />
      </bufferGeometry>
      <pointsMaterial
        size={0.04}
        color={new THREE.Color(1.0, 0.88, 0.85)}
        transparent
        opacity={0.5}
        sizeAttenuation
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}
