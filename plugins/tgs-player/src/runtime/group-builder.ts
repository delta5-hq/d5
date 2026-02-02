export const GROUP_BUILDER_CODE = `
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
`;
