import { createHtmlElement } from './dom-utils.js';
import { createWire } from './wire.js';
import { createSpark } from './spark.js';

export function createBranch(label, config = {}) {
    const container = createHtmlElement('div', 'tree__branch');
    
    const wireContainer = createHtmlElement('div', 'tree__branch-wire');
    const wire = createWire(config.wire);
    wireContainer.appendChild(wire.element);
    
    const spark = createSpark(wire.pathData, config.spark);
    wireContainer.appendChild(spark.element);
    
    const labelElement = createHtmlElement('span', 'tree__branch-label');
    labelElement.textContent = label;
    
    container.appendChild(wireContainer);
    container.appendChild(labelElement);
    
    return {
        element: container,
        wire,
        spark,
        
        pulse() {
            spark.run();
        }
    };
}
