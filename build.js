#!/usr/bin/env node
/* Genera astroplan-standalone.html: stessa app, ma con i dati incorporati.
   Serve per l'uso offline in postazione (doppio clic, niente server, niente rete).
   La versione con JSON separati resta quella da mantenere e da pubblicare. */
const fs=require('fs'), path=require('path');
const dir=__dirname;

const html=fs.readFileSync(path.join(dir,'index.html'),'utf8');
const setups=fs.readFileSync(path.join(dir,'data/setups.json'),'utf8');
const targets=fs.readFileSync(path.join(dir,'data/targets.json'),'utf8');
const catalog=fs.readFileSync(path.join(dir,'data/catalog.json'),'utf8');
const cities=fs.readFileSync(path.join(dir,'data/cities.json'),'utf8');
const ongcPath=path.join(dir,'data/openngc.json');
const ongc=fs.existsSync(ongcPath)?fs.readFileSync(ongcPath,'utf8'):'null';
const darkPath=path.join(dir,'data/darkcat.json');
const dark=fs.existsSync(darkPath)?fs.readFileSync(darkPath,'utf8'):'null';

const inject=`<script>
window.__SETUPS__=${setups};
window.__TARGETS__=${targets};
window.__CATALOG__=${catalog};
window.__DARKCAT__=${dark};
window.__CITIES__=${cities};
window.__ONGC__=${ongc};
</script>
`;

// l'app prova prima il fetch e ricade sui dati incorporati se fallisce
const out=html.replace('<script>', inject+'<script>');
const dest=path.join(dir,'astroplan-standalone.html');
fs.writeFileSync(dest,out);

const kb=(fs.statSync(dest).size/1024).toFixed(0);
const nOngc=ongc==='null'?0:JSON.parse(ongc).objects.length;
console.log(`astroplan-standalone.html generato — ${kb} KB, ${JSON.parse(targets).targets.length} schede curate, `+
  `${JSON.parse(catalog).objects.length} oggetti curati e ${nOngc} da OpenNGC incorporati`);
