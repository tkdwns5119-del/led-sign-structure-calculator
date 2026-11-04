const fs=require('node:fs');
const path=require('node:path');
const sharp=require('../foundation-excel-design/node_modules/sharp');
const base=path.join(__dirname,'tmp');
sharp(fs.readFileSync(path.join(base,'round-neck.svg')),{density:192})
  .resize({width:920})
  .png()
  .toFile(path.join(base,'round-neck.png'))
  .then(()=>console.log(path.join(base,'round-neck.png')));
