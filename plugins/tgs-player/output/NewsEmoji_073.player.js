(function() {

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
    const result = new Array(a.length);
    for (let i = 0; i < a.length; i++) {
      result[i] = this.lerp(a[i], b[i], t);
    }
    return result;
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
    
    if (frame <= keyframes[0].t) return keyframes[0].s;
    
    const lastKf = keyframes[keyframes.length - 1];
    if (frame >= lastKf.t) return lastKf.s;

    const idx = this.findKeyframeIndex(keyframes, frame);
    const kf = keyframes[idx];
    const nextKf = keyframes[idx + 1];

    const duration = nextKf.t - kf.t;
    if (duration === 0) return kf.s;
    
    const elapsed = frame - kf.t;
    let t = elapsed / duration;

    t = this.applyEasing(t, kf.o, kf.i);

    const startVal = kf.s;
    const endVal = kf.e || nextKf.s;

    if (Array.isArray(startVal)) {
      return this.lerpArray(startVal, endVal, t);
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
    svg.setAttribute('viewBox', '0 0 ' + width + ' ' + height);
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', '100%');
    svg.style.overflow = 'visible';
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
    const parts = [];
    
    if (transform.anchor) {
      parts.push('translate(' + (-transform.anchor[0]) + ',' + (-transform.anchor[1]) + ')');
    }
    
    if (transform.position) {
      parts.push('translate(' + transform.position[0] + ',' + transform.position[1] + ')');
    }
    
    if (transform.rotation) {
      parts.push('rotate(' + transform.rotation + ')');
    }
    
    if (transform.scale) {
      const sx = transform.scale[0] / 100;
      const sy = transform.scale[1] / 100;
      if (sx !== 1 || sy !== 1) {
        parts.push('scale(' + sx + ',' + sy + ')');
      }
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

  applyStroke(element, color, opacity, width) {
    element.setAttribute('fill', 'none');
    
    if (color) {
      element.setAttribute('stroke', this.rgbToString(color));
    }
    if (opacity !== undefined) {
      const op = Math.max(0, Math.min(100, opacity)) / 100;
      element.setAttribute('stroke-opacity', op);
    }
    if (width !== undefined && width > 0) {
      element.setAttribute('stroke-width', width);
    }
    element.setAttribute('stroke-linecap', 'round');
    element.setAttribute('stroke-linejoin', 'round');
  }
};



class TgsPlayer {
  constructor(animationData, containerSelector) {
    this.data = animationData;
    this.container = document.querySelector(containerSelector) || document.getElementById(containerSelector);
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
    this.container.appendChild(this.svg);
    this.buildLayers();
  }

  buildLayers() {
    const layers = [...this.data.layers].reverse();
    for (const layer of layers) {
      if (layer.ty === 4) {
        const group = SvgBuilder.createGroup();
        group.setAttribute('data-name', layer.nm);
        this.svg.appendChild(group);
        this.elements.set(layer.ind, { layer, group, paths: [] });
        this.buildShapes(layer, group);
      }
    }
  }

  buildShapes(layer, parentGroup) {
    if (!layer.shapes) return;
    
    for (const shape of layer.shapes) {
      if (shape.ty === 'gr') {
        this.buildGroup(shape, parentGroup, layer.ind);
      }
    }
  }

  buildGroup(group, parentGroup, layerIndex) {
    const g = SvgBuilder.createGroup();
    parentGroup.appendChild(g);
    
    let pathElement = null;
    let pathShape = null;
    let fillShape = null;
    let strokeShape = null;
    let transformShape = null;

    for (const item of group.it) {
      switch (item.ty) {
        case 'sh':
          pathShape = item;
          pathElement = SvgBuilder.createPath();
          g.appendChild(pathElement);
          break;
        case 'fl':
          fillShape = item;
          break;
        case 'st':
          strokeShape = item;
          break;
        case 'tr':
          transformShape = item;
          break;
      }
    }

    if (pathElement) {
      const elemData = this.elements.get(layerIndex);
      elemData.paths.push({
        element: pathElement,
        group: g,
        pathShape,
        fillShape,
        strokeShape,
        transformShape
      });
    }
  }

  renderFrame(frame) {
    for (const [layerIndex, elemData] of this.elements) {
      const layer = elemData.layer;
      
      if (frame < layer.ip || frame > layer.op) {
        elemData.group.setAttribute('visibility', 'hidden');
        continue;
      }
      elemData.group.setAttribute('visibility', 'visible');

      const transform = this.computeLayerTransform(layer.ks, frame);
      SvgBuilder.applyTransform(elemData.group, transform);

      for (const pathData of elemData.paths) {
        this.renderPath(pathData, frame);
      }
    }
  }

  computeLayerTransform(ks, frame) {
    return {
      position: ks.p ? Interpolator.interpolateProperty(ks.p, frame) : [0, 0],
      anchor: ks.a ? Interpolator.interpolateProperty(ks.a, frame) : [0, 0],
      scale: ks.s ? Interpolator.interpolateProperty(ks.s, frame) : [100, 100],
      rotation: ks.r ? Interpolator.interpolateProperty(ks.r, frame) : 0,
      opacity: ks.o ? Interpolator.interpolateProperty(ks.o, frame) : 100
    };
  }

  renderPath(pathData, frame) {
    const { element, group, pathShape, fillShape, strokeShape, transformShape } = pathData;

    if (pathShape && pathShape.ks) {
      const pd = Interpolator.interpolatePath(pathShape.ks, frame);
      element.setAttribute('d', SvgBuilder.pathDataToString(pd));
    }

    if (fillShape) {
      const color = fillShape.c ? Interpolator.interpolateProperty(fillShape.c, frame) : null;
      const opacity = fillShape.o ? Interpolator.interpolateProperty(fillShape.o, frame) : 100;
      SvgBuilder.applyFill(element, color, opacity);
    }

    if (strokeShape) {
      const color = strokeShape.c ? Interpolator.interpolateProperty(strokeShape.c, frame) : null;
      const opacity = strokeShape.o ? Interpolator.interpolateProperty(strokeShape.o, frame) : 100;
      const width = strokeShape.w ? Interpolator.interpolateProperty(strokeShape.w, frame) : 1;
      SvgBuilder.applyStroke(element, color, opacity, width);
    }

    if (transformShape) {
      const tr = this.computeLayerTransform(transformShape, frame);
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
  "op": 180,
  "w": 512,
  "h": 512,
  "nm": "😮 Face with Open Mouth",
  "ddd": 0,
  "assets": [],
  "layers": [
    {
      "ddd": 0,
      "ind": 1,
      "ty": 4,
      "nm": "w",
      "sr": 1,
      "ks": {
        "p": {
          "a": 1,
          "k": [
            {
              "i": {
                "x": 0.25,
                "y": 1
              },
              "o": {
                "x": 0.57,
                "y": 0
              },
              "t": 0,
              "s": [
                386,
                354,
                0
              ],
              "to": [
                0,
                -44.333,
                0
              ],
              "ti": [
                6.667,
                4.333,
                0
              ]
            },
            {
              "i": {
                "x": 0.28,
                "y": 1
              },
              "o": {
                "x": 0.57,
                "y": 0
              },
              "t": 8,
              "s": [
                386,
                88,
                0
              ],
              "to": [
                -6.667,
                -4.333,
                0
              ],
              "ti": [
                3.333,
                -3.333,
                0
              ]
            },
            {
              "i": {
                "x": 0.28,
                "y": 1
              },
              "o": {
                "x": 0.14,
                "y": 0
              },
              "t": 29,
              "s": [
                346,
                328,
                0
              ],
              "to": [
                -3.333,
                3.333,
                0
              ],
              "ti": [
                -3.333,
                36.667,
                0
              ]
            },
            {
              "t": 47,
              "s": [
                366,
                108,
                0
              ]
            }
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
                "a": 1,
                "k": [
                  {
                    "i": {
                      "x": 0.833,
                      "y": 0.833
                    },
                    "o": {
                      "x": 0.57,
                      "y": 0
                    },
                    "t": 0,
                    "s": [
                      {
                        "i": [
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ]
                        ],
                        "o": [
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ]
                        ],
                        "v": [
                          [
                            -20.93,
                            63
                          ],
                          [
                            0.56,
                            -4.37
                          ],
                          [
                            20.93,
                            63
                          ],
                          [
                            66.58,
                            63
                          ],
                          [
                            107,
                            -63
                          ],
                          [
                            66.58,
                            -63
                          ],
                          [
                            43.32,
                            9.56
                          ],
                          [
                            21.29,
                            -63
                          ],
                          [
                            -17.86,
                            -63
                          ],
                          [
                            -41.18,
                            8.59
                          ],
                          [
                            -63.15,
                            -63
                          ],
                          [
                            -107,
                            -63
                          ],
                          [
                            -66.58,
                            63
                          ]
                        ],
                        "c": true
                      }
                    ]
                  },
                  {
                    "i": {
                      "x": 0.25,
                      "y": 1
                    },
                    "o": {
                      "x": 0.167,
                      "y": 0.167
                    },
                    "t": 4,
                    "s": [
                      {
                        "i": [
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ]
                        ],
                        "o": [
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ]
                        ],
                        "v": [
                          [
                            -18.333,
                            175
                          ],
                          [
                            0.103,
                            30.63
                          ],
                          [
                            17.612,
                            175
                          ],
                          [
                            56.811,
                            175
                          ],
                          [
                            79,
                            -63.4
                          ],
                          [
                            44.292,
                            -63.4
                          ],
                          [
                            35.481,
                            92.56
                          ],
                          [
                            18.282,
                            -63
                          ],
                          [
                            -15.336,
                            -63
                          ],
                          [
                            -36.22,
                            92.59
                          ],
                          [
                            -41.346,
                            -63.4
                          ],
                          [
                            -79,
                            -63.4
                          ],
                          [
                            -57.533,
                            175
                          ]
                        ],
                        "c": true
                      }
                    ]
                  },
                  {
                    "i": {
                      "x": 0.25,
                      "y": 1
                    },
                    "o": {
                      "x": 0.57,
                      "y": 0
                    },
                    "t": 8,
                    "s": [
                      {
                        "i": [
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ]
                        ],
                        "o": [
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ]
                        ],
                        "v": [
                          [
                            -20.93,
                            63
                          ],
                          [
                            0.56,
                            -4.37
                          ],
                          [
                            20.93,
                            63
                          ],
                          [
                            66.58,
                            63
                          ],
                          [
                            107,
                            -63
                          ],
                          [
                            66.58,
                            -63
                          ],
                          [
                            43.32,
                            9.56
                          ],
                          [
                            21.29,
                            -63
                          ],
                          [
                            -17.86,
                            -63
                          ],
                          [
                            -41.18,
                            8.59
                          ],
                          [
                            -63.15,
                            -63
                          ],
                          [
                            -107,
                            -63
                          ],
                          [
                            -66.58,
                            63
                          ]
                        ],
                        "c": true
                      }
                    ]
                  },
                  {
                    "i": {
                      "x": 0.25,
                      "y": 1
                    },
                    "o": {
                      "x": 0.49,
                      "y": 0
                    },
                    "t": 17,
                    "s": [
                      {
                        "i": [
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ]
                        ],
                        "o": [
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ]
                        ],
                        "v": [
                          [
                            -20.93,
                            0
                          ],
                          [
                            0.56,
                            0
                          ],
                          [
                            20.93,
                            0
                          ],
                          [
                            66.58,
                            0
                          ],
                          [
                            107,
                            0
                          ],
                          [
                            66.58,
                            0
                          ],
                          [
                            43.32,
                            0
                          ],
                          [
                            21.29,
                            0
                          ],
                          [
                            -17.86,
                            0
                          ],
                          [
                            -41.18,
                            0
                          ],
                          [
                            -63.15,
                            0
                          ],
                          [
                            -107,
                            0
                          ],
                          [
                            -66.58,
                            0
                          ]
                        ],
                        "c": true
                      }
                    ]
                  },
                  {
                    "t": 25,
                    "s": [
                      {
                        "i": [
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ]
                        ],
                        "o": [
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ]
                        ],
                        "v": [
                          [
                            0.098,
                            0
                          ],
                          [
                            -0.003,
                            0
                          ],
                          [
                            -0.098,
                            0
                          ],
                          [
                            -0.311,
                            0
                          ],
                          [
                            -0.5,
                            0
                          ],
                          [
                            -0.311,
                            0
                          ],
                          [
                            -0.202,
                            0
                          ],
                          [
                            -0.099,
                            0
                          ],
                          [
                            0.083,
                            0
                          ],
                          [
                            0.192,
                            0
                          ],
                          [
                            0.295,
                            0
                          ],
                          [
                            0.5,
                            0
                          ],
                          [
                            0.311,
                            0
                          ]
                        ],
                        "c": true
                      }
                    ]
                  }
                ]
              },
              "nm": "Path 1",
              "hd": false
            },
            {
              "ty": "gf",
              "o": {
                "a": 0,
                "k": 100
              },
              "r": 1,
              "bm": 0,
              "g": {
                "p": 3,
                "k": {
                  "a": 0,
                  "k": [
                    0,
                    0.408,
                    1,
                    0.803,
                    0.5,
                    0.427,
                    1,
                    0.896,
                    1,
                    0.446,
                    1,
                    0.989
                  ]
                }
              },
              "s": {
                "a": 0,
                "k": [
                  0,
                  -39.164
                ]
              },
              "e": {
                "a": 0,
                "k": [
                  0,
                  63.759
                ]
              },
              "t": 2,
              "h": {
                "a": 0,
                "k": 0
              },
              "a": {
                "a": 0,
                "k": 0
              },
              "nm": "fdvfd22",
              "hd": false
            },
            {
              "ty": "st",
              "c": {
                "a": 0,
                "k": [
                  0,
                  0.402736991644,
                  0.588172972202,
                  1
                ]
              },
              "o": {
                "a": 0,
                "k": 100
              },
              "w": {
                "a": 1,
                "k": [
                  {
                    "i": {
                      "x": [
                        0.28
                      ],
                      "y": [
                        1
                      ]
                    },
                    "o": {
                      "x": [
                        0.33
                      ],
                      "y": [
                        0
                      ]
                    },
                    "t": 14,
                    "s": [
                      40
                    ]
                  },
                  {
                    "i": {
                      "x": [
                        0.833
                      ],
                      "y": [
                        1
                      ]
                    },
                    "o": {
                      "x": [
                        0.33
                      ],
                      "y": [
                        0
                      ]
                    },
                    "t": 34,
                    "s": [
                      90
                    ]
                  },
                  {
                    "t": 47,
                    "s": [
                      79
                    ]
                  }
                ]
              },
              "lc": 2,
              "lj": 2,
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
          "nm": "Path",
          "bm": 0,
          "hd": false
        }
      ],
      "ip": 0,
      "op": 29,
      "st": 0,
      "bm": 0
    },
    {
      "ddd": 0,
      "ind": 2,
      "ty": 4,
      "nm": "w",
      "sr": 1,
      "ks": {
        "p": {
          "a": 1,
          "k": [
            {
              "i": {
                "x": 0.25,
                "y": 1
              },
              "o": {
                "x": 0.57,
                "y": 0
              },
              "t": 3,
              "s": [
                126.5,
                166,
                0
              ],
              "to": [
                0,
                -13.333,
                0
              ],
              "ti": [
                -6.667,
                -27.333,
                0
              ]
            },
            {
              "i": {
                "x": 0.28,
                "y": 1
              },
              "o": {
                "x": 0.167,
                "y": 0
              },
              "t": 11,
              "s": [
                126.5,
                86,
                0
              ],
              "to": [
                6.667,
                27.333,
                0
              ],
              "ti": [
                -3.333,
                -4,
                0
              ]
            },
            {
              "i": {
                "x": 0.28,
                "y": 1
              },
              "o": {
                "x": 0.14,
                "y": 0
              },
              "t": 29,
              "s": [
                166.5,
                330,
                0
              ],
              "to": [
                3.333,
                4,
                0
              ],
              "ti": [
                3.333,
                36.667,
                0
              ]
            },
            {
              "t": 47,
              "s": [
                146.5,
                110,
                0
              ]
            }
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
                "a": 1,
                "k": [
                  {
                    "i": {
                      "x": 0.833,
                      "y": 0.833
                    },
                    "o": {
                      "x": 0.57,
                      "y": 0
                    },
                    "t": 3,
                    "s": [
                      {
                        "i": [
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ]
                        ],
                        "o": [
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ]
                        ],
                        "v": [
                          [
                            -20.83,
                            63
                          ],
                          [
                            0.56,
                            -4.37
                          ],
                          [
                            20.83,
                            63
                          ],
                          [
                            66.27,
                            63
                          ],
                          [
                            106.5,
                            -63
                          ],
                          [
                            66.27,
                            -63
                          ],
                          [
                            43.12,
                            9.56
                          ],
                          [
                            21.19,
                            -63
                          ],
                          [
                            -17.78,
                            -63
                          ],
                          [
                            -40.98,
                            8.59
                          ],
                          [
                            -62.86,
                            -63
                          ],
                          [
                            -106.5,
                            -63
                          ],
                          [
                            -66.27,
                            63
                          ]
                        ],
                        "c": true
                      }
                    ]
                  },
                  {
                    "i": {
                      "x": 0.25,
                      "y": 1
                    },
                    "o": {
                      "x": 0.167,
                      "y": 0.167
                    },
                    "t": 7,
                    "s": [
                      {
                        "i": [
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ]
                        ],
                        "o": [
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ]
                        ],
                        "v": [
                          [
                            -21.06,
                            91
                          ],
                          [
                            0.33,
                            23.63
                          ],
                          [
                            20.6,
                            91
                          ],
                          [
                            66.04,
                            91
                          ],
                          [
                            90.5,
                            -63
                          ],
                          [
                            48.314,
                            -62.95
                          ],
                          [
                            34.89,
                            37.61
                          ],
                          [
                            18.007,
                            -63
                          ],
                          [
                            -15.109,
                            -63
                          ],
                          [
                            -36.21,
                            36.23
                          ],
                          [
                            -48.416,
                            -63.36
                          ],
                          [
                            -90.5,
                            -63
                          ],
                          [
                            -66.5,
                            91
                          ]
                        ],
                        "c": true
                      }
                    ]
                  },
                  {
                    "i": {
                      "x": 0.25,
                      "y": 1
                    },
                    "o": {
                      "x": 0.57,
                      "y": 0
                    },
                    "t": 11,
                    "s": [
                      {
                        "i": [
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ]
                        ],
                        "o": [
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ]
                        ],
                        "v": [
                          [
                            -20.83,
                            63
                          ],
                          [
                            0.56,
                            -4.37
                          ],
                          [
                            20.83,
                            63
                          ],
                          [
                            66.27,
                            63
                          ],
                          [
                            106.5,
                            -63
                          ],
                          [
                            66.27,
                            -63
                          ],
                          [
                            43.12,
                            9.56
                          ],
                          [
                            21.19,
                            -63
                          ],
                          [
                            -17.78,
                            -63
                          ],
                          [
                            -40.98,
                            8.59
                          ],
                          [
                            -62.86,
                            -63
                          ],
                          [
                            -106.5,
                            -63
                          ],
                          [
                            -66.27,
                            63
                          ]
                        ],
                        "c": true
                      }
                    ]
                  },
                  {
                    "i": {
                      "x": 0.25,
                      "y": 1
                    },
                    "o": {
                      "x": 0.49,
                      "y": 0
                    },
                    "t": 21,
                    "s": [
                      {
                        "i": [
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ]
                        ],
                        "o": [
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ]
                        ],
                        "v": [
                          [
                            -20.93,
                            0
                          ],
                          [
                            0.56,
                            0
                          ],
                          [
                            20.93,
                            0
                          ],
                          [
                            66.58,
                            0
                          ],
                          [
                            107,
                            0
                          ],
                          [
                            66.58,
                            0
                          ],
                          [
                            43.32,
                            0
                          ],
                          [
                            21.29,
                            0
                          ],
                          [
                            -17.86,
                            0
                          ],
                          [
                            -41.18,
                            0
                          ],
                          [
                            -63.15,
                            0
                          ],
                          [
                            -107,
                            0
                          ],
                          [
                            -66.58,
                            0
                          ]
                        ],
                        "c": true
                      }
                    ]
                  },
                  {
                    "t": 29,
                    "s": [
                      {
                        "i": [
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ]
                        ],
                        "o": [
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ]
                        ],
                        "v": [
                          [
                            0.098,
                            0
                          ],
                          [
                            -0.003,
                            0
                          ],
                          [
                            -0.098,
                            0
                          ],
                          [
                            -0.311,
                            0
                          ],
                          [
                            -0.5,
                            0
                          ],
                          [
                            -0.311,
                            0
                          ],
                          [
                            -0.202,
                            0
                          ],
                          [
                            -0.099,
                            0
                          ],
                          [
                            0.083,
                            0
                          ],
                          [
                            0.192,
                            0
                          ],
                          [
                            0.295,
                            0
                          ],
                          [
                            0.5,
                            0
                          ],
                          [
                            0.311,
                            0
                          ]
                        ],
                        "c": true
                      }
                    ]
                  }
                ]
              },
              "nm": "Path 1",
              "hd": false
            },
            {
              "ty": "gf",
              "o": {
                "a": 0,
                "k": 100
              },
              "r": 1,
              "bm": 0,
              "g": {
                "p": 3,
                "k": {
                  "a": 0,
                  "k": [
                    0,
                    0.408,
                    1,
                    0.803,
                    0.5,
                    0.427,
                    1,
                    0.896,
                    1,
                    0.446,
                    1,
                    0.989
                  ]
                }
              },
              "s": {
                "a": 0,
                "k": [
                  0,
                  -39.164
                ]
              },
              "e": {
                "a": 0,
                "k": [
                  0,
                  63.759
                ]
              },
              "t": 2,
              "h": {
                "a": 0,
                "k": 0
              },
              "a": {
                "a": 0,
                "k": 0
              },
              "nm": "fdvfd22",
              "hd": false
            },
            {
              "ty": "st",
              "c": {
                "a": 0,
                "k": [
                  0,
                  0.402736991644,
                  0.588172972202,
                  1
                ]
              },
              "o": {
                "a": 0,
                "k": 100
              },
              "w": {
                "a": 1,
                "k": [
                  {
                    "i": {
                      "x": [
                        0.28
                      ],
                      "y": [
                        1
                      ]
                    },
                    "o": {
                      "x": [
                        0.33
                      ],
                      "y": [
                        0
                      ]
                    },
                    "t": 14,
                    "s": [
                      40
                    ]
                  },
                  {
                    "i": {
                      "x": [
                        0.833
                      ],
                      "y": [
                        1
                      ]
                    },
                    "o": {
                      "x": [
                        0.33
                      ],
                      "y": [
                        0
                      ]
                    },
                    "t": 34,
                    "s": [
                      90
                    ]
                  },
                  {
                    "t": 47,
                    "s": [
                      79
                    ]
                  }
                ]
              },
              "lc": 2,
              "lj": 2,
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
          "nm": "Path",
          "bm": 0,
          "hd": false
        }
      ],
      "ip": 0,
      "op": 29,
      "st": 0,
      "bm": 0
    },
    {
      "ddd": 0,
      "ind": 3,
      "ty": 4,
      "nm": "w 5",
      "sr": 1,
      "ks": {
        "r": {
          "a": 1,
          "k": [
            {
              "i": {
                "x": [
                  0.833
                ],
                "y": [
                  1
                ]
              },
              "o": {
                "x": [
                  0.57
                ],
                "y": [
                  0
                ]
              },
              "t": 0,
              "s": [
                26
              ]
            },
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
                  0.783
                ],
                "y": [
                  0
                ]
              },
              "t": 123,
              "s": [
                26
              ]
            },
            {
              "i": {
                "x": [
                  0.28
                ],
                "y": [
                  1
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
              "t": 130,
              "s": [
                3.488
              ]
            },
            {
              "i": {
                "x": [
                  0.2
                ],
                "y": [
                  1
                ]
              },
              "o": {
                "x": [
                  0.72
                ],
                "y": [
                  0
                ]
              },
              "t": 139,
              "s": [
                0
              ]
            },
            {
              "t": 165,
              "s": [
                0
              ]
            }
          ]
        },
        "p": {
          "a": 1,
          "k": [
            {
              "i": {
                "x": 0.25,
                "y": 1
              },
              "o": {
                "x": 0.57,
                "y": 0
              },
              "t": 0,
              "s": [
                297.99,
                363.62,
                0
              ],
              "to": [
                19.434,
                -39.847,
                0
              ],
              "ti": [
                1.17,
                12.809,
                0
              ]
            },
            {
              "i": {
                "x": 0.91,
                "y": 1
              },
              "o": {
                "x": 0.57,
                "y": 0
              },
              "t": 8,
              "s": [
                414.596,
                124.541,
                0
              ],
              "to": [
                -1.17,
                -12.809,
                0
              ],
              "ti": [
                8.256,
                -9.324,
                0
              ]
            },
            {
              "i": {
                "x": 0.28,
                "y": 1
              },
              "o": {
                "x": 0.09,
                "y": 0
              },
              "t": 29,
              "s": [
                290.97,
                286.765,
                0
              ],
              "to": [
                -8.256,
                9.324,
                0
              ],
              "ti": [
                -6.51,
                -4.803,
                0
              ]
            },
            {
              "i": {
                "x": 0.13,
                "y": 1
              },
              "o": {
                "x": 0.6,
                "y": 0
              },
              "t": 47,
              "s": [
                365.058,
                180.487,
                0
              ],
              "to": [
                6.51,
                4.803,
                0
              ],
              "ti": [
                3.838,
                -5.849,
                0
              ]
            },
            {
              "i": {
                "x": 0.18,
                "y": 1
              },
              "o": {
                "x": 0.6,
                "y": 0
              },
              "t": 81,
              "s": [
                330.031,
                315.584,
                0
              ],
              "to": [
                -3.838,
                5.849,
                0
              ],
              "ti": [
                -8.961,
                -18.69,
                0
              ]
            },
            {
              "i": {
                "x": 0.28,
                "y": 1
              },
              "o": {
                "x": 0.61,
                "y": 0
              },
              "t": 123,
              "s": [
                342.031,
                215.584,
                0
              ],
              "to": [
                8.961,
                18.69,
                0
              ],
              "ti": [
                -7.328,
                -23.069,
                0
              ]
            },
            {
              "i": {
                "x": 0.2,
                "y": 1
              },
              "o": {
                "x": 0.72,
                "y": 0
              },
              "t": 139,
              "s": [
                383.797,
                427.726,
                0
              ],
              "to": [
                7.328,
                23.069,
                0
              ],
              "ti": [
                -0.367,
                12.288,
                0
              ]
            },
            {
              "t": 165,
              "s": [
                386,
                354,
                0
              ]
            }
          ]
        },
        "s": {
          "a": 1,
          "k": [
            {
              "i": {
                "x": [
                  0.833,
                  0.833,
                  0.833
                ],
                "y": [
                  1,
                  1,
                  1
                ]
              },
              "o": {
                "x": [
                  0.57,
                  0.57,
                  0.57
                ],
                "y": [
                  0,
                  0,
                  0
                ]
              },
              "t": 0,
              "s": [
                100,
                100,
                100
              ]
            },
            {
              "i": {
                "x": [
                  0.833,
                  0.833,
                  0.833
                ],
                "y": [
                  1,
                  1,
                  1
                ]
              },
              "o": {
                "x": [
                  0.61,
                  0.61,
                  0.61
                ],
                "y": [
                  0,
                  0,
                  0
                ]
              },
              "t": 123,
              "s": [
                100,
                100,
                100
              ]
            },
            {
              "i": {
                "x": [
                  0.818,
                  0.818,
                  0.818
                ],
                "y": [
                  1,
                  1,
                  1
                ]
              },
              "o": {
                "x": [
                  0.533,
                  0.533,
                  0.533
                ],
                "y": [
                  0,
                  0,
                  0
                ]
              },
              "t": 139,
              "s": [
                100,
                100,
                100
              ]
            },
            {
              "i": {
                "x": [
                  0.667,
                  0.667,
                  0.667
                ],
                "y": [
                  1,
                  1,
                  1
                ]
              },
              "o": {
                "x": [
                  0.215,
                  0.215,
                  0.215
                ],
                "y": [
                  0,
                  0,
                  0
                ]
              },
              "t": 151.691,
              "s": [
                105,
                95,
                100
              ]
            },
            {
              "i": {
                "x": [
                  0.089,
                  0.089,
                  0.089
                ],
                "y": [
                  1,
                  1,
                  1
                ]
              },
              "o": {
                "x": [
                  0.333,
                  0.333,
                  0.333
                ],
                "y": [
                  0,
                  0,
                  0
                ]
              },
              "t": 164.381,
              "s": [
                98,
                102,
                100
              ]
            },
            {
              "t": 180,
              "s": [
                100,
                100,
                100
              ]
            }
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
                "a": 1,
                "k": [
                  {
                    "i": {
                      "x": 0.833,
                      "y": 0.833
                    },
                    "o": {
                      "x": 0.57,
                      "y": 0
                    },
                    "t": 0,
                    "s": [
                      {
                        "i": [
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ]
                        ],
                        "o": [
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ]
                        ],
                        "v": [
                          [
                            -20.93,
                            63
                          ],
                          [
                            0.56,
                            -4.37
                          ],
                          [
                            20.93,
                            63
                          ],
                          [
                            66.58,
                            63
                          ],
                          [
                            107,
                            -63
                          ],
                          [
                            66.58,
                            -63
                          ],
                          [
                            43.32,
                            9.56
                          ],
                          [
                            21.29,
                            -63
                          ],
                          [
                            -17.86,
                            -63
                          ],
                          [
                            -41.18,
                            8.59
                          ],
                          [
                            -63.15,
                            -63
                          ],
                          [
                            -107,
                            -63
                          ],
                          [
                            -66.58,
                            63
                          ]
                        ],
                        "c": true
                      }
                    ]
                  },
                  {
                    "i": {
                      "x": 0.25,
                      "y": 1
                    },
                    "o": {
                      "x": 0.167,
                      "y": 0.167
                    },
                    "t": 4,
                    "s": [
                      {
                        "i": [
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ]
                        ],
                        "o": [
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ]
                        ],
                        "v": [
                          [
                            -18.333,
                            175
                          ],
                          [
                            0.103,
                            30.63
                          ],
                          [
                            17.612,
                            175
                          ],
                          [
                            56.811,
                            175
                          ],
                          [
                            79,
                            -63.4
                          ],
                          [
                            44.292,
                            -63.4
                          ],
                          [
                            35.481,
                            92.56
                          ],
                          [
                            18.282,
                            -63
                          ],
                          [
                            -15.336,
                            -63
                          ],
                          [
                            -36.22,
                            92.59
                          ],
                          [
                            -41.346,
                            -63.4
                          ],
                          [
                            -79,
                            -63.4
                          ],
                          [
                            -57.533,
                            175
                          ]
                        ],
                        "c": true
                      }
                    ]
                  },
                  {
                    "i": {
                      "x": 0.25,
                      "y": 1
                    },
                    "o": {
                      "x": 0.57,
                      "y": 0
                    },
                    "t": 8,
                    "s": [
                      {
                        "i": [
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ]
                        ],
                        "o": [
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ]
                        ],
                        "v": [
                          [
                            -20.93,
                            63
                          ],
                          [
                            0.56,
                            -4.37
                          ],
                          [
                            20.93,
                            63
                          ],
                          [
                            66.58,
                            63
                          ],
                          [
                            107,
                            -63
                          ],
                          [
                            66.58,
                            -63
                          ],
                          [
                            43.32,
                            9.56
                          ],
                          [
                            21.29,
                            -63
                          ],
                          [
                            -17.86,
                            -63
                          ],
                          [
                            -41.18,
                            8.59
                          ],
                          [
                            -63.15,
                            -63
                          ],
                          [
                            -107,
                            -63
                          ],
                          [
                            -66.58,
                            63
                          ]
                        ],
                        "c": true
                      }
                    ]
                  },
                  {
                    "i": {
                      "x": 0.25,
                      "y": 1
                    },
                    "o": {
                      "x": 0.49,
                      "y": 0
                    },
                    "t": 17,
                    "s": [
                      {
                        "i": [
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ]
                        ],
                        "o": [
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ]
                        ],
                        "v": [
                          [
                            -20.93,
                            0
                          ],
                          [
                            0.56,
                            0
                          ],
                          [
                            20.93,
                            0
                          ],
                          [
                            66.58,
                            0
                          ],
                          [
                            107,
                            0
                          ],
                          [
                            66.58,
                            0
                          ],
                          [
                            43.32,
                            0
                          ],
                          [
                            21.29,
                            0
                          ],
                          [
                            -17.86,
                            0
                          ],
                          [
                            -41.18,
                            0
                          ],
                          [
                            -63.15,
                            0
                          ],
                          [
                            -107,
                            0
                          ],
                          [
                            -66.58,
                            0
                          ]
                        ],
                        "c": true
                      }
                    ]
                  },
                  {
                    "i": {
                      "x": 0.833,
                      "y": 1
                    },
                    "o": {
                      "x": 0.49,
                      "y": 0
                    },
                    "t": 25,
                    "s": [
                      {
                        "i": [
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ]
                        ],
                        "o": [
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ]
                        ],
                        "v": [
                          [
                            0.098,
                            0
                          ],
                          [
                            -0.003,
                            0
                          ],
                          [
                            -0.098,
                            0
                          ],
                          [
                            -0.311,
                            0
                          ],
                          [
                            -0.5,
                            0
                          ],
                          [
                            -0.311,
                            0
                          ],
                          [
                            -0.202,
                            0
                          ],
                          [
                            -0.099,
                            0
                          ],
                          [
                            0.083,
                            0
                          ],
                          [
                            0.192,
                            0
                          ],
                          [
                            0.295,
                            0
                          ],
                          [
                            0.5,
                            0
                          ],
                          [
                            0.311,
                            0
                          ]
                        ],
                        "c": true
                      }
                    ]
                  },
                  {
                    "i": {
                      "x": 0.833,
                      "y": 0.833
                    },
                    "o": {
                      "x": 0.61,
                      "y": 0
                    },
                    "t": 123,
                    "s": [
                      {
                        "i": [
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ]
                        ],
                        "o": [
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ]
                        ],
                        "v": [
                          [
                            0.098,
                            0
                          ],
                          [
                            -0.003,
                            0
                          ],
                          [
                            -0.098,
                            0
                          ],
                          [
                            -0.311,
                            0
                          ],
                          [
                            -0.5,
                            0
                          ],
                          [
                            -0.311,
                            0
                          ],
                          [
                            -0.202,
                            0
                          ],
                          [
                            -0.099,
                            0
                          ],
                          [
                            0.083,
                            0
                          ],
                          [
                            0.192,
                            0
                          ],
                          [
                            0.295,
                            0
                          ],
                          [
                            0.5,
                            0
                          ],
                          [
                            0.311,
                            0
                          ]
                        ],
                        "c": true
                      }
                    ]
                  },
                  {
                    "i": {
                      "x": 0.28,
                      "y": 1
                    },
                    "o": {
                      "x": 0.167,
                      "y": 0.167
                    },
                    "t": 130,
                    "s": [
                      {
                        "i": [
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ]
                        ],
                        "o": [
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ]
                        ],
                        "v": [
                          [
                            -10.83,
                            32.74
                          ],
                          [
                            0.29,
                            -2.271
                          ],
                          [
                            10.83,
                            32.74
                          ],
                          [
                            34.451,
                            32.74
                          ],
                          [
                            50.913,
                            -138.665
                          ],
                          [
                            29.998,
                            -138.665
                          ],
                          [
                            20.59,
                            -24.976
                          ],
                          [
                            6.563,
                            -138.665
                          ],
                          [
                            -13.695,
                            -138.665
                          ],
                          [
                            -22.89,
                            -21.488
                          ],
                          [
                            -37.129,
                            -138.665
                          ],
                          [
                            -59.819,
                            -138.665
                          ],
                          [
                            -34.451,
                            32.74
                          ]
                        ],
                        "c": true
                      }
                    ]
                  },
                  {
                    "i": {
                      "x": 0.833,
                      "y": 0.833
                    },
                    "o": {
                      "x": 0.72,
                      "y": 0
                    },
                    "t": 139,
                    "s": [
                      {
                        "i": [
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ]
                        ],
                        "o": [
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ]
                        ],
                        "v": [
                          [
                            -20.93,
                            63
                          ],
                          [
                            0.56,
                            -4.37
                          ],
                          [
                            20.93,
                            63
                          ],
                          [
                            66.58,
                            63
                          ],
                          [
                            107,
                            -63
                          ],
                          [
                            66.58,
                            -63
                          ],
                          [
                            43.32,
                            9.56
                          ],
                          [
                            21.29,
                            -63
                          ],
                          [
                            -17.86,
                            -63
                          ],
                          [
                            -41.18,
                            8.59
                          ],
                          [
                            -63.15,
                            -63
                          ],
                          [
                            -107,
                            -63
                          ],
                          [
                            -66.58,
                            63
                          ]
                        ],
                        "c": true
                      }
                    ]
                  },
                  {
                    "i": {
                      "x": 0.2,
                      "y": 1
                    },
                    "o": {
                      "x": 0.167,
                      "y": 0.167
                    },
                    "t": 155,
                    "s": [
                      {
                        "i": [
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ]
                        ],
                        "o": [
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ]
                        ],
                        "v": [
                          [
                            -18.103,
                            113
                          ],
                          [
                            -0.122,
                            45.63
                          ],
                          [
                            16.921,
                            113
                          ],
                          [
                            55.116,
                            113
                          ],
                          [
                            89.526,
                            -63
                          ],
                          [
                            55.707,
                            -63
                          ],
                          [
                            35.783,
                            45.56
                          ],
                          [
                            17.813,
                            -63
                          ],
                          [
                            -14.943,
                            -63
                          ],
                          [
                            -34.918,
                            44.59
                          ],
                          [
                            -52.837,
                            -63
                          ],
                          [
                            -89.526,
                            -63
                          ],
                          [
                            -56.298,
                            113
                          ]
                        ],
                        "c": true
                      }
                    ]
                  },
                  {
                    "t": 165,
                    "s": [
                      {
                        "i": [
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ]
                        ],
                        "o": [
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ]
                        ],
                        "v": [
                          [
                            -20.93,
                            63
                          ],
                          [
                            0.56,
                            -4.37
                          ],
                          [
                            20.93,
                            63
                          ],
                          [
                            66.58,
                            63
                          ],
                          [
                            107,
                            -63
                          ],
                          [
                            66.58,
                            -63
                          ],
                          [
                            43.32,
                            9.56
                          ],
                          [
                            21.29,
                            -63
                          ],
                          [
                            -17.86,
                            -63
                          ],
                          [
                            -41.18,
                            8.59
                          ],
                          [
                            -63.15,
                            -63
                          ],
                          [
                            -107,
                            -63
                          ],
                          [
                            -66.58,
                            63
                          ]
                        ],
                        "c": true
                      }
                    ]
                  }
                ]
              },
              "nm": "Path 1",
              "hd": false
            },
            {
              "ty": "gf",
              "o": {
                "a": 0,
                "k": 100
              },
              "r": 1,
              "bm": 0,
              "g": {
                "p": 3,
                "k": {
                  "a": 0,
                  "k": [
                    0,
                    0.408,
                    1,
                    0.803,
                    0.5,
                    0.427,
                    1,
                    0.896,
                    1,
                    0.446,
                    1,
                    0.989
                  ]
                }
              },
              "s": {
                "a": 0,
                "k": [
                  0,
                  -39.164
                ]
              },
              "e": {
                "a": 0,
                "k": [
                  0,
                  63.759
                ]
              },
              "t": 2,
              "h": {
                "a": 0,
                "k": 0
              },
              "a": {
                "a": 0,
                "k": 0
              },
              "nm": "fdvfd22",
              "hd": false
            },
            {
              "ty": "st",
              "c": {
                "a": 0,
                "k": [
                  0,
                  0.402736991644,
                  0.588172972202,
                  1
                ]
              },
              "o": {
                "a": 0,
                "k": 100
              },
              "w": {
                "a": 1,
                "k": [
                  {
                    "i": {
                      "x": [
                        0.28
                      ],
                      "y": [
                        1
                      ]
                    },
                    "o": {
                      "x": [
                        0.33
                      ],
                      "y": [
                        0
                      ]
                    },
                    "t": 14,
                    "s": [
                      40
                    ]
                  },
                  {
                    "i": {
                      "x": [
                        0.833
                      ],
                      "y": [
                        1
                      ]
                    },
                    "o": {
                      "x": [
                        0.33
                      ],
                      "y": [
                        0
                      ]
                    },
                    "t": 34,
                    "s": [
                      90
                    ]
                  },
                  {
                    "i": {
                      "x": [
                        0.833
                      ],
                      "y": [
                        1
                      ]
                    },
                    "o": {
                      "x": [
                        0.6
                      ],
                      "y": [
                        0
                      ]
                    },
                    "t": 47,
                    "s": [
                      79
                    ]
                  },
                  {
                    "i": {
                      "x": [
                        0.28
                      ],
                      "y": [
                        1
                      ]
                    },
                    "o": {
                      "x": [
                        0.61
                      ],
                      "y": [
                        0
                      ]
                    },
                    "t": 123,
                    "s": [
                      79
                    ]
                  },
                  {
                    "i": {
                      "x": [
                        0.2
                      ],
                      "y": [
                        1
                      ]
                    },
                    "o": {
                      "x": [
                        0.72
                      ],
                      "y": [
                        0
                      ]
                    },
                    "t": 139,
                    "s": [
                      40
                    ]
                  },
                  {
                    "t": 165,
                    "s": [
                      40
                    ]
                  }
                ]
              },
              "lc": 2,
              "lj": 2,
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
          "nm": "Path",
          "bm": 0,
          "hd": false
        }
      ],
      "ip": 123,
      "op": 180,
      "st": 0,
      "bm": 0
    },
    {
      "ddd": 0,
      "ind": 4,
      "ty": 4,
      "nm": "w 4",
      "sr": 1,
      "ks": {
        "r": {
          "a": 1,
          "k": [
            {
              "i": {
                "x": [
                  0.833
                ],
                "y": [
                  1
                ]
              },
              "o": {
                "x": [
                  0.167
                ],
                "y": [
                  0
                ]
              },
              "t": 3,
              "s": [
                26
              ]
            },
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
                  0.783
                ],
                "y": [
                  0
                ]
              },
              "t": 123,
              "s": [
                26
              ]
            },
            {
              "i": {
                "x": [
                  0.28
                ],
                "y": [
                  1
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
              "t": 130,
              "s": [
                -10.512
              ]
            },
            {
              "i": {
                "x": [
                  0.2
                ],
                "y": [
                  1
                ]
              },
              "o": {
                "x": [
                  0.72
                ],
                "y": [
                  0
                ]
              },
              "t": 137,
              "s": [
                0
              ]
            },
            {
              "t": 161,
              "s": [
                0
              ]
            }
          ]
        },
        "p": {
          "a": 1,
          "k": [
            {
              "i": {
                "x": 0.25,
                "y": 1
              },
              "o": {
                "x": 0.57,
                "y": 0
              },
              "t": 3,
              "s": [
                147.166,
                80.89,
                0
              ],
              "to": [
                5.845,
                -11.984,
                0
              ],
              "ti": [
                3.068,
                -21.498,
                0
              ]
            },
            {
              "i": {
                "x": 0.91,
                "y": 1
              },
              "o": {
                "x": 0.167,
                "y": 0
              },
              "t": 11,
              "s": [
                182.236,
                8.986,
                0
              ],
              "to": [
                -3.068,
                21.498,
                0
              ],
              "ti": [
                2.557,
                -12.846,
                0
              ]
            },
            {
              "i": {
                "x": 0.28,
                "y": 1
              },
              "o": {
                "x": 0.09,
                "y": 0
              },
              "t": 29,
              "s": [
                128.76,
                209.875,
                0
              ],
              "to": [
                -2.557,
                12.846,
                0
              ],
              "ti": [
                -0.741,
                -2.128,
                0
              ]
            },
            {
              "i": {
                "x": 0.13,
                "y": 1
              },
              "o": {
                "x": 0.6,
                "y": 0
              },
              "t": 47,
              "s": [
                166.896,
                86.062,
                0
              ],
              "to": [
                0.741,
                2.128,
                0
              ],
              "ti": [
                3.615,
                -6.097,
                0
              ]
            },
            {
              "i": {
                "x": 0.18,
                "y": 1
              },
              "o": {
                "x": 0.6,
                "y": 0
              },
              "t": 81,
              "s": [
                133.207,
                222.645,
                0
              ],
              "to": [
                -3.615,
                6.097,
                0
              ],
              "ti": [
                1.295,
                -34.254,
                0
              ]
            },
            {
              "i": {
                "x": 0.28,
                "y": 1
              },
              "o": {
                "x": 0.61,
                "y": 0
              },
              "t": 123,
              "s": [
                145.207,
                122.645,
                0
              ],
              "to": [
                -1.295,
                34.254,
                0
              ],
              "ti": [
                3.118,
                -7.226,
                0
              ]
            },
            {
              "i": {
                "x": 0.2,
                "y": 1
              },
              "o": {
                "x": 0.72,
                "y": 0
              },
              "t": 137,
              "s": [
                125.436,
                428.171,
                0
              ],
              "to": [
                -3.118,
                7.226,
                0
              ],
              "ti": [
                -0.177,
                43.695,
                0
              ]
            },
            {
              "t": 161,
              "s": [
                126.5,
                166,
                0
              ]
            }
          ]
        },
        "s": {
          "a": 1,
          "k": [
            {
              "i": {
                "x": [
                  0.833,
                  0.833,
                  0.833
                ],
                "y": [
                  1,
                  1,
                  1
                ]
              },
              "o": {
                "x": [
                  0.167,
                  0.167,
                  0.167
                ],
                "y": [
                  0,
                  0,
                  0
                ]
              },
              "t": 3,
              "s": [
                100,
                100,
                100
              ]
            },
            {
              "i": {
                "x": [
                  0.833,
                  0.833,
                  0.833
                ],
                "y": [
                  1,
                  1,
                  1
                ]
              },
              "o": {
                "x": [
                  0.61,
                  0.61,
                  0.61
                ],
                "y": [
                  0,
                  0,
                  0
                ]
              },
              "t": 123,
              "s": [
                100,
                100,
                100
              ]
            },
            {
              "i": {
                "x": [
                  0.818,
                  0.818,
                  0.818
                ],
                "y": [
                  1,
                  1,
                  1
                ]
              },
              "o": {
                "x": [
                  0.533,
                  0.533,
                  0.533
                ],
                "y": [
                  0,
                  0,
                  0
                ]
              },
              "t": 137,
              "s": [
                100,
                100,
                100
              ]
            },
            {
              "i": {
                "x": [
                  0.667,
                  0.667,
                  0.667
                ],
                "y": [
                  1,
                  1,
                  1
                ]
              },
              "o": {
                "x": [
                  0.215,
                  0.215,
                  0.215
                ],
                "y": [
                  0,
                  0,
                  0
                ]
              },
              "t": 150,
              "s": [
                105,
                95,
                100
              ]
            },
            {
              "i": {
                "x": [
                  0.089,
                  0.089,
                  0.089
                ],
                "y": [
                  1,
                  1,
                  1
                ]
              },
              "o": {
                "x": [
                  0.333,
                  0.333,
                  0.333
                ],
                "y": [
                  0,
                  0,
                  0
                ]
              },
              "t": 163,
              "s": [
                98,
                102,
                100
              ]
            },
            {
              "t": 179,
              "s": [
                100,
                100,
                100
              ]
            }
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
                "a": 1,
                "k": [
                  {
                    "i": {
                      "x": 0.833,
                      "y": 0.833
                    },
                    "o": {
                      "x": 0.57,
                      "y": 0
                    },
                    "t": 3,
                    "s": [
                      {
                        "i": [
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ]
                        ],
                        "o": [
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ]
                        ],
                        "v": [
                          [
                            -20.83,
                            63
                          ],
                          [
                            0.56,
                            -4.37
                          ],
                          [
                            20.83,
                            63
                          ],
                          [
                            66.27,
                            63
                          ],
                          [
                            106.5,
                            -63
                          ],
                          [
                            66.27,
                            -63
                          ],
                          [
                            43.12,
                            9.56
                          ],
                          [
                            21.19,
                            -63
                          ],
                          [
                            -17.78,
                            -63
                          ],
                          [
                            -40.98,
                            8.59
                          ],
                          [
                            -62.86,
                            -63
                          ],
                          [
                            -106.5,
                            -63
                          ],
                          [
                            -66.27,
                            63
                          ]
                        ],
                        "c": true
                      }
                    ]
                  },
                  {
                    "i": {
                      "x": 0.25,
                      "y": 1
                    },
                    "o": {
                      "x": 0.167,
                      "y": 0.167
                    },
                    "t": 7,
                    "s": [
                      {
                        "i": [
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ]
                        ],
                        "o": [
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ]
                        ],
                        "v": [
                          [
                            -21.06,
                            91
                          ],
                          [
                            0.33,
                            23.63
                          ],
                          [
                            20.6,
                            91
                          ],
                          [
                            66.04,
                            91
                          ],
                          [
                            90.5,
                            -63
                          ],
                          [
                            48.314,
                            -62.95
                          ],
                          [
                            34.89,
                            37.61
                          ],
                          [
                            18.007,
                            -63
                          ],
                          [
                            -15.109,
                            -63
                          ],
                          [
                            -36.21,
                            36.23
                          ],
                          [
                            -48.416,
                            -63.36
                          ],
                          [
                            -90.5,
                            -63
                          ],
                          [
                            -66.5,
                            91
                          ]
                        ],
                        "c": true
                      }
                    ]
                  },
                  {
                    "i": {
                      "x": 0.25,
                      "y": 1
                    },
                    "o": {
                      "x": 0.57,
                      "y": 0
                    },
                    "t": 11,
                    "s": [
                      {
                        "i": [
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ]
                        ],
                        "o": [
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ]
                        ],
                        "v": [
                          [
                            -20.83,
                            63
                          ],
                          [
                            0.56,
                            -4.37
                          ],
                          [
                            20.83,
                            63
                          ],
                          [
                            66.27,
                            63
                          ],
                          [
                            106.5,
                            -63
                          ],
                          [
                            66.27,
                            -63
                          ],
                          [
                            43.12,
                            9.56
                          ],
                          [
                            21.19,
                            -63
                          ],
                          [
                            -17.78,
                            -63
                          ],
                          [
                            -40.98,
                            8.59
                          ],
                          [
                            -62.86,
                            -63
                          ],
                          [
                            -106.5,
                            -63
                          ],
                          [
                            -66.27,
                            63
                          ]
                        ],
                        "c": true
                      }
                    ]
                  },
                  {
                    "i": {
                      "x": 0.25,
                      "y": 1
                    },
                    "o": {
                      "x": 0.49,
                      "y": 0
                    },
                    "t": 21,
                    "s": [
                      {
                        "i": [
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ]
                        ],
                        "o": [
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ]
                        ],
                        "v": [
                          [
                            -20.93,
                            0
                          ],
                          [
                            0.56,
                            0
                          ],
                          [
                            20.93,
                            0
                          ],
                          [
                            66.58,
                            0
                          ],
                          [
                            107,
                            0
                          ],
                          [
                            66.58,
                            0
                          ],
                          [
                            43.32,
                            0
                          ],
                          [
                            21.29,
                            0
                          ],
                          [
                            -17.86,
                            0
                          ],
                          [
                            -41.18,
                            0
                          ],
                          [
                            -63.15,
                            0
                          ],
                          [
                            -107,
                            0
                          ],
                          [
                            -66.58,
                            0
                          ]
                        ],
                        "c": true
                      }
                    ]
                  },
                  {
                    "i": {
                      "x": 0.833,
                      "y": 1
                    },
                    "o": {
                      "x": 0.167,
                      "y": 0
                    },
                    "t": 29,
                    "s": [
                      {
                        "i": [
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ]
                        ],
                        "o": [
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ]
                        ],
                        "v": [
                          [
                            0.098,
                            0
                          ],
                          [
                            -0.003,
                            0
                          ],
                          [
                            -0.098,
                            0
                          ],
                          [
                            -0.311,
                            0
                          ],
                          [
                            -0.5,
                            0
                          ],
                          [
                            -0.311,
                            0
                          ],
                          [
                            -0.202,
                            0
                          ],
                          [
                            -0.099,
                            0
                          ],
                          [
                            0.083,
                            0
                          ],
                          [
                            0.192,
                            0
                          ],
                          [
                            0.295,
                            0
                          ],
                          [
                            0.5,
                            0
                          ],
                          [
                            0.311,
                            0
                          ]
                        ],
                        "c": true
                      }
                    ]
                  },
                  {
                    "i": {
                      "x": 0.833,
                      "y": 0.833
                    },
                    "o": {
                      "x": 0.61,
                      "y": 0
                    },
                    "t": 123,
                    "s": [
                      {
                        "i": [
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ]
                        ],
                        "o": [
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ]
                        ],
                        "v": [
                          [
                            0.098,
                            0
                          ],
                          [
                            -0.003,
                            0
                          ],
                          [
                            -0.098,
                            0
                          ],
                          [
                            -0.311,
                            0
                          ],
                          [
                            -0.5,
                            0
                          ],
                          [
                            -0.311,
                            0
                          ],
                          [
                            -0.202,
                            0
                          ],
                          [
                            -0.099,
                            0
                          ],
                          [
                            0.083,
                            0
                          ],
                          [
                            0.192,
                            0
                          ],
                          [
                            0.295,
                            0
                          ],
                          [
                            0.5,
                            0
                          ],
                          [
                            0.311,
                            0
                          ]
                        ],
                        "c": true
                      }
                    ]
                  },
                  {
                    "i": {
                      "x": 0.28,
                      "y": 1
                    },
                    "o": {
                      "x": 0.167,
                      "y": 0.167
                    },
                    "t": 130,
                    "s": [
                      {
                        "i": [
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ]
                        ],
                        "o": [
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ]
                        ],
                        "v": [
                          [
                            -10.778,
                            32.74
                          ],
                          [
                            0.29,
                            -2.271
                          ],
                          [
                            10.778,
                            32.74
                          ],
                          [
                            34.29,
                            32.74
                          ],
                          [
                            57.254,
                            -132.014
                          ],
                          [
                            36.437,
                            -132.014
                          ],
                          [
                            22.615,
                            -29.556
                          ],
                          [
                            13.112,
                            -132.014
                          ],
                          [
                            -7.053,
                            -132.014
                          ],
                          [
                            -20.901,
                            -30.06
                          ],
                          [
                            -30.378,
                            -132.014
                          ],
                          [
                            -52.959,
                            -132.014
                          ],
                          [
                            -34.29,
                            32.74
                          ]
                        ],
                        "c": true
                      }
                    ]
                  },
                  {
                    "i": {
                      "x": 0.833,
                      "y": 0.833
                    },
                    "o": {
                      "x": 0.72,
                      "y": 0
                    },
                    "t": 137,
                    "s": [
                      {
                        "i": [
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ]
                        ],
                        "o": [
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ]
                        ],
                        "v": [
                          [
                            -20.83,
                            63
                          ],
                          [
                            0.56,
                            -4.37
                          ],
                          [
                            20.83,
                            63
                          ],
                          [
                            66.27,
                            63
                          ],
                          [
                            106.5,
                            -63
                          ],
                          [
                            66.27,
                            -63
                          ],
                          [
                            43.12,
                            9.56
                          ],
                          [
                            21.19,
                            -63
                          ],
                          [
                            -17.78,
                            -63
                          ],
                          [
                            -40.98,
                            8.59
                          ],
                          [
                            -62.86,
                            -63
                          ],
                          [
                            -106.5,
                            -63
                          ],
                          [
                            -66.27,
                            63
                          ]
                        ],
                        "c": true
                      }
                    ]
                  },
                  {
                    "i": {
                      "x": 0.2,
                      "y": 1
                    },
                    "o": {
                      "x": 0.167,
                      "y": 0.167
                    },
                    "t": 148,
                    "s": [
                      {
                        "i": [
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ]
                        ],
                        "o": [
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ]
                        ],
                        "v": [
                          [
                            -18.103,
                            113
                          ],
                          [
                            -0.122,
                            45.63
                          ],
                          [
                            16.921,
                            113
                          ],
                          [
                            55.116,
                            113
                          ],
                          [
                            89.526,
                            -63
                          ],
                          [
                            55.707,
                            -63
                          ],
                          [
                            35.783,
                            45.56
                          ],
                          [
                            17.813,
                            -63
                          ],
                          [
                            -14.943,
                            -63
                          ],
                          [
                            -34.918,
                            44.59
                          ],
                          [
                            -52.837,
                            -63
                          ],
                          [
                            -89.526,
                            -63
                          ],
                          [
                            -56.298,
                            113
                          ]
                        ],
                        "c": true
                      }
                    ]
                  },
                  {
                    "t": 161,
                    "s": [
                      {
                        "i": [
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ]
                        ],
                        "o": [
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ]
                        ],
                        "v": [
                          [
                            -20.83,
                            63
                          ],
                          [
                            0.56,
                            -4.37
                          ],
                          [
                            20.83,
                            63
                          ],
                          [
                            66.27,
                            63
                          ],
                          [
                            106.5,
                            -63
                          ],
                          [
                            66.27,
                            -63
                          ],
                          [
                            43.12,
                            9.56
                          ],
                          [
                            21.19,
                            -63
                          ],
                          [
                            -17.78,
                            -63
                          ],
                          [
                            -40.98,
                            8.59
                          ],
                          [
                            -62.86,
                            -63
                          ],
                          [
                            -106.5,
                            -63
                          ],
                          [
                            -66.27,
                            63
                          ]
                        ],
                        "c": true
                      }
                    ]
                  }
                ]
              },
              "nm": "Path 1",
              "hd": false
            },
            {
              "ty": "gf",
              "o": {
                "a": 0,
                "k": 100
              },
              "r": 1,
              "bm": 0,
              "g": {
                "p": 3,
                "k": {
                  "a": 0,
                  "k": [
                    0,
                    0.408,
                    1,
                    0.803,
                    0.5,
                    0.427,
                    1,
                    0.896,
                    1,
                    0.446,
                    1,
                    0.989
                  ]
                }
              },
              "s": {
                "a": 0,
                "k": [
                  0,
                  -39.164
                ]
              },
              "e": {
                "a": 0,
                "k": [
                  0,
                  63.759
                ]
              },
              "t": 2,
              "h": {
                "a": 0,
                "k": 0
              },
              "a": {
                "a": 0,
                "k": 0
              },
              "nm": "fdvfd22",
              "hd": false
            },
            {
              "ty": "st",
              "c": {
                "a": 0,
                "k": [
                  0,
                  0.402736991644,
                  0.588172972202,
                  1
                ]
              },
              "o": {
                "a": 0,
                "k": 100
              },
              "w": {
                "a": 1,
                "k": [
                  {
                    "i": {
                      "x": [
                        0.28
                      ],
                      "y": [
                        1
                      ]
                    },
                    "o": {
                      "x": [
                        0.33
                      ],
                      "y": [
                        0
                      ]
                    },
                    "t": 14,
                    "s": [
                      40
                    ]
                  },
                  {
                    "i": {
                      "x": [
                        0.833
                      ],
                      "y": [
                        1
                      ]
                    },
                    "o": {
                      "x": [
                        0.33
                      ],
                      "y": [
                        0
                      ]
                    },
                    "t": 34,
                    "s": [
                      90
                    ]
                  },
                  {
                    "i": {
                      "x": [
                        0.833
                      ],
                      "y": [
                        1
                      ]
                    },
                    "o": {
                      "x": [
                        0.6
                      ],
                      "y": [
                        0
                      ]
                    },
                    "t": 47,
                    "s": [
                      79
                    ]
                  },
                  {
                    "i": {
                      "x": [
                        0.28
                      ],
                      "y": [
                        1
                      ]
                    },
                    "o": {
                      "x": [
                        0.61
                      ],
                      "y": [
                        0
                      ]
                    },
                    "t": 123,
                    "s": [
                      79
                    ]
                  },
                  {
                    "i": {
                      "x": [
                        0.2
                      ],
                      "y": [
                        1
                      ]
                    },
                    "o": {
                      "x": [
                        0.72
                      ],
                      "y": [
                        0
                      ]
                    },
                    "t": 137,
                    "s": [
                      40
                    ]
                  },
                  {
                    "t": 161,
                    "s": [
                      40
                    ]
                  }
                ]
              },
              "lc": 2,
              "lj": 2,
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
          "nm": "Path",
          "bm": 0,
          "hd": false
        }
      ],
      "ip": 123,
      "op": 180,
      "st": 0,
      "bm": 0
    },
    {
      "ddd": 0,
      "ind": 5,
      "ty": 4,
      "nm": "w 3",
      "parent": 7,
      "sr": 1,
      "ks": {
        "r": {
          "a": 1,
          "k": [
            {
              "i": {
                "x": [
                  0.833
                ],
                "y": [
                  1
                ]
              },
              "o": {
                "x": [
                  0.57
                ],
                "y": [
                  0
                ]
              },
              "t": 0,
              "s": [
                0
              ]
            },
            {
              "i": {
                "x": [
                  0.11
                ],
                "y": [
                  1
                ]
              },
              "o": {
                "x": [
                  0.61
                ],
                "y": [
                  0
                ]
              },
              "t": 123,
              "s": [
                0
              ]
            },
            {
              "i": {
                "x": [
                  0.11
                ],
                "y": [
                  1
                ]
              },
              "o": {
                "x": [
                  0.167
                ],
                "y": [
                  0
                ]
              },
              "t": 154,
              "s": [
                0
              ]
            },
            {
              "t": 179,
              "s": [
                0
              ]
            }
          ]
        },
        "p": {
          "a": 1,
          "k": [
            {
              "i": {
                "x": 0.25,
                "y": 1
              },
              "o": {
                "x": 0.57,
                "y": 0
              },
              "t": 0,
              "s": [
                129,
                97.987,
                0
              ],
              "to": [
                0,
                -44.333,
                0
              ],
              "ti": [
                6.667,
                11,
                0
              ]
            },
            {
              "i": {
                "x": 0.91,
                "y": 1
              },
              "o": {
                "x": 0.57,
                "y": 0
              },
              "t": 8,
              "s": [
                129,
                -168.013,
                0
              ],
              "to": [
                -6.667,
                -11,
                0
              ],
              "ti": [
                3.333,
                -12,
                0
              ]
            },
            {
              "i": {
                "x": 0.28,
                "y": 1
              },
              "o": {
                "x": 0.09,
                "y": 0
              },
              "t": 29,
              "s": [
                89,
                31.987,
                0
              ],
              "to": [
                -3.333,
                12,
                0
              ],
              "ti": [
                -7.957,
                -1.463,
                0
              ]
            },
            {
              "i": {
                "x": 0.13,
                "y": 1
              },
              "o": {
                "x": 0.6,
                "y": 0
              },
              "t": 47,
              "s": [
                109,
                -96.013,
                0
              ],
              "to": [
                7.957,
                1.463,
                0
              ],
              "ti": [
                0.885,
                -6.94,
                0
              ]
            },
            {
              "i": {
                "x": 0.18,
                "y": 1
              },
              "o": {
                "x": 0.6,
                "y": 0
              },
              "t": 81,
              "s": [
                136.741,
                40.766,
                0
              ],
              "to": [
                -0.885,
                6.94,
                0
              ],
              "ti": [
                1.29,
                -9.537,
                0
              ]
            },
            {
              "i": {
                "x": 0.11,
                "y": 1
              },
              "o": {
                "x": 0.61,
                "y": 0
              },
              "t": 123,
              "s": [
                103.689,
                -54.374,
                0
              ],
              "to": [
                -1.29,
                9.537,
                0
              ],
              "ti": [
                -4.218,
                -25.394,
                0
              ]
            },
            {
              "i": {
                "x": 0.11,
                "y": 1
              },
              "o": {
                "x": 0.167,
                "y": 0
              },
              "t": 154,
              "s": [
                129,
                97.987,
                0
              ],
              "to": [
                4.218,
                25.394,
                0
              ],
              "ti": [
                0,
                0,
                0
              ]
            },
            {
              "t": 179,
              "s": [
                129,
                97.987,
                0
              ]
            }
          ]
        },
        "s": {
          "a": 1,
          "k": [
            {
              "i": {
                "x": [
                  0.833,
                  0.833,
                  0.833
                ],
                "y": [
                  1,
                  1,
                  1
                ]
              },
              "o": {
                "x": [
                  0.57,
                  0.57,
                  0.57
                ],
                "y": [
                  0,
                  0,
                  0
                ]
              },
              "t": 0,
              "s": [
                100,
                100,
                100
              ]
            },
            {
              "i": {
                "x": [
                  0.11,
                  0.11,
                  0.11
                ],
                "y": [
                  1,
                  1,
                  1
                ]
              },
              "o": {
                "x": [
                  0.61,
                  0.61,
                  0.61
                ],
                "y": [
                  0,
                  0,
                  0
                ]
              },
              "t": 123,
              "s": [
                100,
                100,
                100
              ]
            },
            {
              "i": {
                "x": [
                  0.11,
                  0.11,
                  0.11
                ],
                "y": [
                  1,
                  1,
                  1
                ]
              },
              "o": {
                "x": [
                  0.167,
                  0.167,
                  0.167
                ],
                "y": [
                  0,
                  0,
                  0
                ]
              },
              "t": 154,
              "s": [
                100,
                100,
                100
              ]
            },
            {
              "t": 179,
              "s": [
                100,
                100,
                100
              ]
            }
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
                "a": 1,
                "k": [
                  {
                    "i": {
                      "x": 0.833,
                      "y": 0.833
                    },
                    "o": {
                      "x": 0.57,
                      "y": 0
                    },
                    "t": 0,
                    "s": [
                      {
                        "i": [
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ]
                        ],
                        "o": [
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ]
                        ],
                        "v": [
                          [
                            -20.93,
                            63
                          ],
                          [
                            0.56,
                            -4.37
                          ],
                          [
                            20.93,
                            63
                          ],
                          [
                            66.58,
                            63
                          ],
                          [
                            107,
                            -63
                          ],
                          [
                            66.58,
                            -63
                          ],
                          [
                            43.32,
                            9.56
                          ],
                          [
                            21.29,
                            -63
                          ],
                          [
                            -17.86,
                            -63
                          ],
                          [
                            -41.18,
                            8.59
                          ],
                          [
                            -63.15,
                            -63
                          ],
                          [
                            -107,
                            -63
                          ],
                          [
                            -66.58,
                            63
                          ]
                        ],
                        "c": true
                      }
                    ]
                  },
                  {
                    "i": {
                      "x": 0.25,
                      "y": 1
                    },
                    "o": {
                      "x": 0.167,
                      "y": 0.167
                    },
                    "t": 4,
                    "s": [
                      {
                        "i": [
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ]
                        ],
                        "o": [
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ]
                        ],
                        "v": [
                          [
                            -18.333,
                            175
                          ],
                          [
                            0.103,
                            30.63
                          ],
                          [
                            17.612,
                            175
                          ],
                          [
                            56.811,
                            175
                          ],
                          [
                            79,
                            -63.4
                          ],
                          [
                            44.292,
                            -63.4
                          ],
                          [
                            35.481,
                            92.56
                          ],
                          [
                            18.282,
                            -63
                          ],
                          [
                            -15.336,
                            -63
                          ],
                          [
                            -36.22,
                            92.59
                          ],
                          [
                            -41.346,
                            -63.4
                          ],
                          [
                            -79,
                            -63.4
                          ],
                          [
                            -57.533,
                            175
                          ]
                        ],
                        "c": true
                      }
                    ]
                  },
                  {
                    "i": {
                      "x": 0.25,
                      "y": 1
                    },
                    "o": {
                      "x": 0.57,
                      "y": 0
                    },
                    "t": 8,
                    "s": [
                      {
                        "i": [
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ]
                        ],
                        "o": [
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ]
                        ],
                        "v": [
                          [
                            -20.93,
                            63
                          ],
                          [
                            0.56,
                            -4.37
                          ],
                          [
                            20.93,
                            63
                          ],
                          [
                            66.58,
                            63
                          ],
                          [
                            107,
                            -63
                          ],
                          [
                            66.58,
                            -63
                          ],
                          [
                            43.32,
                            9.56
                          ],
                          [
                            21.29,
                            -63
                          ],
                          [
                            -17.86,
                            -63
                          ],
                          [
                            -41.18,
                            8.59
                          ],
                          [
                            -63.15,
                            -63
                          ],
                          [
                            -107,
                            -63
                          ],
                          [
                            -66.58,
                            63
                          ]
                        ],
                        "c": true
                      }
                    ]
                  },
                  {
                    "i": {
                      "x": 0.25,
                      "y": 1
                    },
                    "o": {
                      "x": 0.49,
                      "y": 0
                    },
                    "t": 17,
                    "s": [
                      {
                        "i": [
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ]
                        ],
                        "o": [
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ]
                        ],
                        "v": [
                          [
                            -20.93,
                            0
                          ],
                          [
                            0.56,
                            0
                          ],
                          [
                            20.93,
                            0
                          ],
                          [
                            66.58,
                            0
                          ],
                          [
                            107,
                            0
                          ],
                          [
                            66.58,
                            0
                          ],
                          [
                            43.32,
                            0
                          ],
                          [
                            21.29,
                            0
                          ],
                          [
                            -17.86,
                            0
                          ],
                          [
                            -41.18,
                            0
                          ],
                          [
                            -63.15,
                            0
                          ],
                          [
                            -107,
                            0
                          ],
                          [
                            -66.58,
                            0
                          ]
                        ],
                        "c": true
                      }
                    ]
                  },
                  {
                    "i": {
                      "x": 0.833,
                      "y": 1
                    },
                    "o": {
                      "x": 0.49,
                      "y": 0
                    },
                    "t": 25,
                    "s": [
                      {
                        "i": [
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ]
                        ],
                        "o": [
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ]
                        ],
                        "v": [
                          [
                            0.098,
                            0
                          ],
                          [
                            -0.003,
                            0
                          ],
                          [
                            -0.098,
                            0
                          ],
                          [
                            -0.311,
                            0
                          ],
                          [
                            -0.5,
                            0
                          ],
                          [
                            -0.311,
                            0
                          ],
                          [
                            -0.202,
                            0
                          ],
                          [
                            -0.099,
                            0
                          ],
                          [
                            0.083,
                            0
                          ],
                          [
                            0.192,
                            0
                          ],
                          [
                            0.295,
                            0
                          ],
                          [
                            0.5,
                            0
                          ],
                          [
                            0.311,
                            0
                          ]
                        ],
                        "c": true
                      }
                    ]
                  },
                  {
                    "i": {
                      "x": 0.11,
                      "y": 1
                    },
                    "o": {
                      "x": 0.61,
                      "y": 0
                    },
                    "t": 123,
                    "s": [
                      {
                        "i": [
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ]
                        ],
                        "o": [
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ]
                        ],
                        "v": [
                          [
                            0.098,
                            0
                          ],
                          [
                            -0.003,
                            0
                          ],
                          [
                            -0.098,
                            0
                          ],
                          [
                            -0.311,
                            0
                          ],
                          [
                            -0.5,
                            0
                          ],
                          [
                            -0.311,
                            0
                          ],
                          [
                            -0.202,
                            0
                          ],
                          [
                            -0.099,
                            0
                          ],
                          [
                            0.083,
                            0
                          ],
                          [
                            0.192,
                            0
                          ],
                          [
                            0.295,
                            0
                          ],
                          [
                            0.5,
                            0
                          ],
                          [
                            0.311,
                            0
                          ]
                        ],
                        "c": true
                      }
                    ]
                  },
                  {
                    "i": {
                      "x": 0.11,
                      "y": 1
                    },
                    "o": {
                      "x": 0.167,
                      "y": 0
                    },
                    "t": 154,
                    "s": [
                      {
                        "i": [
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ]
                        ],
                        "o": [
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ]
                        ],
                        "v": [
                          [
                            -20.93,
                            63
                          ],
                          [
                            0.56,
                            -4.37
                          ],
                          [
                            20.93,
                            63
                          ],
                          [
                            66.58,
                            63
                          ],
                          [
                            107,
                            -63
                          ],
                          [
                            66.58,
                            -63
                          ],
                          [
                            43.32,
                            9.56
                          ],
                          [
                            21.29,
                            -63
                          ],
                          [
                            -17.86,
                            -63
                          ],
                          [
                            -41.18,
                            8.59
                          ],
                          [
                            -63.15,
                            -63
                          ],
                          [
                            -107,
                            -63
                          ],
                          [
                            -66.58,
                            63
                          ]
                        ],
                        "c": true
                      }
                    ]
                  },
                  {
                    "t": 179,
                    "s": [
                      {
                        "i": [
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ]
                        ],
                        "o": [
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ]
                        ],
                        "v": [
                          [
                            -20.93,
                            63
                          ],
                          [
                            0.56,
                            -4.37
                          ],
                          [
                            20.93,
                            63
                          ],
                          [
                            66.58,
                            63
                          ],
                          [
                            107,
                            -63
                          ],
                          [
                            66.58,
                            -63
                          ],
                          [
                            43.32,
                            9.56
                          ],
                          [
                            21.29,
                            -63
                          ],
                          [
                            -17.86,
                            -63
                          ],
                          [
                            -41.18,
                            8.59
                          ],
                          [
                            -63.15,
                            -63
                          ],
                          [
                            -107,
                            -63
                          ],
                          [
                            -66.58,
                            63
                          ]
                        ],
                        "c": true
                      }
                    ]
                  }
                ]
              },
              "nm": "Path 1",
              "hd": false
            },
            {
              "ty": "gf",
              "o": {
                "a": 0,
                "k": 100
              },
              "r": 1,
              "bm": 0,
              "g": {
                "p": 3,
                "k": {
                  "a": 0,
                  "k": [
                    0,
                    0.408,
                    1,
                    0.803,
                    0.5,
                    0.427,
                    1,
                    0.896,
                    1,
                    0.446,
                    1,
                    0.989
                  ]
                }
              },
              "s": {
                "a": 0,
                "k": [
                  0,
                  -39.164
                ]
              },
              "e": {
                "a": 0,
                "k": [
                  0,
                  63.759
                ]
              },
              "t": 2,
              "h": {
                "a": 0,
                "k": 0
              },
              "a": {
                "a": 0,
                "k": 0
              },
              "nm": "fdvfd22",
              "hd": false
            },
            {
              "ty": "st",
              "c": {
                "a": 0,
                "k": [
                  0,
                  0.402736991644,
                  0.588172972202,
                  1
                ]
              },
              "o": {
                "a": 0,
                "k": 100
              },
              "w": {
                "a": 1,
                "k": [
                  {
                    "i": {
                      "x": [
                        0.28
                      ],
                      "y": [
                        1
                      ]
                    },
                    "o": {
                      "x": [
                        0.33
                      ],
                      "y": [
                        0
                      ]
                    },
                    "t": 14,
                    "s": [
                      40
                    ]
                  },
                  {
                    "i": {
                      "x": [
                        0.833
                      ],
                      "y": [
                        1
                      ]
                    },
                    "o": {
                      "x": [
                        0.33
                      ],
                      "y": [
                        0
                      ]
                    },
                    "t": 34,
                    "s": [
                      90
                    ]
                  },
                  {
                    "i": {
                      "x": [
                        0.833
                      ],
                      "y": [
                        1
                      ]
                    },
                    "o": {
                      "x": [
                        0.6
                      ],
                      "y": [
                        0
                      ]
                    },
                    "t": 47,
                    "s": [
                      79
                    ]
                  },
                  {
                    "i": {
                      "x": [
                        0.11
                      ],
                      "y": [
                        1
                      ]
                    },
                    "o": {
                      "x": [
                        0.61
                      ],
                      "y": [
                        0
                      ]
                    },
                    "t": 123,
                    "s": [
                      79
                    ]
                  },
                  {
                    "i": {
                      "x": [
                        0.11
                      ],
                      "y": [
                        1
                      ]
                    },
                    "o": {
                      "x": [
                        0.167
                      ],
                      "y": [
                        0
                      ]
                    },
                    "t": 154,
                    "s": [
                      40
                    ]
                  },
                  {
                    "t": 179,
                    "s": [
                      40
                    ]
                  }
                ]
              },
              "lc": 2,
              "lj": 2,
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
          "nm": "Path",
          "bm": 0,
          "hd": false
        }
      ],
      "ip": 29,
      "op": 123,
      "st": 0,
      "bm": 0
    },
    {
      "ddd": 0,
      "ind": 6,
      "ty": 4,
      "nm": "w 2",
      "parent": 7,
      "sr": 1,
      "ks": {
        "r": {
          "a": 1,
          "k": [
            {
              "i": {
                "x": [
                  0.833
                ],
                "y": [
                  1
                ]
              },
              "o": {
                "x": [
                  0.167
                ],
                "y": [
                  0
                ]
              },
              "t": 3,
              "s": [
                0
              ]
            },
            {
              "i": {
                "x": [
                  0.11
                ],
                "y": [
                  1
                ]
              },
              "o": {
                "x": [
                  0.61
                ],
                "y": [
                  0
                ]
              },
              "t": 123,
              "s": [
                0
              ]
            },
            {
              "i": {
                "x": [
                  0.11
                ],
                "y": [
                  1
                ]
              },
              "o": {
                "x": [
                  0.167
                ],
                "y": [
                  0
                ]
              },
              "t": 154,
              "s": [
                0
              ]
            },
            {
              "t": 179,
              "s": [
                0
              ]
            }
          ]
        },
        "p": {
          "a": 1,
          "k": [
            {
              "i": {
                "x": 0.25,
                "y": 1
              },
              "o": {
                "x": 0.57,
                "y": 0
              },
              "t": 3,
              "s": [
                -130.5,
                -90.013,
                0
              ],
              "to": [
                0,
                -13.333,
                0
              ],
              "ti": [
                -6.667,
                -20.667,
                0
              ]
            },
            {
              "i": {
                "x": 0.91,
                "y": 1
              },
              "o": {
                "x": 0.167,
                "y": 0
              },
              "t": 11,
              "s": [
                -130.5,
                -170.013,
                0
              ],
              "to": [
                6.667,
                20.667,
                0
              ],
              "ti": [
                -3.333,
                -12.667,
                0
              ]
            },
            {
              "i": {
                "x": 0.28,
                "y": 1
              },
              "o": {
                "x": 0.09,
                "y": 0
              },
              "t": 29,
              "s": [
                -90.5,
                33.987,
                0
              ],
              "to": [
                3.333,
                12.667,
                0
              ],
              "ti": [
                -1.599,
                -1.588,
                0
              ]
            },
            {
              "i": {
                "x": 0.13,
                "y": 1
              },
              "o": {
                "x": 0.6,
                "y": 0
              },
              "t": 47,
              "s": [
                -110.5,
                -94.013,
                0
              ],
              "to": [
                1.599,
                1.588,
                0
              ],
              "ti": [
                0.576,
                -7.065,
                0
              ]
            },
            {
              "i": {
                "x": 0.18,
                "y": 1
              },
              "o": {
                "x": 0.6,
                "y": 0
              },
              "t": 81,
              "s": [
                -80.905,
                43.515,
                0
              ],
              "to": [
                -0.576,
                7.065,
                0
              ],
              "ti": [
                8.266,
                22.255,
                0
              ]
            },
            {
              "i": {
                "x": 0.11,
                "y": 1
              },
              "o": {
                "x": 0.61,
                "y": 0
              },
              "t": 123,
              "s": [
                -113.956,
                -51.625,
                0
              ],
              "to": [
                -8.266,
                -22.255,
                0
              ],
              "ti": [
                2.757,
                6.398,
                0
              ]
            },
            {
              "i": {
                "x": 0.11,
                "y": 1
              },
              "o": {
                "x": 0.167,
                "y": 0
              },
              "t": 154,
              "s": [
                -130.5,
                -90.013,
                0
              ],
              "to": [
                -2.757,
                -6.398,
                0
              ],
              "ti": [
                0,
                0,
                0
              ]
            },
            {
              "t": 179,
              "s": [
                -130.5,
                -90.013,
                0
              ]
            }
          ]
        },
        "s": {
          "a": 1,
          "k": [
            {
              "i": {
                "x": [
                  0.833,
                  0.833,
                  0.833
                ],
                "y": [
                  1,
                  1,
                  1
                ]
              },
              "o": {
                "x": [
                  0.167,
                  0.167,
                  0.167
                ],
                "y": [
                  0,
                  0,
                  0
                ]
              },
              "t": 3,
              "s": [
                100,
                100,
                100
              ]
            },
            {
              "i": {
                "x": [
                  0.11,
                  0.11,
                  0.11
                ],
                "y": [
                  1,
                  1,
                  1
                ]
              },
              "o": {
                "x": [
                  0.61,
                  0.61,
                  0.61
                ],
                "y": [
                  0,
                  0,
                  0
                ]
              },
              "t": 123,
              "s": [
                100,
                100,
                100
              ]
            },
            {
              "i": {
                "x": [
                  0.11,
                  0.11,
                  0.11
                ],
                "y": [
                  1,
                  1,
                  1
                ]
              },
              "o": {
                "x": [
                  0.167,
                  0.167,
                  0.167
                ],
                "y": [
                  0,
                  0,
                  0
                ]
              },
              "t": 154,
              "s": [
                100,
                100,
                100
              ]
            },
            {
              "t": 179,
              "s": [
                100,
                100,
                100
              ]
            }
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
                "a": 1,
                "k": [
                  {
                    "i": {
                      "x": 0.833,
                      "y": 0.833
                    },
                    "o": {
                      "x": 0.57,
                      "y": 0
                    },
                    "t": 3,
                    "s": [
                      {
                        "i": [
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ]
                        ],
                        "o": [
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ]
                        ],
                        "v": [
                          [
                            -20.83,
                            63
                          ],
                          [
                            0.56,
                            -4.37
                          ],
                          [
                            20.83,
                            63
                          ],
                          [
                            66.27,
                            63
                          ],
                          [
                            106.5,
                            -63
                          ],
                          [
                            66.27,
                            -63
                          ],
                          [
                            43.12,
                            9.56
                          ],
                          [
                            21.19,
                            -63
                          ],
                          [
                            -17.78,
                            -63
                          ],
                          [
                            -40.98,
                            8.59
                          ],
                          [
                            -62.86,
                            -63
                          ],
                          [
                            -106.5,
                            -63
                          ],
                          [
                            -66.27,
                            63
                          ]
                        ],
                        "c": true
                      }
                    ]
                  },
                  {
                    "i": {
                      "x": 0.25,
                      "y": 1
                    },
                    "o": {
                      "x": 0.167,
                      "y": 0.167
                    },
                    "t": 7,
                    "s": [
                      {
                        "i": [
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ]
                        ],
                        "o": [
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ]
                        ],
                        "v": [
                          [
                            -21.06,
                            91
                          ],
                          [
                            0.33,
                            23.63
                          ],
                          [
                            20.6,
                            91
                          ],
                          [
                            66.04,
                            91
                          ],
                          [
                            90.5,
                            -63
                          ],
                          [
                            48.314,
                            -62.95
                          ],
                          [
                            34.89,
                            37.61
                          ],
                          [
                            18.007,
                            -63
                          ],
                          [
                            -15.109,
                            -63
                          ],
                          [
                            -36.21,
                            36.23
                          ],
                          [
                            -48.416,
                            -63.36
                          ],
                          [
                            -90.5,
                            -63
                          ],
                          [
                            -66.5,
                            91
                          ]
                        ],
                        "c": true
                      }
                    ]
                  },
                  {
                    "i": {
                      "x": 0.25,
                      "y": 1
                    },
                    "o": {
                      "x": 0.57,
                      "y": 0
                    },
                    "t": 11,
                    "s": [
                      {
                        "i": [
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ]
                        ],
                        "o": [
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ]
                        ],
                        "v": [
                          [
                            -20.83,
                            63
                          ],
                          [
                            0.56,
                            -4.37
                          ],
                          [
                            20.83,
                            63
                          ],
                          [
                            66.27,
                            63
                          ],
                          [
                            106.5,
                            -63
                          ],
                          [
                            66.27,
                            -63
                          ],
                          [
                            43.12,
                            9.56
                          ],
                          [
                            21.19,
                            -63
                          ],
                          [
                            -17.78,
                            -63
                          ],
                          [
                            -40.98,
                            8.59
                          ],
                          [
                            -62.86,
                            -63
                          ],
                          [
                            -106.5,
                            -63
                          ],
                          [
                            -66.27,
                            63
                          ]
                        ],
                        "c": true
                      }
                    ]
                  },
                  {
                    "i": {
                      "x": 0.25,
                      "y": 1
                    },
                    "o": {
                      "x": 0.49,
                      "y": 0
                    },
                    "t": 21,
                    "s": [
                      {
                        "i": [
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ]
                        ],
                        "o": [
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ]
                        ],
                        "v": [
                          [
                            -20.93,
                            0
                          ],
                          [
                            0.56,
                            0
                          ],
                          [
                            20.93,
                            0
                          ],
                          [
                            66.58,
                            0
                          ],
                          [
                            107,
                            0
                          ],
                          [
                            66.58,
                            0
                          ],
                          [
                            43.32,
                            0
                          ],
                          [
                            21.29,
                            0
                          ],
                          [
                            -17.86,
                            0
                          ],
                          [
                            -41.18,
                            0
                          ],
                          [
                            -63.15,
                            0
                          ],
                          [
                            -107,
                            0
                          ],
                          [
                            -66.58,
                            0
                          ]
                        ],
                        "c": true
                      }
                    ]
                  },
                  {
                    "i": {
                      "x": 0.833,
                      "y": 1
                    },
                    "o": {
                      "x": 0.167,
                      "y": 0
                    },
                    "t": 29,
                    "s": [
                      {
                        "i": [
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ]
                        ],
                        "o": [
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ]
                        ],
                        "v": [
                          [
                            0.098,
                            0
                          ],
                          [
                            -0.003,
                            0
                          ],
                          [
                            -0.098,
                            0
                          ],
                          [
                            -0.311,
                            0
                          ],
                          [
                            -0.5,
                            0
                          ],
                          [
                            -0.311,
                            0
                          ],
                          [
                            -0.202,
                            0
                          ],
                          [
                            -0.099,
                            0
                          ],
                          [
                            0.083,
                            0
                          ],
                          [
                            0.192,
                            0
                          ],
                          [
                            0.295,
                            0
                          ],
                          [
                            0.5,
                            0
                          ],
                          [
                            0.311,
                            0
                          ]
                        ],
                        "c": true
                      }
                    ]
                  },
                  {
                    "i": {
                      "x": 0.11,
                      "y": 1
                    },
                    "o": {
                      "x": 0.61,
                      "y": 0
                    },
                    "t": 123,
                    "s": [
                      {
                        "i": [
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ]
                        ],
                        "o": [
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ]
                        ],
                        "v": [
                          [
                            0.098,
                            0
                          ],
                          [
                            -0.003,
                            0
                          ],
                          [
                            -0.098,
                            0
                          ],
                          [
                            -0.311,
                            0
                          ],
                          [
                            -0.5,
                            0
                          ],
                          [
                            -0.311,
                            0
                          ],
                          [
                            -0.202,
                            0
                          ],
                          [
                            -0.099,
                            0
                          ],
                          [
                            0.083,
                            0
                          ],
                          [
                            0.192,
                            0
                          ],
                          [
                            0.295,
                            0
                          ],
                          [
                            0.5,
                            0
                          ],
                          [
                            0.311,
                            0
                          ]
                        ],
                        "c": true
                      }
                    ]
                  },
                  {
                    "i": {
                      "x": 0.11,
                      "y": 1
                    },
                    "o": {
                      "x": 0.167,
                      "y": 0
                    },
                    "t": 154,
                    "s": [
                      {
                        "i": [
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ]
                        ],
                        "o": [
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ]
                        ],
                        "v": [
                          [
                            -20.83,
                            63
                          ],
                          [
                            0.56,
                            -4.37
                          ],
                          [
                            20.83,
                            63
                          ],
                          [
                            66.27,
                            63
                          ],
                          [
                            106.5,
                            -63
                          ],
                          [
                            66.27,
                            -63
                          ],
                          [
                            43.12,
                            9.56
                          ],
                          [
                            21.19,
                            -63
                          ],
                          [
                            -17.78,
                            -63
                          ],
                          [
                            -40.98,
                            8.59
                          ],
                          [
                            -62.86,
                            -63
                          ],
                          [
                            -106.5,
                            -63
                          ],
                          [
                            -66.27,
                            63
                          ]
                        ],
                        "c": true
                      }
                    ]
                  },
                  {
                    "t": 179,
                    "s": [
                      {
                        "i": [
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ]
                        ],
                        "o": [
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ],
                          [
                            0,
                            0
                          ]
                        ],
                        "v": [
                          [
                            -20.83,
                            63
                          ],
                          [
                            0.56,
                            -4.37
                          ],
                          [
                            20.83,
                            63
                          ],
                          [
                            66.27,
                            63
                          ],
                          [
                            106.5,
                            -63
                          ],
                          [
                            66.27,
                            -63
                          ],
                          [
                            43.12,
                            9.56
                          ],
                          [
                            21.19,
                            -63
                          ],
                          [
                            -17.78,
                            -63
                          ],
                          [
                            -40.98,
                            8.59
                          ],
                          [
                            -62.86,
                            -63
                          ],
                          [
                            -106.5,
                            -63
                          ],
                          [
                            -66.27,
                            63
                          ]
                        ],
                        "c": true
                      }
                    ]
                  }
                ]
              },
              "nm": "Path 1",
              "hd": false
            },
            {
              "ty": "gf",
              "o": {
                "a": 0,
                "k": 100
              },
              "r": 1,
              "bm": 0,
              "g": {
                "p": 3,
                "k": {
                  "a": 0,
                  "k": [
                    0,
                    0.408,
                    1,
                    0.803,
                    0.5,
                    0.427,
                    1,
                    0.896,
                    1,
                    0.446,
                    1,
                    0.989
                  ]
                }
              },
              "s": {
                "a": 0,
                "k": [
                  0,
                  -39.164
                ]
              },
              "e": {
                "a": 0,
                "k": [
                  0,
                  63.759
                ]
              },
              "t": 2,
              "h": {
                "a": 0,
                "k": 0
              },
              "a": {
                "a": 0,
                "k": 0
              },
              "nm": "fdvfd22",
              "hd": false
            },
            {
              "ty": "st",
              "c": {
                "a": 0,
                "k": [
                  0,
                  0.402736991644,
                  0.588172972202,
                  1
                ]
              },
              "o": {
                "a": 0,
                "k": 100
              },
              "w": {
                "a": 1,
                "k": [
                  {
                    "i": {
                      "x": [
                        0.28
                      ],
                      "y": [
                        1
                      ]
                    },
                    "o": {
                      "x": [
                        0.33
                      ],
                      "y": [
                        0
                      ]
                    },
                    "t": 14,
                    "s": [
                      40
                    ]
                  },
                  {
                    "i": {
                      "x": [
                        0.833
                      ],
                      "y": [
                        1
                      ]
                    },
                    "o": {
                      "x": [
                        0.33
                      ],
                      "y": [
                        0
                      ]
                    },
                    "t": 34,
                    "s": [
                      90
                    ]
                  },
                  {
                    "i": {
                      "x": [
                        0.833
                      ],
                      "y": [
                        1
                      ]
                    },
                    "o": {
                      "x": [
                        0.6
                      ],
                      "y": [
                        0
                      ]
                    },
                    "t": 47,
                    "s": [
                      79
                    ]
                  },
                  {
                    "i": {
                      "x": [
                        0.11
                      ],
                      "y": [
                        1
                      ]
                    },
                    "o": {
                      "x": [
                        0.61
                      ],
                      "y": [
                        0
                      ]
                    },
                    "t": 123,
                    "s": [
                      79
                    ]
                  },
                  {
                    "i": {
                      "x": [
                        0.11
                      ],
                      "y": [
                        1
                      ]
                    },
                    "o": {
                      "x": [
                        0.167
                      ],
                      "y": [
                        0
                      ]
                    },
                    "t": 154,
                    "s": [
                      40
                    ]
                  },
                  {
                    "t": 179,
                    "s": [
                      40
                    ]
                  }
                ]
              },
              "lc": 2,
              "lj": 2,
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
          "nm": "Path",
          "bm": 0,
          "hd": false
        }
      ],
      "ip": 29,
      "op": 123,
      "st": 0,
      "bm": 0
    },
    {
      "ddd": 0,
      "ind": 7,
      "ty": 4,
      "nm": "o",
      "sr": 1,
      "ks": {
        "r": {
          "a": 1,
          "k": [
            {
              "i": {
                "x": [
                  0.15
                ],
                "y": [
                  1
                ]
              },
              "o": {
                "x": [
                  0.7
                ],
                "y": [
                  0
                ]
              },
              "t": 0,
              "s": [
                0
              ]
            },
            {
              "i": {
                "x": [
                  0.833
                ],
                "y": [
                  1
                ]
              },
              "o": {
                "x": [
                  0.167
                ],
                "y": [
                  0
                ]
              },
              "t": 8,
              "s": [
                0
              ]
            },
            {
              "i": {
                "x": [
                  0.13
                ],
                "y": [
                  1
                ]
              },
              "o": {
                "x": [
                  0.6
                ],
                "y": [
                  0
                ]
              },
              "t": 47,
              "s": [
                0
              ]
            },
            {
              "i": {
                "x": [
                  0.18
                ],
                "y": [
                  1
                ]
              },
              "o": {
                "x": [
                  0.6
                ],
                "y": [
                  0
                ]
              },
              "t": 81,
              "s": [
                -22
              ]
            },
            {
              "i": {
                "x": [
                  0.28
                ],
                "y": [
                  1
                ]
              },
              "o": {
                "x": [
                  0.61
                ],
                "y": [
                  0
                ]
              },
              "t": 123,
              "s": [
                26
              ]
            },
            {
              "i": {
                "x": [
                  0.2
                ],
                "y": [
                  1
                ]
              },
              "o": {
                "x": [
                  0.72
                ],
                "y": [
                  0
                ]
              },
              "t": 137,
              "s": [
                0
              ]
            },
            {
              "t": 166,
              "s": [
                0
              ]
            }
          ]
        },
        "p": {
          "a": 1,
          "k": [
            {
              "i": {
                "x": 0.15,
                "y": 1
              },
              "o": {
                "x": 0.7,
                "y": 0
              },
              "t": 0,
              "s": [
                257,
                253,
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
              "i": {
                "x": 0.15,
                "y": 1
              },
              "o": {
                "x": 0.7,
                "y": 0
              },
              "t": 8,
              "s": [
                257,
                393,
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
              "i": {
                "x": 0.15,
                "y": 1
              },
              "o": {
                "x": 0.167,
                "y": 0
              },
              "t": 34,
              "s": [
                257,
                293,
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
              "i": {
                "x": 0.13,
                "y": 1
              },
              "o": {
                "x": 0.6,
                "y": 0
              },
              "t": 47,
              "s": [
                257,
                213,
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
              "i": {
                "x": 0.18,
                "y": 1
              },
              "o": {
                "x": 0.6,
                "y": 0
              },
              "t": 81,
              "s": [
                253,
                297,
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
              "i": {
                "x": 0.28,
                "y": 1
              },
              "o": {
                "x": 0.61,
                "y": 0
              },
              "t": 123,
              "s": [
                225,
                219,
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
              "i": {
                "x": 0.2,
                "y": 1
              },
              "o": {
                "x": 0.72,
                "y": 0
              },
              "t": 137,
              "s": [
                257,
                95,
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
              "t": 166,
              "s": [
                257,
                253,
                0
              ]
            }
          ]
        },
        "s": {
          "a": 1,
          "k": [
            {
              "i": {
                "x": [
                  0.833,
                  0.833,
                  0.833
                ],
                "y": [
                  0.833,
                  0.833,
                  1
                ]
              },
              "o": {
                "x": [
                  0.167,
                  0.167,
                  0.167
                ],
                "y": [
                  0,
                  0,
                  0
                ]
              },
              "t": 29,
              "s": [
                100,
                100,
                100
              ]
            },
            {
              "i": {
                "x": [
                  0.833,
                  0.833,
                  0.833
                ],
                "y": [
                  1,
                  1,
                  1
                ]
              },
              "o": {
                "x": [
                  0.167,
                  0.167,
                  0.167
                ],
                "y": [
                  0.167,
                  0.167,
                  0
                ]
              },
              "t": 38,
              "s": [
                95,
                105,
                100
              ]
            },
            {
              "i": {
                "x": [
                  0.818,
                  0.818,
                  0.818
                ],
                "y": [
                  1,
                  1,
                  -0.12
                ]
              },
              "o": {
                "x": [
                  0.533,
                  0.533,
                  0.533
                ],
                "y": [
                  0,
                  0,
                  0
                ]
              },
              "t": 47,
              "s": [
                100,
                100,
                100
              ]
            },
            {
              "i": {
                "x": [
                  0.667,
                  0.667,
                  0.667
                ],
                "y": [
                  1,
                  1,
                  1
                ]
              },
              "o": {
                "x": [
                  0.215,
                  0.215,
                  0.215
                ],
                "y": [
                  0,
                  0,
                  1.584
                ]
              },
              "t": 57,
              "s": [
                105,
                95,
                100
              ]
            },
            {
              "i": {
                "x": [
                  0.833,
                  0.833,
                  0.833
                ],
                "y": [
                  1,
                  1,
                  1
                ]
              },
              "o": {
                "x": [
                  0.333,
                  0.333,
                  0.333
                ],
                "y": [
                  0,
                  0,
                  0
                ]
              },
              "t": 69,
              "s": [
                98,
                102,
                100
              ]
            },
            {
              "i": {
                "x": [
                  0.818,
                  0.818,
                  0.818
                ],
                "y": [
                  1,
                  1,
                  1
                ]
              },
              "o": {
                "x": [
                  0.533,
                  0.533,
                  0.533
                ],
                "y": [
                  0,
                  0,
                  0
                ]
              },
              "t": 81,
              "s": [
                100,
                100,
                100
              ]
            },
            {
              "i": {
                "x": [
                  0.667,
                  0.667,
                  0.667
                ],
                "y": [
                  1,
                  1,
                  1
                ]
              },
              "o": {
                "x": [
                  0.215,
                  0.215,
                  0.215
                ],
                "y": [
                  0,
                  0,
                  0
                ]
              },
              "t": 94,
              "s": [
                105,
                95,
                100
              ]
            },
            {
              "i": {
                "x": [
                  0.089,
                  0.089,
                  0.089
                ],
                "y": [
                  1,
                  1,
                  1
                ]
              },
              "o": {
                "x": [
                  0.333,
                  0.333,
                  0.333
                ],
                "y": [
                  0,
                  0,
                  0
                ]
              },
              "t": 107,
              "s": [
                98,
                102,
                100
              ]
            },
            {
              "i": {
                "x": [
                  0.833,
                  0.833,
                  0.833
                ],
                "y": [
                  1,
                  1,
                  1
                ]
              },
              "o": {
                "x": [
                  0.6,
                  0.6,
                  0.6
                ],
                "y": [
                  0,
                  0,
                  0
                ]
              },
              "t": 123,
              "s": [
                100,
                100,
                100
              ]
            },
            {
              "i": {
                "x": [
                  0.818,
                  0.818,
                  0.818
                ],
                "y": [
                  1,
                  1,
                  1
                ]
              },
              "o": {
                "x": [
                  0.533,
                  0.533,
                  0.533
                ],
                "y": [
                  0,
                  0,
                  0
                ]
              },
              "t": 137,
              "s": [
                100,
                100,
                100
              ]
            },
            {
              "i": {
                "x": [
                  0.667,
                  0.667,
                  0.667
                ],
                "y": [
                  1,
                  1,
                  1
                ]
              },
              "o": {
                "x": [
                  0.215,
                  0.215,
                  0.215
                ],
                "y": [
                  0,
                  0,
                  0
                ]
              },
              "t": 150,
              "s": [
                105,
                95,
                100
              ]
            },
            {
              "i": {
                "x": [
                  0.089,
                  0.089,
                  0.089
                ],
                "y": [
                  1,
                  1,
                  1
                ]
              },
              "o": {
                "x": [
                  0.333,
                  0.333,
                  0.333
                ],
                "y": [
                  0,
                  0,
                  0
                ]
              },
              "t": 163,
              "s": [
                98,
                102,
                100
              ]
            },
            {
              "t": 179,
              "s": [
                100,
                100,
                100
              ]
            }
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
                "a": 1,
                "k": [
                  {
                    "i": {
                      "x": 0.833,
                      "y": 0.833
                    },
                    "o": {
                      "x": 0.7,
                      "y": 0
                    },
                    "t": 0,
                    "s": [
                      {
                        "i": [
                          [
                            -47.76,
                            0
                          ],
                          [
                            0,
                            -40.32
                          ],
                          [
                            46.15,
                            0
                          ],
                          [
                            0,
                            40.32
                          ]
                        ],
                        "o": [
                          [
                            47.76,
                            0
                          ],
                          [
                            0,
                            40.32
                          ],
                          [
                            -46.15,
                            0
                          ],
                          [
                            0,
                            -40.32
                          ]
                        ],
                        "v": [
                          [
                            0,
                            -73
                          ],
                          [
                            76,
                            0
                          ],
                          [
                            0,
                            73
                          ],
                          [
                            -76,
                            0
                          ]
                        ],
                        "c": true
                      }
                    ]
                  },
                  {
                    "i": {
                      "x": 0.15,
                      "y": 1
                    },
                    "o": {
                      "x": 0.167,
                      "y": 0.167
                    },
                    "t": 4,
                    "s": [
                      {
                        "i": [
                          [
                            -47.76,
                            0
                          ],
                          [
                            0,
                            -40.32
                          ],
                          [
                            46.15,
                            0
                          ],
                          [
                            0,
                            40.32
                          ]
                        ],
                        "o": [
                          [
                            47.76,
                            0
                          ],
                          [
                            0,
                            40.32
                          ],
                          [
                            -46.15,
                            0
                          ],
                          [
                            0,
                            -40.32
                          ]
                        ],
                        "v": [
                          [
                            0,
                            -149
                          ],
                          [
                            58,
                            0
                          ],
                          [
                            0,
                            73
                          ],
                          [
                            -58,
                            0
                          ]
                        ],
                        "c": true
                      }
                    ]
                  },
                  {
                    "i": {
                      "x": 0.15,
                      "y": 1
                    },
                    "o": {
                      "x": 0.7,
                      "y": 0
                    },
                    "t": 8,
                    "s": [
                      {
                        "i": [
                          [
                            -47.76,
                            0
                          ],
                          [
                            0,
                            -40.32
                          ],
                          [
                            46.15,
                            0
                          ],
                          [
                            0,
                            40.32
                          ]
                        ],
                        "o": [
                          [
                            47.76,
                            0
                          ],
                          [
                            0,
                            40.32
                          ],
                          [
                            -46.15,
                            0
                          ],
                          [
                            0,
                            -40.32
                          ]
                        ],
                        "v": [
                          [
                            0,
                            -73
                          ],
                          [
                            76,
                            0
                          ],
                          [
                            0,
                            73
                          ],
                          [
                            -76,
                            0
                          ]
                        ],
                        "c": true
                      }
                    ]
                  },
                  {
                    "i": {
                      "x": 0.15,
                      "y": 1
                    },
                    "o": {
                      "x": 0.167,
                      "y": 0
                    },
                    "t": 34,
                    "s": [
                      {
                        "i": [
                          [
                            -124.961,
                            0
                          ],
                          [
                            0,
                            -105.495
                          ],
                          [
                            120.749,
                            0
                          ],
                          [
                            0,
                            105.495
                          ]
                        ],
                        "o": [
                          [
                            124.961,
                            0
                          ],
                          [
                            0,
                            105.495
                          ],
                          [
                            -120.749,
                            0
                          ],
                          [
                            0,
                            -105.495
                          ]
                        ],
                        "v": [
                          [
                            0,
                            -191
                          ],
                          [
                            198.849,
                            0
                          ],
                          [
                            0,
                            191
                          ],
                          [
                            -198.849,
                            0
                          ]
                        ],
                        "c": true
                      }
                    ]
                  },
                  {
                    "i": {
                      "x": 0.833,
                      "y": 0.833
                    },
                    "o": {
                      "x": 0.61,
                      "y": 0
                    },
                    "t": 123,
                    "s": [
                      {
                        "i": [
                          [
                            -124.961,
                            0
                          ],
                          [
                            0,
                            -105.495
                          ],
                          [
                            120.749,
                            0
                          ],
                          [
                            0,
                            105.495
                          ]
                        ],
                        "o": [
                          [
                            124.961,
                            0
                          ],
                          [
                            0,
                            105.495
                          ],
                          [
                            -120.749,
                            0
                          ],
                          [
                            0,
                            -105.495
                          ]
                        ],
                        "v": [
                          [
                            0,
                            -191
                          ],
                          [
                            198.849,
                            0
                          ],
                          [
                            0,
                            191
                          ],
                          [
                            -198.849,
                            0
                          ]
                        ],
                        "c": true
                      }
                    ]
                  },
                  {
                    "i": {
                      "x": 0.28,
                      "y": 1
                    },
                    "o": {
                      "x": 0.167,
                      "y": 0.167
                    },
                    "t": 131,
                    "s": [
                      {
                        "i": [
                          [
                            -68.69,
                            0
                          ],
                          [
                            0,
                            -57.989
                          ],
                          [
                            50.207,
                            0
                          ],
                          [
                            0,
                            57.989
                          ]
                        ],
                        "o": [
                          [
                            68.69,
                            0
                          ],
                          [
                            0,
                            57.989
                          ],
                          [
                            -50.207,
                            0
                          ],
                          [
                            0,
                            -57.989
                          ]
                        ],
                        "v": [
                          [
                            0,
                            -104.991
                          ],
                          [
                            82.594,
                            64.498
                          ],
                          [
                            -0.086,
                            169.489
                          ],
                          [
                            -82.766,
                            64.498
                          ]
                        ],
                        "c": true
                      }
                    ]
                  },
                  {
                    "i": {
                      "x": 0.833,
                      "y": 0.833
                    },
                    "o": {
                      "x": 0.72,
                      "y": 0
                    },
                    "t": 137,
                    "s": [
                      {
                        "i": [
                          [
                            -47.76,
                            0
                          ],
                          [
                            0,
                            -40.32
                          ],
                          [
                            46.15,
                            0
                          ],
                          [
                            0,
                            40.32
                          ]
                        ],
                        "o": [
                          [
                            47.76,
                            0
                          ],
                          [
                            0,
                            40.32
                          ],
                          [
                            -46.15,
                            0
                          ],
                          [
                            0,
                            -40.32
                          ]
                        ],
                        "v": [
                          [
                            0,
                            -73
                          ],
                          [
                            76,
                            0
                          ],
                          [
                            0,
                            73
                          ],
                          [
                            -76,
                            0
                          ]
                        ],
                        "c": true
                      }
                    ]
                  },
                  {
                    "i": {
                      "x": 0.2,
                      "y": 1
                    },
                    "o": {
                      "x": 0.167,
                      "y": 0.167
                    },
                    "t": 153,
                    "s": [
                      {
                        "i": [
                          [
                            -47.76,
                            0
                          ],
                          [
                            0,
                            -40.32
                          ],
                          [
                            34.613,
                            0
                          ],
                          [
                            0,
                            40.32
                          ]
                        ],
                        "o": [
                          [
                            47.76,
                            0
                          ],
                          [
                            0,
                            40.32
                          ],
                          [
                            -34.613,
                            0
                          ],
                          [
                            0,
                            -40.32
                          ]
                        ],
                        "v": [
                          [
                            -1,
                            -157
                          ],
                          [
                            57,
                            0
                          ],
                          [
                            0,
                            73
                          ],
                          [
                            -57,
                            0
                          ]
                        ],
                        "c": true
                      }
                    ]
                  },
                  {
                    "t": 166,
                    "s": [
                      {
                        "i": [
                          [
                            -47.76,
                            0
                          ],
                          [
                            0,
                            -40.32
                          ],
                          [
                            46.15,
                            0
                          ],
                          [
                            0,
                            40.32
                          ]
                        ],
                        "o": [
                          [
                            47.76,
                            0
                          ],
                          [
                            0,
                            40.32
                          ],
                          [
                            -46.15,
                            0
                          ],
                          [
                            0,
                            -40.32
                          ]
                        ],
                        "v": [
                          [
                            0,
                            -73
                          ],
                          [
                            76,
                            0
                          ],
                          [
                            0,
                            73
                          ],
                          [
                            -76,
                            0
                          ]
                        ],
                        "c": true
                      }
                    ]
                  }
                ]
              },
              "nm": "Path 1",
              "hd": false
            },
            {
              "ind": 1,
              "ty": "sh",
              "ks": {
                "a": 1,
                "k": [
                  {
                    "i": {
                      "x": 0.833,
                      "y": 0.833
                    },
                    "o": {
                      "x": 0.7,
                      "y": 0
                    },
                    "t": 0,
                    "s": [
                      {
                        "i": [
                          [
                            25.14,
                            0
                          ],
                          [
                            0,
                            -22.09
                          ],
                          [
                            -24.29,
                            0
                          ],
                          [
                            0,
                            22.09
                          ]
                        ],
                        "o": [
                          [
                            -25.14,
                            0
                          ],
                          [
                            0,
                            22.09
                          ],
                          [
                            24.29,
                            0
                          ],
                          [
                            0,
                            -22.09
                          ]
                        ],
                        "v": [
                          [
                            0,
                            -40
                          ],
                          [
                            -40,
                            0
                          ],
                          [
                            0,
                            40
                          ],
                          [
                            40,
                            0
                          ]
                        ],
                        "c": true
                      }
                    ]
                  },
                  {
                    "i": {
                      "x": 0.15,
                      "y": 1
                    },
                    "o": {
                      "x": 0.167,
                      "y": 0.167
                    },
                    "t": 4,
                    "s": [
                      {
                        "i": [
                          [
                            25.14,
                            0
                          ],
                          [
                            0,
                            -22.09
                          ],
                          [
                            -18.301,
                            0
                          ],
                          [
                            0,
                            22.09
                          ]
                        ],
                        "o": [
                          [
                            -25.14,
                            0
                          ],
                          [
                            0,
                            22.09
                          ],
                          [
                            18.301,
                            0
                          ],
                          [
                            0,
                            -22.09
                          ]
                        ],
                        "v": [
                          [
                            0,
                            -116
                          ],
                          [
                            -23,
                            0
                          ],
                          [
                            0,
                            40
                          ],
                          [
                            23,
                            0
                          ]
                        ],
                        "c": true
                      }
                    ]
                  },
                  {
                    "i": {
                      "x": 0.91,
                      "y": 1
                    },
                    "o": {
                      "x": 0.7,
                      "y": 0
                    },
                    "t": 8,
                    "s": [
                      {
                        "i": [
                          [
                            25.14,
                            0
                          ],
                          [
                            0,
                            -22.09
                          ],
                          [
                            -24.29,
                            0
                          ],
                          [
                            0,
                            22.09
                          ]
                        ],
                        "o": [
                          [
                            -25.14,
                            0
                          ],
                          [
                            0,
                            22.09
                          ],
                          [
                            24.29,
                            0
                          ],
                          [
                            0,
                            -22.09
                          ]
                        ],
                        "v": [
                          [
                            -1,
                            -18
                          ],
                          [
                            -41,
                            22
                          ],
                          [
                            -1,
                            62
                          ],
                          [
                            39,
                            22
                          ]
                        ],
                        "c": true
                      }
                    ]
                  },
                  {
                    "i": {
                      "x": 0.28,
                      "y": 1
                    },
                    "o": {
                      "x": 0.09,
                      "y": 0
                    },
                    "t": 29,
                    "s": [
                      {
                        "i": [
                          [
                            17.091,
                            0
                          ],
                          [
                            0,
                            -16.11
                          ],
                          [
                            -16.513,
                            0
                          ],
                          [
                            0,
                            16.11
                          ]
                        ],
                        "o": [
                          [
                            -17.091,
                            0
                          ],
                          [
                            0,
                            16.11
                          ],
                          [
                            16.513,
                            0
                          ],
                          [
                            0,
                            -16.11
                          ]
                        ],
                        "v": [
                          [
                            0,
                            68.829
                          ],
                          [
                            -27.193,
                            98
                          ],
                          [
                            0,
                            127.171
                          ],
                          [
                            27.193,
                            98
                          ]
                        ],
                        "c": true
                      }
                    ]
                  },
                  {
                    "i": {
                      "x": 0.13,
                      "y": 1
                    },
                    "o": {
                      "x": 0.6,
                      "y": 0
                    },
                    "t": 47,
                    "s": [
                      {
                        "i": [
                          [
                            42.77,
                            0
                          ],
                          [
                            0,
                            -40.314
                          ],
                          [
                            -41.324,
                            0
                          ],
                          [
                            0,
                            40.314
                          ]
                        ],
                        "o": [
                          [
                            -42.77,
                            0
                          ],
                          [
                            0,
                            40.314
                          ],
                          [
                            41.324,
                            0
                          ],
                          [
                            0,
                            -40.314
                          ]
                        ],
                        "v": [
                          [
                            1,
                            -137
                          ],
                          [
                            -67.051,
                            -64
                          ],
                          [
                            1,
                            9
                          ],
                          [
                            69.051,
                            -64
                          ]
                        ],
                        "c": true
                      }
                    ]
                  },
                  {
                    "i": {
                      "x": 0.667,
                      "y": 1
                    },
                    "o": {
                      "x": 0.6,
                      "y": 0
                    },
                    "t": 81,
                    "s": [
                      {
                        "i": [
                          [
                            18.916,
                            0
                          ],
                          [
                            0,
                            -16.615
                          ],
                          [
                            -18.276,
                            0
                          ],
                          [
                            0,
                            16.615
                          ]
                        ],
                        "o": [
                          [
                            -18.916,
                            0
                          ],
                          [
                            0,
                            16.615
                          ],
                          [
                            18.276,
                            0
                          ],
                          [
                            0,
                            -16.615
                          ]
                        ],
                        "v": [
                          [
                            37.837,
                            58.341
                          ],
                          [
                            7.74,
                            88.426
                          ],
                          [
                            37.837,
                            118.512
                          ],
                          [
                            67.933,
                            88.426
                          ]
                        ],
                        "c": true
                      }
                    ]
                  },
                  {
                    "i": {
                      "x": 0.18,
                      "y": 1
                    },
                    "o": {
                      "x": 0.333,
                      "y": 0
                    },
                    "t": 94,
                    "s": [
                      {
                        "i": [
                          [
                            40.244,
                            0
                          ],
                          [
                            0,
                            -35.349
                          ],
                          [
                            -38.884,
                            0
                          ],
                          [
                            0,
                            35.349
                          ]
                        ],
                        "o": [
                          [
                            -40.244,
                            0
                          ],
                          [
                            0,
                            35.349
                          ],
                          [
                            38.884,
                            0
                          ],
                          [
                            0,
                            -35.349
                          ]
                        ],
                        "v": [
                          [
                            18.718,
                            -9.357
                          ],
                          [
                            -45.314,
                            54.652
                          ],
                          [
                            18.718,
                            118.661
                          ],
                          [
                            82.75,
                            54.652
                          ]
                        ],
                        "c": true
                      }
                    ]
                  },
                  {
                    "i": {
                      "x": 0.833,
                      "y": 0.833
                    },
                    "o": {
                      "x": 0.61,
                      "y": 0
                    },
                    "t": 123,
                    "s": [
                      {
                        "i": [
                          [
                            18.916,
                            0
                          ],
                          [
                            0,
                            -16.615
                          ],
                          [
                            -18.276,
                            0
                          ],
                          [
                            0,
                            16.615
                          ]
                        ],
                        "o": [
                          [
                            -18.916,
                            0
                          ],
                          [
                            0,
                            16.615
                          ],
                          [
                            18.276,
                            0
                          ],
                          [
                            0,
                            -16.615
                          ]
                        ],
                        "v": [
                          [
                            -5.692,
                            -62.842
                          ],
                          [
                            -35.788,
                            -32.757
                          ],
                          [
                            -5.692,
                            -2.671
                          ],
                          [
                            24.405,
                            -32.757
                          ]
                        ],
                        "c": true
                      }
                    ]
                  },
                  {
                    "i": {
                      "x": 0.28,
                      "y": 1
                    },
                    "o": {
                      "x": 0.167,
                      "y": 0.167
                    },
                    "t": 131,
                    "s": [
                      {
                        "i": [
                          [
                            23.453,
                            0
                          ],
                          [
                            0,
                            -20.606
                          ],
                          [
                            -17.869,
                            0
                          ],
                          [
                            0,
                            20.606
                          ]
                        ],
                        "o": [
                          [
                            -23.453,
                            0
                          ],
                          [
                            0,
                            20.606
                          ],
                          [
                            17.869,
                            0
                          ],
                          [
                            0,
                            -20.606
                          ]
                        ],
                        "v": [
                          [
                            -1.543,
                            -46.193
                          ],
                          [
                            -27.576,
                            51.157
                          ],
                          [
                            1.85,
                            88.469
                          ],
                          [
                            31.276,
                            51.157
                          ]
                        ],
                        "c": true
                      }
                    ]
                  },
                  {
                    "i": {
                      "x": 0.833,
                      "y": 0.833
                    },
                    "o": {
                      "x": 0.72,
                      "y": 0
                    },
                    "t": 137,
                    "s": [
                      {
                        "i": [
                          [
                            25.14,
                            0
                          ],
                          [
                            0,
                            -22.09
                          ],
                          [
                            -24.29,
                            0
                          ],
                          [
                            0,
                            22.09
                          ]
                        ],
                        "o": [
                          [
                            -25.14,
                            0
                          ],
                          [
                            0,
                            22.09
                          ],
                          [
                            24.29,
                            0
                          ],
                          [
                            0,
                            -22.09
                          ]
                        ],
                        "v": [
                          [
                            0,
                            -40
                          ],
                          [
                            -40,
                            0
                          ],
                          [
                            0,
                            40
                          ],
                          [
                            40,
                            0
                          ]
                        ],
                        "c": true
                      }
                    ]
                  },
                  {
                    "i": {
                      "x": 0.2,
                      "y": 1
                    },
                    "o": {
                      "x": 0.167,
                      "y": 0.167
                    },
                    "t": 153,
                    "s": [
                      {
                        "i": [
                          [
                            18.855,
                            0
                          ],
                          [
                            0,
                            -22.09
                          ],
                          [
                            -18.217,
                            0
                          ],
                          [
                            0,
                            22.09
                          ]
                        ],
                        "o": [
                          [
                            -18.855,
                            0
                          ],
                          [
                            0,
                            22.09
                          ],
                          [
                            18.217,
                            0
                          ],
                          [
                            0,
                            -22.09
                          ]
                        ],
                        "v": [
                          [
                            -0.75,
                            -124
                          ],
                          [
                            -30,
                            0
                          ],
                          [
                            0,
                            40
                          ],
                          [
                            30,
                            0
                          ]
                        ],
                        "c": true
                      }
                    ]
                  },
                  {
                    "t": 166,
                    "s": [
                      {
                        "i": [
                          [
                            25.14,
                            0
                          ],
                          [
                            0,
                            -22.09
                          ],
                          [
                            -24.29,
                            0
                          ],
                          [
                            0,
                            22.09
                          ]
                        ],
                        "o": [
                          [
                            -25.14,
                            0
                          ],
                          [
                            0,
                            22.09
                          ],
                          [
                            24.29,
                            0
                          ],
                          [
                            0,
                            -22.09
                          ]
                        ],
                        "v": [
                          [
                            0,
                            -40
                          ],
                          [
                            -40,
                            0
                          ],
                          [
                            0,
                            40
                          ],
                          [
                            40,
                            0
                          ]
                        ],
                        "c": true
                      }
                    ]
                  }
                ]
              },
              "nm": "Path 2",
              "hd": false
            },
            {
              "ty": "mm",
              "mm": 1,
              "nm": "Merge Paths 1",
              "hd": false
            },
            {
              "ty": "gf",
              "o": {
                "a": 0,
                "k": 100
              },
              "r": 1,
              "bm": 0,
              "g": {
                "p": 3,
                "k": {
                  "a": 0,
                  "k": [
                    0,
                    0.408,
                    1,
                    0.803,
                    0.5,
                    0.427,
                    1,
                    0.896,
                    1,
                    0.446,
                    1,
                    0.989
                  ]
                }
              },
              "s": {
                "a": 0,
                "k": [
                  0,
                  -39.164
                ]
              },
              "e": {
                "a": 0,
                "k": [
                  0,
                  63.759
                ]
              },
              "t": 2,
              "h": {
                "a": 0,
                "k": 0
              },
              "a": {
                "a": 0,
                "k": 0
              },
              "nm": "fdvfd22",
              "hd": false
            },
            {
              "ty": "st",
              "c": {
                "a": 0,
                "k": [
                  0,
                  0.402736991644,
                  0.588172972202,
                  1
                ]
              },
              "o": {
                "a": 0,
                "k": 100
              },
              "w": {
                "a": 0,
                "k": 40
              },
              "lc": 2,
              "lj": 2,
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
          "nm": "Shape",
          "bm": 0,
          "hd": false
        }
      ],
      "ip": 0,
      "op": 180,
      "st": 0,
      "bm": 0
    },
    {
      "ddd": 0,
      "ind": 8,
      "ty": 4,
      "nm": "Shape Layer 30",
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
              "t": 125,
              "s": [
                50,
                34.465,
                0
              ],
              "to": [
                0,
                30,
                0
              ],
              "ti": [
                0,
                -30,
                0
              ]
            },
            {
              "t": 138,
              "s": [
                50,
                214.465,
                0
              ]
            }
          ]
        },
        "a": {
          "a": 0,
          "k": [
            -206,
            208,
            0
          ]
        },
        "s": {
          "a": 0,
          "k": [
            -100,
            100,
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
                      0
                    ],
                    [
                      0,
                      0
                    ]
                  ],
                  "o": [
                    [
                      0,
                      0
                    ],
                    [
                      0,
                      0
                    ]
                  ],
                  "v": [
                    [
                      -206,
                      208
                    ],
                    [
                      -206,
                      -52
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
                  0.062745098039,
                  0.850980451995,
                  0.588235294118,
                  1
                ]
              },
              "o": {
                "a": 0,
                "k": 100
              },
              "w": {
                "a": 0,
                "k": 30
              },
              "lc": 1,
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
                "t": 129,
                "s": [
                  0
                ]
              },
              {
                "t": 138,
                "s": [
                  100
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
                "t": 125,
                "s": [
                  0
                ]
              },
              {
                "t": 132,
                "s": [
                  100
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
      "ip": 125,
      "op": 139,
      "st": 125,
      "bm": 0
    },
    {
      "ddd": 0,
      "ind": 9,
      "ty": 4,
      "nm": "Shape Layer 29",
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
              "t": 126,
              "s": [
                156,
                -19.535,
                0
              ],
              "to": [
                0,
                30,
                0
              ],
              "ti": [
                0,
                -30,
                0
              ]
            },
            {
              "t": 143,
              "s": [
                156,
                160.465,
                0
              ]
            }
          ]
        },
        "a": {
          "a": 0,
          "k": [
            -206,
            208,
            0
          ]
        },
        "s": {
          "a": 0,
          "k": [
            -100,
            100,
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
                      0
                    ],
                    [
                      0,
                      0
                    ]
                  ],
                  "o": [
                    [
                      0,
                      0
                    ],
                    [
                      0,
                      0
                    ]
                  ],
                  "v": [
                    [
                      -206,
                      208
                    ],
                    [
                      -206,
                      -52
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
                  0.062745098039,
                  0.850980451995,
                  0.588235294118,
                  1
                ]
              },
              "o": {
                "a": 0,
                "k": 100
              },
              "w": {
                "a": 0,
                "k": 30
              },
              "lc": 1,
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
                "t": 131.23,
                "s": [
                  0
                ]
              },
              {
                "t": 143,
                "s": [
                  100
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
                "t": 126,
                "s": [
                  0
                ]
              },
              {
                "t": 135.154296875,
                "s": [
                  100
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
      "ip": 126,
      "op": 143,
      "st": 126,
      "bm": 0
    },
    {
      "ddd": 0,
      "ind": 10,
      "ty": 4,
      "nm": "Shape Layer 28",
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
              "t": 127,
              "s": [
                422,
                -115.535,
                0
              ],
              "to": [
                0,
                30,
                0
              ],
              "ti": [
                0,
                -30,
                0
              ]
            },
            {
              "t": 140,
              "s": [
                422,
                64.465,
                0
              ]
            }
          ]
        },
        "a": {
          "a": 0,
          "k": [
            -206,
            208,
            0
          ]
        },
        "s": {
          "a": 0,
          "k": [
            -100,
            100,
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
                      0
                    ],
                    [
                      0,
                      0
                    ]
                  ],
                  "o": [
                    [
                      0,
                      0
                    ],
                    [
                      0,
                      0
                    ]
                  ],
                  "v": [
                    [
                      -206,
                      208
                    ],
                    [
                      -206,
                      -52
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
                  0.062745098039,
                  0.850980451995,
                  0.588235294118,
                  1
                ]
              },
              "o": {
                "a": 0,
                "k": 100
              },
              "w": {
                "a": 0,
                "k": 30
              },
              "lc": 1,
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
                "t": 131,
                "s": [
                  0
                ]
              },
              {
                "t": 140,
                "s": [
                  100
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
                "t": 127,
                "s": [
                  0
                ]
              },
              {
                "t": 134,
                "s": [
                  100
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
      "ip": 127,
      "op": 141,
      "st": 127,
      "bm": 0
    },
    {
      "ddd": 0,
      "ind": 11,
      "ty": 4,
      "nm": "Shape Layer 27",
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
              "t": 125,
              "s": [
                322,
                26.465,
                0
              ],
              "to": [
                0,
                30,
                0
              ],
              "ti": [
                0,
                -30,
                0
              ]
            },
            {
              "t": 140,
              "s": [
                322,
                206.465,
                0
              ]
            }
          ]
        },
        "a": {
          "a": 0,
          "k": [
            -206,
            208,
            0
          ]
        },
        "s": {
          "a": 0,
          "k": [
            -100,
            100,
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
                      0
                    ],
                    [
                      0,
                      0
                    ]
                  ],
                  "o": [
                    [
                      0,
                      0
                    ],
                    [
                      0,
                      0
                    ]
                  ],
                  "v": [
                    [
                      -206,
                      208
                    ],
                    [
                      -206,
                      -52
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
                  0.062745098039,
                  0.850980451995,
                  0.588235294118,
                  1
                ]
              },
              "o": {
                "a": 0,
                "k": 100
              },
              "w": {
                "a": 0,
                "k": 30
              },
              "lc": 1,
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
                "t": 129.615,
                "s": [
                  0
                ]
              },
              {
                "t": 140,
                "s": [
                  100
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
                "t": 125,
                "s": [
                  0
                ]
              },
              {
                "t": 133.076171875,
                "s": [
                  100
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
      "ip": 125,
      "op": 145,
      "st": 125,
      "bm": 0
    },
    {
      "ddd": 0,
      "ind": 12,
      "ty": 4,
      "nm": "Shape Layer 26",
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
              "t": 130,
              "s": [
                222,
                -35.535,
                0
              ],
              "to": [
                0,
                30,
                0
              ],
              "ti": [
                0,
                -30,
                0
              ]
            },
            {
              "t": 145,
              "s": [
                222,
                144.465,
                0
              ]
            }
          ]
        },
        "a": {
          "a": 0,
          "k": [
            -206,
            208,
            0
          ]
        },
        "s": {
          "a": 0,
          "k": [
            -100,
            100,
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
                      0
                    ],
                    [
                      0,
                      0
                    ]
                  ],
                  "o": [
                    [
                      0,
                      0
                    ],
                    [
                      0,
                      0
                    ]
                  ],
                  "v": [
                    [
                      -206,
                      208
                    ],
                    [
                      -206,
                      -52
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
                  0.062745098039,
                  0.850980451995,
                  0.588235294118,
                  1
                ]
              },
              "o": {
                "a": 0,
                "k": 100
              },
              "w": {
                "a": 0,
                "k": 30
              },
              "lc": 1,
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
                "t": 134.615,
                "s": [
                  0
                ]
              },
              {
                "t": 145,
                "s": [
                  100
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
                "t": 130,
                "s": [
                  0
                ]
              },
              {
                "t": 138.076171875,
                "s": [
                  100
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
      "ip": 130,
      "op": 145,
      "st": 130,
      "bm": 0
    },
    {
      "ddd": 0,
      "ind": 13,
      "ty": 4,
      "nm": "Shape Layer 6",
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
              "t": 121,
              "s": [
                50,
                34.465,
                0
              ],
              "to": [
                0,
                30,
                0
              ],
              "ti": [
                0,
                -30,
                0
              ]
            },
            {
              "t": 134,
              "s": [
                50,
                214.465,
                0
              ]
            }
          ]
        },
        "a": {
          "a": 0,
          "k": [
            -206,
            208,
            0
          ]
        },
        "s": {
          "a": 0,
          "k": [
            -100,
            100,
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
                      0
                    ],
                    [
                      0,
                      0
                    ]
                  ],
                  "o": [
                    [
                      0,
                      0
                    ],
                    [
                      0,
                      0
                    ]
                  ],
                  "v": [
                    [
                      -206,
                      208
                    ],
                    [
                      -206,
                      -52
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
                  0.435294117647,
                  0.454901960784,
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
                "k": 30
              },
              "lc": 1,
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
                "t": 125,
                "s": [
                  0
                ]
              },
              {
                "t": 134,
                "s": [
                  100
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
                "t": 121,
                "s": [
                  0
                ]
              },
              {
                "t": 128,
                "s": [
                  100
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
      "ip": 121,
      "op": 135,
      "st": 121,
      "bm": 0
    },
    {
      "ddd": 0,
      "ind": 14,
      "ty": 4,
      "nm": "Shape Layer 7",
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
              "t": 122,
              "s": [
                156,
                -19.535,
                0
              ],
              "to": [
                0,
                30,
                0
              ],
              "ti": [
                0,
                -30,
                0
              ]
            },
            {
              "t": 139,
              "s": [
                156,
                160.465,
                0
              ]
            }
          ]
        },
        "a": {
          "a": 0,
          "k": [
            -206,
            208,
            0
          ]
        },
        "s": {
          "a": 0,
          "k": [
            -100,
            100,
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
                      0
                    ],
                    [
                      0,
                      0
                    ]
                  ],
                  "o": [
                    [
                      0,
                      0
                    ],
                    [
                      0,
                      0
                    ]
                  ],
                  "v": [
                    [
                      -206,
                      208
                    ],
                    [
                      -206,
                      -52
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
                  0.435294117647,
                  0.454901960784,
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
                "k": 30
              },
              "lc": 1,
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
                "t": 127.23,
                "s": [
                  0
                ]
              },
              {
                "t": 139,
                "s": [
                  100
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
                "t": 122,
                "s": [
                  0
                ]
              },
              {
                "t": 131.154296875,
                "s": [
                  100
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
      "ip": 122,
      "op": 139,
      "st": 122,
      "bm": 0
    },
    {
      "ddd": 0,
      "ind": 15,
      "ty": 4,
      "nm": "Shape Layer 8",
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
              "t": 123,
              "s": [
                422,
                -115.535,
                0
              ],
              "to": [
                0,
                30,
                0
              ],
              "ti": [
                0,
                -30,
                0
              ]
            },
            {
              "t": 136,
              "s": [
                422,
                64.465,
                0
              ]
            }
          ]
        },
        "a": {
          "a": 0,
          "k": [
            -206,
            208,
            0
          ]
        },
        "s": {
          "a": 0,
          "k": [
            -100,
            100,
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
                      0
                    ],
                    [
                      0,
                      0
                    ]
                  ],
                  "o": [
                    [
                      0,
                      0
                    ],
                    [
                      0,
                      0
                    ]
                  ],
                  "v": [
                    [
                      -206,
                      208
                    ],
                    [
                      -206,
                      -52
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
                  0.435294117647,
                  0.454901960784,
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
                "k": 30
              },
              "lc": 1,
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
                "t": 127,
                "s": [
                  0
                ]
              },
              {
                "t": 136,
                "s": [
                  100
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
                "t": 123,
                "s": [
                  0
                ]
              },
              {
                "t": 130,
                "s": [
                  100
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
      "ip": 123,
      "op": 137,
      "st": 123,
      "bm": 0
    },
    {
      "ddd": 0,
      "ind": 16,
      "ty": 4,
      "nm": "Shape Layer 9",
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
              "t": 121,
              "s": [
                322,
                26.465,
                0
              ],
              "to": [
                0,
                30,
                0
              ],
              "ti": [
                0,
                -30,
                0
              ]
            },
            {
              "t": 136,
              "s": [
                322,
                206.465,
                0
              ]
            }
          ]
        },
        "a": {
          "a": 0,
          "k": [
            -206,
            208,
            0
          ]
        },
        "s": {
          "a": 0,
          "k": [
            -100,
            100,
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
                      0
                    ],
                    [
                      0,
                      0
                    ]
                  ],
                  "o": [
                    [
                      0,
                      0
                    ],
                    [
                      0,
                      0
                    ]
                  ],
                  "v": [
                    [
                      -206,
                      208
                    ],
                    [
                      -206,
                      -52
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
                  0.435294117647,
                  0.454901960784,
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
                "k": 30
              },
              "lc": 1,
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
                "t": 125.615,
                "s": [
                  0
                ]
              },
              {
                "t": 136,
                "s": [
                  100
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
                "t": 121,
                "s": [
                  0
                ]
              },
              {
                "t": 129.076171875,
                "s": [
                  100
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
      "ip": 121,
      "op": 141,
      "st": 121,
      "bm": 0
    },
    {
      "ddd": 0,
      "ind": 17,
      "ty": 4,
      "nm": "Shape Layer 10",
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
              "t": 126,
              "s": [
                222,
                -35.535,
                0
              ],
              "to": [
                0,
                30,
                0
              ],
              "ti": [
                0,
                -30,
                0
              ]
            },
            {
              "t": 141,
              "s": [
                222,
                144.465,
                0
              ]
            }
          ]
        },
        "a": {
          "a": 0,
          "k": [
            -206,
            208,
            0
          ]
        },
        "s": {
          "a": 0,
          "k": [
            -100,
            100,
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
                      0
                    ],
                    [
                      0,
                      0
                    ]
                  ],
                  "o": [
                    [
                      0,
                      0
                    ],
                    [
                      0,
                      0
                    ]
                  ],
                  "v": [
                    [
                      -206,
                      208
                    ],
                    [
                      -206,
                      -52
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
                  0.435294117647,
                  0.454901960784,
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
                "k": 30
              },
              "lc": 1,
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
                "t": 130.615,
                "s": [
                  0
                ]
              },
              {
                "t": 141,
                "s": [
                  100
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
                "t": 126,
                "s": [
                  0
                ]
              },
              {
                "t": 134.076171875,
                "s": [
                  100
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
      "ip": 126,
      "op": 141,
      "st": 126,
      "bm": 0
    },
    {
      "ddd": 0,
      "ind": 18,
      "ty": 4,
      "nm": "Shape Layer 25",
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
              "t": 14,
              "s": [
                250,
                336.592,
                0
              ],
              "to": [
                0,
                -30,
                0
              ],
              "ti": [
                0,
                30,
                0
              ]
            },
            {
              "t": 29,
              "s": [
                250,
                156.592,
                0
              ]
            }
          ]
        },
        "a": {
          "a": 0,
          "k": [
            -206,
            10.592,
            0
          ]
        },
        "s": {
          "a": 0,
          "k": [
            -100,
            100,
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
                      0
                    ],
                    [
                      0,
                      0
                    ]
                  ],
                  "o": [
                    [
                      0,
                      0
                    ],
                    [
                      0,
                      0
                    ]
                  ],
                  "v": [
                    [
                      -206,
                      208
                    ],
                    [
                      -206,
                      -52
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
                  0.435232813218,
                  0.455944345512,
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
                "k": 30
              },
              "lc": 1,
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
                "t": 18.615,
                "s": [
                  0
                ]
              },
              {
                "t": 29,
                "s": [
                  100
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
                "t": 14,
                "s": [
                  0
                ]
              },
              {
                "t": 22.076171875,
                "s": [
                  100
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
      "ip": 14,
      "op": 29,
      "st": 14,
      "bm": 0
    },
    {
      "ddd": 0,
      "ind": 19,
      "ty": 4,
      "nm": "Shape Layer 24",
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
              "t": 9,
              "s": [
                150,
                274.592,
                0
              ],
              "to": [
                0,
                -30,
                0
              ],
              "ti": [
                0,
                30,
                0
              ]
            },
            {
              "t": 24,
              "s": [
                150,
                94.592,
                0
              ]
            }
          ]
        },
        "a": {
          "a": 0,
          "k": [
            -206,
            10.592,
            0
          ]
        },
        "s": {
          "a": 0,
          "k": [
            -100,
            100,
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
                      0
                    ],
                    [
                      0,
                      0
                    ]
                  ],
                  "o": [
                    [
                      0,
                      0
                    ],
                    [
                      0,
                      0
                    ]
                  ],
                  "v": [
                    [
                      -206,
                      208
                    ],
                    [
                      -206,
                      -52
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
                  0.435232813218,
                  0.455944345512,
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
                "k": 30
              },
              "lc": 1,
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
                "t": 13.615,
                "s": [
                  0
                ]
              },
              {
                "t": 24,
                "s": [
                  100
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
                "t": 9,
                "s": [
                  0
                ]
              },
              {
                "t": 17.076171875,
                "s": [
                  100
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
      "ip": 9,
      "op": 29,
      "st": 9,
      "bm": 0
    },
    {
      "ddd": 0,
      "ind": 20,
      "ty": 4,
      "nm": "Shape Layer 23",
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
              "t": 11,
              "s": [
                50,
                397.333,
                0
              ],
              "to": [
                0,
                -30,
                0
              ],
              "ti": [
                0,
                30,
                0
              ]
            },
            {
              "t": 24,
              "s": [
                50,
                217.333,
                0
              ]
            }
          ]
        },
        "a": {
          "a": 0,
          "k": [
            -206,
            -8.667,
            0
          ]
        },
        "s": {
          "a": 0,
          "k": [
            -100,
            100,
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
                      0
                    ],
                    [
                      0,
                      0
                    ]
                  ],
                  "o": [
                    [
                      0,
                      0
                    ],
                    [
                      0,
                      0
                    ]
                  ],
                  "v": [
                    [
                      -206,
                      208
                    ],
                    [
                      -206,
                      -52
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
                  0.435232813218,
                  0.455944345512,
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
                "k": 30
              },
              "lc": 1,
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
                "t": 15,
                "s": [
                  0
                ]
              },
              {
                "t": 24,
                "s": [
                  100
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
                "t": 11,
                "s": [
                  0
                ]
              },
              {
                "t": 18,
                "s": [
                  100
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
      "ip": 11,
      "op": 25,
      "st": 11,
      "bm": 0
    },
    {
      "ddd": 0,
      "ind": 21,
      "ty": 4,
      "nm": "Shape Layer 22",
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
              "t": 10,
              "s": [
                316,
                335.318,
                0
              ],
              "to": [
                0,
                -30,
                0
              ],
              "ti": [
                0,
                30,
                0
              ]
            },
            {
              "t": 27,
              "s": [
                316,
                155.318,
                0
              ]
            }
          ]
        },
        "a": {
          "a": 0,
          "k": [
            -206,
            25.318,
            0
          ]
        },
        "s": {
          "a": 0,
          "k": [
            -100,
            100,
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
                      0
                    ],
                    [
                      0,
                      0
                    ]
                  ],
                  "o": [
                    [
                      0,
                      0
                    ],
                    [
                      0,
                      0
                    ]
                  ],
                  "v": [
                    [
                      -206,
                      208
                    ],
                    [
                      -206,
                      -52
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
                  0.435232813218,
                  0.455944345512,
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
                "k": 30
              },
              "lc": 1,
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
                "t": 15.23,
                "s": [
                  0
                ]
              },
              {
                "t": 27,
                "s": [
                  100
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
                "t": 10,
                "s": [
                  0
                ]
              },
              {
                "t": 19.154296875,
                "s": [
                  100
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
      "ip": 10,
      "op": 27,
      "st": 10,
      "bm": 0
    },
    {
      "ddd": 0,
      "ind": 22,
      "ty": 4,
      "nm": "Shape Layer 21",
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
              "t": 9,
              "s": [
                422,
                247.333,
                0
              ],
              "to": [
                0,
                -30,
                0
              ],
              "ti": [
                0,
                30,
                0
              ]
            },
            {
              "t": 22,
              "s": [
                422,
                67.333,
                0
              ]
            }
          ]
        },
        "a": {
          "a": 0,
          "k": [
            -206,
            -8.667,
            0
          ]
        },
        "s": {
          "a": 0,
          "k": [
            -100,
            100,
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
                      0
                    ],
                    [
                      0,
                      0
                    ]
                  ],
                  "o": [
                    [
                      0,
                      0
                    ],
                    [
                      0,
                      0
                    ]
                  ],
                  "v": [
                    [
                      -206,
                      208
                    ],
                    [
                      -206,
                      -52
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
                  0.435232813218,
                  0.455944345512,
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
                "k": 30
              },
              "lc": 1,
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
                "t": 13,
                "s": [
                  0
                ]
              },
              {
                "t": 22,
                "s": [
                  100
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
                "t": 9,
                "s": [
                  0
                ]
              },
              {
                "t": 16,
                "s": [
                  100
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
      "ip": 9,
      "op": 23,
      "st": 9,
      "bm": 0
    },
    {
      "ddd": 0,
      "ind": 23,
      "ty": 4,
      "nm": "Shape Layer 20",
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
              "t": 7,
              "s": [
                222,
                336.592,
                0
              ],
              "to": [
                0,
                -30,
                0
              ],
              "ti": [
                0,
                30,
                0
              ]
            },
            {
              "t": 22,
              "s": [
                222,
                156.592,
                0
              ]
            }
          ]
        },
        "a": {
          "a": 0,
          "k": [
            -206,
            10.592,
            0
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
                      0
                    ],
                    [
                      0,
                      0
                    ]
                  ],
                  "o": [
                    [
                      0,
                      0
                    ],
                    [
                      0,
                      0
                    ]
                  ],
                  "v": [
                    [
                      -206,
                      208
                    ],
                    [
                      -206,
                      -52
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
                  0.435232813218,
                  0.455944345512,
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
                "k": 30
              },
              "lc": 1,
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
                "t": 11.615,
                "s": [
                  0
                ]
              },
              {
                "t": 22,
                "s": [
                  100
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
                "t": 7,
                "s": [
                  0
                ]
              },
              {
                "t": 15.076171875,
                "s": [
                  100
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
      "ip": 7,
      "op": 22,
      "st": 7,
      "bm": 0
    },
    {
      "ddd": 0,
      "ind": 24,
      "ty": 4,
      "nm": "Shape Layer 19",
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
              "t": 2,
              "s": [
                322,
                274.592,
                0
              ],
              "to": [
                0,
                -30,
                0
              ],
              "ti": [
                0,
                30,
                0
              ]
            },
            {
              "t": 17,
              "s": [
                322,
                94.592,
                0
              ]
            }
          ]
        },
        "a": {
          "a": 0,
          "k": [
            -206,
            10.592,
            0
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
                      0
                    ],
                    [
                      0,
                      0
                    ]
                  ],
                  "o": [
                    [
                      0,
                      0
                    ],
                    [
                      0,
                      0
                    ]
                  ],
                  "v": [
                    [
                      -206,
                      208
                    ],
                    [
                      -206,
                      -52
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
                  0.435232813218,
                  0.455944345512,
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
                "k": 30
              },
              "lc": 1,
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
                "t": 6.615,
                "s": [
                  0
                ]
              },
              {
                "t": 17,
                "s": [
                  100
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
                "t": 2,
                "s": [
                  0
                ]
              },
              {
                "t": 10.076171875,
                "s": [
                  100
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
      "ip": 2,
      "op": 22,
      "st": 2,
      "bm": 0
    },
    {
      "ddd": 0,
      "ind": 25,
      "ty": 4,
      "nm": "Shape Layer 18",
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
              "t": 4,
              "s": [
                422,
                397.333,
                0
              ],
              "to": [
                0,
                -30,
                0
              ],
              "ti": [
                0,
                30,
                0
              ]
            },
            {
              "t": 17,
              "s": [
                422,
                217.333,
                0
              ]
            }
          ]
        },
        "a": {
          "a": 0,
          "k": [
            -206,
            -8.667,
            0
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
                      0
                    ],
                    [
                      0,
                      0
                    ]
                  ],
                  "o": [
                    [
                      0,
                      0
                    ],
                    [
                      0,
                      0
                    ]
                  ],
                  "v": [
                    [
                      -206,
                      208
                    ],
                    [
                      -206,
                      -52
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
                  0.435232813218,
                  0.455944345512,
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
                "k": 30
              },
              "lc": 1,
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
                "t": 8,
                "s": [
                  0
                ]
              },
              {
                "t": 17,
                "s": [
                  100
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
                "t": 4,
                "s": [
                  0
                ]
              },
              {
                "t": 11,
                "s": [
                  100
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
      "ip": 4,
      "op": 18,
      "st": 4,
      "bm": 0
    },
    {
      "ddd": 0,
      "ind": 26,
      "ty": 4,
      "nm": "Shape Layer 17",
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
              "t": 3,
              "s": [
                156,
                335.318,
                0
              ],
              "to": [
                0,
                -30,
                0
              ],
              "ti": [
                0,
                30,
                0
              ]
            },
            {
              "t": 20,
              "s": [
                156,
                155.318,
                0
              ]
            }
          ]
        },
        "a": {
          "a": 0,
          "k": [
            -206,
            25.318,
            0
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
                      0
                    ],
                    [
                      0,
                      0
                    ]
                  ],
                  "o": [
                    [
                      0,
                      0
                    ],
                    [
                      0,
                      0
                    ]
                  ],
                  "v": [
                    [
                      -206,
                      208
                    ],
                    [
                      -206,
                      -52
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
                  0.435232813218,
                  0.455944345512,
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
                "k": 30
              },
              "lc": 1,
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
                "t": 8.23,
                "s": [
                  0
                ]
              },
              {
                "t": 20,
                "s": [
                  100
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
                "t": 3,
                "s": [
                  0
                ]
              },
              {
                "t": 12.154296875,
                "s": [
                  100
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
      "ip": 3,
      "op": 20,
      "st": 3,
      "bm": 0
    },
    {
      "ddd": 0,
      "ind": 27,
      "ty": 4,
      "nm": "Shape Layer 16",
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
              "t": 2,
              "s": [
                50,
                247.333,
                0
              ],
              "to": [
                0,
                -30,
                0
              ],
              "ti": [
                0,
                30,
                0
              ]
            },
            {
              "t": 15,
              "s": [
                50,
                67.333,
                0
              ]
            }
          ]
        },
        "a": {
          "a": 0,
          "k": [
            -206,
            -8.667,
            0
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
                      0
                    ],
                    [
                      0,
                      0
                    ]
                  ],
                  "o": [
                    [
                      0,
                      0
                    ],
                    [
                      0,
                      0
                    ]
                  ],
                  "v": [
                    [
                      -206,
                      208
                    ],
                    [
                      -206,
                      -52
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
                  0.435232813218,
                  0.455944345512,
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
                "k": 30
              },
              "lc": 1,
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
                "t": 6,
                "s": [
                  0
                ]
              },
              {
                "t": 15,
                "s": [
                  100
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
                "t": 2,
                "s": [
                  0
                ]
              },
              {
                "t": 9,
                "s": [
                  100
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
      "ip": 2,
      "op": 16,
      "st": 2,
      "bm": 0
    },
    {
      "ddd": 0,
      "ind": 28,
      "ty": 4,
      "nm": "Shape Layer 15",
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
              "t": 12,
              "s": [
                250,
                336.592,
                0
              ],
              "to": [
                0,
                -30,
                0
              ],
              "ti": [
                0,
                30,
                0
              ]
            },
            {
              "t": 27,
              "s": [
                250,
                156.592,
                0
              ]
            }
          ]
        },
        "a": {
          "a": 0,
          "k": [
            -206,
            10.592,
            0
          ]
        },
        "s": {
          "a": 0,
          "k": [
            -100,
            100,
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
                      0
                    ],
                    [
                      0,
                      0
                    ]
                  ],
                  "o": [
                    [
                      0,
                      0
                    ],
                    [
                      0,
                      0
                    ]
                  ],
                  "v": [
                    [
                      -206,
                      208
                    ],
                    [
                      -206,
                      -52
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
                  0.062745098039,
                  0.850980392157,
                  0.588235294118,
                  1
                ]
              },
              "o": {
                "a": 0,
                "k": 100
              },
              "w": {
                "a": 0,
                "k": 30
              },
              "lc": 1,
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
                "t": 16.615,
                "s": [
                  0
                ]
              },
              {
                "t": 27,
                "s": [
                  100
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
                "t": 12,
                "s": [
                  0
                ]
              },
              {
                "t": 20.076171875,
                "s": [
                  100
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
      "ip": 12,
      "op": 27,
      "st": 12,
      "bm": 0
    },
    {
      "ddd": 0,
      "ind": 29,
      "ty": 4,
      "nm": "Shape Layer 14",
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
              "t": 7,
              "s": [
                150,
                274.592,
                0
              ],
              "to": [
                0,
                -30,
                0
              ],
              "ti": [
                0,
                30,
                0
              ]
            },
            {
              "t": 22,
              "s": [
                150,
                94.592,
                0
              ]
            }
          ]
        },
        "a": {
          "a": 0,
          "k": [
            -206,
            10.592,
            0
          ]
        },
        "s": {
          "a": 0,
          "k": [
            -100,
            100,
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
                      0
                    ],
                    [
                      0,
                      0
                    ]
                  ],
                  "o": [
                    [
                      0,
                      0
                    ],
                    [
                      0,
                      0
                    ]
                  ],
                  "v": [
                    [
                      -206,
                      208
                    ],
                    [
                      -206,
                      -52
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
                  0.062745098039,
                  0.850980392157,
                  0.588235294118,
                  1
                ]
              },
              "o": {
                "a": 0,
                "k": 100
              },
              "w": {
                "a": 0,
                "k": 30
              },
              "lc": 1,
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
                "t": 11.615,
                "s": [
                  0
                ]
              },
              {
                "t": 22,
                "s": [
                  100
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
                "t": 7,
                "s": [
                  0
                ]
              },
              {
                "t": 15.076171875,
                "s": [
                  100
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
      "ip": 7,
      "op": 27,
      "st": 7,
      "bm": 0
    },
    {
      "ddd": 0,
      "ind": 30,
      "ty": 4,
      "nm": "Shape Layer 13",
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
              "t": 9,
              "s": [
                50,
                397.333,
                0
              ],
              "to": [
                0,
                -30,
                0
              ],
              "ti": [
                0,
                30,
                0
              ]
            },
            {
              "t": 22,
              "s": [
                50,
                217.333,
                0
              ]
            }
          ]
        },
        "a": {
          "a": 0,
          "k": [
            -206,
            -8.667,
            0
          ]
        },
        "s": {
          "a": 0,
          "k": [
            -100,
            100,
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
                      0
                    ],
                    [
                      0,
                      0
                    ]
                  ],
                  "o": [
                    [
                      0,
                      0
                    ],
                    [
                      0,
                      0
                    ]
                  ],
                  "v": [
                    [
                      -206,
                      208
                    ],
                    [
                      -206,
                      -52
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
                  0.062745098039,
                  0.850980392157,
                  0.588235294118,
                  1
                ]
              },
              "o": {
                "a": 0,
                "k": 100
              },
              "w": {
                "a": 0,
                "k": 30
              },
              "lc": 1,
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
                "t": 13,
                "s": [
                  0
                ]
              },
              {
                "t": 22,
                "s": [
                  100
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
                "t": 9,
                "s": [
                  0
                ]
              },
              {
                "t": 16,
                "s": [
                  100
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
      "ip": 9,
      "op": 23,
      "st": 9,
      "bm": 0
    },
    {
      "ddd": 0,
      "ind": 31,
      "ty": 4,
      "nm": "Shape Layer 12",
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
              "t": 8,
              "s": [
                316,
                335.318,
                0
              ],
              "to": [
                0,
                -30,
                0
              ],
              "ti": [
                0,
                30,
                0
              ]
            },
            {
              "t": 25,
              "s": [
                316,
                155.318,
                0
              ]
            }
          ]
        },
        "a": {
          "a": 0,
          "k": [
            -206,
            25.318,
            0
          ]
        },
        "s": {
          "a": 0,
          "k": [
            -100,
            100,
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
                      0
                    ],
                    [
                      0,
                      0
                    ]
                  ],
                  "o": [
                    [
                      0,
                      0
                    ],
                    [
                      0,
                      0
                    ]
                  ],
                  "v": [
                    [
                      -206,
                      208
                    ],
                    [
                      -206,
                      -52
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
                  0.062745098039,
                  0.850980392157,
                  0.588235294118,
                  1
                ]
              },
              "o": {
                "a": 0,
                "k": 100
              },
              "w": {
                "a": 0,
                "k": 30
              },
              "lc": 1,
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
                "t": 13.23,
                "s": [
                  0
                ]
              },
              {
                "t": 25,
                "s": [
                  100
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
                "t": 8,
                "s": [
                  0
                ]
              },
              {
                "t": 17.154296875,
                "s": [
                  100
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
      "ip": 8,
      "op": 25,
      "st": 8,
      "bm": 0
    },
    {
      "ddd": 0,
      "ind": 32,
      "ty": 4,
      "nm": "Shape Layer 11",
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
              "t": 7,
              "s": [
                422,
                247.333,
                0
              ],
              "to": [
                0,
                -30,
                0
              ],
              "ti": [
                0,
                30,
                0
              ]
            },
            {
              "t": 20,
              "s": [
                422,
                67.333,
                0
              ]
            }
          ]
        },
        "a": {
          "a": 0,
          "k": [
            -206,
            -8.667,
            0
          ]
        },
        "s": {
          "a": 0,
          "k": [
            -100,
            100,
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
                      0
                    ],
                    [
                      0,
                      0
                    ]
                  ],
                  "o": [
                    [
                      0,
                      0
                    ],
                    [
                      0,
                      0
                    ]
                  ],
                  "v": [
                    [
                      -206,
                      208
                    ],
                    [
                      -206,
                      -52
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
                  0.062745098039,
                  0.850980392157,
                  0.588235294118,
                  1
                ]
              },
              "o": {
                "a": 0,
                "k": 100
              },
              "w": {
                "a": 0,
                "k": 30
              },
              "lc": 1,
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
                "t": 11,
                "s": [
                  0
                ]
              },
              {
                "t": 20,
                "s": [
                  100
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
                "t": 7,
                "s": [
                  0
                ]
              },
              {
                "t": 14,
                "s": [
                  100
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
      "ip": 7,
      "op": 21,
      "st": 7,
      "bm": 0
    },
    {
      "ddd": 0,
      "ind": 33,
      "ty": 4,
      "nm": "Shape Layer 5",
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
              "t": 5,
              "s": [
                222,
                336.592,
                0
              ],
              "to": [
                0,
                -30,
                0
              ],
              "ti": [
                0,
                30,
                0
              ]
            },
            {
              "t": 20,
              "s": [
                222,
                156.592,
                0
              ]
            }
          ]
        },
        "a": {
          "a": 0,
          "k": [
            -206,
            10.592,
            0
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
                      0
                    ],
                    [
                      0,
                      0
                    ]
                  ],
                  "o": [
                    [
                      0,
                      0
                    ],
                    [
                      0,
                      0
                    ]
                  ],
                  "v": [
                    [
                      -206,
                      208
                    ],
                    [
                      -206,
                      -52
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
                  0.062745098039,
                  0.850980392157,
                  0.588235294118,
                  1
                ]
              },
              "o": {
                "a": 0,
                "k": 100
              },
              "w": {
                "a": 0,
                "k": 30
              },
              "lc": 1,
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
                "t": 9.615,
                "s": [
                  0
                ]
              },
              {
                "t": 20,
                "s": [
                  100
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
                "t": 5,
                "s": [
                  0
                ]
              },
              {
                "t": 13.076171875,
                "s": [
                  100
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
      "ip": 5,
      "op": 20,
      "st": 5,
      "bm": 0
    },
    {
      "ddd": 0,
      "ind": 34,
      "ty": 4,
      "nm": "Shape Layer 4",
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
                322,
                274.592,
                0
              ],
              "to": [
                0,
                -30,
                0
              ],
              "ti": [
                0,
                30,
                0
              ]
            },
            {
              "t": 15,
              "s": [
                322,
                94.592,
                0
              ]
            }
          ]
        },
        "a": {
          "a": 0,
          "k": [
            -206,
            10.592,
            0
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
                      0
                    ],
                    [
                      0,
                      0
                    ]
                  ],
                  "o": [
                    [
                      0,
                      0
                    ],
                    [
                      0,
                      0
                    ]
                  ],
                  "v": [
                    [
                      -206,
                      208
                    ],
                    [
                      -206,
                      -52
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
                  0.062745098039,
                  0.850980392157,
                  0.588235294118,
                  1
                ]
              },
              "o": {
                "a": 0,
                "k": 100
              },
              "w": {
                "a": 0,
                "k": 30
              },
              "lc": 2,
              "lj": 2,
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
                "t": 4.615,
                "s": [
                  0
                ]
              },
              {
                "t": 15,
                "s": [
                  100
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
                "t": 0,
                "s": [
                  0
                ]
              },
              {
                "t": 8.076171875,
                "s": [
                  100
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
      "op": 20,
      "st": 0,
      "bm": 0
    },
    {
      "ddd": 0,
      "ind": 35,
      "ty": 4,
      "nm": "Shape Layer 3",
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
              "t": 2,
              "s": [
                422,
                397.333,
                0
              ],
              "to": [
                0,
                -30,
                0
              ],
              "ti": [
                0,
                30,
                0
              ]
            },
            {
              "t": 15,
              "s": [
                422,
                217.333,
                0
              ]
            }
          ]
        },
        "a": {
          "a": 0,
          "k": [
            -206,
            -8.667,
            0
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
                      0
                    ],
                    [
                      0,
                      0
                    ]
                  ],
                  "o": [
                    [
                      0,
                      0
                    ],
                    [
                      0,
                      0
                    ]
                  ],
                  "v": [
                    [
                      -206,
                      208
                    ],
                    [
                      -206,
                      -52
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
                  0.062745098039,
                  0.850980392157,
                  0.588235294118,
                  1
                ]
              },
              "o": {
                "a": 0,
                "k": 100
              },
              "w": {
                "a": 0,
                "k": 30
              },
              "lc": 1,
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
                "t": 6,
                "s": [
                  0
                ]
              },
              {
                "t": 15,
                "s": [
                  100
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
                "t": 2,
                "s": [
                  0
                ]
              },
              {
                "t": 9,
                "s": [
                  100
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
      "ip": 2,
      "op": 16,
      "st": 2,
      "bm": 0
    },
    {
      "ddd": 0,
      "ind": 36,
      "ty": 4,
      "nm": "Shape Layer 2",
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
              "t": 1,
              "s": [
                156,
                335.318,
                0
              ],
              "to": [
                0,
                -30,
                0
              ],
              "ti": [
                0,
                30,
                0
              ]
            },
            {
              "t": 18,
              "s": [
                156,
                155.318,
                0
              ]
            }
          ]
        },
        "a": {
          "a": 0,
          "k": [
            -206,
            25.318,
            0
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
                      0
                    ],
                    [
                      0,
                      0
                    ]
                  ],
                  "o": [
                    [
                      0,
                      0
                    ],
                    [
                      0,
                      0
                    ]
                  ],
                  "v": [
                    [
                      -206,
                      208
                    ],
                    [
                      -206,
                      -52
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
                  0.062745098039,
                  0.850980392157,
                  0.588235294118,
                  1
                ]
              },
              "o": {
                "a": 0,
                "k": 100
              },
              "w": {
                "a": 0,
                "k": 30
              },
              "lc": 1,
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
                "t": 6.23,
                "s": [
                  0
                ]
              },
              {
                "t": 18,
                "s": [
                  100
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
                "t": 1,
                "s": [
                  0
                ]
              },
              {
                "t": 10.154296875,
                "s": [
                  100
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
      "ip": 1,
      "op": 18,
      "st": 1,
      "bm": 0
    },
    {
      "ddd": 0,
      "ind": 37,
      "ty": 4,
      "nm": "Shape Layer 1",
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
                50,
                247.333,
                0
              ],
              "to": [
                0,
                -30,
                0
              ],
              "ti": [
                0,
                30,
                0
              ]
            },
            {
              "t": 13,
              "s": [
                50,
                67.333,
                0
              ]
            }
          ]
        },
        "a": {
          "a": 0,
          "k": [
            -206,
            -8.667,
            0
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
                      0
                    ],
                    [
                      0,
                      0
                    ]
                  ],
                  "o": [
                    [
                      0,
                      0
                    ],
                    [
                      0,
                      0
                    ]
                  ],
                  "v": [
                    [
                      -206,
                      208
                    ],
                    [
                      -206,
                      -52
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
                  0.062745098039,
                  0.850980392157,
                  0.588235294118,
                  1
                ]
              },
              "o": {
                "a": 0,
                "k": 100
              },
              "w": {
                "a": 0,
                "k": 30
              },
              "lc": 2,
              "lj": 2,
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
                "t": 4,
                "s": [
                  0
                ]
              },
              {
                "t": 13,
                "s": [
                  100
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
                "t": 0,
                "s": [
                  0
                ]
              },
              {
                "t": 7,
                "s": [
                  100
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
      "op": 14,
      "st": 0,
      "bm": 0
    }
  ]
};

const player = new TgsPlayer(animationData, 'tgs-player');
player.play();
})();