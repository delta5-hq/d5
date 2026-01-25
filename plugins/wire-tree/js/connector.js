import { createHtmlElement } from './dom-utils.js';
import { createWire } from './wire.js';
import { createSpark } from './spark.js';

const DEFAULT_WIDTH = 16;
const DEFAULT_HEIGHT = 24;
const DEFAULT_PADDING = 2;

export function createConnector(sparkConfig = {}) {
    const container = createHtmlElement('div', 'tree-node__connector');
    
    let currentHeight = DEFAULT_HEIGHT;
    let wire = null;
    let spark = null;
    
    function render() {
        container.innerHTML = '';
        
        wire = createWire({ 
            height: currentHeight, 
            width: DEFAULT_WIDTH, 
            padding: DEFAULT_PADDING 
        });
        container.appendChild(wire.element);
        
        spark = createSpark(wire.pathData, sparkConfig);
        container.appendChild(spark.element);
    }
    
    render();
    
    return {
        element: container,
        
        setHeight(height) {
            if (Math.abs(height - currentHeight) < 2) return;
            currentHeight = height;
            render();
        },
        
        pulse() {
            if (spark) spark.run();
        },
        
        getWire() {
            return wire;
        },
        
        getSpark() {
            return spark;
        }
    };
}
