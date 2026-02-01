export const TRANSFORM_CALCULATOR_CODE = `
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
`;

/* Testable ES6 exports - mock Interpolator dependency */
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/strict-boolean-expressions, @typescript-eslint/no-unsafe-argument, @typescript-eslint/explicit-function-return-type */
const mockInterpolator = {
  interpolateProperty: (prop: any, _frame: number) => prop.k
};

export const TransformCalculator = {
  computeFromKeyframes(ks: any, frame: number, Interpolator = mockInterpolator) {
    return {
      position: ks.p ? Interpolator.interpolateProperty(ks.p, frame) : [0, 0],
      anchor: ks.a ? Interpolator.interpolateProperty(ks.a, frame) : [0, 0],
      scale: ks.s ? Interpolator.interpolateProperty(ks.s, frame) : [100, 100],
      rotation: ks.r ? Interpolator.interpolateProperty(ks.r, frame) : 0,
      opacity: ks.o ? Interpolator.interpolateProperty(ks.o, frame) : 100
    };
  },

  combineParentChild(parent: any, child: any, parentLayerType: number) {
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

  resolveParentChain(layer: any, frame: number, idPrefix: string, elementRegistry: Map<string, any>, Interpolator = mockInterpolator) {
    let transform = this.computeFromKeyframes(layer.ks, frame, Interpolator);
    
    let currentLayer = layer;
    while (currentLayer.parent) {
      const parentId = idPrefix + '_' + currentLayer.parent;
      const parentData = elementRegistry.get(parentId);
      if (!parentData) break;
      
      const parentTransform = this.computeFromKeyframes(parentData.layer.ks, frame, Interpolator);
      transform = this.combineParentChild(parentTransform, transform, parentData.layer.ty);
      currentLayer = parentData.layer;
    }
    
    return transform;
  }
};
