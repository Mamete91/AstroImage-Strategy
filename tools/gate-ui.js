#!/usr/bin/env node
/* GATE UI — controllo STRUTTURALE dell'interfaccia. Non modifica nulla e non
   verifica niente di scientifico: quello lo fanno test.js e i gate fisici.

   Esiste per chiudere l'unica falla silenziosa del progetto. L'helper interno di
   refresh() e' `const set=(id,html)=>{const e=$(id); if(e) e.innerHTML=html;}`:
   se un id sparisce dall'HTML durante un rifacimento della UI, non succede
   niente. Nessun errore in console, nessun test rosso — solo un pezzo di
   pannello che resta vuoto per sempre. Nessuna delle 483 verifiche del motore
   puo' accorgersene, perche' nessuna tocca il DOM.

   Controlla cinque cose:
     A · la cucitura motore/UI e' ancora estraibile dagli otto strumenti
     B · nessun <script> compare prima di quello principale
     C · ogni id che il JS risolve esiste nell'HTML statico o e' generato a runtime
     D · gli ancoraggi strutturali della dashboard ci sono tutti
     E · i pattern cercati dai gate source-text non sono stati introdotti

     node tools/gate-ui.js                                                    */
const fs=require('fs'), path=require('path');
const ROOT=path.join(__dirname,'..');
const html=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');

let pass=0, fail=0;
function chk(name,ok,note){
  console.log(`${ok?'  ok  ':' FAIL '} ${name}${note?`   [${note}]`:''}`);
  ok?pass++:fail++;
}

/* ═══ A · la cucitura ═══
   Gli otto strumenti tagliano index.html per stringa. Se questo taglio non
   funziona piu', smettono di funzionare tutti insieme. */
console.log('\n--- A · cucitura motore / UI ---');
const parts=html.split('<script>');
chk('esiste un blocco <script> senza attributi', parts.length>=2);
const script=parts.length>=2 ? parts[1].split('</script>')[0] : '';
const MARK='/* =====================================================================\n   UI';
const hasMark=script.indexOf(MARK)>=0;
chk('il marcatore di confine UI e presente', hasMark,
    hasMark?'riga '+(html.slice(0,html.indexOf(MARK)).split('\n').length):'MARCATORE PERDUTO');
const pure=script.split(MARK)[0];
chk('la fetta motore e non vuota', pure.length>1000, pure.length+' caratteri');
/* Il motore e' puro per costruzione: se qui compare un riferimento al DOM,
   qualcosa e' passato dal lato sbagliato della cucitura. */
const DOMISH=['document.','innerHTML','querySelector','getElementById',
              'addEventListener','localStorage','classList'];
DOMISH.forEach(k=>chk(`il motore non usa ${k}`, pure.indexOf(k)<0));

/* ═══ A-bis · il blocco script compila ═══
   Questa mancava, e la sua assenza si e' fatta sentire: test.js valuta la sola
   fetta MOTORE, quindi un errore di sintassi nello strato UI passa con 483/483
   verdi e l'applicazione bianca. Basta un apostrofo non sfuggito dentro una
   stringa. `new Function` compila senza eseguire: e' esattamente il controllo
   che serve, e costa niente. */
const compila=(src,dove)=>{ try{ new Function(src); return null; }catch(e){ return e.message; } };
const errScript=compila(script);
chk('il blocco script compila senza errori di sintassi', errScript===null,
    errScript||`${script.length} caratteri`);
const errPure=compila(pure);
chk('e la sola fetta motore compila da sola', errPure===null, errPure||'ok');

/* ═══ B · nessuno script prima ═══ */
console.log('\n--- B · posizione del blocco script ---');
chk('un solo <script> senza attributi in tutto il file',
    html.split('<script>').length===2, (html.split('<script>').length-1)+' occorrenze');
const headHtml=html.slice(0,html.indexOf('<script>'));
chk('nessun <script src=...> aggiunto prima', !/<script\s+[^>]*>/.test(headHtml));

/* ═══ C · contratto degli id ═══ */
console.log('\n--- C · contratto degli id del DOM ---');
const bodyStart=html.indexOf('<body>');
const staticHtml=html.slice(bodyStart, html.indexOf('<script>'));
const uiJs=hasMark ? script.split(MARK)[1] : script;

const setOf=(re,src)=>{ const s=new Set(); let m; while((m=re.exec(src))) s.add(m[1]); return s; };
const STATIC =setOf(/id="([A-Za-z0-9_]+)"/g, staticHtml);
/* Gli id generati a runtime arrivano da tre strade diverse: scritti per esteso
   dentro un template, costruiti dal field-builder — `fld('gf_ap',…)` — oppure
   assegnati come proprieta' su un nodo creato al volo, `el.id='toast'`. Una
   scansione del solo `id="…"` ne vedrebbe una su tre e griderebbe al lupo sulle
   altre due: quattordici falsi allarmi, che e' il modo migliore per far
   ignorare un controllo. */
const RUNTIME=new Set([...setOf(/id="([A-Za-z0-9_]+)"/g, uiJs),
                       ...setOf(/\.id=['"]([A-Za-z0-9_]+)['"]/g, uiJs)]);
/* Una quarta strada: prefisso letterale piu' coda variabile — `id="gf_${id}"`
   nel field-builder dei moduli. Il prefisso si puo' verificare, la coda no, ed
   e' giusto cosi': quella la decide chi chiama. */
const PREFIX=[...setOf(/id="([A-Za-z0-9_]+)\$\{/g, uiJs)];
const byPrefix=id=>PREFIX.some(p=>id.indexOf(p)===0&&id.length>p.length);
const REFD   =new Set([...setOf(/\$\('([A-Za-z0-9_]+)'\)/g, uiJs),
                       ...setOf(/getElementById\('([A-Za-z0-9_]+)'\)/g, uiJs),
                       ...setOf(/getElementById\("([A-Za-z0-9_]+)"\)/g, uiJs)]);
/* Gli id passati per variabile — set('d_fl',…) dentro refresh() — non si vedono
   con una scansione di $('...'), quindi si cercano come stringhe nude. */
const asString=id=>uiJs.indexOf(`'${id}'`)>=0||uiJs.indexOf(`"${id}"`)>=0;

const orphan=[...REFD].filter(id=>!STATIC.has(id)&&!RUNTIME.has(id)&&!byPrefix(id));
chk('ogni id risolto dal JS esiste nel DOM o e generato a runtime',
    orphan.length===0, orphan.length?('ORFANI: '+orphan.join(' ')):`${REFD.size} riferimenti verificati`);

/* Un id statico che nessuna riga di codice risolve o e' un ancoraggio di markup,
   o e' un residuo. Vale la pena distinguerli per nome invece che con una soglia:
     aisRing, aisCore  gradienti SVG del logo, richiamati da url(#…) nell'HTML
     steprail, derived  contenitori con solo aggancio CSS
     filtSheet, stateSheet  gli involucri di Filtri e Archivio, diventati sezioni
                        della dashboard: gli id restano perche' il contratto del
                        DOM non perda pezzi, ma nessuno li risolve piu'. */
const MARKUP_ONLY=['aisRing','aisCore','steprail','derived','filtSheet','stateSheet'];
const unused=[...STATIC].filter(id=>!asString(id));
const unexpected=unused.filter(id=>MARKUP_ONLY.indexOf(id)<0);
chk('gli id statici senza codice sono solo ancoraggi noti di markup',
    unexpected.length===0,
    unexpected.length?('INATTESI: '+unexpected.join(' ')):(unused.join(' ')||'nessuno'));
console.log(`      ${STATIC.size} id statici · ${RUNTIME.size} generati a runtime · ${REFD.size} risolti dal JS`);

/* ═══ D · ancoraggi della dashboard ═══
   I contenitori senza i quali una sezione resta muta. */
console.log('\n--- D · ancoraggi strutturali della dashboard ---');
const ANCHORS=['app','boot','rows','rxOut','rxCtx','cfgCtx','bestNight',
               'rxTarget','rxHours','rxNeed','rxNights','rxGo',
               'derived','night','filtBody','stateList','sumBody','preset','tel','cam','mnt',
               'site','lat','lon','sqm','date','see','rms','bin','drop','fileIn','scanOut',
               'sheet','sheetBody','tgtBody','gearBody','dlObjects'];
const missing=ANCHORS.filter(id=>!STATIC.has(id));
chk('tutti gli ancoraggi della dashboard sono nell HTML statico',
    missing.length===0, missing.length?('MANCANO: '+missing.join(' ')):ANCHORS.length+' verificati');

/* Navigazione: ogni destinazione deve avere una sezione, e viceversa. Una voce
   di sidebar che non porta da nessuna parte e' il modo piu' rapido per far
   sembrare incompleto un software finito. */
const secs=[...setOf(/data-sec="([a-z]+)"/g, staticHtml)];
const gos =[...setOf(/data-go="([a-z]+)"/g,  staticHtml)];
const dead=gos.filter(g=>secs.indexOf(g)<0);
const unreachable=secs.filter(s=>gos.indexOf(s)<0);
chk('ogni destinazione di navigazione ha la sua sezione', dead.length===0,
    dead.length?('SENZA SEZIONE: '+dead.join(' ')):gos.length+' destinazioni');
chk('ogni sezione e raggiungibile dalla navigazione', unreachable.length===0,
    unreachable.length?('IRRAGGIUNGIBILI: '+unreachable.join(' ')):secs.length+' sezioni');
chk('la funzione di navigazione esiste', /function go\(name\)/.test(uiJs));
chk('il riepilogo laterale esiste', /function renderSummary\(\)/.test(uiJs));
/* Il riepilogo deve LEGGERE i valori gia' calcolati. Se qui comparisse una
   chiamata al motore, tornerebbero due sorgenti di verita' per gli stessi numeri. */
const sumFn=(uiJs.split('function renderSummary()')[1]||'').split('\nfunction ')[0];
const ENGINE_CALLS=['derive(','evaluate(','prescribe(','planNights(','exposurePlan(',
                    'resolveNight(','nightProfile(','subExposure(','filterFor('];
const called=ENGINE_CALLS.filter(f=>sumFn.indexOf(f)>=0);
chk('il riepilogo non richiama il motore', called.length===0,
    called.length?('CHIAMATE: '+called.join(' ')):'legge solo RXDV / RXEVAL / RXNIGHT / RXPR');

/* ═══ E · pattern dei gate source-text ═══
   gate-v16 e test.js cercano costanti cablate dentro TUTTO cio' che segue il
   primo <script>, quindi anche dentro il codice della UI. */
console.log('\n--- E · costanti vietate nel sorgente ---');
chk('nessun «2.8» introdotto (lo cerca gate-v16)', !/2\.8|×2,8|x2\.8/.test(script));
chk('nessun «0.8 … 23» introdotto (lo cerca test.js)',
    !/0\.8.{0,20}23|23.{0,20}0\.8x/.test(script));

/* ═══ F · gli stessi input per tutti ═══
   Il motore deve ricevere le stesse schede da qualunque parte lo si chiami.
   Senza l'innesto OpenNGC gli strumenti da riga di comando vedono schede senza
   magnitudine — e objectSatTime restituisce Infinity, cioe' «il soggetto non
   satura mai» — e senza angolo di posizione, e mosaicPanels ripiega su
   maggiore x minore, che equivale ad assumere l'oggetto allineato al sensore.
   Su M31 la differenza vale 2x1 pannelli contro 2x3: il triplo delle ore. */
console.log('\n--- F · innesto OpenNGC negli strumenti ---');
const ENRICHED=['plan.js','diag.js','tools/lib/engine.js'];
const senza=ENRICHED.filter(f=>{
  const p=path.join(ROOT,f);
  return !fs.existsSync(p) || !/enrich\.js/.test(fs.readFileSync(p,'utf8'));
});
chk('ogni strumento che risolve schede innesta i dati OpenNGC', senza.length===0,
    senza.length?('SENZA INNESTO: '+senza.join(' ')):ENRICHED.join(' '));
chk('l helper condiviso esiste', fs.existsSync(path.join(ROOT,'tools/lib/enrich.js')));
/* L'innesto deve restare a runtime: scrivere i valori dentro catalog.json o
   targets.json li renderebbe opere derivate di un database CC-BY-SA-4.0. */
const enrichSrc=fs.existsSync(path.join(ROOT,'tools/lib/enrich.js'))
  ? fs.readFileSync(path.join(ROOT,'tools/lib/enrich.js'),'utf8') : '';
chk('e non scrive niente su disco', !/writeFileSync|createWriteStream/.test(enrichSrc));

/* ═══ G · la diagnosi nomina il colpevole giusto ═══
   Sotto il pavimento operativo si finisce per tre motivi: satura il soggetto,
   il tetto di posa e' basso, oppure le ore non bastano al numero minimo di
   fotogrammi. Prima l'app diceva sempre «il soggetto satura», anche quando il
   soggetto non aveva nemmeno una magnitudine con cui saturare. Qui si verifica
   che non torni il falso positivo — e, altrettanto importante, che la
   correzione non assolva chi e' davvero colpevole.
   I due bersagli sono costruiti apposta e non dipendono dai dati: cosi' la
   verifica misura il ragionamento, non il catalogo del giorno. */
console.log('\n--- G · attribuzione del vincolo sulla posa ---');
let ENG=null;
try{ ENG=require('./lib/engine.js'); }
catch(e){ chk('il motore si carica da lib/engine.js', false, e.message); }
if(ENG){
  const {M,DB,TG}=ENG;
  const dv=M.derive({tel:'rc8',red:1,cam:'asi2600mm',mnt:'cem70g',bin:1});
  const mnt=(DB.mounts||[]).find(x=>x.id==='cem70g')||DB.mounts[0];
  const site={lat:46.0167,lon:10.3333,sqm:20.8,seeing:1.6,horizonMin:20,
              rms:(dv.scale<0.8?mnt.rms_long_fl_arcsec:mnt.rms_typ_arcsec)||0.8};
  site.fwhm=M.effFWHM(site.seeing,site.rms);
  const posa=(tg,akey,band,hours)=>M.subExposure(dv,site,band,
    {tg,arch:TG.archetypes[akey],archetype:akey,
     stellar:!!(TG.archetypes[akey]||{}).stellar,hours});

  /* A · soggetto di magnitudine ignota, budget minuscolo. objectSatTime non ha
     con cui lavorare e restituisce Infinity: il vincolo vero e' il numero
     minimo di fotogrammi, e non c'e' nessuna saturazione da dichiarare. */
  const ignoto={id:'__g_ignoto',names:['__g_ignoto'],ra_deg:300,dec_deg:38,
                size_arcmin:[20,10],archetype:'hii_classic',budget:{},mag:null};
  const a=posa(ignoto,'hii_classic','R',0.15);
  chk('con soggetto di magnitudine ignota il tetto del soggetto non esiste',
      a.tObj===Infinity, 'tObj=∞');
  chk('la posa finisce sotto il pavimento operativo', a.underFloor===true,
      a.sec+' s contro un pavimento di '+a.minSub+' s');
  chk('e il vincolo NON e il soggetto che satura',
      a.binding!=='il soggetto satura', 'dichiarato: '+a.binding);
  chk('e nominato il numero minimo di pose', a.binding==='numero minimo di pose');

  /* B · la controprova. Un oggetto minuscolo e brillantissimo — la geometria e
     la magnitudine di NGC 7027 — satura davvero, e li' l'accusa e' fondata. */
  const compatto={id:'__g_compatto',names:['__g_compatto'],ra_deg:316,dec_deg:42,
                  size_arcmin:[0.23,0.23],archetype:'pn_bright',budget:{},mag:8.5};
  const b=posa(compatto,'pn_bright','OIII',3);
  chk('su un soggetto compatto e brillante il tetto del soggetto e finito',
      isFinite(b.tObj), 'tObj='+Math.round(b.tObj)+' s');
  chk('ed e il piu stretto dei tre', b.tObj<Math.min(b.tRisk,b.tFrames), true);
  chk('quindi il vincolo resta il soggetto che satura',
      b.binding==='il soggetto satura', 'dichiarato: '+b.binding);
}

console.log('\n--- L · l RGB per le sole stelle si dichiara ovunque compaia ---');
if(ENG){
  const {M,TG}=ENG;
  const SRC=html;
  /* La regola, nelle parole di chi riprende: l'RGB e' solo stelle nelle strade a
     BANDA STRETTA PURA — HOO, SHO. Li' non porta nessuna quota del soggetto e
     serve al colore delle stelle; in una LRGB+Ha lavora anche sulla nebulosa, e
     chiamarlo «solo stelle» sarebbe falso. */
  const BB=['L','R','G','B','RGB'];
  const solo=(g,pr)=>{ if(!g||g.id!=='RGB'||g.critical) return false;
    const a=pr.alloc.filter(x=>x.id!==g.id&&!x.dropped&&(x.share||0)>0);
    return a.length>0&&a.every(x=>(x.bands||[]).every(b=>!BB.includes(b))); };
  const st={lat:46.0167,lon:10.3333,sqm:20.8,seeing:1.6,rms:0.6,horizonMin:20,clearFrac:0.35};
  st.fwhm=M.effFWHM(st.seeing,st.rms);
  const npx=M.nightProfile(new Date(2026,8,6),st.lat,st.lon);
  const dvm=M.derive({tel:'rc8',red:'1',cam:'asi2600mm',mnt:'cem70g',bin:1});
  const casi=[];
  for(const tg of TG.targets){
    let e,pr; try{ e=M.evaluate(tg,dvm,st,npx,{}); pr=M.prescribe(e,20,dvm,1); }catch(err){ continue; }
    const g=pr.alloc.find(x=>x.id==='RGB'); if(!g||g.dropped) continue;
    casi.push({nome:tg.names[0],road:pr.road.id,solo:solo(g,pr),share:g.share||0});
  }
  const stretta=casi.filter(x=>/^(sho|hoo)/.test(x.road));
  /* «Con banda larga» significa che una L o un RGB portano davvero il soggetto —
     lrgb, lrgb_ha, hargb — non che la stringa contenga «rgb»: `hoo_rgbstars` la
     contiene ed e' l'esempio opposto. */
  const larga=casi.filter(x=>/^(lrgb|hargb)/.test(x.road));
  chk('nelle strade a banda stretta pura l RGB e sempre solo stelle',
    stretta.length>0&&stretta.every(x=>x.solo),
    stretta.length+' casi (' + [...new Set(stretta.map(x=>x.road))].join(', ') + ')');
  chk('e nelle strade con banda larga non lo e mai',
    larga.length>0&&larga.every(x=>!x.solo),
    larga.length+' casi (' + [...new Set(larga.map(x=>x.road))].join(', ') + ')');
  /* E il marcatore deve esistere nel sorgente in tutti i punti in cui un canale
     viene nominato: prescrizione, piano, tabella della posa, riepilogo. */
  const marcatori=(SRC.match(/solo stelle<\/span>/g)||[]).length;
  chk('il marcatore compare in ogni punto in cui il canale viene nominato',
    marcatori>=3, marcatori+' punti nel sorgente');
  chk('e la regola e scritta una volta sola',
    (SRC.match(/const isStarsOnly=/g)||[]).length===1,true);
}


/* ═══ F · IL MARCHIO RIPORTA A CASA, E PER FARLO DEVE ESSERE RAGGIUNGIBILE ═══
   Due cose che si reggono a vicenda: il marchio e' un comando che riporta alla
   Strategia, e ha senso solo se l'intestazione resta in alto mentre si scorre.
   La seconda era rotta e non se ne accorgeva nessuno — `height:100%` sul body
   chiudeva la scatola dopo una schermata, e uno `position:sticky` vive solo
   dentro la scatola del proprio padre. Su una pagina di risultati lunga seimila
   pixel l'intestazione spariva dopo poche centinaia. */
console.log('\n--- F · il marchio, e l intestazione che lo tiene a portata ---');
{
  const brand = html.match(/<button[^>]*class="brandblock"[^>]*>/);
  chk('il marchio e un comando premibile, non un contenitore muto', !!brand,
    brand ? 'e un <button>' : 'e ancora un <div>');
  if (brand) {
    const b = brand[0];
    chk('e porta alla Strategia con lo stesso meccanismo delle altre voci',
      /data-go="strategia"/.test(b));
    chk('e si annuncia a chi non vede il logo', /aria-label="[^"]+"/.test(b));
  }

  /* Lo sticky vive nella scatola del padre: se il body ha un'altezza FISSA quella
     scatola finisce con la prima schermata. E' la differenza fra `height` e
     `min-height`, e vale la sparizione dell'intestazione su ogni pagina lunga. */
  chk('il body non ha un altezza fissa che chiuderebbe lo sticky',
    !/\bhtml,\s*body\{height:100%\}/.test(html) && /body\{min-height:100%\}/.test(html),
    /body\{min-height:100%\}/.test(html) ? 'min-height:100%' : 'ALTEZZA FISSA: l intestazione sparisce scorrendo');
  chk('e l intestazione e dichiarata appiccicata in alto',
    /\.topbar\{[^}]*position:sticky/.test(html.replace(/\n/g, '')));

  /* Navigare deve chiudere cio' che sta sopra: cambiare sezione sotto un pannello
     aperto e' un cambio che non si vede. */
  const goSrc = script.slice(script.indexOf('function go(name){'));
  const corpo = goSrc.slice(0, goSrc.indexOf('function initNav'));
  chk('cambiare sezione chiude i pannelli aperti sopra',
    /sheet/.test(corpo) && /classList\.remove\('on'\)/.test(corpo),
    corpo.indexOf('tgtSheet') > 0 ? 'tutti e tre i pannelli' : 'controllare');
  chk('e riporta in cima', /scrollTo/.test(corpo));
}

/* ═══ G · IL PESO DEL CANALE CRITICO VA DETTO ═══
   Il riparto favorisce il canale che decide l'immagine finche' le ore non bastano
   a tutti. E' una priorita' dichiarata e difendibile, ma il piano ne mostrava il
   RISULTATO senza dire che una parte dello sbilanciamento veniva da li' — e sopra
   le ore che bastano a tutti il peso sparisce da solo, quindi l'effetto era
   invisibile proprio a chi confronta due piani. Il valore non si tocca: si dice. */
console.log('\n--- G · il peso del canale critico e dichiarato ---');
{
  chk('il peso e una costante con un nome, non un numero sparso',
    /const CRIT_WEIGHT=1\.35;/.test(html.replace(/\n/g, '')));
  const usi = (script.match(/1\.35/g) || []).length;
  chk('e il numero nudo non ricompare nel riparto',
    !/critical\s*\?\s*1\.35\s*:/.test(script), usi + ' occorrenze di 1.35 nel file');
  chk('il motore misura quanto il peso ha spostato', /critPeso/.test(script));
  chk('e lo confronta con il riparto a peso uguale', /senzaPeso/.test(script));
  chk('l interfaccia lo dichiara con i due numeri',
    /pesoNota/.test(script) && /invece delle/.test(script));
  chk('e la nota compare nel corpo dei risultati', /\$\{filtNote\}\$\{pesoNota\}/.test(script));
}

console.log(`\n${pass} verifiche superate, ${fail} fallite\n`);
process.exit(fail?1:0);
