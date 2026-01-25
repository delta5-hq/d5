import { createTree } from './tree.js';
import { createFolderData, createFileData } from './node-data.js';

function init() {
    const app = document.getElementById('app');
    
    const treeData = createFolderData('Project', [
        createFolderData('src', [
            createFolderData('components', [
                createFileData('Button.tsx'),
                createFileData('Input.tsx'),
                createFileData('Modal.tsx')
            ]),
            createFolderData('hooks', [
                createFileData('useAuth.ts'),
                createFileData('useApi.ts')
            ]),
            createFileData('App.tsx'),
            createFileData('index.tsx')
        ]),
        createFolderData('public', [
            createFileData('index.html'),
            createFileData('favicon.ico')
        ]),
        createFolderData('tests', [
            createFileData('App.test.tsx'),
            createFileData('setup.ts')
        ]),
        createFileData('package.json'),
        createFileData('tsconfig.json'),
        createFileData('README.md')
    ]);
    
    const tree = createTree(treeData, {
        spark: { duration: 400, easing: 'ease-out' }
    });
    
    app.appendChild(tree.element);
}

document.addEventListener('DOMContentLoaded', init);
