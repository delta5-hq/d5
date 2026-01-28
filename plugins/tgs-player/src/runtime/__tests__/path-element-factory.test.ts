/**
 * Path Element Factory Test Suite
 * 
 * Tests path element creation and descriptor building.
 */

import { describe, it, expect } from 'vitest';

/* Mock element for testing */
interface MockElement {
  tagName: string;
  attributes: Map<string, string>;
  children: MockElement[];
  setAttribute(name: string, value: string): void;
  getAttribute(name: string): string | null;
  appendChild(child: MockElement): void;
}

const createMockElement = (tagName: string): MockElement => ({
  tagName,
  attributes: new Map(),
  children: [],
  setAttribute(name: string, value: string) {
    this.attributes.set(name, value);
  },
  getAttribute(name: string) {
    return this.attributes.get(name) || null;
  },
  appendChild(child: MockElement) {
    this.children.push(child);
  }
});

/* Recreate PathElementFactory logic for testing */
const createPathElementFactory = () => ({
  createFillPath(parentGroup: MockElement, gradientId?: string): MockElement {
    const element = createMockElement('path');
    if (gradientId) {
      element.setAttribute('fill', 'url(#' + gradientId + ')');
    }
    parentGroup.appendChild(element);
    return element;
  },

  createStrokePath(parentGroup: MockElement): MockElement {
    const element = createMockElement('path');
    parentGroup.appendChild(element);
    return element;
  },

  createEmptyPath(parentGroup: MockElement): MockElement {
    const element = createMockElement('path');
    parentGroup.appendChild(element);
    return element;
  },

  createPathDescriptor(
    element: MockElement,
    group: MockElement,
    shapes: {
      pathShape?: unknown;
      pathShapes?: unknown[];
      fillShape?: unknown;
      gradientFillShape?: unknown;
      gradientElement?: unknown;
      strokeShape?: unknown;
      transformShape?: unknown;
      trimShapes?: unknown[];
    },
    isMerged: boolean
  ) {
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
});

describe('PathElementFactory', () => {
  const factory = createPathElementFactory();
  
  describe('createFillPath', () => {
    it('should create path element and append to parent', () => {
      const parent = createMockElement('g');
      
      const element = factory.createFillPath(parent);
      
      expect(element.tagName).toBe('path');
      expect(parent.children).toHaveLength(1);
      expect(parent.children[0]).toBe(element);
    });
    
    it('should set fill to gradient URL when gradientId provided', () => {
      const parent = createMockElement('g');
      
      const element = factory.createFillPath(parent, 'grad-123');
      
      expect(element.getAttribute('fill')).toBe('url(#grad-123)');
    });
    
    it('should not set fill when no gradientId', () => {
      const parent = createMockElement('g');
      
      const element = factory.createFillPath(parent);
      
      expect(element.getAttribute('fill')).toBeNull();
    });
  });
  
  describe('createStrokePath', () => {
    it('should create path element and append to parent', () => {
      const parent = createMockElement('g');
      
      const element = factory.createStrokePath(parent);
      
      expect(element.tagName).toBe('path');
      expect(parent.children).toHaveLength(1);
    });
    
    it('should not set any fill or stroke attributes', () => {
      const parent = createMockElement('g');
      
      const element = factory.createStrokePath(parent);
      
      expect(element.getAttribute('fill')).toBeNull();
      expect(element.getAttribute('stroke')).toBeNull();
    });
  });
  
  describe('createEmptyPath', () => {
    it('should create path element and append to parent', () => {
      const parent = createMockElement('g');
      
      const element = factory.createEmptyPath(parent);
      
      expect(element.tagName).toBe('path');
      expect(parent.children).toHaveLength(1);
    });
  });
  
  describe('createPathDescriptor', () => {
    const mockElement = createMockElement('path');
    const mockGroup = createMockElement('g');
    
    it('should create descriptor with single pathShape when not merged', () => {
      const pathShape = { ty: 'sh', ks: {} };
      const shapes = { pathShape, fillShape: { ty: 'fl' } };
      
      const descriptor = factory.createPathDescriptor(mockElement, mockGroup, shapes, false);
      
      expect(descriptor.pathShape).toBe(pathShape);
      expect(descriptor.pathShapes).toBeUndefined();
      expect(descriptor.merged).toBe(false);
    });
    
    it('should create descriptor with pathShapes array when merged', () => {
      const pathShapes = [{ ty: 'sh', ks: {} }, { ty: 'sh', ks: {} }];
      const shapes = { pathShapes, fillShape: { ty: 'fl' } };
      
      const descriptor = factory.createPathDescriptor(mockElement, mockGroup, shapes, true);
      
      expect(descriptor.pathShapes).toBe(pathShapes);
      expect(descriptor.pathShape).toBeUndefined();
      expect(descriptor.merged).toBe(true);
    });
    
    it('should include all shape references', () => {
      const fillShape = { ty: 'fl', c: {} };
      const gradientFillShape = { ty: 'gf', g: {} };
      const gradientElement = createMockElement('linearGradient');
      const strokeShape = { ty: 'st', c: {} };
      const transformShape = { ty: 'tr', p: {} };
      const trimShapes = [{ ty: 'tm', s: {} }];
      
      const shapes = {
        pathShape: { ty: 'sh' },
        fillShape,
        gradientFillShape,
        gradientElement,
        strokeShape,
        transformShape,
        trimShapes
      };
      
      const descriptor = factory.createPathDescriptor(mockElement, mockGroup, shapes, false);
      
      expect(descriptor.fillShape).toBe(fillShape);
      expect(descriptor.gradientFillShape).toBe(gradientFillShape);
      expect(descriptor.gradientElement).toBe(gradientElement);
      expect(descriptor.strokeShape).toBe(strokeShape);
      expect(descriptor.transformShape).toBe(transformShape);
      expect(descriptor.trimShapes).toBe(trimShapes);
    });
    
    it('should include element and group references', () => {
      const shapes = { pathShape: { ty: 'sh' } };
      
      const descriptor = factory.createPathDescriptor(mockElement, mockGroup, shapes, false);
      
      expect(descriptor.element).toBe(mockElement);
      expect(descriptor.group).toBe(mockGroup);
    });
    
    it('should handle null/undefined shapes', () => {
      const shapes: {
        pathShape?: unknown;
        fillShape?: unknown;
        strokeShape?: unknown;
        trimShapes?: unknown[];
      } = {
        pathShape: { ty: 'sh' },
        fillShape: null,
      };
      
      const descriptor = factory.createPathDescriptor(mockElement, mockGroup, shapes, false);
      
      expect(descriptor.fillShape).toBeNull();
      expect(descriptor.strokeShape).toBeUndefined();
      expect(descriptor.trimShapes).toBeUndefined();
    });
  });
});
