export const PLAYER_CODE = `
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
`;
