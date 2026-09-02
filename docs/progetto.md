# Astro Imaging Strategy — Documento di progetto
*(nome interno di lavoro: Strategia di Ripresa)*

*Stato: **v1.2 costruita e verificata** — catena chiusa fino a N.I.N.A., audit del modello del cielo, e il pianificatore a due modalità: la sessione autonoma è ora il default. Codice in `C:\Users\aless\Documents\ASTROFOTO`. Ultimo aggiornamento: 1 settembre 2026. **309 verifiche.***

---

## 0-ter. Rifinitura UX — v1.1

Il motore non cambia di una riga; cambia quanto è evidente cosa sa fare.

**Nome.** *Astro Imaging Strategy* al centro della barra, sulla stessa riga del nome
interno, in assoluto: non entra nel flusso, non cambia l'altezza della barra, non
intercetta i clic. «Come lo riprendo» resta dov'era — nome dell'app e nome della funzione
sono due livelli distinti.

**Il colore come linguaggio.** Cinque funzioni, cinque colori, gli stessi ovunque:
azzurro azione principale, viola configurazione e strumentazione, verde-acqua piano delle
notti, arancio inquadratura e rotatore, verde quello che esporti. Contorno tinto per le
funzioni secondarie, pieno solo per l'azione principale di ogni contesto — il colore
distingue senza gridare. In modalità notte le cinque famiglie restano distinguibili
**dentro la gamma del rosso**: un verde pieno lì vanificherebbe mezz'ora di adattamento.

**Il bacino della classifica — la correzione che conta.** «I migliori stanotte» girava su
**tredici** schede: un motore dinamico applicato a un campione minuscolo. Ora gira su
tutto lo strato curato — 169 oggetti scelti perché vale la pena riprenderli — più le
schede e gli oggetti dell'utente: **176**, valutati con lo stesso `evaluate` della
prescrizione, sulla stessa configurazione e sulla stessa notte. Nessun secondo
classificatore, nessuna graduatoria precalcolata. Costa 30 ms per refresh.

OpenNGC intero resta fuori per scelta: tredicimila galassie anonime non sono una lista di
consigli, e il curato è per costruzione lo strato «questo merita». Chi cerca un NGC
qualsiasi lo trova scrivendolo.

**I chip.** Dodici invece di quattro, e con addosso il perché — classe fisica e ore utili.
Un nome da solo non è un consiglio, è un indovinello. Il clic scrive e prescrive.

**La spiegazione dove serve.** Il paragrafo introduttivo era permanente e occupava spazio
sopra le scelte: ora è un tooltip sull'etichetta «Cosa vuoi riprendere», cioè esattamente
nel punto in cui si decide.

---

## 0-bis. Il caso M56 — il difetto trovato provando

Alessandro cerca **M56**. L'app risponde *«nessuna scheda»* e apre un modulo da compilare,
con la tendina archetipo posizionata sul primo elemento: **«Regione HII fotoionizzata
classica»**.

### Cosa era vero e cosa no

Il catalogo **sapeva già tutto**: `M56 · globular · Lyra · 289.15 / +30.18 · 7′ ·
archetype: cluster`. L'archetipo `cluster` diceva già *«nessuna emissione, banda stretta
assolutamente controindicata»*. Nessuna prescrizione HII è mai stata calcolata per M56 —
quella tendina era un modulo vuoto che mostrava il suo default, non una classificazione.

Ma un default plausibile e sbagliato è comunque una trappola: bastava non toccarlo per
salvare un globulare come regione HII e ottenere Ha/OIII/SII dall'aria scientifica.

**Il difetto vero non era la mancanza di schede: era il vicolo cieco.** L'app chiedeva
all'utente di ricopiare a mano quello che sapeva già.

### Le tre correzioni

1. **Prescrizione diretta dal catalogo.** `synthTarget(cat, archetipo)` compone i due
   strati e produce una scheda di classe completa — budget, ordine, resa attesa, trappole.
   Niente modulo. La risposta a `M56` è ora *«ammasso globulare in Lira, 7′, niente banda
   stretta, RGB 2,5 h + L 1,5 h in 4 ore, il problema è il nucleo che satura»*, con un
   banner **confidenza bassa** sopra il numero, non sotto.
2. **Nessun archetipo di default.** La tendina parte da *«— non determinato —»*, e finché
   resta lì non viene proposto nessun budget; il salvataggio è rifiutato. Il catalogo la
   determina da solo appena riconosce il nome.
3. **Archetipi arricchiti.** Tutti e 13 hanno ora `order`, `expect` (2-3 soglie) e `traps`
   di **classe**. Senza, la scheda sintetica diceva *«nessuna trappola documentata»*, che è
   un segnaposto travestito da informazione. I test rifiutano archetipi con trappole sotto
   i 60 caratteri.

### Lo split `cluster`

Diviso in **`cluster_globular`** (29 oggetti) e **`cluster_open`** (30). Condividono solo
«niente banda stretta»:

| | Problema reale | Conseguenza in ripresa |
|---|---|---|
| Globulare | **Dinamica**: il nucleo satura molte magnitudini prima che la periferia esca dal fondo | Serie di pose corte da fondere; il pregio è quante stelle separi nel nucleo, e lo decide il **seeing** |
| Aperto | **Colore** e qualità del campo: bordi, vignettatura, aloni | Si chiude in 1,5 h; soggetto giusto per le notti con la Luna |

Il ritag è venuto dal campo `type` già presente: nessuna ipotesi. Le Pleiadi restano
`reflection` — lì il soggetto fotografico è la nebulosità, non l'ammasso, e il test che
sbagliava era il mio.

### L'architettura che ne esce, in una riga

**Molti oggetti catalogati · pochi archetipi affidabili · poche schede molto approfondite.**
169 / 13 / 13 oggi; il primo numero può crescere di due ordini di grandezza senza toccare
gli altri due, ed è esattamente il punto.

---

## 0. Correzioni importanti rispetto alle versioni precedenti di questo documento

| Cosa | Valore vecchio (errato) | Valore corretto |
|---|---|---|
| Riduttore Askar 71F | 0,80x → 392mm | **0,75x → 367mm** |
| Riduttore RC8 | 0,75x → 1218mm | **0,80x → 1300mm** |
| Riduttore Tecnosky 115 | 0,80x → 640mm | 0,80x → 640mm ✓ |
| Seeing a Borno | 3-4″ tipico | **1,0-2,4″ (tipico ~1,6″)** |
| Rapporto focale RC8 | "f/9,52 efficaci" | **f/8, con trasmissione 70% come grandezza separata** |
| SQM di Borno | 21,5 stimato | **20,80** (misura sul campo: 20,50-20,90, mai 21) |
| Verifiche del motore | 37 | **225** |

⚠️ **Tutto il materiale precedentemente derivato dal progetto PHD2 Adaptive Agent è stato rimosso**: quel sistema è superato, la versione corrente sta sul Lenovo e non è visibile da questa sessione. Nessun parametro va più preso da lì.

### Rapporto focale ≠ trasmissione

Due grandezze diverse che vanno tenute separate, e che una versione precedente di questo documento confondeva:

- Il **rapporto focale** è geometria pura, focale ÷ diametro. **Un RC8 è f/8**, e resta f/8.
- La **trasmissione** è quanta luce arriva davvero. Sull'RC8: il 45% di ostruzione lineare toglie il 20% dell'area, due specchi al 94% ne tolgono un altro 12% → **70%**.

Tradurre la seconda in un "f/ efficace" nasconde una perdita facendola sembrare geometria. Il tempo si calcola dal **tasso di segnale per pixel** — `A_eff × Ω_px` — non da un rapporto focale corretto a mano.

### La conseguenza più importante: una conclusione ritirata

Con seeing reale 1,0-2,4″, **l'RC8 a piena focale (0,478″/px) è campionato correttamente** quando la guida tiene, non sovracampionato per costruzione. La precedente diagnosi "strumento sbagliato su NGC 6888" era basata sul dato di seeing stantio ed **è ritirata**.

La diagnosi corretta è diversa e più utile: *il telescopio era giusto, il budget non era scalato al telescopio*. Fra RC8 nativo e configurazione di riferimento c'è un fattore **×2,81** sul tempo. La soglia SII passa da 5h a **14,0h**: le 1,5h riprese erano **9,4× sotto soglia**.

---

## 1. Il concetto

```
Input  =  oggetto × strumentazione × cielo
Output =  tecnica, filtri, ripartizione del tempo, ordine, risultato atteso, trappole
```

Non un planetario, non un planner: un **motore di strategia di acquisizione**. I planetari dicono *dove* sta un oggetto; questo dice **come riprenderlo**.

### Il buco di mercato (verificato)

| Software | Cosa risolve | Dove si ferma |
|---|---|---|
| Telescopius / Stellarium / AstroPlanner | Geometria: visibilità, FOV, mosaici | Zero fotometria, zero banda di emissione |
| SharpCap Smart Histogram / NINA Exposure Calc | Posa singola (teoria Glover) | Cieco all'oggetto |
| NINA Target Scheduler / Voyager / SGP | Esegue un piano | Non lo genera |
| AstroBin | Unico "database" reale | Implicito, non strutturato |

---

## 2. Il collo di bottiglia è il dato

| Banda | Dato disponibile | Utilizzabilità |
|---|---|---|
| **Hα** | Mappa composita Finkbeiner 2003 (WHAM+VTSS+SHASSA); IPHAS/VPHAS+/MDW | **Buona** |
| **[OIII]** | **Nessuna survey all-sky** | **Il buco nero del progetto** |
| **[SII]** | Nulla di sistematico | Peggio |
| **Planetarie** | HASH DB + catalogo Frew + rapporti Acker/Strasbourg | **Ottima** |
| **Galassie** | HyperLEDA / RC3 | Sufficiente per LRGB |
| **IFN / riflessione** | Stime broadband (27-28 mag/arcsec²) | Segnale puro |

Da qui l'obbligo editoriale di **dichiarare la confidenza** su ogni riga.

---

## 3. Architettura

- **Strato astrofisico** (`data/targets.json`) — statico, curato, versionato, incertezza esplicita. Indipendente dalla strumentazione. **È il valore.**
- **Strato strumentale** (`data/setups.json` + runtime) — ~12 numeri, due formule. **È aritmetica.**

È questo disaccoppiamento a evitare l'esplosione combinatoria: le schede non conoscono la strumentazione, la strumentazione non conosce gli oggetti.

### Le due formule

```
Oggetto esteso:     e⁻/s/px ∝ A_eff · Ω_px       → rapporto focale, pixel, trasmissione
Oggetto puntiforme: SNR ∝ D·√t / θ_FWHM          → apertura e seeing
```

| Configurazione | Focale | Scala (bin 1) | f/ | Trasmissione | Fattore tempo |
|---|---|---|---|---|---|
| RC8 nativo | 1624 mm | 0,478″/px | **f/8,0** | 70% | ×2,81 |
| RC8 0,80x | 1300 mm | 0,597″/px | f/6,4 | 70% | ×1,80 |
| Tecnosky nativo | 800 mm | 0,969″/px | f/7,0 | 96% | ×1,56 |
| **Tecnosky 0,80x** (riferimento) | 640 mm | 1,212″/px | **f/5,6** | 96% | **×1,00** |
| Askar nativo | 490 mm | 1,583″/px | f/6,9 | 95% | ×1,55 |
| Askar 0,75x | 367 mm | 2,113″/px | f/5,2 | 95% | ×0,87 |

L'ostruzione dell'RC8 è ciò che rende il suo ×2,81 peggiore di quanto suggerirebbe il solo rapporto (8,0/5,6)² = 2,04.

### La catena del campionamento

Tre grandezze, tutte modificabili a mano nel pannello perché nessuna ha un valore di catalogo che significhi qualcosa:

```
FWHM reale = √( seeing² + (1,7 · RMS)² )
pixel effettivo = pixel × bin        scala = 206,265 × pixel_eff / focale
intervallo corretto = FWHM/3,5  …  FWHM/1,8
```

Il seeing appartiene al **sito**, l'RMS alla **montatura**, il binning alla **notte**. È la FWHM reale — non il seeing nudo — a decidere il verdetto: sull'RC8 nativo con seeing 1,6″, guida perfetta dà *corretto* e guida a 1,3″ RMS dà *sovracampionato*. Stesso telescopio, stesso cielo, verdetto opposto.

### Cosa il modello fa e cosa no
- Il fondo cielo in banda stretta **non** deriva dall'SQM: in narrowband il pavimento è l'airglow
- Luna: **Krisciunas & Schaefer 1991** — altezza lunare, **separazione angolare**, fase, banda. La separazione conta spesso più della fase
- Estinzione per banda: k(500nm)=0,199 contro k(656nm)=0,090, **rapporto 2,2**
- **La Luna non spegne la notte: riordina la lista**
- L'**inquinamento luminoso invece non si media**: c'è tutte le notti, quindi entra anche nel calcolo strategico delle settimane. La Luna no, perché il novilunio torna

---

## 4. Binning di ripresa — il mito da smontare

Il binning è nella catena perché ne chiude un pezzo: `pixel → scala → campionamento → ore`. Ma va capito bene, e quasi tutti lo raccontano male.

**Sui CMOS il binning non è quello che era sui CCD.** Sul CCD i pozzetti si sommavano *prima* della lettura e il read noise restava uno: segnale ×4, rumore ×1, **SNR ×4**. Sui CMOS la somma è digitale e avviene *dopo*, quindi su 2×2 il read noise si somma in quadratura e raddoppia: segnale ×4, rumore ×2, **SNR ×2**.

**Corretto in v1.4.** Qui c'era scritto «÷4 sul tempo»: è vero **per pixel** e falso per unità di angolo solido, che è la metrica con cui si misura la profondità di un'immagine. Il conto: `RN_binnato = RN·bin` e `Ω_px ∝ bin²`, quindi `RN²/Ω_px` e `d_px/Ω_px` non cambiano — il binning è **esattamente neutro sul tempo necessario** (verificato a bin 1, 2, 3 e 4). Non crea fotoni. Quello che cambia davvero: il **campionamento**, il **duty cycle** (meno dati da scaricare, più pose per ora di orologio) e lo spazio su disco. Ed è lo stesso guadagno che si ottiene binnando in elaborazione: la decisione resta reversibile.

> **La decisione è quindi reversibile.** Si riprende a bin 1; se la nottata è venuta con FWHM larga si bina in post, se è venuta buona ci si tiene la risoluzione. Quello che si risparmia binnando in ripresa è spazio disco e tempo di calibrazione, non fotoni.

L'eccezione sono i sensori con un *modo* nativo diverso: l'ASI294MM in «bin 2» è il modo 4,63 µm reale, non una somma. Lì la scelta è irreversibile davvero. Non riguarda le 2600.

Il consiglio in app propone il **binning più alto che resta in campionamento corretto** rispetto alla FWHM di stanotte:

| Configurazione | FWHM | Consiglio |
|---|---|---|
| RC8 nativo, 0,48″/px | 2,0″ | *valuta bin 2* → 0,96″/px, campionamento corretto, stesse ore |
| RC8 nativo, 0,48″/px | 1,4″ | *bin 1* — bin 2 butterebbe risoluzione disponibile |
| Askar 0,75x, 2,11″/px | qualunque | *bin 1* — già sottocampionato, binnare è solo perdita |

**Correzione al punteggio resa necessaria dal binning**: il termine di campionamento pesa ora 0,12 (era 0,08) e penalizza il sottocampionamento in proporzione alla risoluzione buttata via. Senza, bastava alzare il binning per far salire il punteggio di ogni oggetto — barare con sé stessi in modo strutturale.

---

## 5. Doppio livello di budget — ideale e ridotto

Ogni canale aveva tre numeri: **soglia**, **utile**, **satura**. Ora ne ha un quarto, il **livello ridotto**:

```
ridotto = max( soglia , k × utile )      k = 0,60 sul canale critico
                                         k = 0,40 sugli altri
```

Due regole, entrambe l'opposto di "dimezza tutto":

1. **Mai sotto la soglia.** Sotto quella il canale restituisce rumore colorato e le ore sono perse due volte — prima a raccoglierle, poi a spegnere quello che hanno raccolto. Dimezzare a tappeto è esattamente l'errore che ha bruciato 1,5h di SII sulla Crescent.
2. **Il canale critico si taglia meno.** È quello che decide se l'immagine si riconosce.

Risultato sui 13 target: il totale ridotto viene fra il **52% e il 63%** del progetto pieno — non il 50% secco. La differenza sta tutta nei canali dove la soglia blocca il taglio: **29 canali su 47** finiscono appoggiati alla soglia, e l'app li elenca (*«il taglio non tocca Hα, SII, RGB — su questi canali non esiste la mezza misura»*).

Esempio, NGC 6888 su RC8 nativo + 2600MM, strada HOO + stelle RGB:

| Canale | Soglia | Utile | Ridotto |
|---|---|---|---|
| Hα | 4,2 h | 8,4 h | **4,2 h** — non si taglia |
| OIII (critico) | 11,2 h | 22,5 h | **13,5 h** |
| SII | 14,0 h | 22,5 h | **14,0 h** — non si taglia |
| RGB | 1,4 h | 2,8 h | **1,4 h** — non si taglia |
| **Totale strada** | | **34 h** | **19 h (57%)** |

Se le soglie mangiassero più dell'85% del budget l'app direbbe che la **versione ridotta non esiste**. Con i dati attuali non capita mai: il ramo resta come guardia per gli oggetti aggiunti dagli utenti e per schede future.

⚠️ **Il livello ridotto è derivato, non curato.** Nasce da soglia e utile con una regola fissa: vale esattamente quanto valgono le soglie. Il che rende `floor` doppiamente critico nella scrittura di una scheda — è insieme l'avvertimento di non iniziare e il pavimento del progetto ridotto.

---

## 5-bis. Il motore di prescrizione — «quante ore hai?»

La domanda che l'app poneva era *cosa conviene riprendere stanotte*. Quella che pone
adesso è **cosa riesci davvero a portare a casa**, e cambia le risposte, non solo la
presentazione.

L'input è **ore totali dedicabili all'oggetto** (non di una notte sola: in banda stretta
nessun progetto si chiude in una notte, ed è l'unità che i testi editoriali già usavano —
«sotto le 12h disponibili nella finestra stagionale»).

### La strada segue le ore
Le strade in scheda smettono di essere descrittive. Per ognuna si sommano i canali che le
appartengono (quelli senza vincolo più quelli che dichiarano `road: <id>`) e si sceglie **la
più ambiziosa che ci sta**. Su NGC 6888, configurazione di riferimento:

| Ore | Strada scelta | Livello |
|---|---|---|
| 8 h | HOO | ridotto |
| 14 h | HOO | pieno |
| 20 h | SHO | pieno |

Che è esattamente quello che dicono i `when` scritti a mano nella scheda («sotto le 12h» /
«sopra le 18h»): il motore riproduce l'indicazione editoriale partendo dai numeri. Se una
scheda non distingue i canali fra due strade, le due strade costano uguale — e l'app **lo
dichiara** invece di fingere una scelta.

### Cinque livelli, non due
`pieno` · `ridotto` · `minimo` · **`parziale`** · `insufficiente`.

Il livello che conta è **parziale**: ore che non bastano per tutta la strada ma bastano per
il canale critico intero. Sull'RC8 nativo con 14 h la risposta non è «non ci stai» ma
*«fai l'OIII per intero (12,6 h) più le stelle RGB, e lascia l'Hα per dopo — è il canale
che perdona»*. È la situazione più frequente sul campo ed è quella che nessun software
sapeva descrivere.

### Il riempimento
Due fasi. Prima tutti alla **soglia**, per priorità (critico, poi quota): un gruppo che non
arriva alla soglia **resta a zero**, non viene finanziato a rate — mezze ore sotto soglia
non sono mezza immagine, sono rumore. Poi il resto a piccoli passi verso l'**utile**, con
il critico pesato ×1,35; solo quando tutti hanno raggiunto l'utile il surplus va verso la
**saturazione**, e lì senza pesi (altrimenti a budget esatto il critico sfonderebbe il
proprio utile rubando ore agli altri).

Con un **dual-band su OSC** Ha e OIII diventano un solo *gruppo di costo*: dire «Ha 3h e
OIII 4h» a chi ha un L-Ultimate è una finzione — espone 4h e porta a casa entrambi.

### Quando non ci sta: l'altra configurazione
Se il canale critico non raggiunge la soglia, la risposta non è una ripartizione più
piccola. L'app **cerca fra i preset dell'utente** (la strumentazione vera, non le 1400
combinazioni di catalogo) e fra bin 1 e bin 2 le configurazioni in cui l'oggetto entra:

> 6 h su NGC 6888, RC8 nativo → *non ci sta, servono 11,2 h solo per l'OIII*.
> **Con lo stesso RC8 a bin 2** → progetto pieno, 0,96″/px, campionamento corretto.

L'ordinamento mette **prima il campionamento corretto**, poi il livello raggiunto: un
«pieno» ottenuto sottocampionando non è un'immagine migliore, è un'immagine più piccola.
Cambiando preset cambia anche la montatura, quindi l'RMS di catalogo di quella montatura
rientra nella FWHM: uno scambio di tubo non viene mai presentato come gratuito.

### Coerenza editoriale
Le voci di `expect` («a 12h vedrai…») sono scritte per la configurazione di riferimento: le
ore spese vengono **riportate al riferimento** dividendo per il fattore tempo prima di
scegliere la riga. Su RC8, 40 h reali leggono la riga «12h». Lo stesso vale per i `when`,
con una nota esplicita del moltiplicatore.

---

## 5-ter. I primi 30 secondi

Il rischio del progetto non è che qualcun altro costruisca un motore di prescrizione —
richiede lo strato astrofisico curato, che è anni di lavoro editoriale. Il rischio è
**che il motore resti ottimo e nessuno lo apra**, perché aprirlo costa più dei trenta
secondi di un companion.

Quindi la prima cosa nella pagina è il pannello **«Come lo riprendo»**: oggetto, ore,
risposta. Con l'app appena aperta e nessun campo compilato mostra i quattro oggetti
migliori di stanotte come chip cliccabili — *un clic e li prescrivo*. La tabella completa
resta sotto per chi vuole esplorare, e la colonna progetto guadagna una riga
«in N h: HOO ridotto» / «non ci sta» su ogni oggetto.

Strumentazione e sito non vengono chiesti: sono già impostati, con una riga che dice quali
sono e dove cambiarli.

---

## 5-quater. Inquadratura reale — Aladin Lite v3

Il verdetto testuale («ideale / mosaico / troppo piccolo») è corretto ma cieco: non dice
**dove** cade il sensore, e su oggetti asimmetrici — il Velo, il Cuore, la Proboscide — è
proprio quello che serve.

Nel blocco 3 della scheda c'è ora il campo reale su survey HiPS del CDS (DSS2 colore, DSS2
rosso per l'Hα, PanSTARRS), con il rettangolo del sensore sovrapposto. Alle alte
declinazioni il rettangolo tiene conto del coseno: senza, un campo da un grado verrebbe
disegnato largo il doppio a dec 60°.

Quando l'oggetto non ci sta, i **pannelli del mosaico** vengono disegnati in giallo con il
15% di sovrapposizione, e il numero viene detto: *«mosaico 2×2 — le ore del budget vanno
moltiplicate per quattro»*. È il vero costo del mosaico; l'allineamento è la parte facile.

⚠️ **Progressive enhancement, non dipendenza.** Lo script (~0,5 MB + WebAssembly) viene
caricato solo all'apertura di una scheda e solo se c'è rete; se fallisce, il riquadro dice
perché e il resto della pagina non se ne accorge. La versione standalone offline in
postazione continua a funzionare esattamente come prima.

---

## 5-quinquies. OpenNGC — copertura, non un secondo sistema

Il vincolo posto: *«OpenNGC deve estendere la copertura degli oggetti, non creare un
secondo sistema parallelo»*. È stato rispettato alla lettera — non c'è un percorso di
codice alternativo: un oggetto che arriva da OpenNGC passa per `synthTarget()` esattamente
come i 169 curati, e da lì per soglie, strade, canale critico, fattore tempo, binning,
Luna, livelli e piano per notte.

### I numeri

13.309 oggetti da `mattiaverga/OpenNGC` (CC-BY-SA-4.0), fusi in **un solo indice** con i
169 curati, che hanno sempre la precedenza. Totale ricercabile: **13.319**.

| certezza dell'archetipo | quanti | come si ottiene |
|---|---|---|
| `alta` | 995 | il tipo OpenNGC corrisponde uno-a-uno (OCl, GCl, HII, EmN, RfN, SNR) |
| `media` | 10.420 | serve un campo secondario: morfologia di Hubble per le 10.482 galassie, brillanza superficiale stimata per le planetarie |
| `da collaudare` | 1.102 | tipo generico (`Neb`, `Other`) o dati mancanti |
| `stella` | 792 | nessun archetipo: cercarle risponde *«non è un bersaglio deep-sky esteso»* |

**Cosa OpenNGC non copre**, e per cui il catalogo curato resta indispensabile: Sharpless,
Barnard, LDN, vdB, planetarie di Abell. Nessun identificatore `Sh2` compare in tutto il
file. Inoltre OpenNGC ha solo 131 nomi comuni contro i 214 alias italiani e inglesi dei
169 curati.

### Il discriminante per le planetarie

Brillanza superficiale stimata: `V + 2,5·log₁₀(area in arcsec²)`, taglio a **21,0**.
Verificato su casi noti: Saturn 15,5 · Cat's Eye 17,4 · M57 17,9 · M27 20,2 → *compatte e
luminose*; NGC 6781 21,3 · Helix 22,0 · NGC 7139 22,5 → *estese e deboli*. Coerente con la
classificazione curata di M27.

### La verifica incrociata — il controllo che ha trovato errori da entrambe le parti

152 oggetti sono classificati **due volte in modo indipendente**. Al primo confronto:
129 concordi, **24 discordi**. Le discordanze hanno rivelato:

**Due errori miei nel catalogo curato.** NGC 891 e NGC 4565 erano marcati
`elliptical_group`. Sono spirali di taglio (Hubble Sb). Corretti.

**Un errore di mappatura mio, più istruttivo.** Avevo mandato il tipo generico `Neb` a
`reflection`, ragionando che la banda larga è la scelta prudente: una sessione a banda
larga su una nebulosa a emissione porta comunque a casa qualcosa, mentre una sessione in
banda stretta su un continuo non porta niente. Argomento teoricamente pulito e **smentito
dai dati**: dei 14 oggetti `Neb` con nome comune, **11 sono a emissione** — Laguna,
Aquila, Trifida, California, Rosetta, Omega, Testa di Scimmia, Stella Fiammeggiante — e 3
a riflessione. Il motivo è strutturale: in OpenNGC la riflessione ha il suo tipo (`RfN`) e
le oscure pure (`DrkN`), quindi `Neb` è il secchio dei residui, e lì resta soprattutto
emissione. Corretto: undici volte su quattordici la mia regola avrebbe sbagliato.

Dopo le correzioni: **140 concordi, 12 discordi**, e le dodici rimaste sono volute — il
curato è deliberatamente più specifico (NGC 2359 è una bolla Wolf-Rayet, non una HII
generica; NGC 5907 vale per la marea stellare, non per i bracci; NGC 1333 e NGC 1977 sono
riflessione dentro un `Cl+N`).

Il confronto è ora un **test permanente**: se una delle due classificazioni deriva, il
test lo dice.

### Quando la classe non è decidibile

Nessuna prescrizione inventata, ma nemmeno un rifiuto. I 1.102 oggetti `da collaudare`
ricevono la prescrizione dell'archetipo più prudente, con un banner **rosso** che dichiara:
il tipo di catalogo è generico, ecco il motivo, *questa è una scelta prudente e non una
deduzione*, provala sul campo e correggi l'archetipo se sbagliata — da quel momento vale
la tua.

### Prestazioni

Con 13.319 oggetti la ricerca non poteva più normalizzare tutto a ogni tasto: l'indice
precalcola le chiavi una volta (31 ms all'avvio) e la ricerca scende a **~3 ms per query**.
Il datalist non contiene più tutto il catalogo — sarebbero 27.000 nodi nel DOM — ma si
riempie con le dodici corrispondenze migliori mentre scrivi. Lo standalone passa da 348 KB
a **1,78 MB**: si apre in due secondi con un doppio clic.

---

## 5-sexies. Il motore auditabile

`diag.js` — tracciato eseguibile da riga di comando:

```bash
node diag.js M31 14.5 tec_red_am5 1
```

Dieci sezioni: provenienza dei numeri, rapporti fra canali, fattore tempo scomposto in
geometria/QE/CFA, soglie riscalate, scelta della strada, riempimento passo per passo con
il residuo dopo ogni assegnazione, cosa fa scattare il livello, **cosa non entra e perché**,
calendario, e quale riga di *cosa aspettarti* è stata scelta. Lo stesso tracciato è in app,
chiuso per default.

Documentazione completa del motore e delle ratio per archetipo: `docs/motore.md`.

I difetti trovati da questo strumento — strade non distinte, canale additivo che
schiacciava il critico su OSC, archetipi con una strada sola — sono descritti lì. Tutti e
tre erano **nei dati, non nella fisica**.

---

## 6. Decisioni prese

### Stack
- **App: singolo HTML + JSON statico.** Nessun backend. Due varianti: `index.html` (JSON separati, mantenibile, per GitHub Pages) e `astroplan-standalone.html` (dati incorporati, doppio clic, offline in postazione)
- **Motore prototipale: Python** se servirà il layer HEALPix di Finkbeiner (`astropy`/`healpy`)
- Stadio 3 eventuale: plugin N.I.N.A. (C#). **Mai** PJSR PixInsight

### Selezione oggetti — niente soglia rigida di altezza
Il limite fisso a 30° è **scartato**: a 46°N cancellerebbe M8, M20, M17 e di fatto M16. La soglia è un **parametro dichiarato**, non un filtro. Soglie per banda: OIII/L 35°, B 35°, G 32°, R 28°, **Hα/SII 25°**.

Criteri: **ambiguità, non popolarità** · rappresentativi + poco noti con buona realizzabilità · **tassonomia con esemplari**, non catalogo.

### Voce e struttura
1. L'unità di consiglio è una **soglia con conseguenza**, non un numero
2. **Incertezza sempre dichiarata**
3. **Fisica prima della prescrizione**
4. Alternative **condizionali** e **asimmetriche** (un default + il "quando le altre lo battono")
5. **Costo opportunità esplicito**

⚠️ Tensione nota: il tono sfumato è inservibile per un principiante. **Stesso JSON, due renderizzatori.** Non ancora implementato.

### Estensibilità dall'app, non dal codice
Strumentazione, riduttori, siti e oggetti si aggiungono **dentro l'app** (`+ Aggiungi…` in ogni tendina), restano in `localStorage` e si esportano in `progetti.json`. Su GitHub passano **solo i target curati**, con `confidence` + `source` obbligatori e `provenance` per i contributi esterni. Senza, il database degenera in folklore — lo stesso bias che rimproveriamo ad AstroBin.

---

## 7. Modulo selettore target

**È la porta d'ingresso** che fa aprire l'app ogni notte serena.

### I sette criteri
1. **Fit geometrico** — dimensione / lato corto del campo, ottimo 0,30-0,85
2. **Fattibilità del segnale** — su due livelli: progetto pieno e versione ridotta
3. **Finestra utile per banda** — soglia di altezza diversa per canale
4. **Luna per banda** — riordina, non spegne
5. **Urgenza stagionale**
6. **Montatura e flip**
7. **Profilo di orizzonte**

### Punteggio (resa attesa stanotte)
`0,26 · finestra + 0,20 · inquadratura + 0,12 · campionamento + 0,34 · fattibilità + 0,08 · guida`

### Due correzioni di impostazione
- Non "cosa vedo alle 23" ma "su cosa integro dalle 22 alle 3"
- L'output è una **timeline**, non una lista

### Buio astronomico a 45,95°N — verificato dal motore
**21 giugno: 2,83 h** · **15 settembre: 8,08 h** · **21 dicembre: 11,67 h** — rapporto **4,1×**

---

## 8. Modello a progetti multi-notte

In banda stretta nessun progetto si chiude in una notte. L'unità è il **progetto**.

- **Strategico** — quali progetti apro questa stagione? La Luna non entra, **l'IL sì**
- **Tattico** — quale avanzo stanotte? Qui la Luna pesa tutta, espressa come *finestra efficace*

### L'output tattico è il canale, non l'oggetto
> *Luna al 70%, separazione 50°. Ore sul **SII**, indietro di 6h. L'**OIII** al novilunio: è il canale che non recuperi.*

### Il numero decisivo: settimane di calendario
Ore ÷ finestra utile ÷ frazione di notti serene, su entrambi i livelli di budget.

### 8-bis. Il piano operativo — v0.8

Il difetto che ha fatto partire questa revisione: chiedere 20 h su 40 notti produceva
**quaranta righe da mezz'ora**. Falsa precisione, e inservibile davanti al telescopio.
Il numero di notti veniva usato come divisore.

Tre strati, separati per costruzione:

| | decide | non può toccare |
|---|---|---|
| prescrizione | quante ore per canale | — |
| pianificazione | in quali notti quelle ore ci stanno | le ore |
| posa | come quelle ore si spezzano in fotogrammi | le ore, le notti |

**La notte è una data.** `nightWindows` interseca la notte astronomica di quella data
con il tempo in cui l'oggetto sta sopra la sua soglia, meno l'overhead di sessione.
NGC 6888 da Borno il 20 settembre dà 5,0 h; il 20 dicembre dà altro. La Luna non taglia
ore: viene misurata e sposta i canali.

**La guardia.** Minimo = capienza cumulata ≥ ore prescritte; massimo = ore ÷ sessione
minima. Fuori intervallo il piano non si costruisce, dice perché, offre entrambe le
uscite (più notti, o meno ore). Nessuna correzione silenziosa: sono due parametri
distinti.

**Le quote.** Cinque notti chieste sono cinque notti usate, con quote proporzionali alle
ore che ciascuna offre. La Luna decide *cosa* va dove, non *quanto*.

**L'ordine.** Prima il critico, poi per **escursione** fra la notte migliore e la
peggiore: chi ha più da perdere sceglie per primo. Un greedy sul «meglio adesso»
assegnerebbe le notti buie ai canali che non le sfruttano.

**`bestStart`.** Chiedere tre notti a partire da stasera non è chiedere tre notti: se la
Luna è al 77% sono le tre peggiori del mese. Lo dice, con il fattore di guadagno.

### 8-bis-2. Due modalità di pianificazione — v1.0

Il chiarimento che mancava, e viene dalla pratica: **ottimizzare il progetto e ottimizzare
la notte sono due cose diverse.** La prima versione del pianificatore metteva l'OIII nelle
tre notti buie e l'Hα nella quinta — matematicamente ottimo, operativamente sbagliato per
chi riprende dall'Italia, dove domani piove.

| | ogni notte | quando |
|---|---|---|
| **Sessione completa** *(default)* | tutti i canali della strategia, nelle proporzioni della prescrizione | meteo incerto · vuoi fermarti dopo una notte · vuoi già un mono da guardare · vuoi Ha/OIII/SII tutti presenti nella singola sessione |
| **Ottimizzazione sul progetto** | i canali distribuiti secondo la Luna | il calendario è dalla tua parte |

Le ore per canale sono **identiche** nelle due: cambia solo come si posano sulle notti.

**Come funziona.** È un trasporto sulla matrice canali × notti: somma di riga = ore
prescritte (invariante), somma di colonna = capienza della notte, e dentro si segue la
resa lunare. Bilanciamento iterativo (Sinkhorn) con l'ultima passata sulle righe, perché
fra i due vincoli quello che non si negozia è la prescrizione.

Il tilt lunare si vede al lavoro: su NGC 6888 in cinque notti l'RGB scende da 27′ a 15′
mentre la Luna cresce dal 69% al 91%, e alla quinta — Luna al 96% — esce del tutto;
l'OIII a 3 nm non se ne accorge e sale a compensare. Le somme di riga non si muovono di
un minuto.

**Il pavimento si misura in pose, non in ore**: sotto tre scatti per filtro una casella si
spegne e la sua massa torna alle altre notti. Per questo la posa si calcola *prima* del
piano — dipende dal totale del progetto, non da come le notti si dividono.

**L'export resta per singola notte**, e ora ha anche un pulsante per notte: il file della
notte 1 è una sessione N.I.N.A. completa e autonoma, con un Smart Exposure per filtro.

### 8-ter. La posa — un'ottimizzazione, non una tabella

Si massimizza l'SNR per ora di **orologio** (`eff × duty`), sotto tre tetti: saturazione
stellare, rischio di perdere un fotogramma, numero minimo di pose per la reiezione. Ne
segue che la posa migliore è sempre la più lunga ammessa, e che **a fermarla è un tetto,
mai il cielo**.

Il risultato che vale il lavoro: con 3 nm da Borno il fondo è ~0,004 e⁻/s/px e
servirebbero pose da **oltre due ore** per sommergere il rumore di lettura. In banda
stretta da un buon cielo non sei mai limitato dal cielo — e questo è il motivo fisico
per cui la banda stretta va in HCG e la banda larga sul pozzetto profondo. Il motore lo
**ricava**; non lo copia.

Il banco di prova non è un valore di catalogo: è la sequenza N.I.N.A. reale. Sull'RC8 a
f/8 da Borno il modello dà **L 120 s a gain 0**, che è quello che c'è nel file.

### 8-sexies. La posa contro la pratica — v1.2

Il modello proteggeva solo le **stelle di campo** e usciva con 600 s di OIII su una
planetaria brillante e pose lunghe sui globulari: l'opposto di quello che fa chiunque
riprenda, e in contraddizione con la scheda di classe, che a parole chiedeva già «una
serie corta per il nucleo».

Tre correzioni:

1. **Satura anche il soggetto.** Brillanza superficiale di picco dell'oggetto
   (`m` + area + concentrazione dichiarata dall'archetipo, con override per oggetto
   curato) dentro la stessa fotometria del fondo cielo. Su NGC 7027 lega e dà 20 s;
   su NGC 6888 non lega mai.
2. **Il pavimento operativo vale contro le stelle, non contro il soggetto.** Un nucleo
   stellare bruciato si cura in post; un soggetto bruciato no.
3. **Tetto di classe dalla pratica documentata**, non dal modello: globulari 60 s,
   ammassi aperti 120 s, planetarie brillanti 180 s, riflessione 240 s — con la fonte
   scritta nel dato.

Più la **serie corta per il nucleo** (25 × 10 s su R, G e B per un globulare), presa
dalle ore della prima notte perché le ore per canale non si toccano, e presente
nell'export come Smart Exposure a sé.

### 8-quinquies. L'audit del modello del cielo — v0.9

Sei difetti, tutti emersi costruendo il pianificatore: finché il cielo era un fattore
scalare mostrato una volta sola, nessuno si vedeva.

1. **La Luna confrontata invece che sommata.** `max(0, SQM − V_luna)` concludeva che una
   Luna più debole del cielo non contasse. I fondi si sommano in flusso. Misurato su 72
   casi: la Luna era rilevata in **0**, ora in 60. Il 20 settembre 2026, con la Luna al
   70%, l'app diceva «nessuna Luna» ovunque.
2. **La Luna campionata a un istante**, a metà notte. Ora è la media sulla finestra utile.
3. **L'inquinamento luminoso con l'esponente sbagliato**: `1/√rapporto` (un fattore di
   SNR) usato dove serve un fattore di tempo. L'app *diceva* «×43,7 il tempo» e
   *calcolava* con ×6,6. Il testo aveva ragione.
4. **Il cielo di riferimento non era dichiarato.** Ora `reference_config.sqm_zenith = 21.3`.
5. **Luna e lampioni moltiplicati invece che sommati**, contando due volte il fondo
   naturale. Ora `moonF` è il costo *marginale* — da una città la Luna pesa meno, ed è vero.
6. **Il dual-band su OSC calcolato come banda larga.** `filterFor('Ha+OIII')` non trovava
   niente e ripiegava sui 250 nm: fondo cielo cento volte troppo alto, posa a 60 s invece
   di 600, proprio sulla configurazione più diffusa che esista.

Più uno latente: un oggetto con una sola dimensione produceva `NaN` in silenzio su
pannelli e riempimento (`Math.max(1, NaN)` è `NaN`).

**Zero prescrizioni cambiate su 72.** Le ore per canale sono l'invariante e sono rimaste
identiche. Borno — il sito su cui il motore è tarato — si muove del 2%; a muoversi sono i
cieli cattivi, che erano quelli sbagliati.

### 8-quater. Export N.I.N.A. — solo export

Nessun dialogo, nessun controllo, nessun secondo motore di acquisizione: un `.json` per
notte. Serializzazione Newtonsoft verificata **campo per campo** contro una sequenza
reale — 29 tipi di nodo su 29 con lo stesso insieme di campi — e `ninaCheck()` che
rifiuta di consegnare un file con `$id` duplicati o `$ref` pendenti.

Dove N.I.N.A. ha già un meccanismo si usa il suo: «Hα 600 s × 25» è **uno** Smart
Exposure con `Iterations 25`, non venticinque istruzioni. Nessun nodo di plugin di terze
parti finisce nell'export.

---

## 9. Gestione dello stato (msi ↔ Lenovo)

`progetti.json` **esportabile e importabile** dalla pagina: progetti, siti, strumentazione, riduttori e target aggiunti. Il `localStorage` è comodità: **la verità è il file**.

**Popolamento automatico dai nomi dei master** — filtro ed esposizione sono già nel naming WBPP:
```
masterLight_BIN-1_6248x4176_EXPOSURE-300.00s_FILTER-O_mono_autocrop.xisf
```
Si trascina la cartella sulla pagina: la File API legge i nomi senza alcun server.

---

## 10. Anatomia di una scheda (8 blocchi)

1. **Cos'è** — meccanismo di eccitazione
2. **Spettro atteso** — righe, **affidabilità**, **distribuzione spaziale**
3. **Geometria sulla configurazione** — inquadratura, campionamento, **binning consigliato**
4. **Le strade percorribili** — 2-3, con pro e contro
5. **Budget con le soglie** — non iniziare sotto / **ridotto** / utile / satura
6. **Ordine e condizioni** — e *se hai una notte sola cosa fai*
7. **Cosa aspettarti** — a 5h / 12h / 20h
8. **Trappole in elaborazione**

---

## 11. Stato della v0.3 — costruita

### File in `C:\Users\aless\Documents\ASTROFOTO`

| File | Cosa |
|---|---|
| `index.html` | App single-file, nessuna dipendenza esterna |
| `astroplan-standalone.html` | Generato, dati incorporati, offline |
| `data/setups.json` | 28 telescopi, 17 camere, 14 montature, 34 filtri, 6 preset |
| `data/targets.json` | 12 archetipi, 13 target con scheda completa |
| `data/catalog.json` | 169 oggetti con archetipo curato, 214 alias IT/EN |
| `data/cities.json` | 159 comuni per il modello di inquinamento luminoso |
| `build.js` | Genera la versione standalone |
| `test.js` | **158 verifiche** sul motore |
| `docs/progetto.md` | Questo documento |
| `README.md`, `CONTRIBUTING.md` | Documentazione e formato contributi |

### I 13 target
NGC 6888 · NGC 7000 · Velo · NGC 7635 · Sh2-155 · M27 · Abell 61 · IC 1805/1848 · IC 1396 · Sh2-129/Ou4 · M31 · NGC 7331 · M45

### Cosa coprono le 158 verifiche
Geometria strumentale e rapporti focali · trasmissione per tipo di ottica · fattore tempo contro calcolo indipendente · **binning: scala, campo invariante, read noise in quadratura, neutralità sul tempo a bin 1/2/3/4** · **livello ridotto: fra soglia e utile su tutti i target, canale critico protetto** · **prescrizione: scelta della strada in base alle ore, nessun canale finanziato sotto soglia, expect riportato al riferimento, alternative davvero fattibili, dual-band come gruppo unico** · **mosaici e geometria del campo con il coseno della declinazione** · buio astronomico alle tre stagioni · circumpolarità · estinzione differenziale · penalizzazione lunare per banda · modello IL e SQM da coordinate · integrità del database.

I test hanno trovato buchi reali in scrittura: Sh2-155 senza canale critico dichiarato; QE presente nel JSON ma mai usata nel fattore tempo (due camere diverse davano lo stesso risultato); archetipi dedotti da un campo `type` invece che curati.

---

## 12. Validazione sul caso NGC 6888

**RC8 nativo, ASI 2600MM, bin 1, sub 300s, HOO finale + stelle RGB.**

| Previsione | Verifica |
|---|---|
| SII sotto soglia → rumore | ✅ Master SII = rumore con un accenno di arco. **Non è entrato nell'immagine finale: perdita secca** |
| Hα si porta a casa in poche ore | ✅ Ottimo, rete filamentare completa |
| OIII spazialmente distinto dall'Hα | ✅ **Confermato**: Hα = mezzaluna interna, OIII = bolla completa |
| L = nessun ruolo su target a righe | ✅ 1,5h non usate |
| ~~RC8 sovracampionato~~ | ❌ **Ritirato**: con seeing 1,0-2,4″ il campionamento è corretto |

**Numeri**: soglia SII su RC8 nativo = **14,0h**; riprese 1,5h → **9,4× sotto soglia**. Strada HOO completa = **34h**; versione ridotta = **19h**, e il SII resta a 14h perché è uno dei canali che non si tagliano.

**Recupero disponibile**: bin 2×2 software sul master SII porta l'SNR **per pixel** a ×2 — ma *non* è ×4 in tempo equivalente, ed è la correzione di v1.4: per unità di cielo il binning è neutro, e quello stesso ×2 lo ottieni ridimensionando l'immagine finita. A 0,96″/px con FWHM ~2″ il campionamento resta corretto, quindi **binnare il SII ha senso per il campionamento**, non per recuperare ore. Le ore mancanti si recuperano solo riprendendo.

---

## 13. Dove vanno i file

| Cosa | Dove |
|---|---|
| Decisioni e schede | **Project docs** — persistono, visibili da ogni dispositivo |
| Sorgenti | **`C:\Users\aless\Documents\ASTROFOTO`** sull'msi → repo git → GitHub |
| `progetti.json` | Stesso repo, o cartella sincronizzata |

⚠️ Il workspace di sessione è **effimero**. GitHub: init/commit/push dal PC (Claude Code), non dalla shell remota.

---

## 14. Punti aperti

1. **Il buco vero: validazione empirica.** Le soglie sono calcolate dal modello fisico e **mai confrontate con integrazioni reali**. Un **diario di sessione** strutturato (ore per canale, FWHM misurata, esito) è il meccanismo che lo chiude. Lo strato posa è l'unica parte che oggi ha un riscontro reale: la sequenza N.I.N.A. dell'utente.
2. ~~«Tempo disponibile» come input~~ — **fatto in v0.4.**
3. ~~Nessun vicolo cieco nella ricerca~~ — **fatto in v0.7** con OpenNGC.
4. ~~Rotatore di camera~~ — **fatto in v0.7**, corretto a 0–360° in v0.8: era troncato a 180 e il `PositionAngle` di N.I.N.A. era inesprimibile.
5. **Orizzonte reale importato** dal `.csv` di N.I.N.A. Ora ha un posto preciso dove entrare: `nightWindows`, dove oggi c'è una soglia unica per tutti gli azimut. È il prossimo miglioramento di fisica vera.
6. ~~Dalla posa al numero di sub~~ — **fatto in v0.8.**
7. ~~Il modello lunare sottostima il primo quarto~~ — **corretto in v0.9**, insieme ad altri cinque difetti del modello del cielo (§8-quinquies).
8. **Pozzetto in HCG derivato, non misurato** (16.000 e⁻ da 65535 ADU × ~0,25 e⁻/ADU). Insieme alla magnitudine protetta (V 12,0; V 11,0 sui soggetti stellari) è il numero meno solido dello strato posa. Entrambi modificabili dall'app.
9. **Frazione di notti serene** — 33% stimato, da correggere sull'esperienza reale. Il pianificatore non lo usa: le notti candidate sono consecutive, `bestStart` sposta l'inizio ma non modella il meteo.
10. **Ostruzione e riflettività RC8** — 45% e 94% sono valori di catalogo GSO, da confermare.
11. **Modalità principiante** (secondo renderizzatore) — progettata, non implementata.
12. **Un archetipo nuovo, non un altro esemplare.** Le **comete** (target mobili) romperebbero l'assunto delle coordinate fisse: quello sì che è un test di robustezza.
13. **Calibrazione AstroBin normalizzata** in fotoni/arcsec² — v2.
14. ~~Export sequenza N.I.N.A.~~ — **fatto in v0.8.** Solo esportazione, per scelta architetturale: N.I.N.A. esegue, ASTROFOTO decide.

### Posizionamento — deciso guardando Sidereus
Non si costruisce un'app che faccia più cose di un companion. La catena è:
planetario → **strategia di ripresa** → N.I.N.A./Voyager → PixInsight. Restano fuori per
scelta: meteo, mappe, controllo montatura, album da collezionista. Sidereus e simili
rispondono a *come organizzo la mia attività*; questa app risponde a *qual è il modo
fisicamente più efficace di acquisire questo oggetto con questo sistema*.

Nota tecnica emersa dal confronto: il calcolatore «velocità ottica» di Sidereus confronta
due setup per solo rapporto focale, senza dimensione del pixel né trasmissione. È il mito
f/ nella forma più pura, e il motivo per cui qui il tempo si calcola da `A_eff · Ω_px`.
