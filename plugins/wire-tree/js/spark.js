import { createHtmlElement } from './dom-utils.js';

const DEFAULT_CONFIG = {
    duration: 800,
    easing: 'ease-in-out'
};

export function createSpark(pathData, config = {}) {
    const { duration, easing } = { ...DEFAULT_CONFIG, ...config };
    
    const spark = createHtmlElement('div', 'spark');
    spark.style.offsetPath = `path('${pathData}')`;
    spark.style.setProperty('--duration', `${duration}ms`);
    spark.style.setProperty('--easing', easing);
    
    return {
        element: spark,
        
        run() {
            spark.classList.remove('spark--running');
            void spark.offsetWidth;
            spark.classList.add('spark--running');
        },
        
        stop() {
            spark.classList.remove('spark--running');
        }
    };
}
