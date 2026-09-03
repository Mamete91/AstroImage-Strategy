#!/usr/bin/env node
/* Converte OpenNGC (mattiaverga/OpenNGC, CC-BY-SA-4.0) nello strato catalografico
   dell'app.  NON crea un secondo sistema: produce oggetti della stessa forma che
   il motore già consuma — nome, alias, coordinate, dimensioni, costellazione,
   ARCHETIPO — così che synthTarget() li tratti esattamente come i 169 curati.

   La parte che conta è la mappatura tipo → archetipo, ed è dichiarata con tre
   livelli di certezza, perché non tutti i tipi si mappano allo stesso modo:

     alta          il tipo OpenNGC corrisponde uno-a-uno a un archetipo
     media         serve un campo secondario (morfologia di Hubble, brillanza)
     da collaudare il tipo è generico e l'archetipo è una scelta prudente,
                   dichiarata come tale e da verificare sul campo

   uso:  node tools/build-openngc.js /percorso/OpenNGC/database_files/NGC.csv
*/
const fs=require('fs'), path=require('path');
const SRC=process.argv[2]||'/tmp/ongc/database_files/NGC.csv';
const OUT=path.join(__dirname,'..','data','openngc.json');

/* ---------- lettura ---------- */
/* E' un importatore una tantum: gli serve il CSV di OpenNGC, che non sta nel
   repository (data/openngc.json e' gia' il suo risultato). Se manca lo dice,
   invece di morire su uno stack trace. */
if(!fs.existsSync(SRC)){
  console.error('\n  Serve il CSV di OpenNGC, che non e in questo repository.\n'
    +'    ' + SRC + '  (non trovato)\n\n'
    +'  Si prende da github.com/mattiaverga/OpenNGC (CC-BY-SA-4.0), file\n'
    +'  database_files/NGC.csv, e si passa come primo argomento:\n'
    +'    node tools/build-openngc.js /percorso/NGC.csv\n\n'
    +'  data/openngc.json e gia il risultato di questa conversione: rieseguirla\n'
    +'  serve solo per aggiornare il catalogo a una versione nuova di OpenNGC.\n');
  process.exit(2);
}
const raw=fs.readFileSync(SRC,'utf8').split(/\r?\n/).filter(Boolean);
const head=raw[0].split(';');
const rows=raw.slice(1).map(l=>{const c=l.split(';'),o={};head.forEach((h,i)=>o[h]=c[i]||'');return o;});

const num=x=>{const v=parseFloat(x);return isFinite(v)?v:null;};
const ra2deg=s=>{const m=/^(\d+):(\d+):([\d.]+)$/.exec(s||'');
  return m?(+m[1]+ +m[2]/60+ +m[3]/3600)*15:null;};
const dec2deg=s=>{const m=/^([+-])(\d+):(\d+):([\d.]+)$/.exec(s||'');
  return m?(m[1]==='-'?-1:1)*(+m[2]+ +m[3]/60+ +m[4]/3600):null;};

/* Brillanza superficiale stimata: mag integrata spalmata sull'ellisse.
   Serve solo a separare le planetarie compatte e brillanti (problema di dinamica)
   da quelle estese e deboli (problema di segnale). Verificata su casi noti:
   Saturn 15.5 · Cat's Eye 17.4 · M57 17.9 · M27 20.2 · Helix 22.0 · NGC 7139 22.5 */
function surfBr(r){
  const v=num(r['V-Mag'])??num(r['B-Mag']);
  const a=num(r.MajAx), b=num(r.MinAx)??num(r.MajAx);
  if(v==null||!a) return null;
  return v+2.5*Math.log10(Math.PI*(a*30)*(b*30));
}
const PN_SB_CUT=21.0;

/* ---------- la mappatura ---------- */
function classify(r){
  const t=r.Type, hub=(r.Hubble||'').trim();
  switch(t){
    // uno-a-uno: il tipo OpenNGC È l'archetipo
    case 'OCl':  return ['cluster_open','alta',['type']];
    case 'GCl':  return ['cluster_globular','alta',['type']];
    case 'HII':
    case 'EmN':  return ['hii_classic','alta',['type']];
    case 'RfN':  return ['reflection','alta',['type']];
    case 'DrkN': return ['dark_molecular','alta',['type']];
    case 'SNR':  return ['snr','alta',['type']];

    /* ammasso immerso in nebulosità: il soggetto fotografico è quasi sempre la
       nebulosa, non le stelle — ma è un giudizio, non un dato */
    case 'Cl+N': return ['hii_classic','media',['cln']];
    case '*Ass': return ['cluster_open','media',['ass']];

    case 'PN': {
      const sb=surfBr(r);
      if(sb==null) return ['pn_bright','da collaudare',['pn_nodata']];
      const sbr=Math.round(sb*10)/10;
      return sb>PN_SB_CUT ? ['pn_faint','media',['pn_faint',sbr]]
                          : ['pn_bright','media',['pn_bright',sbr]];
    }

    case 'G': case 'GPair': case 'GTrpl': case 'GGroup': {
      if(!hub) return ['elliptical_group','da collaudare',['g_nohub']];
      // E, E-E+, S0, SB0 → continuo puro; S*, I* → spirale/irregolare con regioni HII
      if(/^(E|S0|SB0|SAB0|SA0)/.test(hub)) return ['elliptical_group','media',['g_ell',hub]];
      if(/^(S|I)/.test(hub))               return ['spiral_hii','media',['g_spi',hub]];
      return ['elliptical_group','da collaudare',['g_unk',hub]];
    }

    /* Generici. Qui la scelta prudente non è simmetrica: una sessione a banda
       larga su una nebulosa a emissione porta comunque a casa qualcosa, mentre
       una sessione in banda stretta su una nebulosa a riflessione non porta
       niente. Quindi in dubbio si assume banda larga, e lo si dichiara. */
    /* «Neb» è il secchio dei residui, non una classe. La riflessione ha il suo tipo
       (RfN) e le oscure pure (DrkN), quindi qui resta soprattutto emissione: dei 14
       oggetti con nome comune, 11 sono nebulose a emissione (Laguna, Aquila,
       California, Rosetta, Trifida, Omega, Testa di Scimmia, Stella Fiammeggiante…)
       e 3 sono a riflessione (Iris, Merope, rho Oph). Il primo tentativo era
       «assumi banda larga perché è la scelta prudente»: teoricamente pulito e
       smentito dai dati — undici volte su quattordici avrebbe sbagliato.
       «Other» è un'altra cosa: 419 oggetti, nessuno con nome comune, nessuna base
       per classificarli. Lì la banda larga resta la scelta che non spreca ore. */
    case 'Neb':   return ['hii_classic','da collaudare',['neb']];
    case 'Other': return ['reflection','da collaudare',['generic']];

    case '*': case '**': case 'Nova': return [null,'stella',['star']];
    default: return [null,'escluso',null];
  }
}

/* ---------- alias ---------- */
const CAT_PREFIX=/^(C|UGC|LBN|PK|Cr|Mel|Tr|Stock|Berkeley|King|Basel|Ced|vdB|Barnard|Abell|Sh2)\b/i;
function aliases(r,dupTo){
  const out=[];
  if(r.M) out.push('M'+String(+r.M));
  // "NGC0224" → anche "NGC 224", che è come la gente scrive
  const m=/^(NGC|IC)(\d+)(.*)$/.exec(r.Name);
  if(m) out.push(m[1]+' '+(+m[2])+m[3]);
  for(const cn of (r['Common names']||'').split(',')) if(cn.trim()) out.push(cn.trim());
  for(const id of (r.Identifiers||'').split(',')){
    const s=id.trim();
    if(s&&CAT_PREFIX.test(s)) out.push(s);
  }
  for(const d of dupTo) out.push(d);
  return [...new Set(out)].slice(0,8);
}

/* le righe Dup non sono oggetti: sono nomi alternativi di un oggetto reale */
const dupMap={};
for(const r of rows){
  if(r.Type!=='Dup') continue;
  const target = r.NGC?('NGC'+r.NGC) : r.IC?('IC'+r.IC) : null;
  if(!target) continue;
  (dupMap[target]=dupMap[target]||[]).push(r.Name);
  const m=/^(NGC|IC)(\d+)$/.exec(r.Name);
  if(m) dupMap[target].push(m[1]+' '+(+m[2]));
}

/* ---------- costruzione ---------- */
const stats={}, objects=[];
let skipped=0;
for(const r of rows){
  if(r.Type==='Dup'||r.Type==='NonEx'){ skipped++; continue; }
  const ra=ra2deg(r.RA), de=dec2deg(r.Dec);
  if(ra==null||de==null){ skipped++; continue; }
  const [arch,conf,why]=classify(r);
  if(conf==='escluso'){ skipped++; continue; }
  const a=num(r.MajAx), b=num(r.MinAx);
  const maj=a!=null?Math.round(a*100)/100:(arch?2:1);
  const min=b!=null?Math.round(b*100)/100:maj;
  const mag=num(r['V-Mag'])??num(r['B-Mag']);
  /* Angolo di posizione dell'asse maggiore, da Nord verso Est. Presente su 10.734
     oggetti e — quello che conta — su 4.984 dei 5.034 allungati (a/b >= 1,6), cioè
     esattamente quelli per cui ruotare la camera cambia la risposta. */
  const pa=num(r.PosAng);
  stats[conf]=(stats[conf]||0)+1;
  /* Il nome da mostrare è quello che la gente scrive: «NGC 1300», non «NGC1300».
     La forma compatta resta come alias, così la ricerca trova entrambe. */
  /* Comprende anche i suffissi: «NGC0281A» → «NGC 281A», e le componenti NED dei
     sistemi multipli, «IC0080 NED01» → «IC 80 NED01». */
  const mm=/^(NGC|IC)(\d+)(.*)$/.exec(r.Name);
  const display=mm?`${mm[1]} ${+mm[2]}${mm[3]}` : r.Name;
  const al=aliases(r,dupMap[r.Name]||[]).filter(x=>x!==display);
  if(display!==r.Name) al.unshift(r.Name);
  objects.push([
    display, Math.round(ra*1e4)/1e4, Math.round(de*1e4)/1e4,
    maj, Math.min(min,maj), r.Const||'', r.Type,
    arch, conf, mag!=null?Math.round(mag*10)/10:null,
    al.slice(0,8), why, pa!=null?Math.round(pa):null
  ]);
}

/* I motivi della classificazione stanno in tabella e nell'oggetto resta un codice:
   la stessa frase ripetuta millequattrocento volte costava piu' di tutto il resto. */
const REASONS={
  type:      'il tipo OpenNGC corrisponde direttamente a questo archetipo',
  cln:       'ammasso immerso in nebulosità: il soggetto fotografico è quasi sempre la nebulosa, non le stelle',
  ass:       'associazione stellare, trattata come ammasso aperto',
  pn_bright: 'brillanza superficiale stimata %s: planetaria compatta e luminosa — il problema è la dinamica, non il segnale',
  pn_faint:  'brillanza superficiale stimata %s: planetaria estesa e debole — OIII dominante, servono molte ore',
  pn_nodata: 'Planetaria senza magnitudine o dimensione utilizzabile: la classe non è decidibile dai dati.',
  g_ell:     'morfologia %s: continuo stellare puro, LRGB',
  g_spi:     'morfologia %s: spirale o irregolare, con regioni HII nei bracci',
  g_nohub:   'Galassia senza tipo morfologico in catalogo: assunto LRGB puro, che è la scelta che non spreca ore su un canale Hα che potrebbe non servire.',
  g_unk:     'Morfologia %s non riconosciuta dalla mappatura.',
  neb:       'Il catalogo lo classifica come «Neb», un tipo generico: in OpenNGC riflessione e oscure hanno un tipo proprio, quindi lì resta soprattutto emissione — ma circa una su quattro è a riflessione, ed è esattamente il motivo per cui va collaudata.',
  generic:   'Il catalogo lo classifica come «Other», senza nome comune né altri indizi: assunta banda larga, perché in banda stretta su un continuo non si raccoglie nulla.',
  star:      'stella o coppia di stelle: non è un oggetto deep-sky esteso'
};

const out={
  source:'OpenNGC — mattiaverga/OpenNGC',
  license:'CC-BY-SA-4.0',
  url:'https://github.com/mattiaverga/OpenNGC',
  note:'Strato catalografico. Copre NGC e IC. NON copre Sharpless, Barnard, LDN, vdB, '+
       'planetarie di Abell: quelli stanno nel catalogo curato, che ha la precedenza.',
  built:new Date().toISOString().slice(0,10),
  pn_surface_brightness_cut:PN_SB_CUT,
  fields:['name','ra_deg','dec_deg','maj_arcmin','min_arcmin','constellation','ongc_type',
          'archetype','archetype_confidence','mag','aliases','why','pa_deg'],
  reasons:REASONS,
  objects
};
fs.writeFileSync(OUT,JSON.stringify(out));
const kb=(fs.statSync(OUT).size/1024).toFixed(0);
console.log(`openngc.json — ${objects.length} oggetti, ${kb} KB (${skipped} righe scartate: duplicati, inesistenti, coordinate mancanti)`);
console.log('\ncertezza della classificazione:');
for(const [k,v] of Object.entries(stats).sort((a,b)=>b[1]-a[1]))
  console.log(`  ${k.padEnd(15)} ${String(v).padStart(6)}`);
const byArch={};
objects.forEach(o=>{ if(o[7]) byArch[o[7]]=(byArch[o[7]]||0)+1; });
console.log('\nper archetipo:');
for(const [k,v] of Object.entries(byArch).sort((a,b)=>b[1]-a[1]))
  console.log(`  ${k.padEnd(18)} ${String(v).padStart(6)}`);
