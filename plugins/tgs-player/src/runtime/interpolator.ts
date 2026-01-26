export const INTERPOLATOR_CODE = `
const Interpolator = {
  lerp(a, b, t) {
    return a + (b - a) * t;
  },

  lerpArray(a, b, t) {
    if (!b || !Array.isArray(b)) b = a;  /* Fallback if b is undefined */
    const result = new Array(a.length);
    for (let i = 0; i < a.length; i++) {
      result[i] = this.lerp(a[i], b[i] ?? a[i], t);  /* Use a[i] if b[i] undefined */
    }
    return result;
  },

  /* Unwrap single-element arrays for scalar contexts */
  unwrapScalar(val) {
    if (Array.isArray(val) && val.length === 1) return val[0];
    return val;
  },

  findKeyframeIndex(keyframes, frame) {
    for (let i = 0; i < keyframes.length - 1; i++) {
      if (frame >= keyframes[i].t && frame < keyframes[i + 1].t) {
        return i;
      }
    }
    return Math.max(0, keyframes.length - 2);
  },

  extractBezierHandle(handle, index) {
    if (!handle) return 0;
    return Array.isArray(handle) ? handle[index] : handle;
  },

  applyEasing(t, outHandle, inHandle) {
    if (!outHandle || !inHandle) return t;
    
    const ox = this.extractBezierHandle(outHandle.x, 0);
    const oy = this.extractBezierHandle(outHandle.y, 0);
    const ix = this.extractBezierHandle(inHandle.x, 0);
    const iy = this.extractBezierHandle(inHandle.y, 0);
    
    return BezierEaser(ox, oy, ix, iy)(t);
  },

  interpolateProperty(property, frame) {
    if (property.a === 0) return property.k;

    const keyframes = property.k;
    if (!keyframes || keyframes.length === 0) return 0;
    
    if (frame <= keyframes[0].t) return this.unwrapScalar(keyframes[0].s);
    
    const lastKf = keyframes[keyframes.length - 1];
    if (frame >= lastKf.t) return this.unwrapScalar(lastKf.s);

    const idx = this.findKeyframeIndex(keyframes, frame);
    const kf = keyframes[idx];
    const nextKf = keyframes[idx + 1];

    const duration = nextKf.t - kf.t;
    if (duration === 0) return this.unwrapScalar(kf.s);
    
    const elapsed = frame - kf.t;
    let t = elapsed / duration;

    t = this.applyEasing(t, kf.o, kf.i);

    const startVal = kf.s;
    const endVal = kf.e || nextKf.s;

    if (Array.isArray(startVal)) {
      const result = this.lerpArray(startVal, endVal, t);
      return this.unwrapScalar(result);
    }
    return this.lerp(startVal, endVal, t);
  },

  interpolatePath(pathProp, frame) {
    if (pathProp.a === 0) return pathProp.k;

    const keyframes = pathProp.k;
    if (!keyframes || keyframes.length === 0) return null;
    
    if (frame <= keyframes[0].t) return keyframes[0].s[0];
    
    const lastKf = keyframes[keyframes.length - 1];
    if (frame >= lastKf.t) return lastKf.s[0];

    const idx = this.findKeyframeIndex(keyframes, frame);
    const kf = keyframes[idx];
    const nextKf = keyframes[idx + 1];

    const duration = nextKf.t - kf.t;
    if (duration === 0) return kf.s[0];
    
    const elapsed = frame - kf.t;
    let t = elapsed / duration;

    t = this.applyEasing(t, kf.o, kf.i);

    const startPath = kf.s[0];
    const endPath = kf.e ? kf.e[0] : nextKf.s[0];

    return {
      v: this.lerpPoints(startPath.v, endPath.v, t),
      i: this.lerpPoints(startPath.i, endPath.i, t),
      o: this.lerpPoints(startPath.o, endPath.o, t),
      c: startPath.c
    };
  },

  lerpPoints(a, b, t) {
    const result = new Array(Math.min(a.length, b.length));
    for (let i = 0; i < result.length; i++) {
      result[i] = this.lerpArray(a[i], b[i], t);
    }
    return result;
  }
};
`;
