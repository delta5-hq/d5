import * as fs from 'fs'

const pkg = JSON.parse(fs.readFileSync('./package.json', 'utf8'));
const version = pkg.gitVersion || pkg.version || '0.0.0';

const content = `export const version = '${version}'\n`;

fs.writeFileSync('./src/version.ts', content, 'utf8');
