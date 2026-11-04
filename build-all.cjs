'use strict';
const {execFileSync}=require('node:child_process');
const path=require('node:path');
for(const file of ['build-foundation.cjs','build-integrated.cjs','build-quantity.cjs'])execFileSync(process.execPath,[path.join(__dirname,file)],{cwd:__dirname,stdio:'inherit'});
