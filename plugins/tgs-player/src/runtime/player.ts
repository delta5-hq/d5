export const PLAYER_CODE = `
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
`;
