export interface LottieAnimation {
  v: string;
  fr: number;
  ip: number;
  op: number;
  w: number;
  h: number;
  nm: string;
  ddd: number;
  assets: LottieAsset[];
  layers: LottieLayer[];
  tgs?: number;
}

export interface LottieAsset {
  id: string;
  nm?: string;
  layers?: LottieLayer[];
}

export interface LottieLayer {
  ddd: number;
  ind: number;
  ty: LayerType;
  nm: string;
  sr: number;
  ks: LayerTransform;
  ao: number;
  shapes?: ShapeElement[];
  ip: number;
  op: number;
  st: number;
  bm: number;
}

export enum LayerType {
  Precomp = 0,
  Solid = 1,
  Image = 2,
  Null = 3,
  Shape = 4,
  Text = 5,
}

export interface LayerTransform {
  p: AnimatedProperty;
  a?: AnimatedProperty;
  s?: AnimatedProperty;
  r?: AnimatedProperty;
  o?: AnimatedProperty;
}

export interface AnimatedProperty {
  a: 0 | 1;
  k: PropertyValue | Keyframe[];
}

export type PropertyValue = number | number[];

export interface Keyframe {
  t: number;
  s: number[];
  e?: number[];
  i?: BezierHandle;
  o?: BezierHandle;
}

export interface BezierHandle {
  x: number | number[];
  y: number | number[];
}

export interface ShapeElement {
  ty: ShapeType;
  nm?: string;
  it?: ShapeElement[];
  ks?: ShapePath;
  c?: AnimatedProperty;
  o?: AnimatedProperty;
  w?: AnimatedProperty;
}

export type ShapeType = 'gr' | 'sh' | 'fl' | 'st' | 'tr' | 'el' | 'rc' | 'sr';

export interface ShapePath {
  a: 0 | 1;
  k: PathData | PathKeyframe[];
}

export interface PathData {
  i: number[][];
  o: number[][];
  v: number[][];
  c: boolean;
}

export interface PathKeyframe {
  t: number;
  s: PathData[];
  e?: PathData[];
  i?: BezierHandle;
  o?: BezierHandle;
}
