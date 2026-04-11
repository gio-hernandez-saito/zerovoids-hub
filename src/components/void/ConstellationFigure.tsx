import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

import { useFlightCtx } from './useScrollFlight';

/* ═══════════════════════ Types ═══════════════════════ */

interface Point {
  x: number;
  y: number;
}

interface FrameData {
  edge: Point[];
  interior: Point[];
  detail?: Point[];
}

export interface ConstellationData {
  name: string;
  aspect: number;
  fps: number;
  animated: boolean;
  edge: { lines: number[][] };
  interior: { lines: number[][] };
  detail?: { lines: number[][] };
  frames: FrameData[];
}

/* ═══════════════════════ Shaders ═══════════════════════ */

const starVertexShader = `
  attribute float aSize;
  attribute float aFlicker;
  attribute vec3 aColor;
  uniform float uTime;
  uniform float uOpacity;
  varying float vOpacity;
  varying vec3 vColor;
  void main() {
    float flick = 1.0 + 0.22 * sin(uTime * aFlicker + aFlicker * 100.0);
    vOpacity = uOpacity * flick;
    vColor = aColor;
    vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * (180.0 / -mvPos.z);
    gl_Position = projectionMatrix * mvPos;
  }
`;

const starFragmentShader = `
  varying float vOpacity;
  varying vec3 vColor;
  void main() {
    vec2 uv = gl_PointCoord - vec2(0.5);
    float d = length(uv);
    if (d > 0.5) discard;
    float core = exp(-d * d * 90.0);
    float spikeH = exp(-uv.y * uv.y * 220.0) * exp(-uv.x * uv.x * 6.0);
    float spikeV = exp(-uv.x * uv.x * 220.0) * exp(-uv.y * uv.y * 6.0);
    float spikes = (spikeH + spikeV) * 0.22;
    float glow = exp(-d * d * 5.0) * 0.1;
    float alpha = (core + spikes + glow) * vOpacity;
    gl_FragColor = vec4(vColor, alpha);
  }
`;

const lineVertexShader = `
  uniform float uOpacity;
  varying float vOpacity;
  void main() {
    vOpacity = uOpacity;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const lineFragmentShader = `
  uniform vec3 uColor;
  uniform float uIntensity;
  varying float vOpacity;
  void main() {
    gl_FragColor = vec4(uColor, vOpacity * uIntensity);
  }
`;

/* ═══════════════════════ Buffer builders ═══════════════════════ */

interface PrngFn {
  (): number;
}

function makePrng(seed: number): PrngFn {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

/** Build deterministic per-star attributes (size/flicker/color/depth) sized to count. */
function buildStarAttribs(
  count: number,
  baseColor: [number, number, number],
  sizeMin: number,
  sizeMax: number,
  depthScatter: number,
  seed: number,
) {
  const sizes = new Float32Array(count);
  const flickers = new Float32Array(count);
  const colors = new Float32Array(count * 3);
  const depths = new Float32Array(count);
  const rand = makePrng(seed);
  const variance = 0.08;
  for (let i = 0; i < count; i++) {
    sizes[i] = sizeMin + rand() * (sizeMax - sizeMin);
    flickers[i] = 0.5 + rand() * 2.5;
    colors[i * 3] = Math.min(1, baseColor[0] + (rand() - 0.5) * variance);
    colors[i * 3 + 1] = Math.min(1, baseColor[1] + (rand() - 0.5) * variance);
    colors[i * 3 + 2] = Math.min(1, baseColor[2] + (rand() - 0.5) * variance);
    depths[i] = (rand() - 0.5) * depthScatter;
  }
  return { sizes, flickers, colors, depths };
}

/** Build a Float32Array(count*3) of (x, y, z=depth) from a single frame's points. */
function pointsToPositions(pts: Point[], depths: Float32Array): Float32Array {
  const n = pts.length;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    arr[i * 3] = pts[i].x;
    arr[i * 3 + 1] = pts[i].y;
    arr[i * 3 + 2] = depths[i] || 0;
  }
  return arr;
}

/** Build a Float32Array(lines*2*3) of pairs from points + line indices. */
function linesToPositions(pts: Point[], lines: number[][], depths: Float32Array): Float32Array {
  const arr = new Float32Array(lines.length * 6);
  for (let i = 0; i < lines.length; i++) {
    const [a, b] = lines[i];
    arr[i * 6] = pts[a].x;
    arr[i * 6 + 1] = pts[a].y;
    arr[i * 6 + 2] = depths[a] || 0;
    arr[i * 6 + 3] = pts[b].x;
    arr[i * 6 + 4] = pts[b].y;
    arr[i * 6 + 5] = depths[b] || 0;
  }
  return arr;
}

/* ═══════════════════════ Component ═══════════════════════ */

interface Props {
  data: ConstellationData;
  position: [number, number, number];
  scale?: number;
  /** Flight progress range where figure fades in → fully visible. */
  fadeRange?: [number, number];
  /** Optional flight progress range where figure fades back out (after the in). */
  fadeOutRange?: [number, number];
  /** Edge star/line color tint. Defaults to white/teal. */
  edgeColor?: [number, number, number];
  edgeLineColor?: [number, number, number];
  interiorColor?: [number, number, number];
  interiorLineColor?: [number, number, number];
  detailColor?: [number, number, number];
  detailLineColor?: [number, number, number];
  /** Random seed for stable star attribute generation per figure. */
  seed?: number;
}

export default function ConstellationFigure({
  data,
  position,
  scale = 3.2,
  fadeRange = [0.82, 0.96],
  fadeOutRange,
  edgeColor = [1.0, 1.0, 1.0],
  edgeLineColor = [0.31, 0.8, 0.77], // teal #4ecdc4
  interiorColor = [0.78, 0.88, 1.0],
  interiorLineColor = [0.55, 0.78, 1.0],
  detailColor = [1.0, 0.82, 0.62],
  detailLineColor = [1.0, 0.69, 0.43], // warm amber #ffb070
  seed = 42,
}: Props) {
  const { progress } = useFlightCtx();

  const groupRef = useRef<THREE.Group>(null);

  const edgePointsRef = useRef<THREE.Points>(null);
  const interiorPointsRef = useRef<THREE.Points>(null);
  const detailPointsRef = useRef<THREE.Points>(null);
  const edgeLinesRef = useRef<THREE.LineSegments>(null);
  const interiorLinesRef = useRef<THREE.LineSegments>(null);
  const detailLinesRef = useRef<THREE.LineSegments>(null);

  const currentFrame = useRef(-1);

  const buffers = useMemo(() => {
    const nFrames = data.frames.length;
    const edgeCount = data.frames[0].edge.length;
    const interiorCount = data.frames[0].interior.length;
    const detailLines = data.detail?.lines ?? [];
    const detailCount = data.frames[0].detail?.length ?? 0;
    const hasDetail = detailCount > 0;

    const edgeAttribs = buildStarAttribs(edgeCount, edgeColor, 0.95, 1.65, 0.32, seed);
    const interiorAttribs = buildStarAttribs(interiorCount, interiorColor, 0.7, 1.15, 0.22, seed + 1295);
    const detailAttribs = buildStarAttribs(
      Math.max(detailCount, 1),
      detailColor,
      0.55,
      0.95,
      0.18,
      seed + 7777,
    );

    const edgePosFrames: Float32Array[] = [];
    const interiorPosFrames: Float32Array[] = [];
    const detailPosFrames: Float32Array[] = [];
    const edgeLinePosFrames: Float32Array[] = [];
    const interiorLinePosFrames: Float32Array[] = [];
    const detailLinePosFrames: Float32Array[] = [];

    for (let f = 0; f < nFrames; f++) {
      const frame = data.frames[f];
      edgePosFrames.push(pointsToPositions(frame.edge, edgeAttribs.depths));
      interiorPosFrames.push(pointsToPositions(frame.interior, interiorAttribs.depths));
      edgeLinePosFrames.push(linesToPositions(frame.edge, data.edge.lines, edgeAttribs.depths));
      interiorLinePosFrames.push(
        linesToPositions(frame.interior, data.interior.lines, interiorAttribs.depths),
      );
      if (hasDetail && frame.detail) {
        detailPosFrames.push(pointsToPositions(frame.detail, detailAttribs.depths));
        detailLinePosFrames.push(linesToPositions(frame.detail, detailLines, detailAttribs.depths));
      }
    }

    return {
      nFrames,
      edgeCount,
      interiorCount,
      detailCount,
      hasDetail,
      edgeAttribs,
      interiorAttribs,
      detailAttribs,
      edgePosFrames,
      interiorPosFrames,
      detailPosFrames,
      edgeLinePosFrames,
      interiorLinePosFrames,
      detailLinePosFrames,
      // Live mutable arrays the GPU reads from each frame
      edgePosLive: new Float32Array(edgePosFrames[0]),
      interiorPosLive: new Float32Array(interiorPosFrames[0]),
      detailPosLive: hasDetail ? new Float32Array(detailPosFrames[0]) : new Float32Array(0),
      edgeLinePosLive: new Float32Array(edgeLinePosFrames[0]),
      interiorLinePosLive: new Float32Array(interiorLinePosFrames[0]),
      detailLinePosLive: hasDetail ? new Float32Array(detailLinePosFrames[0]) : new Float32Array(0),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, seed]);

  const edgeStarMaterial = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: starVertexShader,
        fragmentShader: starFragmentShader,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: {
          uTime: { value: 0 },
          uOpacity: { value: 0 },
        },
      }),
    [],
  );

  const interiorStarMaterial = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: starVertexShader,
        fragmentShader: starFragmentShader,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: {
          uTime: { value: 0 },
          uOpacity: { value: 0 },
        },
      }),
    [],
  );

  const edgeLineMaterial = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: lineVertexShader,
        fragmentShader: lineFragmentShader,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: {
          uColor: { value: new THREE.Color(edgeLineColor[0], edgeLineColor[1], edgeLineColor[2]) },
          uIntensity: { value: 0.45 },
          uOpacity: { value: 0 },
        },
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [edgeLineColor[0], edgeLineColor[1], edgeLineColor[2]],
  );

  const interiorLineMaterial = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: lineVertexShader,
        fragmentShader: lineFragmentShader,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: {
          uColor: {
            value: new THREE.Color(interiorLineColor[0], interiorLineColor[1], interiorLineColor[2]),
          },
          uIntensity: { value: 0.55 },
          uOpacity: { value: 0 },
        },
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [interiorLineColor[0], interiorLineColor[1], interiorLineColor[2]],
  );

  const detailStarMaterial = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: starVertexShader,
        fragmentShader: starFragmentShader,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: {
          uTime: { value: 0 },
          uOpacity: { value: 0 },
        },
      }),
    [],
  );

  const detailLineMaterial = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: lineVertexShader,
        fragmentShader: lineFragmentShader,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: {
          uColor: {
            value: new THREE.Color(detailLineColor[0], detailLineColor[1], detailLineColor[2]),
          },
          uIntensity: { value: 0.35 },
          uOpacity: { value: 0 },
        },
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [detailLineColor[0], detailLineColor[1], detailLineColor[2]],
  );

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    const p = progress.current;

    // Fade in over fadeRange, optionally fade out over fadeOutRange
    const [fStart, fEnd] = fadeRange;
    let op = Math.max(0, Math.min(1, (p - fStart) / (fEnd - fStart)));
    if (fadeOutRange) {
      const [oStart, oEnd] = fadeOutRange;
      const fadeOut = Math.max(0, Math.min(1, (p - oStart) / (oEnd - oStart)));
      op *= 1 - fadeOut;
    }

    edgeStarMaterial.uniforms.uTime.value = t;
    edgeStarMaterial.uniforms.uOpacity.value = op;
    interiorStarMaterial.uniforms.uTime.value = t + 1.3;
    interiorStarMaterial.uniforms.uOpacity.value = op;
    detailStarMaterial.uniforms.uTime.value = t + 2.6;
    detailStarMaterial.uniforms.uOpacity.value = op;
    edgeLineMaterial.uniforms.uOpacity.value = op;
    interiorLineMaterial.uniforms.uOpacity.value = op;
    detailLineMaterial.uniforms.uOpacity.value = op;

    // Frame swap (animation)
    if (buffers.nFrames > 1 && op > 0.001) {
      const idx = Math.floor(t * data.fps) % buffers.nFrames;
      if (idx !== currentFrame.current) {
        currentFrame.current = idx;
        buffers.edgePosLive.set(buffers.edgePosFrames[idx]);
        buffers.interiorPosLive.set(buffers.interiorPosFrames[idx]);
        buffers.edgeLinePosLive.set(buffers.edgeLinePosFrames[idx]);
        buffers.interiorLinePosLive.set(buffers.interiorLinePosFrames[idx]);
        if (buffers.hasDetail) {
          buffers.detailPosLive.set(buffers.detailPosFrames[idx]);
          buffers.detailLinePosLive.set(buffers.detailLinePosFrames[idx]);
        }
        if (edgePointsRef.current) {
          (edgePointsRef.current.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
        }
        if (interiorPointsRef.current) {
          (interiorPointsRef.current.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
        }
        if (detailPointsRef.current) {
          (detailPointsRef.current.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
        }
        if (edgeLinesRef.current) {
          (edgeLinesRef.current.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
        }
        if (interiorLinesRef.current) {
          (interiorLinesRef.current.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
        }
        if (detailLinesRef.current) {
          (detailLinesRef.current.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
        }
      }
    }

    // Gentle idle drift
    if (groupRef.current) {
      groupRef.current.rotation.y = Math.sin(t * 0.1) * 0.07;
      groupRef.current.rotation.x = Math.cos(t * 0.08) * 0.035;
      groupRef.current.position.y = position[1] + Math.sin(t * 0.2) * 0.1;
    }
  });

  return (
    <group ref={groupRef} position={position} scale={scale}>
      {/* Edge stars */}
      <points ref={edgePointsRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            array={buffers.edgePosLive}
            count={buffers.edgeCount}
            itemSize={3}
          />
          <bufferAttribute
            attach="attributes-aSize"
            array={buffers.edgeAttribs.sizes}
            count={buffers.edgeCount}
            itemSize={1}
          />
          <bufferAttribute
            attach="attributes-aFlicker"
            array={buffers.edgeAttribs.flickers}
            count={buffers.edgeCount}
            itemSize={1}
          />
          <bufferAttribute
            attach="attributes-aColor"
            array={buffers.edgeAttribs.colors}
            count={buffers.edgeCount}
            itemSize={3}
          />
        </bufferGeometry>
        <primitive object={edgeStarMaterial} attach="material" />
      </points>

      {/* Interior stars */}
      <points ref={interiorPointsRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            array={buffers.interiorPosLive}
            count={buffers.interiorCount}
            itemSize={3}
          />
          <bufferAttribute
            attach="attributes-aSize"
            array={buffers.interiorAttribs.sizes}
            count={buffers.interiorCount}
            itemSize={1}
          />
          <bufferAttribute
            attach="attributes-aFlicker"
            array={buffers.interiorAttribs.flickers}
            count={buffers.interiorCount}
            itemSize={1}
          />
          <bufferAttribute
            attach="attributes-aColor"
            array={buffers.interiorAttribs.colors}
            count={buffers.interiorCount}
            itemSize={3}
          />
        </bufferGeometry>
        <primitive object={interiorStarMaterial} attach="material" />
      </points>

      {/* Edge lines */}
      <lineSegments ref={edgeLinesRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            array={buffers.edgeLinePosLive}
            count={buffers.edgeLinePosLive.length / 3}
            itemSize={3}
          />
        </bufferGeometry>
        <primitive object={edgeLineMaterial} attach="material" />
      </lineSegments>

      {/* Interior lines */}
      <lineSegments ref={interiorLinesRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            array={buffers.interiorLinePosLive}
            count={buffers.interiorLinePosLive.length / 3}
            itemSize={3}
          />
        </bufferGeometry>
        <primitive object={interiorLineMaterial} attach="material" />
      </lineSegments>

      {/* Detail (canny clothing/feature) layer — only if data has it */}
      {buffers.hasDetail && (
        <>
          <points ref={detailPointsRef}>
            <bufferGeometry>
              <bufferAttribute
                attach="attributes-position"
                array={buffers.detailPosLive}
                count={buffers.detailCount}
                itemSize={3}
              />
              <bufferAttribute
                attach="attributes-aSize"
                array={buffers.detailAttribs.sizes}
                count={buffers.detailCount}
                itemSize={1}
              />
              <bufferAttribute
                attach="attributes-aFlicker"
                array={buffers.detailAttribs.flickers}
                count={buffers.detailCount}
                itemSize={1}
              />
              <bufferAttribute
                attach="attributes-aColor"
                array={buffers.detailAttribs.colors}
                count={buffers.detailCount}
                itemSize={3}
              />
            </bufferGeometry>
            <primitive object={detailStarMaterial} attach="material" />
          </points>

          <lineSegments ref={detailLinesRef}>
            <bufferGeometry>
              <bufferAttribute
                attach="attributes-position"
                array={buffers.detailLinePosLive}
                count={buffers.detailLinePosLive.length / 3}
                itemSize={3}
              />
            </bufferGeometry>
            <primitive object={detailLineMaterial} attach="material" />
          </lineSegments>
        </>
      )}
    </group>
  );
}
