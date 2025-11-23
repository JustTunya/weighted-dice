"use client";

import { useRef, useMemo } from "react";
import * as THREE from "three";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, RoundedBox, Text } from "@react-three/drei";

function DieMesh({ weights }: { weights: number[] }) {
  const groupRef = useRef<THREE.Group>(null!);

  useFrame((_state, delta) => {
    if (groupRef.current) {
      groupRef.current.rotation.x += 0.3 * delta;
      groupRef.current.rotation.y += 0.4 * delta;
    }
  });

  const probs = useMemo(() => {
    const sum = weights.reduce((acc, w) => acc + w, 0);
    if (sum <= 0) {
      return Array(weights.length).fill(1 / weights.length);
    }
    return weights.map(w => w / sum);
  }, [weights]);

  // === WEIGHTS ===
  const sizeX = 1;
  const sizeY = 1;
  const sizeZ = 1;
  const offset = 0.3;
  const minSize = 0.05;
  const maxSize = 0.10;

  const weightSpheres = useMemo(() => [
    { face: 1, pos: [0, offset, 0], weight: probs[0] },
    { face: 6, pos: [0, -offset, 0], weight: probs[5] },
    { face: 2, pos: [offset, 0, 0], weight: probs[1] },
    { face: 5, pos: [-offset, 0, 0], weight: probs[4] },
    { face: 3, pos: [0, 0, offset], weight: probs[2] },
    { face: 4, pos: [0, 0, -offset], weight: probs[3] },
  ], [probs]);

  // const [sizeX, sizeY, sizeZ] = useMemo(() => {
  //   const pairY = probs[0] + probs[5];
  //   const pairX = probs[1] + probs[4];
  //   const pairZ = probs[2] + probs[3];

  //   const scaleFromPair = (pair: number) => 0.8 + 1.2 * pair;

  //   return [
  //     scaleFromPair(pairX),
  //     scaleFromPair(pairY),
  //     scaleFromPair(pairZ),
  //   ];
  // }, [probs]);

  const probToColor = (p: number) => {
    const lightness = 30 + 50 * p;
    return `hsl(0, 80%, ${lightness}%)`;
  };

  const faceData = useMemo(() => [
    {
      face: 1,
      position: [0,  sizeY / 2 + 0.01, 0],
      rotation: [Math.PI / 2, 0, 0],
      prob: probs[0],
    },
    {
      face: 6,
      position: [0, -sizeY / 2 - 0.01, 0],
      rotation: [Math.PI / 2, 0, 0],
      prob: probs[5],
    },
    {
      face: 2,
      position: [sizeX / 2 + 0.01, 0, 0],
      rotation: [0, Math.PI / 2, -Math.PI / 2],
      prob: probs[1],
    },
    {
      face: 5,
      position: [-sizeX / 2 - 0.01, 0, 0],
      rotation: [0, -Math.PI / 2, Math.PI / 2],
      prob: probs[4],
    },
    {
      face: 3,
      position: [0, 0, sizeZ / 2 + 0.01],
      rotation: [0, Math.PI, 0],
      prob: probs[2],
    },
    {
      face: 4,
      position: [0, 0, -sizeZ / 2 - 0.01],
      rotation: [0, 0, 0],
      prob: probs[3],
    },
  ], [sizeX, sizeY, sizeZ, probs]);

  return (
    <group ref={groupRef}>
      <RoundedBox args={[sizeX, sizeY, sizeZ]} radius={0.15} smoothness={4}>
        <meshStandardMaterial color="#ffffff" transparent opacity={0.75} />
      </RoundedBox>

      {weightSpheres.map(({ face, pos, weight }) => (
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

      {faceData.map(({ face, position, rotation, prob }) => (
        <Text
          key={face}
          position={position as [number, number, number]}
          rotation={rotation as [number, number, number]}
          fontSize={0.3}
          color={probToColor(prob)}
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.005}
          outlineColor="#000000"
        >
          {String(face)}
        </Text>
      ))}
    </group>
  );
}

export function WeightedDieCanvas({ weights }: { weights: number[] }) {
  const safeWeights =
    weights.length === 6 ? weights : [1, 1, 1, 1, 1, 1];

  return (
    <div className="w-full h-80 border rounded overflow-hidden bg-slate-900">
      <Canvas camera={{ position: [3, 3, 3], fov: 50 }}>
        <ambientLight intensity={0.6} />
        <directionalLight position={[5, 5, 5]} intensity={0.8} />
        <DieMesh weights={safeWeights} />
        <OrbitControls />
      </Canvas>
    </div>
  );
}