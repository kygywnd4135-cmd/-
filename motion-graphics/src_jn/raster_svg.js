// usage: node raster_svg.js <in.svg> <out.png> <size>
const { chromium } = require('playwright'); const fs=require('fs');
(async()=>{
  const [,,inp,out,size]=process.argv; const svg=fs.readFileSync(inp,'utf8');
  const b=await chromium.launch(); const p=await b.newPage({viewport:{width:+size,height:+size},deviceScaleFactor:1});
  await p.setContent(`<html><body style="margin:0;background:transparent">${svg.replace('<svg ','<svg width="'+size+'" height="'+size+'" ')}</body></html>`);
  await p.locator('svg').screenshot({path:out,omitBackground:true}); await b.close();
})();
