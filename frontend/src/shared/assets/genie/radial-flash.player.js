(function() {

const DebugLogger = {
  enabled: (function() {
    if (typeof window === 'undefined') return false;
    try {
      if (typeof localStorage !== 'undefined') {
        const stored = localStorage.getItem('TGS_DEBUG');
        if (stored === 'true') {
          window.TGS_DEBUG = true;
          return true;
        }
      }
    } catch (e) { /* localStorage may be blocked */ }
    return window.TGS_DEBUG === true;
  })(),
  
  setEnabled(value) {
    this.enabled = value;
    if (typeof window !== 'undefined') {
      window.TGS_DEBUG = value;
    }
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('TGS_DEBUG', value ? 'true' : 'false');
      }
    } catch (e) { /* localStorage may be blocked */ }
    console.log('[TGS:DEBUG] Logging ' + (value ? 'ENABLED' : 'DISABLED') + ' (persisted to localStorage)');
  },
  
  log(prefix, message, data) {
    if (!this.enabled) return;
    const timestamp = performance.now().toFixed(2);
    console.log('[TGS:' + prefix + ':' + timestamp + 'ms]', message, data !== undefined ? data : '');
  },
  
  warn(prefix, message, data) {
    const timestamp = performance.now().toFixed(2);
    console.warn('[TGS:' + prefix + ':' + timestamp + 'ms]', message, data !== undefined ? data : '');
  },
  
  feature(featureName, status, details) {
    if (!this.enabled) return;
    const symbol = status === 'supported' ? '✓' : (status === 'partial' ? '⚠' : '✗');
    console.log('[TGS:FEATURE] ' + symbol + ' ' + featureName, details !== undefined ? details : '');
  },
  
  path(label, pathData) {
    if (!this.enabled) return;
    if (!pathData) {
      console.log('[TGS:PATH] ' + label + ': NULL');
      return;
    }
    console.log('[TGS:PATH] ' + label + ':', {
      vertices: pathData.v ? pathData.v.slice(0, 3) : 'missing',
      vertexCount: pathData.v ? pathData.v.length : 0,
      closed: pathData.c,
      inHandles: pathData.i ? pathData.i.slice(0, 2) : 'missing',
      outHandles: pathData.o ? pathData.o.slice(0, 2) : 'missing'
    });
  },
  
  transform(label, transform) {
    if (!this.enabled) return;
    console.log('[TGS:TRANSFORM] ' + label + ':', transform);
  }
};

/* Auto-enable on load if persisted */
if (typeof window !== 'undefined' && DebugLogger.enabled) {
  console.log('[TGS:DEBUG] Auto-enabled from localStorage');
}



const BezierEaser = (function() {
  const NEWTON_ITERATIONS = 4;
  const NEWTON_MIN_SLOPE = 0.001;
  const SUBDIVISION_PRECISION = 0.0000001;
  const SUBDIVISION_MAX_ITERATIONS = 10;
  const K_SPLINE_TABLE_SIZE = 11;
  const K_SAMPLE_STEP_SIZE = 1.0 / (K_SPLINE_TABLE_SIZE - 1.0);

  function A(a1, a2) { return 1.0 - 3.0 * a2 + 3.0 * a1; }
  function B(a1, a2) { return 3.0 * a2 - 6.0 * a1; }
  function C(a1) { return 3.0 * a1; }

  function calcBezier(t, a1, a2) {
    return ((A(a1, a2) * t + B(a1, a2)) * t + C(a1)) * t;
  }

  function getSlope(t, a1, a2) {
    return 3.0 * A(a1, a2) * t * t + 2.0 * B(a1, a2) * t + C(a1);
  }

  function binarySubdivide(x, a, b, mX1, mX2) {
    let currentX, currentT, i = 0;
    do {
      currentT = a + (b - a) / 2.0;
      currentX = calcBezier(currentT, mX1, mX2) - x;
      if (currentX > 0.0) b = currentT;
      else a = currentT;
    } while (Math.abs(currentX) > SUBDIVISION_PRECISION && ++i < SUBDIVISION_MAX_ITERATIONS);
    return currentT;
  }

  function newtonRaphsonIterate(x, guessT, mX1, mX2) {
    for (let i = 0; i < NEWTON_ITERATIONS; ++i) {
      const slope = getSlope(guessT, mX1, mX2);
      if (slope === 0.0) return guessT;
      const currentX = calcBezier(guessT, mX1, mX2) - x;
      guessT -= currentX / slope;
    }
    return guessT;
  }

  return function createBezierEaser(mX1, mY1, mX2, mY2) {
    const sampleValues = new Float32Array(K_SPLINE_TABLE_SIZE);
    for (let i = 0; i < K_SPLINE_TABLE_SIZE; ++i) {
      sampleValues[i] = calcBezier(i * K_SAMPLE_STEP_SIZE, mX1, mX2);
    }

    function getTForX(x) {
      let intervalStart = 0.0;
      let currentSample = 1;
      const lastSample = K_SPLINE_TABLE_SIZE - 1;

      for (; currentSample !== lastSample && sampleValues[currentSample] <= x; ++currentSample) {
        intervalStart += K_SAMPLE_STEP_SIZE;
      }
      --currentSample;

      const dist = (x - sampleValues[currentSample]) / (sampleValues[currentSample + 1] - sampleValues[currentSample]);
      const guessForT = intervalStart + dist * K_SAMPLE_STEP_SIZE;
      const initialSlope = getSlope(guessForT, mX1, mX2);

      if (initialSlope >= NEWTON_MIN_SLOPE) return newtonRaphsonIterate(x, guessForT, mX1, mX2);
      if (initialSlope === 0.0) return guessForT;
      return binarySubdivide(x, intervalStart, intervalStart + K_SAMPLE_STEP_SIZE, mX1, mX2);
    }

    return function(x) {
      if (mX1 === mY1 && mX2 === mY2) return x;
      if (x === 0) return 0;
      if (x === 1) return 1;
      return calcBezier(getTForX(x), mY1, mY2);
    };
  };
})();



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



const SvgBuilder = {
  NS: 'http://www.w3.org/2000/svg',

  createSvg(width, height) {
    const svg = document.createElementNS(this.NS, 'svg');
    /* Lottie uses top-left origin (0,0), same as SVG default */
    svg.setAttribute('viewBox', '0 0 ' + width + ' ' + height);
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', '100%');
    svg.style.overflow = 'hidden';
    return svg;
  },

  createGroup() {
    return document.createElementNS(this.NS, 'g');
  },

  createPath() {
    return document.createElementNS(this.NS, 'path');
  },

  pathDataToString(pathData) {
    if (!pathData || !pathData.v || pathData.v.length === 0) return '';
    
    const v = pathData.v;
    const i = pathData.i;
    const o = pathData.o;
    const closed = pathData.c;

    const parts = ['M' + v[0][0] + ',' + v[0][1]];

    for (let j = 1; j < v.length; j++) {
      const prevOut = o[j - 1];
      const currIn = i[j];
      const curr = v[j];
      const prev = v[j - 1];
      
      parts.push(
        'C' + (prev[0] + prevOut[0]) + ',' + (prev[1] + prevOut[1]) +
        ' ' + (curr[0] + currIn[0]) + ',' + (curr[1] + currIn[1]) +
        ' ' + curr[0] + ',' + curr[1]
      );
    }

    if (closed && v.length > 1) {
      const lastOut = o[v.length - 1];
      const firstIn = i[0];
      const last = v[v.length - 1];
      const first = v[0];
      
      parts.push(
        'C' + (last[0] + lastOut[0]) + ',' + (last[1] + lastOut[1]) +
        ' ' + (first[0] + firstIn[0]) + ',' + (first[1] + firstIn[1]) +
        ' ' + first[0] + ',' + first[1] + 'Z'
      );
    }

    return parts.join(' ');
  },

  applyTransform(element, transform) {
    /* Lottie matrix build order:
     * M = pre * translate(-a) * scale(s) * rotate(-r) * translate(p)
     * Point transformation: p' = M * p
     * Effective order on point: -anchor → scale → rotate → position
     * 
     * SVG transform="A B C" applies A(B(C(point))), i.e., C first, A last.
     * So we need: translate(p), rotate(r), scale(s), translate(-a)
     * Note: Keeping rotation POSITIVE - the negation in lottie is internal to matrix math
     */
    
    /* Format number to avoid scientific notation and NaN */
    const fmt = (n) => {
      if (!Number.isFinite(n)) return 0;
      return Math.round(n * 1000) / 1000;
    };
    
    const px = fmt(transform.position ? transform.position[0] : 0);
    const py = fmt(transform.position ? transform.position[1] : 0);
    const ax = fmt(transform.anchor ? transform.anchor[0] : 0);
    const ay = fmt(transform.anchor ? transform.anchor[1] : 0);
    const r = fmt(transform.rotation || 0);
    const sx = fmt(transform.scale ? transform.scale[0] / 100 : 1);
    const sy = fmt(transform.scale ? transform.scale[1] / 100 : 1);
    
    const parts = [];
    
    /* Order: position last (outermost), anchor first (innermost) */
    parts.push('translate(' + px + ',' + py + ')');
    
    if (r !== 0) {
      parts.push('rotate(' + r + ')');
    }
    
    if (sx !== 1 || sy !== 1) {
      parts.push('scale(' + sx + ',' + sy + ')');
    }
    
    if (ax !== 0 || ay !== 0) {
      parts.push('translate(' + (-ax) + ',' + (-ay) + ')');
    }

    if (parts.length > 0) {
      element.setAttribute('transform', parts.join(' '));
    } else {
      element.removeAttribute('transform');
    }
    
    if (transform.opacity !== undefined) {
      const opacity = Math.max(0, Math.min(100, transform.opacity)) / 100;
      if (opacity < 1) {
        element.setAttribute('opacity', opacity);
      } else {
        element.removeAttribute('opacity');
      }
    }
  },

  rgbToString(color) {
    if (typeof color === 'string') return color;
    const r = Math.round(Math.max(0, Math.min(1, color[0])) * 255);
    const g = Math.round(Math.max(0, Math.min(1, color[1])) * 255);
    const b = Math.round(Math.max(0, Math.min(1, color[2])) * 255);
    return 'rgb(' + r + ',' + g + ',' + b + ')';
  },

  applyFill(element, color, opacity) {
    if (color) {
      element.setAttribute('fill', this.rgbToString(color));
    }
    if (opacity !== undefined) {
      const op = Math.max(0, Math.min(100, opacity)) / 100;
      element.setAttribute('fill-opacity', op);
    }
  },

  applyStroke(element, color, opacity, width, lineCap, lineJoin) {
    if (color) {
      element.setAttribute('stroke', this.rgbToString(color));
    }
    if (opacity !== undefined) {
      const op = Math.max(0, Math.min(100, opacity)) / 100;
      element.setAttribute('stroke-opacity', op);
    }
    if (width !== undefined && width > 0) {
      element.setAttribute('stroke-width', width);
      element.setAttribute('paint-order', 'stroke');
    }
    /* lc: 1=butt, 2=round, 3=square */
    const capMap = { 1: 'butt', 2: 'round', 3: 'square' };
    element.setAttribute('stroke-linecap', capMap[lineCap] || 'round');
    /* lj: 1=miter, 2=round, 3=bevel */
    const joinMap = { 1: 'miter', 2: 'round', 3: 'bevel' };
    element.setAttribute('stroke-linejoin', joinMap[lineJoin] || 'round');
  },

  createClipPath(id, width, height) {
    const clipPath = document.createElementNS(this.NS, 'clipPath');
    clipPath.setAttribute('id', id);
    const rect = document.createElementNS(this.NS, 'rect');
    rect.setAttribute('x', '0');
    rect.setAttribute('y', '0');
    rect.setAttribute('width', width);
    rect.setAttribute('height', height);
    clipPath.appendChild(rect);
    return clipPath;
  },

  createDefs() {
    return document.createElementNS(this.NS, 'defs');
  },

  applyClipPath(element, clipId) {
    element.setAttribute('clip-path', 'url(#' + clipId + ')');
  }
};



const TrimPaths = {
  apply(pathElement, trimStart, trimEnd, trimOffset) {
    DebugLogger.log('TRIM', 'Applying trim', { start: trimStart, end: trimEnd, offset: trimOffset });
    
    /* Convert offset from degrees to percentage (lottie uses 0-360 degrees) */
    const offsetPercent = (trimOffset % 360) / 360 * 100;
    
    /* Normalize start/end with offset - handle 100% correctly (don't wrap to 0) */
    let rawS = trimStart + offsetPercent;
    let rawE = trimEnd + offsetPercent;
    /* Only apply modulo if > 100, preserve 100% as 1.0 */
    let s = rawS > 100 ? (rawS % 100) / 100 : rawS / 100;
    let e = rawE > 100 ? (rawE % 100) / 100 : rawE / 100;
    if (s < 0) s += 1;
    if (e < 0) e += 1;
    
    /* Swap if start > end (like lottie-web) */
    if (s > e) {
      const tmp = s;
      s = e;
      e = tmp;
    }
    
    /* Round to avoid floating point issues (like lottie-web) */
    s = Math.round(s * 10000) * 0.0001;
    e = Math.round(e * 10000) * 0.0001;
    
    const totalLength = pathElement.getTotalLength();
    
    /* Full path - no trim needed */
    if ((s === 0 && e === 1) || (s === 1 && e === 0)) {
      pathElement.removeAttribute('stroke-dasharray');
      pathElement.removeAttribute('stroke-dashoffset');
      return;
    }
    
    /* Empty path - use zero-length dash instead of visibility:hidden */
    if (s === e) {
      pathElement.setAttribute('stroke-dasharray', '0 ' + totalLength);
      pathElement.setAttribute('stroke-dashoffset', '0');
      return;
    }
    
    const startLength = totalLength * s;
    const endLength = totalLength * e;
    const dashLength = endLength - startLength;
    
    pathElement.setAttribute('stroke-dasharray', dashLength + ' ' + totalLength);
    pathElement.setAttribute('stroke-dashoffset', -startLength);
  },
  
  findTrimShape(shapes) {
    for (let i = 0; i < shapes.length; i++) {
      if (shapes[i].ty === 'tm') {
        return shapes[i];
      }
    }
    return null;
  }
};



const GradientBuilder = {
  gradientCounter: 0,
  
  /* Create gradient element once during build phase */
  createGradientElement(svg, gradientShape, gradientId) {
    const isRadial = gradientShape.t === 2;
    
    const gradient = document.createElementNS(SvgBuilder.NS, isRadial ? 'radialGradient' : 'linearGradient');
    gradient.setAttribute('id', gradientId);
    gradient.setAttribute('gradientUnits', 'userSpaceOnUse');
    
    /* Create stop elements based on color count */
    const colorCount = gradientShape.g ? gradientShape.g.p : 0;
    for (let i = 0; i < colorCount; i++) {
      const stop = document.createElementNS(SvgBuilder.NS, 'stop');
      stop.setAttribute('data-index', i);
      gradient.appendChild(stop);
    }
    
    let defs = svg.querySelector('defs');
    if (!defs) {
      defs = document.createElementNS(SvgBuilder.NS, 'defs');
      svg.insertBefore(defs, svg.firstChild);
    }
    defs.appendChild(gradient);
    
    return gradient;
  },
  
  /* Update gradient properties per frame */
  updateGradient(gradientElement, gradientShape, frame) {
    const isRadial = gradientShape.t === 2;
    
    if (!isRadial && gradientShape.s && gradientShape.e) {
      const start = Interpolator.interpolateProperty(gradientShape.s, frame);
      const end = Interpolator.interpolateProperty(gradientShape.e, frame);
      gradientElement.setAttribute('x1', start[0]);
      gradientElement.setAttribute('y1', start[1]);
      gradientElement.setAttribute('x2', end[0]);
      gradientElement.setAttribute('y2', end[1]);
    }
    
    if (isRadial && gradientShape.s) {
      const center = Interpolator.interpolateProperty(gradientShape.s, frame);
      gradientElement.setAttribute('cx', center[0]);
      gradientElement.setAttribute('cy', center[1]);
      
      if (gradientShape.e) {
        const endPoint = Interpolator.interpolateProperty(gradientShape.e, frame);
        const dx = endPoint[0] - center[0];
        const dy = endPoint[1] - center[1];
        const radius = Math.sqrt(dx * dx + dy * dy);
        gradientElement.setAttribute('r', radius > 0 ? radius : 256);
      } else {
        gradientElement.setAttribute('r', '256');
      }
      
      if (gradientShape.h && gradientShape.a) {
        const highlightLength = Interpolator.interpolateProperty(gradientShape.h, frame);
        const highlightAngle = Interpolator.interpolateProperty(gradientShape.a, frame);
        const angleRad = (highlightAngle * Math.PI) / 180;
        const fx = center[0] + Math.cos(angleRad) * highlightLength;
        const fy = center[1] + Math.sin(angleRad) * highlightLength;
        gradientElement.setAttribute('fx', fx);
        gradientElement.setAttribute('fy', fy);
      }
    }
    
    if (gradientShape.g && gradientShape.g.k) {
      const colors = Interpolator.interpolateProperty(gradientShape.g.k, frame);
      const colorCount = gradientShape.g.p;
      const stops = gradientElement.querySelectorAll('stop');
      
      /* Lottie gradient format: [colorStops][opacityStops]
       * Color stops: offset, r, g, b (4 values each)
       * Opacity stops: offset, opacity (2 values each, after color data) */
      const colorDataLen = colorCount * 4;
      const hasOpacity = colors.length > colorDataLen;
      
      for (let i = 0; i < colorCount && i < stops.length; i++) {
        const offset = colors[i * 4];
        const r = Math.round(colors[i * 4 + 1] * 255);
        const g = Math.round(colors[i * 4 + 2] * 255);
        const b = Math.round(colors[i * 4 + 3] * 255);
        
        /* Get opacity from separate opacity stops if present */
        let opacity = 1;
        if (hasOpacity) {
          const opacityIdx = colorDataLen + i * 2 + 1;
          if (opacityIdx < colors.length) {
            opacity = colors[opacityIdx];
          }
        }
        
        stops[i].setAttribute('offset', offset);
        stops[i].setAttribute('stop-color', 'rgb(' + r + ',' + g + ',' + b + ')');
        stops[i].setAttribute('stop-opacity', opacity);
      }
    }
  },
  
  generateId(prefix) {
    /* Use prefix (container ID) to ensure unique IDs across multiple players */
    return (prefix || 'g') + '_grad_' + (++this.gradientCounter);
  }
};



const TransformCalculator = {
  computeFromKeyframes(ks, frame) {
    return {
      position: ks.p ? Interpolator.interpolateProperty(ks.p, frame) : [0, 0],
      anchor: ks.a ? Interpolator.interpolateProperty(ks.a, frame) : [0, 0],
      scale: ks.s ? Interpolator.interpolateProperty(ks.s, frame) : [100, 100],
      rotation: ks.r ? Interpolator.interpolateProperty(ks.r, frame) : 0,
      opacity: ks.o ? Interpolator.interpolateProperty(ks.o, frame) : 100
    };
  },

  combineParentChild(parent, child, parentLayerType) {
    const parentScaleX = parent.scale[0] / 100;
    const parentScaleY = parent.scale[1] / 100;
    const parentRotRad = (parent.rotation || 0) * Math.PI / 180;
    const parentAnchorX = parent.anchor ? parent.anchor[0] : 0;
    const parentAnchorY = parent.anchor ? parent.anchor[1] : 0;
    
    const childX = child.position[0];
    const childY = child.position[1];
    const cos = Math.cos(parentRotRad);
    const sin = Math.sin(parentRotRad);
    
    const transformedX = (childX * cos - childY * sin) * parentScaleX;
    const transformedY = (childX * sin + childY * cos) * parentScaleY;
    
    const scaleSignX = parentScaleX >= 0 ? 1 : -1;
    const scaleSignY = parentScaleY >= 0 ? 1 : -1;
    const px = (parent.position[0] - parentAnchorX * scaleSignX) + transformedX;
    const py = (parent.position[1] - parentAnchorY * scaleSignY) + transformedY;
    
    const sx = (parent.scale[0] / 100) * child.scale[0];
    const sy = (parent.scale[1] / 100) * child.scale[1];
    const r = (parent.rotation || 0) + (child.rotation || 0);
    const o = parentLayerType === 3 ? child.opacity : (parent.opacity / 100) * child.opacity;
    
    const ax = child.anchor ? child.anchor[0] : 0;
    const ay = child.anchor ? child.anchor[1] : 0;
    
    return { position: [px, py], anchor: [ax, ay], scale: [sx, sy], rotation: r, opacity: o };
  },

  resolveParentChain(layer, frame, idPrefix, elementRegistry) {
    let transform = this.computeFromKeyframes(layer.ks, frame);
    
    let currentLayer = layer;
    while (currentLayer.parent) {
      const parentId = idPrefix + '_' + currentLayer.parent;
      const parentData = elementRegistry.get(parentId);
      if (!parentData) break;
      
      const parentTransform = this.computeFromKeyframes(parentData.layer.ks, frame);
      transform = this.combineParentChild(parentTransform, transform, parentData.layer.ty);
      currentLayer = parentData.layer;
    }
    
    return transform;
  }
};



const StrokeOrderDetector = {
  analyzeGroup(groupItems) {
    let fillIndex = -1;
    let strokeIndex = -1;

    for (let idx = 0; idx < groupItems.length; idx++) {
      const item = groupItems[idx];
      if ((item.ty === 'fl' || item.ty === 'gf') && fillIndex < 0) {
        fillIndex = idx;
      }
      if ((item.ty === 'st' || item.ty === 'gs') && strokeIndex < 0) {
        strokeIndex = idx;
      }
    }

    return {
      fillIndex,
      strokeIndex,
      strokeFirst: strokeIndex >= 0 && fillIndex >= 0 && strokeIndex > fillIndex
    };
  }
};



const ShapeCollector = {
  extractFromGroup(groupItems) {
    const pathShapes = [];
    let fillShape = null;
    let gradientFillShape = null;
    const strokeShapes = [];
    let transformShape = null;
    const trimShapes = [];
    let mergeShape = null;

    for (const item of groupItems) {
      switch (item.ty) {
        case 'sh': pathShapes.push(item); break;
        case 'fl': fillShape = item; break;
        case 'gf': gradientFillShape = item; break;
        case 'st': strokeShapes.push(item); break;
        case 'tr': transformShape = item; break;
        case 'tm': trimShapes.push(item); break;
        case 'mm': mergeShape = item; break;
      }
    }

    return {
      pathShapes,
      fillShape,
      gradientFillShape,
      strokeShapes,
      transformShape,
      trimShapes,
      mergeShape
    };
  },

  extractLayerLevel(layerShapes) {
    return {
      trimShapes: layerShapes.filter(s => s.ty === 'tm'),
      fillShape: layerShapes.find(s => s.ty === 'fl'),
      strokeShape: layerShapes.find(s => s.ty === 'st'),
      gradientFillShape: layerShapes.find(s => s.ty === 'gf')
    };
  },

  mergeWithLayerDefaults(groupShapes, layerShapes) {
    return {
      ...groupShapes,
      fillShape: groupShapes.fillShape || layerShapes.fillShape,
      gradientFillShape: groupShapes.gradientFillShape || layerShapes.gradientFillShape,
      strokeShapes: groupShapes.strokeShapes.length > 0 ? groupShapes.strokeShapes : 
        (layerShapes.strokeShape ? [layerShapes.strokeShape] : []),
      trimShapes: [...(layerShapes.trimShapes || []), ...groupShapes.trimShapes]
    };
  }
};



const PathElementFactory = {
  createFillPath(parentGroup, gradientId) {
    const element = SvgBuilder.createPath();
    if (gradientId) {
      element.setAttribute('fill', 'url(#' + gradientId + ')');
    }
    parentGroup.appendChild(element);
    return element;
  },

  createStrokePath(parentGroup) {
    const element = SvgBuilder.createPath();
    parentGroup.appendChild(element);
    return element;
  },

  createEmptyPath(parentGroup) {
    const element = SvgBuilder.createPath();
    parentGroup.appendChild(element);
    return element;
  },

  createPathDescriptor(element, group, shapes, isMerged) {
    return {
      element,
      group,
      pathShape: isMerged ? undefined : shapes.pathShape,
      pathShapes: isMerged ? shapes.pathShapes : undefined,
      fillShape: shapes.fillShape,
      gradientFillShape: shapes.gradientFillShape,
      gradientElement: shapes.gradientElement,
      strokeShape: shapes.strokeShape,
      transformShape: shapes.transformShape,
      trimShapes: shapes.trimShapes,
      merged: isMerged
    };
  }
};



const GroupBuilder = {
  build(group, parentGroup, elementRegistry, uniqueId, containerId, layerDefaults, svgRoot) {
    const g = SvgBuilder.createGroup();
    parentGroup.appendChild(g);
    
    const collected = ShapeCollector.extractFromGroup(group.it || []);
    const orderInfo = StrokeOrderDetector.analyzeGroup(group.it || []);
    const shapes = ShapeCollector.mergeWithLayerDefaults(collected, layerDefaults);
    
    const hasFill = shapes.fillShape || shapes.gradientFillShape;
    const hasStroke = shapes.strokeShapes.length > 0;
    
    let gradientElement = null;
    let gradientId = null;
    if (shapes.gradientFillShape) {
      gradientId = GradientBuilder.generateId(containerId);
      gradientElement = GradientBuilder.createGradientElement(svgRoot, shapes.gradientFillShape, gradientId);
    }
    
    if (shapes.pathShapes.length === 0) return;
    
    const elemData = elementRegistry.get(uniqueId);
    const isMergedMode = shapes.mergeShape && shapes.mergeShape.mm === 1 && shapes.pathShapes.length > 1;
    
    if (isMergedMode) {
      this.buildMergedPaths(g, elemData, shapes, hasFill, hasStroke, orderInfo.strokeFirst, gradientId, gradientElement);
    } else {
      this.buildSeparatePaths(g, elemData, shapes, hasFill, hasStroke, orderInfo.strokeFirst, gradientId, gradientElement);
    }
  },

  buildMergedPaths(group, elemData, shapes, hasFill, hasStroke, strokeFirst, gradientId, gradientElement) {
    if (strokeFirst) {
      if (hasStroke) this.createStrokeElements(group, elemData, null, shapes.pathShapes, true, shapes, gradientId, gradientElement);
      if (hasFill) this.createFillElement(group, elemData, null, shapes.pathShapes, true, shapes, gradientId, gradientElement);
    } else {
      if (hasFill) this.createFillElement(group, elemData, null, shapes.pathShapes, true, shapes, gradientId, gradientElement);
      if (hasStroke) this.createStrokeElements(group, elemData, null, shapes.pathShapes, true, shapes, gradientId, gradientElement);
    }
  },

  buildSeparatePaths(group, elemData, shapes, hasFill, hasStroke, strokeFirst, gradientId, gradientElement) {
    for (const pathShape of shapes.pathShapes) {
      if (strokeFirst) {
        if (hasStroke) this.createStrokeElements(group, elemData, pathShape, null, false, shapes, gradientId, gradientElement);
        if (hasFill) this.createFillElement(group, elemData, pathShape, null, false, shapes, gradientId, gradientElement);
      } else {
        if (hasFill) this.createFillElement(group, elemData, pathShape, null, false, shapes, gradientId, gradientElement);
        if (hasStroke) this.createStrokeElements(group, elemData, pathShape, null, false, shapes, gradientId, gradientElement);
      }
      if (!hasFill && !hasStroke) {
        const element = PathElementFactory.createEmptyPath(group);
        const descriptor = PathElementFactory.createPathDescriptor(element, group, {
          pathShape,
          fillShape: null,
          gradientFillShape: null,
          gradientElement: null,
          strokeShape: null,
          transformShape: shapes.transformShape,
          trimShapes: shapes.trimShapes
        }, false);
        elemData.paths.push(descriptor);
      }
    }
  },

  createFillElement(group, elemData, pathShape, pathShapes, isMerged, shapes, gradientId, gradientElement) {
    const element = PathElementFactory.createFillPath(group, gradientId);
    const descriptor = PathElementFactory.createPathDescriptor(element, group, {
      pathShape,
      pathShapes,
      fillShape: shapes.fillShape,
      gradientFillShape: shapes.gradientFillShape,
      gradientElement,
      strokeShape: null,
      transformShape: shapes.transformShape,
      trimShapes: shapes.trimShapes
    }, isMerged);
    elemData.paths.push(descriptor);
  },

  createStrokeElements(group, elemData, pathShape, pathShapes, isMerged, shapes, gradientId, gradientElement) {
    for (let i = shapes.strokeShapes.length - 1; i >= 0; i--) {
      const strokeShape = shapes.strokeShapes[i];
      const element = PathElementFactory.createStrokePath(group);
      const descriptor = PathElementFactory.createPathDescriptor(element, group, {
        pathShape,
        pathShapes,
        fillShape: null,
        gradientFillShape: null,
        gradientElement: null,
        strokeShape,
        transformShape: shapes.transformShape,
        trimShapes: shapes.trimShapes
      }, isMerged);
      elemData.paths.push(descriptor);
    }
  }
};



class TgsPlayer {
  constructor(animationData, containerSelector) {
    this.data = animationData;
    this.containerId = containerSelector;
    this.container = document.querySelector('#' + containerSelector) || document.getElementById(containerSelector);
    
    if (!this.container) {
      throw new Error('TGS Player: Container element not found: ' + containerSelector);
    }
    
    this.frameRate = animationData.fr;
    this.totalFrames = animationData.op - animationData.ip;
    this.currentFrame = 0;
    this.isPlaying = false;
    this.lastTimestamp = 0;
    this.elements = new Map();
    
    this.init();
  }

  init() {
    this.svg = SvgBuilder.createSvg(this.data.w, this.data.h);
    this.defs = SvgBuilder.createDefs();
    this.svg.appendChild(this.defs);
    this.container.appendChild(this.svg);
    this.buildLayers();
  }

  buildLayers() {
    this.buildLayerList(this.data.layers, this.svg, null, '');
  }

  buildLayerList(layers, parentGroup, precompLayer, idPrefix) {
    const reversed = [...layers].reverse();
    for (const layer of reversed) {
      const uniqueId = idPrefix + '_' + layer.ind;
      
      if (layer.ty === 4) {
        const group = SvgBuilder.createGroup();
        group.setAttribute('data-name', layer.nm);
        parentGroup.appendChild(group);
        this.elements.set(uniqueId, { layer, group, paths: [], idPrefix });
        this.buildShapes(layer, group, uniqueId);
      } else if (layer.ty === 0 && layer.refId) {
        const asset = this.data.assets && this.data.assets.find(a => a.id === layer.refId);
        if (asset && asset.layers) {
          const group = SvgBuilder.createGroup();
          group.setAttribute('data-name', layer.nm);
          
          if (layer.w && layer.h) {
            const clipId = 'clip-' + uniqueId.replace(/[^a-zA-Z0-9]/g, '_');
            const clipPath = SvgBuilder.createClipPath(clipId, layer.w, layer.h);
            this.defs.appendChild(clipPath);
            SvgBuilder.applyClipPath(group, clipId);
          }
          
          parentGroup.appendChild(group);
          this.elements.set(uniqueId, { layer, group, paths: [], isPrecomp: true, idPrefix });
          this.buildLayerList(asset.layers, group, layer, idPrefix + layer.refId);
        }
      } else if (layer.ty === 3) {
        this.elements.set(uniqueId, { layer, group: null, paths: [], idPrefix });
      }
    }
  }

  buildShapes(layer, parentGroup, uniqueId) {
    if (!layer.shapes) return;
    
    const layerDefaults = ShapeCollector.extractLayerLevel(layer.shapes);
    
    for (const shape of layer.shapes) {
      if (shape.ty === 'gr') {
        GroupBuilder.build(shape, parentGroup, this.elements, uniqueId, this.containerId, layerDefaults, this.svg);
      }
    }
  }

  renderFrame(frame) {
    for (const [layerIndex, elemData] of this.elements) {
      const layer = elemData.layer;
      if (!elemData.group) continue;

      const shouldHide = frame < layer.ip || frame > layer.op;
      if (shouldHide) {
        elemData.group.setAttribute('visibility', 'hidden');
        continue;
      }
      elemData.group.setAttribute('visibility', 'visible');

      const transform = TransformCalculator.resolveParentChain(layer, frame, elemData.idPrefix, this.elements);
      SvgBuilder.applyTransform(elemData.group, transform);

      for (const pathData of elemData.paths) {
        this.renderPath(pathData, frame);
      }
    }
  }

  renderPath(pathData, frame) {
    const { element, group, pathShape, pathShapes, fillShape, gradientFillShape, gradientElement, strokeShape, transformShape, trimShapes, merged } = pathData;

    if (merged && pathShapes) {
      const dParts = [];
      for (const ps of pathShapes) {
        if (ps.ks) {
          const pd = Interpolator.interpolatePath(ps.ks, frame);
          dParts.push(SvgBuilder.pathDataToString(pd));
        }
      }
      element.setAttribute('d', dParts.join(' '));
    } else if (pathShape && pathShape.ks) {
      const pd = Interpolator.interpolatePath(pathShape.ks, frame);
      element.setAttribute('d', SvgBuilder.pathDataToString(pd));
    }

    if (gradientFillShape && gradientElement) {
      GradientBuilder.updateGradient(gradientElement, gradientFillShape, frame);
      const opacity = gradientFillShape.o ? Interpolator.interpolateProperty(gradientFillShape.o, frame) : 100;
      element.setAttribute('fill-opacity', opacity / 100);
      if (merged) element.setAttribute('fill-rule', 'evenodd');
    } else if (fillShape) {
      const color = fillShape.c ? Interpolator.interpolateProperty(fillShape.c, frame) : null;
      const opacity = fillShape.o ? Interpolator.interpolateProperty(fillShape.o, frame) : 100;
      SvgBuilder.applyFill(element, color, opacity);
    } else {
      element.setAttribute('fill', 'none');
    }

    if (strokeShape) {
      const color = strokeShape.c ? Interpolator.interpolateProperty(strokeShape.c, frame) : null;
      const opacity = strokeShape.o ? Interpolator.interpolateProperty(strokeShape.o, frame) : 100;
      const width = strokeShape.w ? Interpolator.interpolateProperty(strokeShape.w, frame) : 1;
      const lineCap = strokeShape.lc || 2;
      const lineJoin = strokeShape.lj || 2;
      SvgBuilder.applyStroke(element, color, opacity, width, lineCap, lineJoin);
    }

    if (trimShapes && trimShapes.length > 0) {
      let trimShape = trimShapes[trimShapes.length - 1];
      for (const t of trimShapes) {
        if ((t.s && t.s.a === 1) || (t.e && t.e.a === 1)) {
          trimShape = t;
          break;
        }
      }
      const start = trimShape.s ? Interpolator.interpolateProperty(trimShape.s, frame) : 0;
      const end = trimShape.e ? Interpolator.interpolateProperty(trimShape.e, frame) : 100;
      const offset = trimShape.o ? Interpolator.interpolateProperty(trimShape.o, frame) : 0;
      TrimPaths.apply(element, start, end, offset);
    }

    if (transformShape) {
      const tr = TransformCalculator.computeFromKeyframes(transformShape, frame);
      SvgBuilder.applyTransform(group, tr);
    }
  }

  play() {
    if (this.isPlaying) return;
    this.isPlaying = true;
    this.lastTimestamp = performance.now();
    this.tick();
  }

  pause() {
    this.isPlaying = false;
  }

  stop() {
    this.isPlaying = false;
    this.currentFrame = 0;
    this.renderFrame(0);
  }

  tick() {
    if (!this.isPlaying) return;

    const now = performance.now();
    const delta = now - this.lastTimestamp;
    const frameDelta = (delta / 1000) * this.frameRate;
    
    this.currentFrame += frameDelta;
    if (this.currentFrame >= this.totalFrames) {
      this.currentFrame = this.currentFrame % this.totalFrames;
    }

    this.renderFrame(this.currentFrame);
    this.lastTimestamp = now;
    
    requestAnimationFrame(() => this.tick());
  }
}


const animationData = {
  "tgs": 1,
  "v": "5.5.2",
  "fr": 60,
  "ip": 0,
  "op": 26,
  "w": 512,
  "h": 512,
  "nm": "Radial Flash",
  "ddd": 0,
  "assets": [],
  "layers": [
    {
      "ddd": 0,
      "ind": 41,
      "ty": 4,
      "nm": "Shape Layer 46",
      "sr": 1,
      "ks": {
        "r": {
          "a": 0,
          "k": -60
        },
        "p": {
          "a": 1,
          "k": [
            {
              "i": {
                "x": 0.833,
                "y": 0.833
              },
              "o": {
                "x": 0.167,
                "y": 0.167
              },
              "t": 0,
              "s": [
                255.999,
                255.999,
                0
              ],
              "to": [
                0,
                0,
                0
              ],
              "ti": [
                0,
                0,
                0
              ]
            },
            {
              "t": 26,
              "s": [
                391.186,
                334.049,
                0
              ]
            }
          ]
        },
        "a": {
          "a": 0,
          "k": [
            -87,
            63,
            0
          ]
        },
        "s": {
          "a": 0,
          "k": [
            223,
            223,
            100
          ]
        }
      },
      "ao": 0,
      "shapes": [
        {
          "ty": "gr",
          "it": [
            {
              "ind": 0,
              "ty": "sh",
              "ks": {
                "a": 0,
                "k": {
                  "i": [
                    [
                      0,
                      15
                    ],
                    [
                      0,
                      0
                    ]
                  ],
                  "o": [
                    [
                      0,
                      -15
                    ],
                    [
                      0,
                      0
                    ]
                  ],
                  "v": [
                    [
                      -87,
                      107
                    ],
                    [
                      -87,
                      63
                    ]
                  ],
                  "c": false
                }
              },
              "nm": "Path 1",
              "hd": false
            },
            {
              "ty": "st",
              "c": {
                "a": 0,
                "k": [
                  0,
                  0.7,
                  1,
                  1
                ]
              },
              "o": {
                "a": 0,
                "k": 100
              },
              "w": {
                "a": 0,
                "k": 9
              },
              "lc": 2,
              "lj": 1,
              "ml": 4,
              "bm": 0,
              "nm": "Stroke 1",
              "hd": false
            },
            {
              "ty": "tr",
              "p": {
                "a": 0,
                "k": [
                  0,
                  0
                ]
              },
              "a": {
                "a": 0,
                "k": [
                  0,
                  0
                ]
              },
              "s": {
                "a": 0,
                "k": [
                  100,
                  100
                ]
              },
              "r": {
                "a": 0,
                "k": 0
              },
              "o": {
                "a": 0,
                "k": 100
              },
              "sk": {
                "a": 0,
                "k": 0
              },
              "sa": {
                "a": 0,
                "k": 0
              },
              "nm": "Transform"
            }
          ],
          "nm": "Shape 1",
          "bm": 0,
          "hd": false
        },
        {
          "ty": "tm",
          "s": {
            "a": 1,
            "k": [
              {
                "i": {
                  "x": [
                    0.833
                  ],
                  "y": [
                    0.833
                  ]
                },
                "o": {
                  "x": [
                    0.167
                  ],
                  "y": [
                    0.167
                  ]
                },
                "t": 0,
                "s": [
                  100
                ]
              },
              {
                "t": 14.857421875,
                "s": [
                  0
                ]
              }
            ]
          },
          "e": {
            "a": 1,
            "k": [
              {
                "i": {
                  "x": [
                    0.833
                  ],
                  "y": [
                    0.833
                  ]
                },
                "o": {
                  "x": [
                    0.167
                  ],
                  "y": [
                    0.167
                  ]
                },
                "t": 9.284999999999997,
                "s": [
                  100
                ]
              },
              {
                "t": 26,
                "s": [
                  0
                ]
              }
            ]
          },
          "o": {
            "a": 0,
            "k": 0
          },
          "m": 1,
          "nm": "Trim Paths 1",
          "hd": false
        }
      ],
      "ip": 0,
      "op": 26,
      "st": 0,
      "bm": 0
    },
    {
      "ddd": 0,
      "ind": 42,
      "ty": 4,
      "nm": "Shape Layer 45",
      "sr": 1,
      "ks": {
        "r": {
          "a": 0,
          "k": 120
        },
        "p": {
          "a": 1,
          "k": [
            {
              "i": {
                "x": 0.833,
                "y": 0.833
              },
              "o": {
                "x": 0.167,
                "y": 0.167
              },
              "t": 0,
              "s": [
                255.999,
                255.999,
                0
              ],
              "to": [
                0,
                0,
                0
              ],
              "ti": [
                0,
                0,
                0
              ]
            },
            {
              "t": 26,
              "s": [
                120.813,
                177.949,
                0
              ]
            }
          ]
        },
        "a": {
          "a": 0,
          "k": [
            -87,
            63,
            0
          ]
        },
        "s": {
          "a": 0,
          "k": [
            223,
            223,
            100
          ]
        }
      },
      "ao": 0,
      "shapes": [
        {
          "ty": "gr",
          "it": [
            {
              "ind": 0,
              "ty": "sh",
              "ks": {
                "a": 0,
                "k": {
                  "i": [
                    [
                      0,
                      15
                    ],
                    [
                      0,
                      0
                    ]
                  ],
                  "o": [
                    [
                      0,
                      -15
                    ],
                    [
                      0,
                      0
                    ]
                  ],
                  "v": [
                    [
                      -87,
                      107
                    ],
                    [
                      -87,
                      63
                    ]
                  ],
                  "c": false
                }
              },
              "nm": "Path 1",
              "hd": false
            },
            {
              "ty": "st",
              "c": {
                "a": 0,
                "k": [
                  0,
                  0.7,
                  1,
                  1
                ]
              },
              "o": {
                "a": 0,
                "k": 100
              },
              "w": {
                "a": 0,
                "k": 9
              },
              "lc": 2,
              "lj": 1,
              "ml": 4,
              "bm": 0,
              "nm": "Stroke 1",
              "hd": false
            },
            {
              "ty": "tr",
              "p": {
                "a": 0,
                "k": [
                  0,
                  0
                ]
              },
              "a": {
                "a": 0,
                "k": [
                  0,
                  0
                ]
              },
              "s": {
                "a": 0,
                "k": [
                  100,
                  100
                ]
              },
              "r": {
                "a": 0,
                "k": 0
              },
              "o": {
                "a": 0,
                "k": 100
              },
              "sk": {
                "a": 0,
                "k": 0
              },
              "sa": {
                "a": 0,
                "k": 0
              },
              "nm": "Transform"
            }
          ],
          "nm": "Shape 1",
          "bm": 0,
          "hd": false
        },
        {
          "ty": "tm",
          "s": {
            "a": 1,
            "k": [
              {
                "i": {
                  "x": [
                    0.833
                  ],
                  "y": [
                    0.833
                  ]
                },
                "o": {
                  "x": [
                    0.167
                  ],
                  "y": [
                    0.167
                  ]
                },
                "t": 0,
                "s": [
                  100
                ]
              },
              {
                "t": 14.857421875,
                "s": [
                  0
                ]
              }
            ]
          },
          "e": {
            "a": 1,
            "k": [
              {
                "i": {
                  "x": [
                    0.833
                  ],
                  "y": [
                    0.833
                  ]
                },
                "o": {
                  "x": [
                    0.167
                  ],
                  "y": [
                    0.167
                  ]
                },
                "t": 9.284999999999997,
                "s": [
                  100
                ]
              },
              {
                "t": 26,
                "s": [
                  0
                ]
              }
            ]
          },
          "o": {
            "a": 0,
            "k": 0
          },
          "m": 1,
          "nm": "Trim Paths 1",
          "hd": false
        }
      ],
      "ip": 0,
      "op": 26,
      "st": 0,
      "bm": 0
    },
    {
      "ddd": 0,
      "ind": 43,
      "ty": 4,
      "nm": "Shape Layer 44",
      "sr": 1,
      "ks": {
        "r": {
          "a": 0,
          "k": -150
        },
        "p": {
          "a": 1,
          "k": [
            {
              "i": {
                "x": 0.833,
                "y": 0.833
              },
              "o": {
                "x": 0.167,
                "y": 0.167
              },
              "t": 0,
              "s": [
                255.999,
                255.999,
                0
              ],
              "to": [
                0,
                0,
                0
              ],
              "ti": [
                0,
                0,
                0
              ]
            },
            {
              "t": 26,
              "s": [
                334.049,
                120.813,
                0
              ]
            }
          ]
        },
        "a": {
          "a": 0,
          "k": [
            -87,
            63,
            0
          ]
        },
        "s": {
          "a": 0,
          "k": [
            223,
            223,
            100
          ]
        }
      },
      "ao": 0,
      "shapes": [
        {
          "ty": "gr",
          "it": [
            {
              "ind": 0,
              "ty": "sh",
              "ks": {
                "a": 0,
                "k": {
                  "i": [
                    [
                      0,
                      15
                    ],
                    [
                      0,
                      0
                    ]
                  ],
                  "o": [
                    [
                      0,
                      -15
                    ],
                    [
                      0,
                      0
                    ]
                  ],
                  "v": [
                    [
                      -87,
                      107
                    ],
                    [
                      -87,
                      63
                    ]
                  ],
                  "c": false
                }
              },
              "nm": "Path 1",
              "hd": false
            },
            {
              "ty": "st",
              "c": {
                "a": 0,
                "k": [
                  0,
                  0.7,
                  1,
                  1
                ]
              },
              "o": {
                "a": 0,
                "k": 100
              },
              "w": {
                "a": 0,
                "k": 9
              },
              "lc": 2,
              "lj": 1,
              "ml": 4,
              "bm": 0,
              "nm": "Stroke 1",
              "hd": false
            },
            {
              "ty": "tr",
              "p": {
                "a": 0,
                "k": [
                  0,
                  0
                ]
              },
              "a": {
                "a": 0,
                "k": [
                  0,
                  0
                ]
              },
              "s": {
                "a": 0,
                "k": [
                  100,
                  100
                ]
              },
              "r": {
                "a": 0,
                "k": 0
              },
              "o": {
                "a": 0,
                "k": 100
              },
              "sk": {
                "a": 0,
                "k": 0
              },
              "sa": {
                "a": 0,
                "k": 0
              },
              "nm": "Transform"
            }
          ],
          "nm": "Shape 1",
          "bm": 0,
          "hd": false
        },
        {
          "ty": "tm",
          "s": {
            "a": 1,
            "k": [
              {
                "i": {
                  "x": [
                    0.833
                  ],
                  "y": [
                    0.833
                  ]
                },
                "o": {
                  "x": [
                    0.167
                  ],
                  "y": [
                    0.167
                  ]
                },
                "t": 0,
                "s": [
                  100
                ]
              },
              {
                "t": 14.857421875,
                "s": [
                  0
                ]
              }
            ]
          },
          "e": {
            "a": 1,
            "k": [
              {
                "i": {
                  "x": [
                    0.833
                  ],
                  "y": [
                    0.833
                  ]
                },
                "o": {
                  "x": [
                    0.167
                  ],
                  "y": [
                    0.167
                  ]
                },
                "t": 9.284999999999997,
                "s": [
                  100
                ]
              },
              {
                "t": 26,
                "s": [
                  0
                ]
              }
            ]
          },
          "o": {
            "a": 0,
            "k": 0
          },
          "m": 1,
          "nm": "Trim Paths 1",
          "hd": false
        }
      ],
      "ip": 0,
      "op": 26,
      "st": 0,
      "bm": 0
    },
    {
      "ddd": 0,
      "ind": 44,
      "ty": 4,
      "nm": "Shape Layer 43",
      "sr": 1,
      "ks": {
        "r": {
          "a": 0,
          "k": 30
        },
        "p": {
          "a": 1,
          "k": [
            {
              "i": {
                "x": 0.833,
                "y": 0.833
              },
              "o": {
                "x": 0.167,
                "y": 0.167
              },
              "t": 0,
              "s": [
                255.999,
                255.999,
                0
              ],
              "to": [
                0,
                0,
                0
              ],
              "ti": [
                0,
                0,
                0
              ]
            },
            {
              "t": 26,
              "s": [
                177.949,
                391.186,
                0
              ]
            }
          ]
        },
        "a": {
          "a": 0,
          "k": [
            -87,
            63,
            0
          ]
        },
        "s": {
          "a": 0,
          "k": [
            223,
            223,
            100
          ]
        }
      },
      "ao": 0,
      "shapes": [
        {
          "ty": "gr",
          "it": [
            {
              "ind": 0,
              "ty": "sh",
              "ks": {
                "a": 0,
                "k": {
                  "i": [
                    [
                      0,
                      15
                    ],
                    [
                      0,
                      0
                    ]
                  ],
                  "o": [
                    [
                      0,
                      -15
                    ],
                    [
                      0,
                      0
                    ]
                  ],
                  "v": [
                    [
                      -87,
                      107
                    ],
                    [
                      -87,
                      63
                    ]
                  ],
                  "c": false
                }
              },
              "nm": "Path 1",
              "hd": false
            },
            {
              "ty": "st",
              "c": {
                "a": 0,
                "k": [
                  0,
                  0.7,
                  1,
                  1
                ]
              },
              "o": {
                "a": 0,
                "k": 100
              },
              "w": {
                "a": 0,
                "k": 9
              },
              "lc": 2,
              "lj": 1,
              "ml": 4,
              "bm": 0,
              "nm": "Stroke 1",
              "hd": false
            },
            {
              "ty": "tr",
              "p": {
                "a": 0,
                "k": [
                  0,
                  0
                ]
              },
              "a": {
                "a": 0,
                "k": [
                  0,
                  0
                ]
              },
              "s": {
                "a": 0,
                "k": [
                  100,
                  100
                ]
              },
              "r": {
                "a": 0,
                "k": 0
              },
              "o": {
                "a": 0,
                "k": 100
              },
              "sk": {
                "a": 0,
                "k": 0
              },
              "sa": {
                "a": 0,
                "k": 0
              },
              "nm": "Transform"
            }
          ],
          "nm": "Shape 1",
          "bm": 0,
          "hd": false
        },
        {
          "ty": "tm",
          "s": {
            "a": 1,
            "k": [
              {
                "i": {
                  "x": [
                    0.833
                  ],
                  "y": [
                    0.833
                  ]
                },
                "o": {
                  "x": [
                    0.167
                  ],
                  "y": [
                    0.167
                  ]
                },
                "t": 0,
                "s": [
                  100
                ]
              },
              {
                "t": 14.857421875,
                "s": [
                  0
                ]
              }
            ]
          },
          "e": {
            "a": 1,
            "k": [
              {
                "i": {
                  "x": [
                    0.833
                  ],
                  "y": [
                    0.833
                  ]
                },
                "o": {
                  "x": [
                    0.167
                  ],
                  "y": [
                    0.167
                  ]
                },
                "t": 9.284999999999997,
                "s": [
                  100
                ]
              },
              {
                "t": 26,
                "s": [
                  0
                ]
              }
            ]
          },
          "o": {
            "a": 0,
            "k": 0
          },
          "m": 1,
          "nm": "Trim Paths 1",
          "hd": false
        }
      ],
      "ip": 0,
      "op": 26,
      "st": 0,
      "bm": 0
    },
    {
      "ddd": 0,
      "ind": 45,
      "ty": 4,
      "nm": "Shape Layer 42",
      "sr": 1,
      "ks": {
        "r": {
          "a": 0,
          "k": -30
        },
        "p": {
          "a": 1,
          "k": [
            {
              "i": {
                "x": 0.833,
                "y": 0.833
              },
              "o": {
                "x": 0.167,
                "y": 0.167
              },
              "t": 0,
              "s": [
                255.999,
                255.999,
                0
              ],
              "to": [
                0,
                0,
                0
              ],
              "ti": [
                0,
                0,
                0
              ]
            },
            {
              "t": 26,
              "s": [
                334.049,
                391.186,
                0
              ]
            }
          ]
        },
        "a": {
          "a": 0,
          "k": [
            -87,
            63,
            0
          ]
        },
        "s": {
          "a": 0,
          "k": [
            223,
            223,
            100
          ]
        }
      },
      "ao": 0,
      "shapes": [
        {
          "ty": "gr",
          "it": [
            {
              "ind": 0,
              "ty": "sh",
              "ks": {
                "a": 0,
                "k": {
                  "i": [
                    [
                      0,
                      15
                    ],
                    [
                      0,
                      0
                    ]
                  ],
                  "o": [
                    [
                      0,
                      -15
                    ],
                    [
                      0,
                      0
                    ]
                  ],
                  "v": [
                    [
                      -87,
                      107
                    ],
                    [
                      -87,
                      63
                    ]
                  ],
                  "c": false
                }
              },
              "nm": "Path 1",
              "hd": false
            },
            {
              "ty": "st",
              "c": {
                "a": 0,
                "k": [
                  0,
                  0.7,
                  1,
                  1
                ]
              },
              "o": {
                "a": 0,
                "k": 100
              },
              "w": {
                "a": 0,
                "k": 9
              },
              "lc": 2,
              "lj": 1,
              "ml": 4,
              "bm": 0,
              "nm": "Stroke 1",
              "hd": false
            },
            {
              "ty": "tr",
              "p": {
                "a": 0,
                "k": [
                  0,
                  0
                ]
              },
              "a": {
                "a": 0,
                "k": [
                  0,
                  0
                ]
              },
              "s": {
                "a": 0,
                "k": [
                  100,
                  100
                ]
              },
              "r": {
                "a": 0,
                "k": 0
              },
              "o": {
                "a": 0,
                "k": 100
              },
              "sk": {
                "a": 0,
                "k": 0
              },
              "sa": {
                "a": 0,
                "k": 0
              },
              "nm": "Transform"
            }
          ],
          "nm": "Shape 1",
          "bm": 0,
          "hd": false
        },
        {
          "ty": "tm",
          "s": {
            "a": 1,
            "k": [
              {
                "i": {
                  "x": [
                    0.833
                  ],
                  "y": [
                    0.833
                  ]
                },
                "o": {
                  "x": [
                    0.167
                  ],
                  "y": [
                    0.167
                  ]
                },
                "t": 0,
                "s": [
                  100
                ]
              },
              {
                "t": 14.857421875,
                "s": [
                  0
                ]
              }
            ]
          },
          "e": {
            "a": 1,
            "k": [
              {
                "i": {
                  "x": [
                    0.833
                  ],
                  "y": [
                    0.833
                  ]
                },
                "o": {
                  "x": [
                    0.167
                  ],
                  "y": [
                    0.167
                  ]
                },
                "t": 9.284999999999997,
                "s": [
                  100
                ]
              },
              {
                "t": 26,
                "s": [
                  0
                ]
              }
            ]
          },
          "o": {
            "a": 0,
            "k": 0
          },
          "m": 1,
          "nm": "Trim Paths 1",
          "hd": false
        }
      ],
      "ip": 0,
      "op": 26,
      "st": 0,
      "bm": 0
    },
    {
      "ddd": 0,
      "ind": 46,
      "ty": 4,
      "nm": "Shape Layer 41",
      "sr": 1,
      "ks": {
        "r": {
          "a": 0,
          "k": 150
        },
        "p": {
          "a": 1,
          "k": [
            {
              "i": {
                "x": 0.833,
                "y": 0.833
              },
              "o": {
                "x": 0.167,
                "y": 0.167
              },
              "t": 0,
              "s": [
                255.999,
                255.999,
                0
              ],
              "to": [
                0,
                0,
                0
              ],
              "ti": [
                0,
                0,
                0
              ]
            },
            {
              "t": 26,
              "s": [
                177.949,
                120.813,
                0
              ]
            }
          ]
        },
        "a": {
          "a": 0,
          "k": [
            -87,
            63,
            0
          ]
        },
        "s": {
          "a": 0,
          "k": [
            223,
            223,
            100
          ]
        }
      },
      "ao": 0,
      "shapes": [
        {
          "ty": "gr",
          "it": [
            {
              "ind": 0,
              "ty": "sh",
              "ks": {
                "a": 0,
                "k": {
                  "i": [
                    [
                      0,
                      15
                    ],
                    [
                      0,
                      0
                    ]
                  ],
                  "o": [
                    [
                      0,
                      -15
                    ],
                    [
                      0,
                      0
                    ]
                  ],
                  "v": [
                    [
                      -87,
                      107
                    ],
                    [
                      -87,
                      63
                    ]
                  ],
                  "c": false
                }
              },
              "nm": "Path 1",
              "hd": false
            },
            {
              "ty": "st",
              "c": {
                "a": 0,
                "k": [
                  0,
                  0.7,
                  1,
                  1
                ]
              },
              "o": {
                "a": 0,
                "k": 100
              },
              "w": {
                "a": 0,
                "k": 9
              },
              "lc": 2,
              "lj": 1,
              "ml": 4,
              "bm": 0,
              "nm": "Stroke 1",
              "hd": false
            },
            {
              "ty": "tr",
              "p": {
                "a": 0,
                "k": [
                  0,
                  0
                ]
              },
              "a": {
                "a": 0,
                "k": [
                  0,
                  0
                ]
              },
              "s": {
                "a": 0,
                "k": [
                  100,
                  100
                ]
              },
              "r": {
                "a": 0,
                "k": 0
              },
              "o": {
                "a": 0,
                "k": 100
              },
              "sk": {
                "a": 0,
                "k": 0
              },
              "sa": {
                "a": 0,
                "k": 0
              },
              "nm": "Transform"
            }
          ],
          "nm": "Shape 1",
          "bm": 0,
          "hd": false
        },
        {
          "ty": "tm",
          "s": {
            "a": 1,
            "k": [
              {
                "i": {
                  "x": [
                    0.833
                  ],
                  "y": [
                    0.833
                  ]
                },
                "o": {
                  "x": [
                    0.167
                  ],
                  "y": [
                    0.167
                  ]
                },
                "t": 0,
                "s": [
                  100
                ]
              },
              {
                "t": 14.857421875,
                "s": [
                  0
                ]
              }
            ]
          },
          "e": {
            "a": 1,
            "k": [
              {
                "i": {
                  "x": [
                    0.833
                  ],
                  "y": [
                    0.833
                  ]
                },
                "o": {
                  "x": [
                    0.167
                  ],
                  "y": [
                    0.167
                  ]
                },
                "t": 9.284999999999997,
                "s": [
                  100
                ]
              },
              {
                "t": 26,
                "s": [
                  0
                ]
              }
            ]
          },
          "o": {
            "a": 0,
            "k": 0
          },
          "m": 1,
          "nm": "Trim Paths 1",
          "hd": false
        }
      ],
      "ip": 0,
      "op": 26,
      "st": 0,
      "bm": 0
    },
    {
      "ddd": 0,
      "ind": 47,
      "ty": 4,
      "nm": "Shape Layer 40",
      "sr": 1,
      "ks": {
        "r": {
          "a": 0,
          "k": -120
        },
        "p": {
          "a": 1,
          "k": [
            {
              "i": {
                "x": 0.833,
                "y": 0.833
              },
              "o": {
                "x": 0.167,
                "y": 0.167
              },
              "t": 0,
              "s": [
                255.999,
                255.999,
                0
              ],
              "to": [
                0,
                0,
                0
              ],
              "ti": [
                0,
                0,
                0
              ]
            },
            {
              "t": 26,
              "s": [
                391.186,
                177.949,
                0
              ]
            }
          ]
        },
        "a": {
          "a": 0,
          "k": [
            -87,
            63,
            0
          ]
        },
        "s": {
          "a": 0,
          "k": [
            223,
            223,
            100
          ]
        }
      },
      "ao": 0,
      "shapes": [
        {
          "ty": "gr",
          "it": [
            {
              "ind": 0,
              "ty": "sh",
              "ks": {
                "a": 0,
                "k": {
                  "i": [
                    [
                      0,
                      15
                    ],
                    [
                      0,
                      0
                    ]
                  ],
                  "o": [
                    [
                      0,
                      -15
                    ],
                    [
                      0,
                      0
                    ]
                  ],
                  "v": [
                    [
                      -87,
                      107
                    ],
                    [
                      -87,
                      63
                    ]
                  ],
                  "c": false
                }
              },
              "nm": "Path 1",
              "hd": false
            },
            {
              "ty": "st",
              "c": {
                "a": 0,
                "k": [
                  0,
                  0.7,
                  1,
                  1
                ]
              },
              "o": {
                "a": 0,
                "k": 100
              },
              "w": {
                "a": 0,
                "k": 9
              },
              "lc": 2,
              "lj": 1,
              "ml": 4,
              "bm": 0,
              "nm": "Stroke 1",
              "hd": false
            },
            {
              "ty": "tr",
              "p": {
                "a": 0,
                "k": [
                  0,
                  0
                ]
              },
              "a": {
                "a": 0,
                "k": [
                  0,
                  0
                ]
              },
              "s": {
                "a": 0,
                "k": [
                  100,
                  100
                ]
              },
              "r": {
                "a": 0,
                "k": 0
              },
              "o": {
                "a": 0,
                "k": 100
              },
              "sk": {
                "a": 0,
                "k": 0
              },
              "sa": {
                "a": 0,
                "k": 0
              },
              "nm": "Transform"
            }
          ],
          "nm": "Shape 1",
          "bm": 0,
          "hd": false
        },
        {
          "ty": "tm",
          "s": {
            "a": 1,
            "k": [
              {
                "i": {
                  "x": [
                    0.833
                  ],
                  "y": [
                    0.833
                  ]
                },
                "o": {
                  "x": [
                    0.167
                  ],
                  "y": [
                    0.167
                  ]
                },
                "t": 0,
                "s": [
                  100
                ]
              },
              {
                "t": 14.857421875,
                "s": [
                  0
                ]
              }
            ]
          },
          "e": {
            "a": 1,
            "k": [
              {
                "i": {
                  "x": [
                    0.833
                  ],
                  "y": [
                    0.833
                  ]
                },
                "o": {
                  "x": [
                    0.167
                  ],
                  "y": [
                    0.167
                  ]
                },
                "t": 9.284999999999997,
                "s": [
                  100
                ]
              },
              {
                "t": 26,
                "s": [
                  0
                ]
              }
            ]
          },
          "o": {
            "a": 0,
            "k": 0
          },
          "m": 1,
          "nm": "Trim Paths 1",
          "hd": false
        }
      ],
      "ip": 0,
      "op": 26,
      "st": 0,
      "bm": 0
    },
    {
      "ddd": 0,
      "ind": 48,
      "ty": 4,
      "nm": "Shape Layer 39",
      "sr": 1,
      "ks": {
        "r": {
          "a": 0,
          "k": 60
        },
        "p": {
          "a": 1,
          "k": [
            {
              "i": {
                "x": 0.833,
                "y": 0.833
              },
              "o": {
                "x": 0.167,
                "y": 0.167
              },
              "t": 0,
              "s": [
                255.999,
                255.999,
                0
              ],
              "to": [
                0,
                0,
                0
              ],
              "ti": [
                0,
                0,
                0
              ]
            },
            {
              "t": 26,
              "s": [
                120.813,
                334.049,
                0
              ]
            }
          ]
        },
        "a": {
          "a": 0,
          "k": [
            -87,
            63,
            0
          ]
        },
        "s": {
          "a": 0,
          "k": [
            223,
            223,
            100
          ]
        }
      },
      "ao": 0,
      "shapes": [
        {
          "ty": "gr",
          "it": [
            {
              "ind": 0,
              "ty": "sh",
              "ks": {
                "a": 0,
                "k": {
                  "i": [
                    [
                      0,
                      15
                    ],
                    [
                      0,
                      0
                    ]
                  ],
                  "o": [
                    [
                      0,
                      -15
                    ],
                    [
                      0,
                      0
                    ]
                  ],
                  "v": [
                    [
                      -87,
                      107
                    ],
                    [
                      -87,
                      63
                    ]
                  ],
                  "c": false
                }
              },
              "nm": "Path 1",
              "hd": false
            },
            {
              "ty": "st",
              "c": {
                "a": 0,
                "k": [
                  0,
                  0.7,
                  1,
                  1
                ]
              },
              "o": {
                "a": 0,
                "k": 100
              },
              "w": {
                "a": 0,
                "k": 9
              },
              "lc": 2,
              "lj": 1,
              "ml": 4,
              "bm": 0,
              "nm": "Stroke 1",
              "hd": false
            },
            {
              "ty": "tr",
              "p": {
                "a": 0,
                "k": [
                  0,
                  0
                ]
              },
              "a": {
                "a": 0,
                "k": [
                  0,
                  0
                ]
              },
              "s": {
                "a": 0,
                "k": [
                  100,
                  100
                ]
              },
              "r": {
                "a": 0,
                "k": 0
              },
              "o": {
                "a": 0,
                "k": 100
              },
              "sk": {
                "a": 0,
                "k": 0
              },
              "sa": {
                "a": 0,
                "k": 0
              },
              "nm": "Transform"
            }
          ],
          "nm": "Shape 1",
          "bm": 0,
          "hd": false
        },
        {
          "ty": "tm",
          "s": {
            "a": 1,
            "k": [
              {
                "i": {
                  "x": [
                    0.833
                  ],
                  "y": [
                    0.833
                  ]
                },
                "o": {
                  "x": [
                    0.167
                  ],
                  "y": [
                    0.167
                  ]
                },
                "t": 0,
                "s": [
                  100
                ]
              },
              {
                "t": 14.857421875,
                "s": [
                  0
                ]
              }
            ]
          },
          "e": {
            "a": 1,
            "k": [
              {
                "i": {
                  "x": [
                    0.833
                  ],
                  "y": [
                    0.833
                  ]
                },
                "o": {
                  "x": [
                    0.167
                  ],
                  "y": [
                    0.167
                  ]
                },
                "t": 9.284999999999997,
                "s": [
                  100
                ]
              },
              {
                "t": 26,
                "s": [
                  0
                ]
              }
            ]
          },
          "o": {
            "a": 0,
            "k": 0
          },
          "m": 1,
          "nm": "Trim Paths 1",
          "hd": false
        }
      ],
      "ip": 0,
      "op": 26,
      "st": 0,
      "bm": 0
    },
    {
      "ddd": 0,
      "ind": 49,
      "ty": 4,
      "nm": "Shape Layer 38",
      "sr": 1,
      "ks": {
        "r": {
          "a": 0,
          "k": -90
        },
        "p": {
          "a": 1,
          "k": [
            {
              "i": {
                "x": 0.833,
                "y": 0.833
              },
              "o": {
                "x": 0.167,
                "y": 0.167
              },
              "t": 0,
              "s": [
                255.999,
                255.999,
                0
              ],
              "to": [
                0,
                0,
                0
              ],
              "ti": [
                0,
                0,
                0
              ]
            },
            {
              "t": 26,
              "s": [
                412.099,
                255.999,
                0
              ]
            }
          ]
        },
        "a": {
          "a": 0,
          "k": [
            -87,
            63,
            0
          ]
        },
        "s": {
          "a": 0,
          "k": [
            223,
            223,
            100
          ]
        }
      },
      "ao": 0,
      "shapes": [
        {
          "ty": "gr",
          "it": [
            {
              "ind": 0,
              "ty": "sh",
              "ks": {
                "a": 0,
                "k": {
                  "i": [
                    [
                      0,
                      15
                    ],
                    [
                      0,
                      0
                    ]
                  ],
                  "o": [
                    [
                      0,
                      -15
                    ],
                    [
                      0,
                      0
                    ]
                  ],
                  "v": [
                    [
                      -87,
                      107
                    ],
                    [
                      -87,
                      63
                    ]
                  ],
                  "c": false
                }
              },
              "nm": "Path 1",
              "hd": false
            },
            {
              "ty": "st",
              "c": {
                "a": 0,
                "k": [
                  0,
                  0.7,
                  1,
                  1
                ]
              },
              "o": {
                "a": 0,
                "k": 100
              },
              "w": {
                "a": 0,
                "k": 9
              },
              "lc": 2,
              "lj": 1,
              "ml": 4,
              "bm": 0,
              "nm": "Stroke 1",
              "hd": false
            },
            {
              "ty": "tr",
              "p": {
                "a": 0,
                "k": [
                  0,
                  0
                ]
              },
              "a": {
                "a": 0,
                "k": [
                  0,
                  0
                ]
              },
              "s": {
                "a": 0,
                "k": [
                  100,
                  100
                ]
              },
              "r": {
                "a": 0,
                "k": 0
              },
              "o": {
                "a": 0,
                "k": 100
              },
              "sk": {
                "a": 0,
                "k": 0
              },
              "sa": {
                "a": 0,
                "k": 0
              },
              "nm": "Transform"
            }
          ],
          "nm": "Shape 1",
          "bm": 0,
          "hd": false
        },
        {
          "ty": "tm",
          "s": {
            "a": 1,
            "k": [
              {
                "i": {
                  "x": [
                    0.833
                  ],
                  "y": [
                    0.833
                  ]
                },
                "o": {
                  "x": [
                    0.167
                  ],
                  "y": [
                    0.167
                  ]
                },
                "t": 0,
                "s": [
                  100
                ]
              },
              {
                "t": 14.857421875,
                "s": [
                  0
                ]
              }
            ]
          },
          "e": {
            "a": 1,
            "k": [
              {
                "i": {
                  "x": [
                    0.833
                  ],
                  "y": [
                    0.833
                  ]
                },
                "o": {
                  "x": [
                    0.167
                  ],
                  "y": [
                    0.167
                  ]
                },
                "t": 9.284999999999997,
                "s": [
                  100
                ]
              },
              {
                "t": 26,
                "s": [
                  0
                ]
              }
            ]
          },
          "o": {
            "a": 0,
            "k": 0
          },
          "m": 1,
          "nm": "Trim Paths 1",
          "hd": false
        }
      ],
      "ip": 0,
      "op": 26,
      "st": 0,
      "bm": 0
    },
    {
      "ddd": 0,
      "ind": 50,
      "ty": 4,
      "nm": "Shape Layer 37",
      "sr": 1,
      "ks": {
        "r": {
          "a": 0,
          "k": 90
        },
        "p": {
          "a": 1,
          "k": [
            {
              "i": {
                "x": 0.833,
                "y": 0.833
              },
              "o": {
                "x": 0.167,
                "y": 0.167
              },
              "t": 0,
              "s": [
                255.999,
                255.999,
                0
              ],
              "to": [
                0,
                0,
                0
              ],
              "ti": [
                0,
                0,
                0
              ]
            },
            {
              "t": 26,
              "s": [
                99.899,
                255.999,
                0
              ]
            }
          ]
        },
        "a": {
          "a": 0,
          "k": [
            -87,
            63,
            0
          ]
        },
        "s": {
          "a": 0,
          "k": [
            223,
            223,
            100
          ]
        }
      },
      "ao": 0,
      "shapes": [
        {
          "ty": "gr",
          "it": [
            {
              "ind": 0,
              "ty": "sh",
              "ks": {
                "a": 0,
                "k": {
                  "i": [
                    [
                      0,
                      15
                    ],
                    [
                      0,
                      0
                    ]
                  ],
                  "o": [
                    [
                      0,
                      -15
                    ],
                    [
                      0,
                      0
                    ]
                  ],
                  "v": [
                    [
                      -87,
                      107
                    ],
                    [
                      -87,
                      63
                    ]
                  ],
                  "c": false
                }
              },
              "nm": "Path 1",
              "hd": false
            },
            {
              "ty": "st",
              "c": {
                "a": 0,
                "k": [
                  0,
                  0.7,
                  1,
                  1
                ]
              },
              "o": {
                "a": 0,
                "k": 100
              },
              "w": {
                "a": 0,
                "k": 9
              },
              "lc": 2,
              "lj": 1,
              "ml": 4,
              "bm": 0,
              "nm": "Stroke 1",
              "hd": false
            },
            {
              "ty": "tr",
              "p": {
                "a": 0,
                "k": [
                  0,
                  0
                ]
              },
              "a": {
                "a": 0,
                "k": [
                  0,
                  0
                ]
              },
              "s": {
                "a": 0,
                "k": [
                  100,
                  100
                ]
              },
              "r": {
                "a": 0,
                "k": 0
              },
              "o": {
                "a": 0,
                "k": 100
              },
              "sk": {
                "a": 0,
                "k": 0
              },
              "sa": {
                "a": 0,
                "k": 0
              },
              "nm": "Transform"
            }
          ],
          "nm": "Shape 1",
          "bm": 0,
          "hd": false
        },
        {
          "ty": "tm",
          "s": {
            "a": 1,
            "k": [
              {
                "i": {
                  "x": [
                    0.833
                  ],
                  "y": [
                    0.833
                  ]
                },
                "o": {
                  "x": [
                    0.167
                  ],
                  "y": [
                    0.167
                  ]
                },
                "t": 0,
                "s": [
                  100
                ]
              },
              {
                "t": 14.857421875,
                "s": [
                  0
                ]
              }
            ]
          },
          "e": {
            "a": 1,
            "k": [
              {
                "i": {
                  "x": [
                    0.833
                  ],
                  "y": [
                    0.833
                  ]
                },
                "o": {
                  "x": [
                    0.167
                  ],
                  "y": [
                    0.167
                  ]
                },
                "t": 9.284999999999997,
                "s": [
                  100
                ]
              },
              {
                "t": 26,
                "s": [
                  0
                ]
              }
            ]
          },
          "o": {
            "a": 0,
            "k": 0
          },
          "m": 1,
          "nm": "Trim Paths 1",
          "hd": false
        }
      ],
      "ip": 0,
      "op": 26,
      "st": 0,
      "bm": 0
    },
    {
      "ddd": 0,
      "ind": 51,
      "ty": 4,
      "nm": "Shape Layer 36",
      "sr": 1,
      "ks": {
        "r": {
          "a": 0,
          "k": -180
        },
        "p": {
          "a": 1,
          "k": [
            {
              "i": {
                "x": 0.833,
                "y": 0.833
              },
              "o": {
                "x": 0.167,
                "y": 0.167
              },
              "t": 0,
              "s": [
                255.999,
                255.999,
                0
              ],
              "to": [
                0,
                0,
                0
              ],
              "ti": [
                0,
                0,
                0
              ]
            },
            {
              "t": 26,
              "s": [
                255.999,
                99.899,
                0
              ]
            }
          ]
        },
        "a": {
          "a": 0,
          "k": [
            -87,
            63,
            0
          ]
        },
        "s": {
          "a": 0,
          "k": [
            223,
            223,
            100
          ]
        }
      },
      "ao": 0,
      "shapes": [
        {
          "ty": "gr",
          "it": [
            {
              "ind": 0,
              "ty": "sh",
              "ks": {
                "a": 0,
                "k": {
                  "i": [
                    [
                      0,
                      15
                    ],
                    [
                      0,
                      0
                    ]
                  ],
                  "o": [
                    [
                      0,
                      -15
                    ],
                    [
                      0,
                      0
                    ]
                  ],
                  "v": [
                    [
                      -87,
                      107
                    ],
                    [
                      -87,
                      63
                    ]
                  ],
                  "c": false
                }
              },
              "nm": "Path 1",
              "hd": false
            },
            {
              "ty": "st",
              "c": {
                "a": 0,
                "k": [
                  0,
                  0.7,
                  1,
                  1
                ]
              },
              "o": {
                "a": 0,
                "k": 100
              },
              "w": {
                "a": 0,
                "k": 9
              },
              "lc": 2,
              "lj": 1,
              "ml": 4,
              "bm": 0,
              "nm": "Stroke 1",
              "hd": false
            },
            {
              "ty": "tr",
              "p": {
                "a": 0,
                "k": [
                  0,
                  0
                ]
              },
              "a": {
                "a": 0,
                "k": [
                  0,
                  0
                ]
              },
              "s": {
                "a": 0,
                "k": [
                  100,
                  100
                ]
              },
              "r": {
                "a": 0,
                "k": 0
              },
              "o": {
                "a": 0,
                "k": 100
              },
              "sk": {
                "a": 0,
                "k": 0
              },
              "sa": {
                "a": 0,
                "k": 0
              },
              "nm": "Transform"
            }
          ],
          "nm": "Shape 1",
          "bm": 0,
          "hd": false
        },
        {
          "ty": "tm",
          "s": {
            "a": 1,
            "k": [
              {
                "i": {
                  "x": [
                    0.833
                  ],
                  "y": [
                    0.833
                  ]
                },
                "o": {
                  "x": [
                    0.167
                  ],
                  "y": [
                    0.167
                  ]
                },
                "t": 0,
                "s": [
                  100
                ]
              },
              {
                "t": 14.857421875,
                "s": [
                  0
                ]
              }
            ]
          },
          "e": {
            "a": 1,
            "k": [
              {
                "i": {
                  "x": [
                    0.833
                  ],
                  "y": [
                    0.833
                  ]
                },
                "o": {
                  "x": [
                    0.167
                  ],
                  "y": [
                    0.167
                  ]
                },
                "t": 9.284999999999997,
                "s": [
                  100
                ]
              },
              {
                "t": 26,
                "s": [
                  0
                ]
              }
            ]
          },
          "o": {
            "a": 0,
            "k": 0
          },
          "m": 1,
          "nm": "Trim Paths 1",
          "hd": false
        }
      ],
      "ip": 0,
      "op": 26,
      "st": 0,
      "bm": 0
    },
    {
      "ddd": 0,
      "ind": 52,
      "ty": 4,
      "nm": "Shape Layer 35",
      "sr": 1,
      "ks": {
        "p": {
          "a": 1,
          "k": [
            {
              "i": {
                "x": 0.833,
                "y": 0.833
              },
              "o": {
                "x": 0.167,
                "y": 0.167
              },
              "t": 0,
              "s": [
                255.999,
                255.999,
                0
              ],
              "to": [
                0,
                0,
                0
              ],
              "ti": [
                0,
                0,
                0
              ]
            },
            {
              "t": 26,
              "s": [
                255.999,
                412.099,
                0
              ]
            }
          ]
        },
        "a": {
          "a": 0,
          "k": [
            -87,
            63,
            0
          ]
        },
        "s": {
          "a": 0,
          "k": [
            223,
            223,
            100
          ]
        }
      },
      "ao": 0,
      "shapes": [
        {
          "ty": "gr",
          "it": [
            {
              "ind": 0,
              "ty": "sh",
              "ks": {
                "a": 0,
                "k": {
                  "i": [
                    [
                      0,
                      15
                    ],
                    [
                      0,
                      0
                    ]
                  ],
                  "o": [
                    [
                      0,
                      -15
                    ],
                    [
                      0,
                      0
                    ]
                  ],
                  "v": [
                    [
                      -87,
                      107
                    ],
                    [
                      -87,
                      63
                    ]
                  ],
                  "c": false
                }
              },
              "nm": "Path 1",
              "hd": false
            },
            {
              "ty": "st",
              "c": {
                "a": 0,
                "k": [
                  0,
                  0.7,
                  1,
                  1
                ]
              },
              "o": {
                "a": 0,
                "k": 100
              },
              "w": {
                "a": 0,
                "k": 9
              },
              "lc": 2,
              "lj": 1,
              "ml": 4,
              "bm": 0,
              "nm": "Stroke 1",
              "hd": false
            },
            {
              "ty": "tr",
              "p": {
                "a": 0,
                "k": [
                  0,
                  0
                ]
              },
              "a": {
                "a": 0,
                "k": [
                  0,
                  0
                ]
              },
              "s": {
                "a": 0,
                "k": [
                  100,
                  100
                ]
              },
              "r": {
                "a": 0,
                "k": 0
              },
              "o": {
                "a": 0,
                "k": 100
              },
              "sk": {
                "a": 0,
                "k": 0
              },
              "sa": {
                "a": 0,
                "k": 0
              },
              "nm": "Transform"
            }
          ],
          "nm": "Shape 1",
          "bm": 0,
          "hd": false
        },
        {
          "ty": "tm",
          "s": {
            "a": 1,
            "k": [
              {
                "i": {
                  "x": [
                    0.833
                  ],
                  "y": [
                    0.833
                  ]
                },
                "o": {
                  "x": [
                    0.167
                  ],
                  "y": [
                    0.167
                  ]
                },
                "t": 0,
                "s": [
                  100
                ]
              },
              {
                "t": 14.857421875,
                "s": [
                  0
                ]
              }
            ]
          },
          "e": {
            "a": 1,
            "k": [
              {
                "i": {
                  "x": [
                    0.833
                  ],
                  "y": [
                    0.833
                  ]
                },
                "o": {
                  "x": [
                    0.167
                  ],
                  "y": [
                    0.167
                  ]
                },
                "t": 9.284999999999997,
                "s": [
                  100
                ]
              },
              {
                "t": 26,
                "s": [
                  0
                ]
              }
            ]
          },
          "o": {
            "a": 0,
            "k": 0
          },
          "m": 1,
          "nm": "Trim Paths 1",
          "hd": false
        }
      ],
      "ip": 0,
      "op": 26,
      "st": 0,
      "bm": 0
    }
  ]
};

/* Export class and data for manual instantiation */
if (typeof window !== 'undefined') {
  window.TgsPlayer = TgsPlayer;
  window.TgsAnimations = window.TgsAnimations || [];
  window.TgsAnimations.push({ id: 'radial-flash', data: animationData });
  
  /* Auto-init only if container exists */
  const container = document.getElementById('radial-flash');
  if (container) {
    const player = new TgsPlayer(animationData, 'radial-flash');
    container._tgsPlayer = player;
    player.play();
  }
}
})();