'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
test('HealthGo does not show cropped badge atlas graphics or old controls',()=>{
 const html=fs.readFileSync('www/index.html','utf8');
 const svg=fs.readFileSync('www/healthgo-badge-vector.js','utf8');
 const css=fs.readFileSync('www/healthgo-badge-vector.css','utf8');
 assert.match(html,/healthgo-badge-vector\.js\?v=1/);
 assert.match(html,/healthgo-badge-vector\.css\?v=1/);
 assert.doesNotMatch(html,/healthgo-badge-gallery\.js/);
 assert.doesNotMatch(html,/healthgo-badge-gallery\.css/);
 assert.doesNotMatch(svg,/healthgo-badges-collection\.avif|background-position|data-atlas-index|sprite/);
 assert.doesNotMatch(css,/background-size:1400% 1800%|healthgo-badges-collection\.avif/);
 assert.doesNotMatch(svg,/data-hgai="auto"|data-hgai="details"|data-hgai="zoomin"/);
});
