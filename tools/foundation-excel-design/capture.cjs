const fs=require('node:fs');
const path=require('node:path');
const {harness}=require('../../tests/foundation-ui.test.cjs');
const h=harness();
fs.mkdirSync(path.join(__dirname,'tmp'),{recursive:true});
fs.writeFileSync(path.join(__dirname,'tmp/packet.json'),JSON.stringify(h.api.getExcelPacket(),null,2));
