"use client";

import { useRef, useMemo } from "react";
import * as THREE from "three";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, RoundedBox, Text, Sphere } from "@react-three/drei";
import { BubbleConfig } from "@/types/bubble";

function DieMesh({
  weights,
  bubble,
  dimensions,
}: {
  weights: number[];
  bubble?: BubbleConfig;
  dimensions: { lx: number; ly: number; lz: number };
}) {
  const groupRef = useRef<THREE.Group>(null!);

  useFrame((_state, delta) => {
    if (groupRef.current) {
      groupRef.current.rotation.x += 0.3 * delta;
      groupRef.current.rotation.y += 0.4 * delta;
    }
  });

  const bubblePos = useMemo(() => {
    if (!bubble || !bubble.enabled) return [0, 0, 0] as [number, number, number];
    return [bubble.offset.x, bubble.offset.y, bubble.offset.z] as [number, number, number];
  }, [bubble]);

  const probs = useMemo(() => {
    const sum = weights.reduce((acc, w) => acc + w, 0);
    if (sum <= 0) return Array(weights.length).fill(1 / weights.length);
    return weights.map(w => w / sum);
  }, [weights]);

  const probToColor = (p: number) => {
    const lightness = 30 + 50 * p;
    return `hsl(0, 80%, ${lightness}%)`;
  };

  const sizeX = Math.max(dimensions.lx, 0.01);
  const sizeY = Math.max(dimensions.ly, 0.01);
  const sizeZ = Math.max(dimensions.lz, 0.01);
  const dieScale = Math.min(sizeX, sizeY, sizeZ);
  const minSize = 0.05 * dieScale;
  const maxSize = 0.10 * dieScale;
  const [hX, hY, hZ] = [sizeX / 2, sizeY / 2, sizeZ / 2];
  const hPi = Math.PI / 2;
  const markerOffset = Math.min(hX, hY, hZ) * 0.7;
  const epsilon = Math.max(sizeX, sizeY, sizeZ) * 0.01;

  const weightData = useMemo(() => [
    { face: 1, pos: [0, markerOffset, 0],  weight: probs[0] },
    { face: 6, pos: [0, -markerOffset, 0], weight: probs[5] },
    { face: 2, pos: [markerOffset, 0, 0],  weight: probs[1] },
    { face: 5, pos: [-markerOffset, 0, 0], weight: probs[4] },
    { face: 3, pos: [0, 0, markerOffset],  weight: probs[2] },
    { face: 4, pos: [0, 0, -markerOffset], weight: probs[3] },
  ], [markerOffset, probs]);

  const faceData = useMemo(() => [
    { face: 1, pos: [0,  hY + epsilon, 0], rot: [hPi, 0, 0],     prob: probs[0] },
    { face: 6, pos: [0, -hY - epsilon, 0], rot: [-hPi, 0, 0],    prob: probs[5] },
    { face: 2, pos: [hX + epsilon, 0, 0],  rot: [0, hPi, -hPi],  prob: probs[1] },
    { face: 5, pos: [-hX - epsilon, 0, 0], rot: [0, -hPi, hPi],  prob: probs[4] },
    { face: 3, pos: [0, 0, hZ + epsilon],  rot: [0, Math.PI, 0], prob: probs[2] },
    { face: 4, pos: [0, 0, -hZ - epsilon], rot: [0, 0, 0],       prob: probs[3] },
  ], [epsilon, hX, hY, hZ, hPi, probs]);

  return (
    <group ref={groupRef}>
      <RoundedBox
        args={[sizeX, sizeY, sizeZ]}
        radius={0.15 * Math.min(sizeX, sizeY, sizeZ)}
        smoothness={4}
      >
        <meshStandardMaterial color="#ffffff" transparent opacity={0.75} />
      </RoundedBox>

      {weightData.map(({ face, pos, weight }) => (
        <mesh key={`w-${face}`} position={pos as [number, number, number]}>
          <sphereGeometry args={[minSize + (maxSize - minSize) * weight, 16, 16]} />
          <meshStandardMaterial
            color={probToColor(weight)}
            emissive={probToColor(weight)}
            emissiveIntensity={1 + weight * 2}
            metalness={0.6}
            roughness={0.3}
          />
        </mesh>
      ))}

      {faceData.map(({ face, pos, rot, prob }) => (
        <Text
          key={face}
          position={pos as [number, number, number]}
          rotation={rot as [number, number, number]}
          fontSize={0.3 * dieScale}
          color={probToColor(prob)}
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.005}
          outlineColor="#000000"
        >
          {String(face)}
        </Text>
      ))}
      {bubble && bubble.enabled && (
        <Sphere args={[bubble.radius, 16, 16]} position={bubblePos}>
           <meshPhysicalMaterial 
            color="#66aaff" 
            transmission={0.8} 
            opacity={0.5} 
            transparent 
            roughness={1} 
            ior={1}
            thickness={0.5}
           />
        </Sphere>
      )}
    </group>
  );
}

export function WeightedDieCanvas({
  weights,
  bubble,
  dimensions,
}: {
  weights: number[];
  bubble?: BubbleConfig;
  dimensions?: { lx: number; ly: number; lz: number };
}) {
  const safeWeights =
    weights.length === 6 ? weights : [1, 1, 1, 1, 1, 1];
  const safeDims = dimensions ?? { lx: 1, ly: 1, lz: 1 };

  return (
    <div className="w-full h-80 bg-[#171717] border border-white/15 rounded-xl overflow-hidden">
      <Canvas camera={{ position: [3, 3, 3], fov: 50 }}>
        <ambientLight intensity={0.6} />
        <directionalLight position={[5, 5, 5]} intensity={0.8} />
        <DieMesh weights={safeWeights} bubble={bubble} dimensions={safeDims} />
        <OrbitControls />
      </Canvas>
    </div>
  );
}
