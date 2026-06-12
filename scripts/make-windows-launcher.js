const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const launcherPath = path.join(rootDir, 'SaemWork.cmd');
const logPath = path.join(rootDir, 'saemwork-start.log');

const content = `@echo off
setlocal
cd /d "%~dp0"

echo Starting SaemWork...
npm start
`;

fs.writeFileSync(launcherPath, content, 'utf8');
fs.writeFileSync(logPath, '', { flag: 'a' });

console.log(`Created ${launcherPath}`);
