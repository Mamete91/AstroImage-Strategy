/* GATE — LA CATENA TEMPORALE: ORE DI PROGETTO E ORE DI OROLOGIO
   ═══════════════════════════════════════════════════════════════════════════

   Due grandezze che si somigliano, si misurano entrambe in ore, e non sono la
   stessa cosa:

     ORA DI OROLOGIO   quella che passa. E' cio' che si scrive nel sequenziatore,
                       cio' che la notte deve contenere, cio' che si perde quando
                       arrivano le nuvole.

     ORA DI PROGETTO   la profondita' che quell'ora deposita. Sotto un cielo buio
                       un'ora di orologio ne deposita una; con la Luna piena in
                       luminanza ne deposita meno di meta'.

   Il difetto che questo gate impedisce di tornare. Il budget non vedeva il cielo:
   da SQM 21.3 a 17.8 le ore di M51 erano identiche, e il verdetto restava «pieno»
   da Milano come dalla montagna — l'inquinamento entrava solo nel calendario, e
   per giunta con il fattore di UNA banda applicato a tutta la strada. Il piano
   non vedeva la Luna nelle quantita': stava scritto nel codice, «la Luna decide
   COSA mettere in quale notte, non QUANTO», cosi' una notte di plenilunio riceveva
   la stessa quota di una notte buia e il piano si dichiarava chiuso avendo
   depositato molto meno di quel che prometteva. E la Luna stessa era misurata
   contro un cielo naturale invece che contro quello vero, sovrastimandola dai
   siti inquinati.

   Adesso il fabbisogno e' in ore di progetto, la capacita' di una notte e' un
   vettore sui canali, e la conversione fra le due unita' avviene in un punto solo
   e dichiarato.                                                                */

const {M,DB,TG,CAT}=require('./lib/engine.js');

let ok=0, ko=0;
const chk=(what,cond,extra)=>{
  if(cond) { ok++; console.log('  ok   '+what+(extra?'   ['+extra+']':'')); }
  else     { ko++; console.log(' FAIL  '+what+(extra?'   ['+extra+']':'')); }
};
const H=t=>console.log('\n\x1b[1m'+t+'\x1b[0m\n'+'─'.repeat(Math.min(t.length,78)));
const F=(x,n)=>x==null?'—':Number(x).toFixed(n==null?2:n);

const sito=(sqm)=>{const s={lat:46.0167,lon:10.3333,sqm,seeing:1.6,rms:0.6,
  horizonMin:20,clearFrac:0.35}; s.fwhm=M.effFWHM(s.seeing,s.rms); return s;};
const borno=sito(20.8), citta=sito(18.5), vetta=sito(21.6);
const dvMono=M.derive({tel:'tecnosky115',red:0.80,cam:'asi2600mm',mnt:'am5',bin:1});
const m31=TG.targets.find(t=>t.names[0]==='M31');
const m27=TG.targets.find(t=>/M27/.test(t.names[0]));
const npB=M.nightProfile(new Date(2026,8,15),borno.lat,borno.lon);
const piano=(tg,site,date,n,ore,dv)=>{
  const d=dv||dvMono;
  const e=M.evaluate(tg,d,site,M.nightProfile(date,site.lat,site.lon),{});
  const pr=M.prescribe(e,ore,d,1);
  return {e,pr,pl:M.planNights(pr,e,d,n,{site,date})};
};

// ═══════════════════════════════════════════════════════════════════════════
H('A · IL BUDGET VEDE IL CIELO');
// ═══════════════════════════════════════════════════════════════════════════
{
  const ore=[vetta,borno,citta].map(s=>{
    const e=M.evaluate(m31,dvMono,s,npB,{});
    return {sqm:s.sqm,roadH:e.roadH,L:e.budget.L?e.budget.L.useful:null,
            Ha:e.budget.Ha?e.budget.Ha.useful:null};
  });
  ore.forEach(x=>console.log('       SQM '+F(x.sqm,1)+'   strada '+F(x.roadH,1)+' h'+
    '   L utile '+F(x.L,1)+' h   Ha utile '+F(x.Ha,1)+' h'));
  chk('un cielo peggiore chiede piu ore, non le stesse',
    ore[0].roadH<ore[1].roadH&&ore[1].roadH<ore[2].roadH,
    F(ore[0].roadH,1)+' < '+F(ore[1].roadH,1)+' < '+F(ore[2].roadH,1)+' h');
  /* Il difetto vero non era «manca un fattore»: era che il fattore di UNA banda
     veniva applicato a tutta la strada. Un 3 nm e una luminanza non subiscono lo
     stesso cielo, e a SQM 18.5 fra i due fattori corrono dieci volte e mezzo. */
  const kL=ore[2].L/ore[0].L, kHa=ore[2].Ha/ore[0].Ha;
  chk('e il rincaro e per banda: la luminanza paga molto piu della banda stretta',
    kL>kHa*3, 'da SQM 21.6 a 18.5 la L costa x'+F(kL,1)+', l Ha x'+F(kHa,2));
  /* Al cielo di riferimento il fattore deve valere esattamente uno, altrimenti
     tutte le schede sarebbero state riscritte in silenzio. */
  const rif=DB.reference_config.sqm_zenith;
  chk('al cielo di riferimento il fattore vale esattamente 1',
    Math.abs(M.lpPenalty(rif,3)-1)<1e-12&&Math.abs(M.lpPenalty(rif,250)-1)<1e-12,
    'SQM '+rif);
  /* E il rapporto e' quello dei flussi di fondo: mezza magnitudine di cielo in
     piu' e' 10^0.2 volte il fondo, quindi 10^0.2 volte il tempo. Non e' un
     coefficiente scelto: e' il regime limitato dal fondo. */
  const atteso=Math.pow(10,0.4*(21.3-20.8));
  const misurato=1/M.lpPenalty(20.8,250);
  chk('e vale il rapporto dei flussi di fondo, non un coefficiente scelto',
    Math.abs(misurato-atteso)<0.02, 'atteso '+F(atteso,3)+', misurato '+F(misurato,3));
}

// ═══════════════════════════════════════════════════════════════════════════
H('B · IL CIELO NON VIENE CONTATO DUE VOLTE');
// ═══════════════════════════════════════════════════════════════════════════
{
  /* Prima `perNight` valeva `critH x lpF` mentre le ore della strada erano al
     cielo di riferimento: due unita' diverse divise l'una per l'altra. Ora
     entrambe sono ore vere, e il rapporto ha senso dimensionale. */
  const e=M.evaluate(m31,dvMono,citta,npB,{});
  chk('le ore per notte non superano la notte astronomica',
    e.perNight<=(npB.darkH||npB.nautH)+1e-9,
    F(e.perNight,2)+' h su '+F(npB.darkH||npB.nautH,2)+' h di buio');
  chk('e restano positive anche da un cielo pessimo',e.perNight>0,F(e.perNight,2)+' h');
  /* Il controllo che il doppio conteggio non torni: le settimane stimate devono
     crescere col peggiorare del cielo in modo monotono, senza salti quadratici. */
  const w=[vetta,borno,citta].map(s=>M.evaluate(m31,dvMono,s,npB,{}).weeks);
  console.log('       settimane stimate: '+w.map(x=>F(x,1)).join('  →  '));
  chk('le settimane crescono col cielo, monotone',
    w[0]<=w[1]+1e-9&&w[1]<=w[2]+1e-9,w.map(x=>F(x,1)).join(' ≤ '));
}

// ═══════════════════════════════════════════════════════════════════════════
H('C · LA CAPACITA DI UNA NOTTE E UN VETTORE SUI CANALI');
// ═══════════════════════════════════════════════════════════════════════════
{
  const W=M.nightWindows(m31,borno,new Date(2026,8,1),8,{});
  const conLuna=W.nights.filter(x=>x.dMagV>0.5).sort((a,b)=>b.dMagV-a.dMagV)[0];
  chk('esiste almeno una notte con Luna vera nella finestra di prova',!!conLuna,
    conLuna?'dMagV '+F(conLuna.dMagV):'nessuna');
  if(conLuna){
    const p=b=>{const f=M.filterFor(b,dvMono.c), fw=f?f.fwhm_nm:250;
      return M.moonPenalty(b,conLuna.dMagV,fw,false,M.lpExcessFlux(borno.sqm,fw));};
    const pL=p('L'), pHa=p('Ha'), pO=p('OIII');
    console.log('       notte del '+conLuna.date.toLocaleDateString('it-IT')+
      ' (dMagV '+F(conLuna.dMagV)+'): L rende '+F(pL*100,0)+'%, OIII '+F(pO*100,0)+
      '%, Ha '+F(pHa*100,0)+'%');
    chk('la stessa notte rende meno in luminanza che in banda stretta',pHa>pL+0.1,
      F(pHa,2)+' contro '+F(pL,2));
    chk('e l OIII prende piu Luna dell Ha, per Rayleigh',pHa>pO,F(pHa,3)+' > '+F(pO,3));
    /* La Luna si misura sul cielo VERO. Da un sito inquinato conta meno, perche'
       il fondo e' gia' alto: assumere un cielo naturale la sovrastima. */
    const f=M.filterFor('L',dvMono.c), fw=f?f.fwhm_nm:250;
    const pCitta=M.moonPenalty('L',conLuna.dMagV,fw,false,M.lpExcessFlux(citta.sqm,fw));
    const pNatura=M.moonPenalty('L',conLuna.dMagV,fw,false);
    chk('la Luna pesa meno dove il fondo e gia alto, e il motore lo sa',
      pCitta>pNatura+0.02,'in citta '+F(pCitta,2)+', su cielo naturale '+F(pNatura,2));
  }
}

// ═══════════════════════════════════════════════════════════════════════════
H('D · UNA, DUE, TRE E PIU NOTTI');
// ═══════════════════════════════════════════════════════════════════════════
{
  const D=new Date(2026,8,1);
  const {pr,e}=piano(m31,borno,D,3,14.5);
  const b=M.planNights(pr,e,dvMono,60,{site:borno,date:D}).bounds;
  console.log('       fabbisogno '+F(b.need)+' h di progetto · minimo '+b.min+
    ' notti · massimo '+b.max+' · base '+b.mixBasis);
  const esiti=[1,2,3,4,5,8].map(n=>({n,pl:M.planNights(pr,e,dvMono,n,{site:borno,date:D})}));
  esiti.forEach(x=>console.log('       '+x.n+' nott'+(x.n===1?'e':'i')+': '+
    (x.pl.ok?'piano su '+x.pl.nights.length+' notti, '+
      F(x.pl.nights.reduce((a,y)=>a+y.usedH,0))+' h di orologio'
     :'rifiutato — '+x.pl.reason.code)));
  /* Il piano si da' SEMPRE, anche sotto il minimo: quello che cambia e' che sotto
     il minimo arriva con un consiglio e un residuo dichiarato. «Non accorciato in
     silenzio» resta l'invariante — la parola che conta e' `in silenzio`. */
  chk('il piano si costruisce sempre, anche sotto il minimo',
    esiti.every(x=>x.pl.ok&&x.pl.nights.length===x.n),
    esiti.map(x=>x.n+':'+x.pl.nights.length).join(' '));
  chk('e sotto il minimo lo dichiara invece di tacerlo',
    esiti.filter(x=>x.n<b.min).every(x=>(x.pl.advice[0]||{}).code==='poche'&&x.pl.leftover>0),
    'minimo '+b.min);
  chk('dichiarando anche quante notti servirebbero',
    esiti.filter(x=>(x.pl.advice[0]||{}).code==='poche').every(x=>x.pl.advice[0].want>=b.min),true);
  chk('mentre dal minimo in su non resta residuo',
    esiti.filter(x=>x.n>=b.min&&x.n<=b.max).every(x=>x.pl.leftover<0.05),
    esiti.filter(x=>x.n>=b.min&&x.n<=b.max).map(x=>x.n+':'+F(x.pl.leftover,2)).join(' '));
  /* L'invariante che non si negozia: qualunque sia il numero di notti, la
     profondita' depositata e' quella prescritta. */
  const prof=pl=>pl.nights.reduce((a,n)=>a+n.blocks.reduce((x,y)=>x+y.projH,0),0);
  const buoni=esiti.filter(x=>x.pl.ok&&x.n>=b.min);
  chk('e dal minimo in su la profondita depositata resta la prescrizione',
    buoni.every(x=>Math.abs(prof(x.pl)-pr.spent)<0.03),
    buoni.map(x=>x.n+':'+F(prof(x.pl),1)).join(' '));
  /* Sotto il minimo deposita meno, e la differenza e' esattamente il residuo:
     nessuna ora inventata, nessuna ora persa senza dirlo. */
  const corti=esiti.filter(x=>x.pl.ok&&x.n<b.min);
  chk('e sotto il minimo deposita meno, per esattamente il residuo dichiarato',
    corti.every(x=>Math.abs(prof(x.pl)-(pr.spent-x.pl.leftover))<0.05),
    corti.map(x=>x.n+':'+F(prof(x.pl),1)+'/'+F(pr.spent,1)).join(' '));
}

// ═══════════════════════════════════════════════════════════════════════════
H('E · CAPACITA DIVERSE, LUNE DIVERSE');
// ═══════════════════════════════════════════════════════════════════════════
{
  /* Due date scelte per la Luna: novilunio contro plenilunio, stesso oggetto,
     stesso sito, stesso fabbisogno. Le ore di orologio devono differire. */
  const date=[new Date(2026,8,10),new Date(2026,8,1)];
  const out=date.map(D=>{
    const {pr,e}=piano(m31,borno,D,4,14.5);
    const b=M.planNights(pr,e,dvMono,60,{site:borno,date:D}).bounds;
    const pl=M.planNights(pr,e,dvMono,Math.max(4,b.min),{site:borno,date:D});
    const lunaMedia=pl.ok?pl.nights.reduce((a,n)=>a+n.dMagV,0)/pl.nights.length:null;
    return {D,pr,b,pl,lunaMedia,
            ore:pl.ok?pl.nights.reduce((a,n)=>a+n.usedH,0):null};
  });
  out.forEach(x=>console.log('       dal '+x.D.toLocaleDateString('it-IT')+
    ': dMagV medio '+F(x.lunaMedia)+' · minimo '+x.b.min+' notti · '+
    F(x.ore)+' h di orologio per '+F(x.pr.spent)+' h di progetto'));
  const buia=out[0].lunaMedia<out[1].lunaMedia?out[0]:out[1];
  const chiara=buia===out[0]?out[1]:out[0];
  chk('la notte piu chiara costa piu ore di orologio a parita di profondita',
    chiara.ore>buia.ore+0.05,F(chiara.ore)+' h contro '+F(buia.ore)+' h');
  chk('e la capacita per notte e minore dove la Luna e piu forte',
    chiara.b.capacity/chiara.b.windows.nights.length <
    buia.b.capacity/buia.b.windows.nights.length,
    F(chiara.b.capacity/chiara.b.windows.nights.length)+' h contro '+
    F(buia.b.capacity/buia.b.windows.nights.length)+' h per notte');
  /* Il rapporto capacita/orologio e' la resa della notte, e sta fra zero e uno:
     la Luna toglie, non aggiunge. */
  const rese=[];
  for(const x of out) x.b.windows.nights.forEach((nt,i)=>{
    if(nt.availH>0&&x.b.capH[i]!=null) rese.push(x.b.capH[i]/nt.availH); });
  chk('nessuna notte rende piu di quello che dura',rese.every(r=>r<=1+1e-9),
    'massimo '+F(Math.max(...rese),3));
  chk('e nessuna rende zero: la Luna toglie, non annulla',rese.every(r=>r>0),
    'minimo '+F(Math.min(...rese),3));
}

// ═══════════════════════════════════════════════════════════════════════════
H('F · BERSAGLIO BASSO E BERSAGLIO ALTO');
// ═══════════════════════════════════════════════════════════════════════════
{
  const D=new Date(2026,8,15);
  /* Il catalogo curato va da +22.7 a +62.6: non contiene oggetti australi, e
     inventarne uno per far girare il test sarebbe peggio che non farlo. Si prende
     quindi il piu' alto e il piu' basso che esistono davvero — quaranta gradi di
     differenza da 46 N bastano ampiamente a separare le due finestre. */
  const perDec=TG.targets.slice().sort((a,b)=>a.dec_deg-b.dec_deg);
  const basso=perDec[0], alto=perDec[perDec.length-1];
  for(const [et,tg] of [['alto',alto],['basso',basso]]){
    if(!tg){ chk('esiste un bersaglio '+et+' in catalogo',false); continue; }
    const W=M.nightWindows(tg,borno,D,6,{});
    const media=W.nights.length?W.nights.reduce((a,x)=>a+x.availH,0)/W.nights.length:0;
    console.log('       '+et+': '+tg.names[0]+' a dec '+F(tg.dec_deg,1)+'° → '+
      W.nights.length+' notti utili su '+W.scanned+' guardate, '+F(media)+' h medie'+
      (W.skipped.length?'  ('+W.skipped.length+' scartate: '+W.skipped[0].why+')':''));
    chk('il bersaglio '+et+' ha ore per notte coerenti con la sua declinazione',
      W.nights.every(x=>x.availH>0&&x.availH<=(x.darkH||24)),true);
  }
  if(alto&&basso){
    const wa=M.nightWindows(alto,borno,D,6,{}), wb=M.nightWindows(basso,borno,D,6,{});
    const ma=wa.nights.reduce((a,x)=>a+x.availH,0)/Math.max(1,wa.nights.length);
    const mb=wb.nights.reduce((a,x)=>a+x.availH,0)/Math.max(1,wb.nights.length);
    chk('da 46°N un bersaglio alto offre piu ore di uno basso',ma>mb,
      F(ma)+' h contro '+F(mb)+' h');
  }
}

// ═══════════════════════════════════════════════════════════════════════════
H('G · PROGETTO COMPLETABILE E PROGETTO CHE NON SI CHIUDE');
// ═══════════════════════════════════════════════════════════════════════════
{
  const D=new Date(2026,8,15);
  /* Completabile: poche ore su un cielo buono. */
  const A=piano(m31,vetta,D,3,14.5);
  chk('un progetto alla portata si chiude e non lascia residuo',
    A.pl.ok&&A.pl.leftover<0.05,'residuo '+F(A.pl.leftover,3)+' h');
  /* Non completabile: la guardia deve dirlo PRIMA, non consegnare un piano
     che promette una profondita' che non arriva. */
  const B=piano(m31,citta,D,2,60);
  console.log('       da SQM 18.5 con 60 h chieste su 2 notti: '+
    (B.pl.ok?'piano':'rifiutato — '+B.pl.reason.code+': '+B.pl.reason.msg.slice(0,90)));
  /* «Dichiarato tale» non vuol dire «rifiutato». Il piano si da' sempre — anche
     sessanta ore su due notti da un cielo di citta' — e cio' che non ci sta si
     vede: il consiglio dice quante notti servirebbero, il residuo dice quante ore
     restano fuori. Quello che NON deve succedere e' consegnare un piano a meta'
     senza dirlo. */
  console.log('       residuo dichiarato '+F(B.pl.leftover,1)+' h su '+F(B.pl.need,1)+
    ' · consiglio: '+((B.pl.advice[0]||{}).code||'nessuno'));
  chk('un progetto fuori portata riceve comunque un piano',
    B.pl.ok&&B.pl.nights.length>0, B.pl.nights.length+' notti pianificate');
  chk('e viene dichiarato tale: consiglio esplicito e residuo visibile',
    (B.pl.advice[0]||{}).code==='poche'&&B.pl.leftover>0.05,
    'restano fuori '+F(B.pl.leftover,1)+' h');
  chk('i conti tornano: depositate + residuo = fabbisogno',
    Math.abs(B.pl.nights.reduce((a,x)=>a+x.blocks.reduce((b,y)=>b+y.projH,0),0)
             +B.pl.leftover-B.pl.need)<0.05,
    F(B.pl.need-B.pl.leftover,1)+' + '+F(B.pl.leftover,1)+' = '+F(B.pl.need,1)+' h');
  chk('e nessuna notte viene caricata oltre le proprie ore nemmeno li',
    B.pl.nights.every(x=>x.usedH<=x.availH+1e-6),
    B.pl.nights.map(x=>F(x.usedH,1)+'/'+F(x.availH,1)).join(' '));
  /* La prescrizione sotto soglia resta una prescrizione: e' la decisione presa
     quando «non ci sta» e' stato tolto dalla strada. */
  const C=piano(m31,citta,D,4,6);
  chk('sotto soglia il motore prescrive comunque, dichiarandolo',
    C.pr.alloc.some(g=>g.hours>0),
    'livello '+C.pr.level+', canali '+C.pr.alloc.filter(g=>g.hours>0).map(g=>g.id).join('+'));
}

// ═══════════════════════════════════════════════════════════════════════════
H('H · LE ASSEGNAZIONI NON SUPERANO MAI LA CAPACITA REALE');
// ═══════════════════════════════════════════════════════════════════════════
{
  /* La verifica piu' importante del gate, e va fatta a tappeto: su ogni bersaglio,
     su tre cieli, su tre durate, in entrambe le modalita', nessuna notte puo'
     ricevere piu' ore di orologio di quante ne abbia. */
  let casi=0, sforati=[], profOk=0, profKo=[];
  const campione=TG.targets.slice(0,24);
  for(const tg of campione){
    for(const site of [vetta,borno,citta]){
      const D=new Date(2026,8,15);
      const np=M.nightProfile(D,site.lat,site.lon);
      let e,pr; try{ e=M.evaluate(tg,dvMono,site,np,{}); pr=M.prescribe(e,20,dvMono,1); }
      catch(err){ continue; }
      if(!pr||!pr.alloc.some(g=>g.hours>0)) continue;
      const bb=M.planNights(pr,e,dvMono,60,{site,date:D}).bounds;
      for(const mode of ['sessione','progetto']){
        for(const n of [bb.min,bb.min+1,Math.min(bb.max,bb.min+3)]){
          if(!n||n<1||n>bb.max) continue;
          const pl=M.planNights(pr,e,dvMono,n,{site,date:D,mode});
          if(!pl.ok) continue;
          casi++;
          for(const nt of pl.nights)
            if(nt.usedH>nt.availH+1e-6)
              sforati.push(tg.names[0]+'/SQM'+site.sqm+'/'+mode+'/n'+n+': '+
                F(nt.usedH)+' h su '+F(nt.availH));
          const dep=pl.nights.reduce((a,x)=>a+x.blocks.reduce((b,y)=>b+y.projH,0),0);
          if(Math.abs(dep-pr.spent)<0.05) profOk++;
          else profKo.push(tg.names[0]+'/SQM'+site.sqm+'/'+mode+': '+F(dep)+' contro '+F(pr.spent));
        }
      }
    }
  }
  console.log('       '+casi+' piani costruiti su '+campione.length+
    ' bersagli x 3 cieli x 2 modalita x 3 durate');
  chk('nessuna notte riceve piu ore di quante ne abbia',sforati.length===0,
    sforati.length?sforati.slice(0,3).join(' · '):casi+' piani, zero sforamenti');
  chk('e ogni piano deposita esattamente la profondita prescritta',
    profKo.length===0,profKo.length?profKo.slice(0,3).join(' · '):profOk+'/'+casi);
}

// ═══════════════════════════════════════════════════════════════════════════
H('I · I VINCOLI OPERATIVI RESTANO VINCOLI');
// ═══════════════════════════════════════════════════════════════════════════
{
  const D=new Date(2026,8,15);
  const {pr,e}=piano(m31,borno,D,4,20);
  const bb=M.planNights(pr,e,dvMono,60,{site:borno,date:D}).bounds;
  const pl=M.planNights(pr,e,dvMono,Math.max(3,bb.min),{site:borno,date:D});
  chk('l overhead di sessione resta tolto da ogni notte',
    pl.ok&&pl.nights.every(n=>Math.abs(n.clockH-n.availH-pl.bounds.windows.overhead)<1e-6),
    'overhead '+F(pl.bounds.windows.overhead)+' h');
  chk('nessun blocco e una scheggia sotto il minimo utile',
    pl.ok&&pl.nights.every(n=>n.blocks.every(b=>b.h>0.05)),true);
  chk('il canale critico non manca dalle prime notti',
    pl.ok&&pl.nights.slice(0,2).some(n=>n.blocks.some(b=>b.critical)),true);
  /* Il minimo di sessione: un piano non puo' produrre notti da dieci minuti. */
  chk('il massimo di notti nasce dal minimo di sessione, e si dichiara',
    bb.max===Math.min(Math.max(1,Math.floor(bb.need/bb.minSession+1e-9)),
                      bb.windows.nights.length||1),
    F(bb.need)+' h / '+F(bb.minSession)+' h = '+bb.rawMax+' → '+bb.max);
  /* Un canale che in una notte rende pochissimo deve essere spostato altrove,
     non messo li' perche' «tanto le ore ci sono». */
  const D2=new Date(2026,8,1);            // Luna forte all inizio della finestra
  const p2=piano(m31,borno,D2,4,20);
  const b2=M.planNights(p2.pr,p2.e,dvMono,60,{site:borno,date:D2}).bounds;
  const pl2=M.planNights(p2.pr,p2.e,dvMono,Math.max(4,b2.min),{site:borno,date:D2},
    {mode:'progetto'});
  if(pl2.ok){
    const perNotte=pl2.nights.map(n=>({d:n.dMagV,
      L:(n.blocks.find(b=>b.id==='L')||{}).h||0,
      Lp:(n.blocks.find(b=>b.id==='L')||{}).projH||0,
      Ha:(n.blocks.find(b=>b.id==='Ha')||{}).h||0}));
    console.log('       dMagV / ore L / ore Ha per notte: '+
      perNotte.map(x=>F(x.d,1)+' → L '+F(x.L,1)+' Ha '+F(x.Ha,1)).join(' · '));
    /* LA GRANDEZZA GIUSTA E' LA PROFONDITA DEPOSITATA, NON LE ORE DI OROLOGIO.

       Questa verifica confrontava le ORE che la luminanza riceve nelle notti con
       la Luna contro quelle senza, e chiedeva che fossero meno dove la Luna c'e'.
       E' il proxy sbagliato, e si vede dalla definizione stessa del trasporto: le
       righe si chiudono sulla PROFONDITA — somma di ore x resa — non sulle ore.
       Sotto la Luna la stessa profondita' costa piu' ore di orologio, quindi un
       canale presente su una notte lunare ne chiede legittimamente di piu'.

       Lo scoperchiamento e' arrivato correggendo il riferimento dei filtri: la
       luminanza ha cominciato a chiedere il 25% di ore in piu' (l'IDAS finalmente
       prezzato), l'RGB della prima notte e' sceso sotto il minimo operativo e si e'
       spento, e le sue ore sono andate alla L — che su quella notte rende 0.48. Le
       ore della L sulla notte lunare sono salite da 2.20 a 3.38 e la verifica e'
       caduta. Ma la PROFONDITA depositata era ed e' rimasta ordinata:
       1.631 · 1.630 · 2.113 · 2.435 · 2.578 dalla notte peggiore alla migliore.

       Due correzioni sono state provate sull'allocatore e MISURATE come peggiori:
       accorciare la quota della colonna quando una casella si spegne rompe
       l'invariante duro (19.87 h depositate contro 20.00 prescritte su NGC 6888),
       e alzare l'inclinazione del trasporto peggiora sia il deposito (da 162/162 a
       147/162 gia' a tilt 2) sia le inversioni sulla profondita' (da 1812 a 2896 su
       12563 coppie). Il tilt attuale e' il migliore dei valori provati sulla
       grandezza che conta. L'allocatore quindi non si tocca: si corregge il metro. */
    const dep=perNotte.map(x=>({d:x.d,p:x.Lp}));
    let inv=0, peggio=0;
    for(let a=0;a<dep.length;a++) for(let b=a+1;b<dep.length;b++){
      if(Math.abs(dep[a].d-dep[b].d)<1e-6) continue;
      const buona=dep[a].d<dep[b].d?dep[a]:dep[b];      // dMagV piu' basso = meno Luna
      const cattiva=dep[a].d<dep[b].d?dep[b]:dep[a];
      /* Il trasporto e' iterativo — quaranta passate di Sinkhorn — quindi due
         valori che il modello vuole uguali escono uguali a meno di qualche
         millesimo. La tolleranza e' mezzo punto percentuale: sopra quella soglia
         non e' rumore, e' un ordinamento sbagliato. */
      const tol=Math.max(1e-3,0.005*buona.p);
      if(cattiva.p>buona.p+tol){ inv++; peggio=Math.max(peggio,cattiva.p-buona.p); }
    }
    console.log('       profondita depositata in L per notte: '+
      dep.map(x=>F(x.d,1)+' → '+F(x.p,3)).join(' · '));
    chk('la profondita depositata in luminanza segue la Luna, non la contraddice',
      inv===0, inv?inv+' inversioni, la peggiore '+F(peggio,3)+' h':
      dep.length+' notti, ordinamento monotono');
    chk('e la verifica discrimina: fra la notte peggiore e la migliore c e un fattore vero',
      Math.max(...dep.map(x=>x.p))>Math.min(...dep.map(x=>x.p))*1.3,
      'da '+F(Math.min(...dep.map(x=>x.p)),3)+' a '+F(Math.max(...dep.map(x=>x.p)),3)+' h');
    /* Le ore di orologio restano stampate come contesto: e' il numero che l'utente
       vede nel sequenziatore, e sapere che sale sotto la Luna e' utile. */
    const conLuna=perNotte.filter(x=>x.d>0.5), senza=perNotte.filter(x=>x.d<=0.5);
    if(conLuna.length&&senza.length){
      const qL=a=>a.reduce((s,x)=>s+x.L,0)/a.length;
      console.log('       ore di orologio in L: con Luna '+F(qL(conLuna))+
        ' h · senza '+F(qL(senza))+' h — sotto la Luna la stessa profondita costa di piu');
    }
  } else chk('il piano di controllo si costruisce',false,pl2.reason.code);
}

// ═══════════════════════════════════════════════════════════════════════════
H('OGNI POSA CONSIGLIATA DEVE ESSERE CALIBRABILE');
// ═══════════════════════════════════════════════════════════════════════════
{
  /* Una posa vive solo se esiste il master dark che la sottrae. Le librerie si
     costruiscono una volta e si tengono per anni, a temperatura e guadagno fissi,
     sui tempi canonici; consigliare 420 s o 45 s significa consigliare una notte
     che in elaborazione non si puo' calibrare. Non e' una preferenza estetica: e'
     un vincolo, e vale su TUTTI i percorsi che producono un numero di secondi.

     Il difetto arrivava dal campo, da una schermata di piano: «420 s x 53» per la
     luminanza e «45 s x 11» per R, G e B. Nessuno dei due era sbagliato quanto a
     efficienza — erano l'ottimo di EQUILIBRIO sulla vecchia griglia — ed entrambi
     erano inutilizzabili. */
  const SCALA = M.EXP_GRID;
  chk('la scala contiene solo tempi da libreria dark',
    SCALA.every(t => [10, 15, 20, 30, 60, 120, 180, 240, 300, 600, 900].indexOf(t) >= 0),
    SCALA.join(' · ') + ' s');
  chk('e non contiene i tempi che nessuno usa',
    [45, 90, 150, 360, 420, 480, 720].every(t => SCALA.indexOf(t) < 0));
  chk('la scala e crescente e senza doppioni',
    SCALA.every((t, i) => i === 0 || t > SCALA[i - 1]));

  const stX = { lat: 46.0167, lon: 10.3333, sqm: 20.8, seeing: 1.6, rms: 0.6, horizonMin: 20, clearFrac: 0.35 };
  stX.fwhm = M.effFWHM(stX.seeing, stX.rms);
  const CONF = [['askar71f', 'asi2600mc', 0.75], ['rc8', 'asi2600mm', '1'],
                ['tecnosky115', 'asi2600mm', 0.80], ['redcat51', 'asi2600mc', 0.92],
                ['askar_fra400', 'asi2600mm', '1'], ['sw200n', 'asi2600mc', '1'],
                ['c8', 'asi2600mm', '1'], ['samyang135', 'asi2600mc', '1']];
  const BANDE = ['Ha', 'OIII', 'SII', 'L', 'R', 'G', 'B', 'RGB', 'Ha+OIII'];

  /* Tutte e tre le strategie, non solo quella di riferimento: 420 e 45 nascevano
     proprio in EQUILIBRIO e DINAMICA, che cercano un gradino piu' corto di RESA. */
  let provate = 0; const fuori = {};
  for (const [tel, cam, red] of CONF) {
    const dv = M.derive({ tel, red, cam, mnt: 'am5', bin: 1 });
    for (const b of BANDE) for (const q of [21.3, 20.8, 19.5, 18.5, 17.8]) {
      let S; try { S = M.exposureStrategies(dv, Object.assign({}, stX, { sqm: q }), b, {}); } catch (e) { continue; }
      for (const k of ['resa', 'equilibrio', 'dinamica']) {
        const e = S[k]; if (!e || !e.sec) continue;
        provate++;
        if (SCALA.indexOf(e.sec) < 0) fuori[e.sec] = (fuori[e.sec] || 0) + 1;
      }
    }
  }
  chk('nessuna delle tre strategie esce dalla scala',
    Object.keys(fuori).length === 0,
    provate + ' pose provate' + (Object.keys(fuori).length ? ' — FUORI: ' +
      Object.keys(fuori).sort((a, b) => a - b).map(x => x + ' s x' + fuori[x]).join(', ') : ''));

  /* La serie corta per il nucleo non passa dalla griglia ma dalle schede: anche
     quella deve essere un tempo che si trova in libreria. */
  const corte = {};
  for (const k of Object.keys(TG.archetypes)) {
    const a = TG.archetypes[k];
    if (a.hdr_short_s) corte[a.hdr_short_s] = 1;
  }
  chk('anche le pose corte per il nucleo sono tempi canonici',
    Object.keys(corte).every(t => [5, 10, 15, 20, 30].indexOf(+t) >= 0),
    Object.keys(corte).sort((a, b) => a - b).join(' · ') + ' s');

  /* I tetti dichiarati dalle schede devono esistere sulla scala, altrimenti il
     tetto diventa in silenzio il gradino sotto. E' la ragione per cui la scala
     tiene il 240 anche se non e' fra i piu' comuni. */
  const tetti = {};
  for (const k of Object.keys(TG.archetypes)) {
    const a = TG.archetypes[k];
    if (a.sub_max_s) tetti[a.sub_max_s] = 1;
  }
  const mancanti = Object.keys(tetti).filter(t => SCALA.indexOf(+t) < 0);
  chk('ogni tetto di posa dichiarato dalle schede esiste sulla scala',
    mancanti.length === 0,
    mancanti.length ? 'assenti: ' + mancanti.join(', ') + ' s'
                    : Object.keys(tetti).sort((a, b) => a - b).join(' · ') + ' s');
}

// ═══════════════════════════════════════════════════════════════════════════
H('IL RIFERIMENTO NON DIPENDE DA CHI LO INTERROGA');
// ═══════════════════════════════════════════════════════════════════════════
{
  /* La posa del riferimento e' il denominatore di ogni `timeFactor`, cioe' il metro
     con cui le ore delle schede vengono riscalate sulla tua strumentazione. Si
     calcolava pero' con `filterFor`, che legge la ruota di CHI USA L'APP: con i
     filtri da 3 nm usciva 600 s, con un L-eNhance 120 s, e da li' cambiavano le ore
     prescritte. Il valore veniva poi memoizzato e mai invalidato, quindi cambiando
     filtri a sessione avviata restava congelato quello di prima: lo stesso caso
     fisico dava numeri diversi a seconda dell'ORDINE in cui lo si era interrogato.

     Un metro che cambia con chi misura non e' un metro. */
  const fsx = require('fs'), pathx = require('path');
  const ROOTx = pathx.join(__dirname, '..');
  const srcx = fsx.readFileSync(pathx.join(ROOTx, 'index.html'), 'utf8');
  const purex = srcx.split('<script>')[1].split('</script>')[0]
    .split('/* =====================================================================\n   UI')[0];
  const DBx = JSON.parse(fsx.readFileSync(pathx.join(ROOTx, 'data', 'setups.json'), 'utf8'));
  const TGx = JSON.parse(fsx.readFileSync(pathx.join(ROOTx, 'data', 'targets.json'), 'utf8'));
  const CATx = JSON.parse(fsx.readFileSync(pathx.join(ROOTx, 'data', 'catalog.json'), 'utf8'));
  const CITx = JSON.parse(fsx.readFileSync(pathx.join(ROOTx, 'data', 'cities.json'), 'utf8'));

  chk('la ruota di riferimento e dichiarata nei dati',
    Array.isArray(DBx.reference_config && DBx.reference_config.filters) &&
    DBx.reference_config.filters.length > 0,
    (DBx.reference_config.filters || []).join(' '));
  chk('e ogni suo filtro esiste nel catalogo',
    (DBx.reference_config.filters || []).every(id => DBx.filters.some(f => f.id === id)));

  /* Il metro va misurato con ruote diverse: se cambia, non e' un metro. */
  const conRuota = ruota => {
    const OWNEDx = ruota.slice();
    const ctxx = { DB: DBx, TG: TGx, CAT: CATx.objects, CITIES: CITx.cities, OWNED: OWNEDx,
      console, Math, Date, Object, JSON, isFinite, parseFloat, parseInt, Number, window: {} };
    const Mx = new Function(...Object.keys(ctxx), purex +
      `return {refSubFor,derive,evaluate,prescribe,nightProfile,effFWHM,timeFactor};`)(...Object.values(ctxx));
    return { rif: ['Ha', 'OIII', 'SII', 'L'].map(b => Mx.refSubFor(b)), M: Mx, OWNED: OWNEDx };
  };
  const RUOTE = [
    ['3 nm', ['ha3', 'o3_3', 's2_3', 'lum', 'red', 'grn', 'blu']],
    ['12 nm', ['ha12', 'o3_12', 's2_12', 'lum', 'red', 'grn', 'blu']],
    ['L-eNhance', ['lenh', 'lum', 'red', 'grn', 'blu']],
    ['L-Ultimate', ['lult', 'idas']],
    ['di serie', DBx.default_filters],
  ];
  const primo = conRuota(RUOTE[0][1]).rif;
  let diverse = [];
  for (const [nome, r] of RUOTE) {
    const v = conRuota(r).rif;
    console.log('       ' + String(nome).padEnd(12) + 'posa di riferimento ' + v.join(' · ') + ' s');
    if (v.join(',') !== primo.join(',')) diverse.push(nome);
  }
  chk('la posa di riferimento e la stessa con qualunque ruota', diverse.length === 0,
    diverse.length ? 'cambia con: ' + diverse.join(', ') : 'identica su ' + RUOTE.length + ' ruote');

  /* E non deve restare congelata: cambiare ruota a sessione avviata deve dare lo
     stesso risultato di una sessione nata gia' cosi'. */
  const A = conRuota(['ha12', 'o3_12', 's2_12', 'lum', 'red', 'grn', 'blu']);
  const B = conRuota(['ha3', 'o3_3', 's2_3', 'lum', 'red', 'grn', 'blu']);
  B.M.refSubFor('Ha'); B.M.refSubFor('OIII');            // fissa la cache con la vecchia ruota
  B.OWNED.length = 0; ['ha12', 'o3_12', 's2_12', 'lum', 'red', 'grn', 'blu'].forEach(x => B.OWNED.push(x));
  const stx = { lat: 46.0167, lon: 10.3333, sqm: 20.8, seeing: 1.6, rms: 0.6, horizonMin: 20, clearFrac: 0.35 };
  stx.fwhm = A.M.effFWHM(1.6, 0.6);
  const npx = A.M.nightProfile(new Date(2026, 8, 11), stx.lat, stx.lon);
  const ore = K => {
    const dv = K.M.derive({ tel: 'tecnosky115', red: 0.80, cam: 'asi2600mm', mnt: 'am5', bin: 1 });
    const t = TGx.targets.find(x => /Velo/i.test(x.names.join(' ')));
    const pr = K.M.prescribe(K.M.evaluate(t, dv, stx, npx, {}), 6.4, dv, 1);
    const g = {};
    for (const a of pr.alloc) for (const b of (a.bands || [a.id])) g[b] = (g[b] || 0) + a.hours / (a.bands || [a.id]).length;
    return g.OIII || 0;
  };
  const oA = ore(A), oB = ore(B);
  console.log('       nata con i 12 nm ' + F(oA, 3) + ' h   ·   passata ai 12 nm ' + F(oB, 3) + ' h');
  chk('cambiare ruota a sessione avviata non lascia il metro congelato',
    Math.abs(oA - oB) < 1e-6, 'scarto ' + F(Math.abs(oA - oB), 4) + ' h');

  /* IL METRO DEVE RESTARE NEUTRO SU SE STESSO — e «se stesso» comprende la ruota.

     Questa verifica prima costruiva il modulo `R` con una ruota e poi chiamava
     `M.timeFactor` del modulo ESTERNO: due motori diversi, e passava lo stesso
     perche' il riferimento prendeva in prestito i filtri di chi lo interrogava,
     quindi numeratore e denominatore si semplificavano comunque.

     Adesso il denominatore sta sotto `reference_config.filters`, e l'identita' vale
     nella sua forma vera: stessa ottica E stessa ruota del riferimento -> uno esatto
     su ogni banda. Con una ruota diversa il fattore NON deve valere uno, ed e' il
     punto: `default_filters` contiene un IDAS, e `filterFor` lo sceglie per la
     luminanza al posto del `lum` del riferimento. Riprendere la L attraverso un
     filtro anti-inquinamento costa il 25% di tempo in piu', e prima quel costo
     spariva perche' anche il metro passava dall'IDAS. */
  const RIF = conRuota(DBx.reference_config.filters);
  const dvR = RIF.M.derive({ tel: DBx.reference_config.telescope, red: DBx.reference_config.reducer,
                             cam: DBx.reference_config.camera, mnt: 'am5', bin: 1 });
  const bandeRif = ['Ha', 'OIII', 'SII', 'L', 'R', 'G', 'B'];
  chk('la configurazione di riferimento, con la ruota del riferimento, vale uno esatto',
    bandeRif.every(b => Math.abs(RIF.M.timeFactor(dvR, b) - 1) < 1e-12),
    bandeRif.map(b => b + ' ' + RIF.M.timeFactor(dvR, b).toFixed(6)).join(' · '));

  const ALT = conRuota(DBx.default_filters);
  const dvA = ALT.M.derive({ tel: DBx.reference_config.telescope, red: DBx.reference_config.reducer,
                             cam: DBx.reference_config.camera, mnt: 'am5', bin: 1 });
  chk('e la banda stretta resta uno anche con una ruota piu ricca: il metro non si muove',
    ['Ha', 'OIII', 'SII'].every(b => Math.abs(ALT.M.timeFactor(dvA, b) - 1) < 1e-12),
    ['Ha', 'OIII', 'SII'].map(b => b + ' ' + ALT.M.timeFactor(dvA, b).toFixed(6)).join(' · '));
  chk('mentre la luminanza attraverso un IDAS costa piu del lum del riferimento',
    ALT.M.timeFactor(dvA, 'L') > 1.05,
    'L ' + ALT.M.timeFactor(dvA, 'L').toFixed(4) + ' contro 1.000000 del riferimento');
}

console.log('\n'+(ko?'\x1b[31m':'\x1b[32m')+ok+' verifiche superate, '+ko+' fallite\x1b[0m');
if(ko) process.exitCode=1;
module.exports={ok,ko};
