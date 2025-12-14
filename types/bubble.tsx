export type Vec3 = { x: number; y: number; z: number };

export type BubbleConfig = {
  enabled: boolean;
  offset: Vec3;
  radius: number;
};

export const DEFAULT_BUBBLE: BubbleConfig = {
  enabled: false,
  offset: { x: 0, y: 0, z: 0 },
  radius: 0.1,
};