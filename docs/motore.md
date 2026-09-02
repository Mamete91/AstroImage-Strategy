# Il motore di prescrizione — come si arriva ai numeri

*Documento di officina. Descrive ogni passaggio che porta dalle soglie di scheda alle
ore per canale, e dice per ciascun numero da dove viene. Serve a due cose: verificare
che la logica sia coerente, e — quando arriveranno le integrazioni reali — poter dire
quale passaggio ha sbagliato.*

Il tracciato eseguibile è `diag.js`:

```bash
node diag.js M31 14.5 tec_red_am5 1      # oggetto, ore, preset, binning
node diag.js "NGC 2237" 30 rc8_full_cem70
```

La stessa diagnostica è in app, chiusa per default, sotto ogni prescrizione.

Il gemello per lo strato operativo — notti reali, posa, numero di sub, integrità
dell'export — è `plan.js`:

```bash
node plan.js M31 14.5 3 rc8_red_cem70 1 2026-09-20
node plan.js "NGC 6888" 20 5 rc8_full_cem70 1 2026-09-20 245
WRITE=/tmp/notte1.json node plan.js M31 14.5 3          # scrive anche la sequenza
```

Sei sezioni: prescrizione (che non tocca), finestre reali notte per notte, guardia
sulle notti ammesse, posa con i tetti scoperti, piano a blocchi, verifica dell'export.

---

## 0. Gli strati, e cosa può stare in ciascuno

| strato | contiene | chi lo scrive | confidenza |
|---|---|---|---|
| **OpenNGC** | tutto NGC e IC, con **archetipo dedotto** dal tipo e dalla morfologia | derivato, ~13.300 oggetti | alta / media / da collaudare |
| **catalogo curato** | nome, alias, coordinate, dimensioni, costellazione, **archetipo** | curato a mano, 169 oggetti | è geometria |
| **archetipo** | budget tipico, strade, ordine, resa attesa, trappole — **della classe** | curato a mano, 13 classi | bassa, dichiarata |
| **scheda** | righe di emissione con morfologia e fonte, soglie di *quell'oggetto*, trappole specifiche | curato a mano, 13 oggetti | alta/media per riga |
| **runtime** | tutto il resto: geometria, cielo, ore, calendario | calcolato | è aritmetica |

Regola: nell'archetipo si scrive solo ciò che è vero **per l'intera classe**. Se una
frase vale per un oggetto solo, quella frase appartiene a una scheda.

Il curato ha sempre la precedenza sul dedotto. Un oggetto che arriva da OpenNGC passa
per lo stesso identico motore — non c'è un percorso alternativo — ma porta con sé la
certezza della propria classificazione, e quella certezza è scritta sopra il numero,
non sotto.

La mappatura tipo OpenNGC → archetipo sta in `tools/build-openngc.js`, commentata riga
per riga, e si rigenera con `node tools/build-openngc.js <percorso>/NGC.csv`.

---

## 1. Da dove vengono i numeri

Soglie e utili **non sono calcolati**: sono scritti a mano, uno per uno, e sono
espressi in ore **per la configurazione di riferimento** — Tecnosky 115 con riduttore
0,80× + ASI 2600MM, 640 mm f/5,6, pixel 3,76 µm, bin 1. Mai per la configurazione
dell'utente.

Ogni canale ha quattro numeri, tre scritti e uno derivato:

```
floor      sotto questa soglia il canale NON va iniziato: restituisce rumore colorato
useful     il punto in cui il canale dà quello che può dare
saturates  oltre, il guadagno è marginale
ridotto    DERIVATO = max(floor, k × useful)     k = 0,60 sul critico, 0,40 sugli altri
```

Più due attributi:

```
share      NON divide le ore. Serve solo all'ordine di priorità quando non bastano.
critical   il canale che decide se l'immagine riesce. Uno per scheda, obbligatorio.
road       a quale strada appartiene il canale (stringa o elenco). Assente = tutte.
```

---

## 2. Il rapporto fra i canali — la logica, per archetipo

**Non esiste una formula che calcoli i rapporti.** Il rapporto effettivo fra due
canali è semplicemente `useful(A) : useful(B)`, e quei numeri sono editoriali: vengono
dalla fisica della classe, non da un'ottimizzazione.

Il principio che li governa è uno solo, ed è controintuitivo: **più un canale è
debole, più ore gli servono per diventare utile.** Quindi un `useful` alto non
significa «canale importante» ma «canale caro». Il canale *importante* è quello
marcato `critical`, e in quasi tutti gli archetipi a righe è l'**OIII** — non perché
sia il più forte, ma perché è quello la cui assenza rende l'immagine irriconoscibile.

| archetipo | critico | L | RGB | Ha | OIII | SII | rapporto (utile, critico=1) |
|---|---|---|---|---|---|---|---|
| `hii_classic` | **OIII** | — | 0.5 / 1 / 1.5 | 1 / 2.5 / 5 | 4 / 8 / 14 | 8 / 12 / 18 | RGB 0.13 · Ha 0.31 · OIII 1 · SII 1.50 |
| `hii_faint_he` | **OIII** | — | 0.5 / 1 / 1.5 | 2 / 4 / 8 | 6 / 10 / 16 | 10 / 15 / 20 | RGB 0.10 · Ha 0.40 · OIII 1 · SII 1.50 |
| `wr_bubble` | **OIII** | — | 0.5 / 1 / 1.5 | 1.5 / 3 / 5 | 4 / 8 / 14 | 5 / 8 / 14 | RGB 0.13 · Ha 0.38 · OIII 1 · SII 1 |
| `snr` | **OIII** | — | 0.5 / 1 / 1.5 | 1 / 2.5 / 5 | 2 / 5 / 10 | 5 / 9 / 14 | RGB 0.20 · Ha 0.50 · OIII 1 · SII 1.80 |
| `pn_bright` | **OIII** | — | 0.5 / 1 / 1.5 | 0.5 / 1.5 / 3 | 1 / 3 / 7 | 4 / 7 / 12 | RGB 0.33 · Ha 0.50 · OIII 1 · SII 2.33 |
| `pn_faint` | **OIII** | — | 0.5 / 1 / 1.5 | 3 / 5 / 9 | 8 / 15 / 25 | — | RGB 0.07 · Ha 0.33 · OIII 1 |
| `reflection` | **L** | 1.5 / 4 / 10 | 2 / 4.5 / 9 | — | — | — | L 1 · RGB 1.13 |
| `dark_molecular` | **Ha** | 2 / 5 / 10 | 1.5 / 3 / 6 | 1 / 2.5 / 5 | — | — | L 2 · RGB 1.20 · Ha 1 |
| `spiral_hii` | **L** | 1.5 / 4 / 8 | 1.5 / 3 / 6 | 2 / 4 / 7 | — | — | L 1 · RGB 0.75 · Ha 1 |
| `elliptical_group` | **L** | 2 / 6 / 12 | 2 / 4.5 / 9 | — | — | — | L 1 · RGB 0.75 |
| `tidal_ifn` | **L** | 6 / 15 / 30 | 3 / 6 / 12 | — | — | — | L 1 · RGB 0.40 |
| `cluster_globular` | **RGB** | 0.5 / 1.5 / 3 | 1 / 2.5 / 5 | — | — | — | L 0.60 · RGB 1 |
| `cluster_open` | **RGB** | 0.3 / 1 / 2 | 0.5 / 1.5 / 3 | — | — | — | L 0.67 · RGB 1 |

Come si legge la colonna soglie: `floor / useful / saturates` in ore di riferimento.

### Perché il SII ha sempre il numero più alto

Su ogni archetipo a righe il SII ha l'`useful` maggiore di tutti — fino a 2,3 volte
l'OIII critico su una planetaria brillante. È corretto: `[SII]` è tipicamente 0,1–0,3
volte l'Hα su gas fotoionizzato, quindi per portarlo sopra il rumore servono molte
più ore. Non vuol dire che conti di più: vuol dire che **costa** di più.

Questo ha una conseguenza che è stata la scoperta più importante di questo audit —
vedi §11.

### Perché il critico non è sempre il canale più caro

| archetipo | critico | perché quello |
|---|---|---|
| HII, WR, SNR, PN | **OIII** | l'Hα si porta a casa quasi sempre; è l'OIII che decide se l'immagine ha struttura o è un alone. E paga il doppio di estinzione e di scattering lunare |
| riflessione, spirali, ellittiche, IFN | **L** | continuo puro: la luminanza *è* il segnale, il colore è una rifinitura |
| nube oscura | **Ha** | il soggetto è l'assenza; serve un fondo da oscurare, e l'Hα è il fondo migliore |
| ammassi | **RGB** | il colore delle stelle è il soggetto; la L satura il nucleo e molti la saltano |

---

## 3. Dal riferimento alla configurazione reale

*Rifatto in v1.4. La forma precedente è documentata in `docs/gate-fisico.md` insieme
all'errore che conteneva.*

**Metrica dichiarata: SNR per unità di angolo solido di cielo** (per arcsec²), al cielo
di riferimento. La scala scelta si semplifica nel rapporto fra due configurazioni — non
c'è un parametro libero. Cielo reale e Luna entrano altrove, come fattori a parte.

```
fattore = [ V̇ / (A·k)² ]_tuo  /  [ V̇ / (A·k)² ]_rif

A·k = A_eff · QE(λ) · T_filtro · f_CFA          fotoni raccolti da un arcsec² di cielo
V̇   = s_arc + b_arc + d_px/Ω_px + RN²/(Ω_px·t_posa)     varianza per arcsec² al secondo

A_eff = area geometrica × trasmissione (ostruzione e riflettività incluse)
Ω_px  = (206,265 · pixel_µm · bin / focale)²    arcsec² per pixel
```

È la forma pubblicata da **ESO** (Hainaut, *Signal, Noise and Detection*), **STScI**
(WFC3 Instrument Handbook §9.6) e **Rubin** (SMTN-002) per una sequenza di N pose,
riscritta per unità di angolo solido:

```
SNR_px = R_s·T / √( (R_s+R_b+R_d)·T + N·RN² )        con N = T/t_posa
       = R_s·T / √( T·[R_s+R_b+R_d+RN²/t_posa] )
```

`N` sparisce: entra solo attraverso `T/t_posa`. Il rumore di lettura si paga **per
lettura**, non si integra nel tempo — ecco perché diventa il tasso `RN²/t_posa`.

Quattro conseguenze da tenere a mente:

- **Segnale e cielo seguono l'apertura; buio e lettura seguono la focale.** `s_arc` e
  `b_arc` sono per arcsec² e vanno con `A·k`. `d_px` e `RN²` sono **per pixel**: divisi
  per `Ω_px` crescono con il quadrato della focale. È lì, e solo lì, che il rapporto
  focale entra nel bilancio di una sorgente estesa.
- **Il fattore dipende dalla posa.** Non è una proprietà del telescopio ma della
  strategia di acquisizione, e va calcolato con la posa che il planner usa davvero.
  Sull'RC8 in OIII: ×0,96 a 120 s, ×0,74 a 600 s, ×0,66 a 1800 s. La posa usata è
  scritta accanto al numero.
- **La scala del pixel non è una perdita di fotoni.** Fino alla v1.3 il fattore conteneva
  il rapporto `Ω_rif/Ω_px` — ×6,44 sull'RC8 a focale piena — addebitato come se fossero
  fotoni persi. Non lo sono: distribuire la stessa luce su più fotositi è campionamento.
- **La trasmissione è una grandezza separata.** L'RC8 è f/8 e resta f/8; il 70% di resa
  luminosa entra come fattore a parte, mai travestito da «f/ efficace».

### Le tre grandezze da non confondere

| | segue | dove vive |
|---|---|---|
| illuminamento **per pixel** | `1/f² · τ` | è ciò che vedi in una singola posa |
| raccolta **per arcsec²** | `A_eff · QE · T · CFA` | è ciò che decide la profondità |
| **campionamento** | focale, pixel, binning | è ciò che decide la risoluzione |

A pari f/, due aperture diverse hanno lo **stesso** illuminamento per pixel e una
raccolta per arcsec² che scala come `D²`. Non sono equivalenti: il maggiore è più
profondo **e** più risolvente. Verificato nella suite (`test.js`, sezione «aperture
diverse a pari f/ratio»): il vantaggio in tempo è esattamente il rapporto di raccolta,
e niente di più.

### Dove il modello non è validato

Su **matrice di Bayer in banda larga** `OSC_BB` (che corregge la *banda*: un fotosito
colorato vede circa un terzo dello spettro) e `f_CFA` (che corregge il *numero* di
fotositi che raccolgono una *riga*) si sovrappongono. Per L la scheda dichiara
`f_CFA = 1,00` e il conto è pulito; per RGB dichiara `0,62`, e `0,62 × 0,34 = 0,21`
conta due volte la stessa perdita. **Il motore non aggiusta il numero: dichiara il ramo
non validato** e lo scrive accanto al fattore. La banda stretta non è toccata.

---

## 4. Il binning

**Non entra nel fattore di tempo.** Sui CMOS la somma è digitale e avviene dopo la
lettura: `RN_binnato = RN·bin` mentre `Ω_px ∝ bin²`, quindi `RN²/Ω_px` e `d_px/Ω_px`
non si muovono. Verificato a bin 1, 2, 3 e 4: il fattore è identico.

*Corretto in v1.4.* Qui c'era scritto «tutte le soglie divise per bin²»: è vero **per
pixel** e falso per unità di angolo solido. Il binning non crea fotoni.

Quello che cambia davvero, e conta:

| | effetto |
|---|---|
| **campionamento** | la scala del pixel, e con essa la risoluzione che porti a casa |
| **duty cycle** | meno dati da scaricare, più pose per ora di orologio |
| spazio su disco | il meno interessante dei tre |

Su CCD sarebbe diverso: lì i pozzetti si sommano *prima* della lettura e il rumore di
lettura si paga una volta sola. E resta vero che **binnare in ripresa o in elaborazione
dà lo stesso risultato**: la decisione è reversibile.

---

## 5. Cosa NON entra nelle ore per canale

La parte che si dà per scontata e non lo è.

| grandezza | entra nel budget? | dove entra invece |
|---|---|---|
| **seeing** | **no** | campionamento, consiglio di binning, punteggio |
| **guida RMS** | **no** | idem, sommata in quadratura al seeing |
| **Luna** | **no** | finestra efficace di stanotte, punteggio, nota per canale |
| **inquinamento luminoso** | **no** | calendario: `perNight = critH × lpF` |
| **binning** | **sì** | soglie ÷ bin² |
| **ottica, camera, filtri** | **sì** | fattore tempo |

**Perché il seeing non entra, ed è corretto.** Su un oggetto esteso la brillanza
superficiale per pixel non dipende dal seeing: la turbolenza ridistribuisce i fotoni
localmente, non ne toglie. Il seeing limita il *dettaglio risolvibile*, non l'SNR per
pixel. Su sorgenti puntiformi è tutt'altra storia — ed è il motivo per cui l'archetipo
globulare dice che il pregio dell'immagine lo decide il seeing, non le ore.

**Perché la Luna non entra.** Scelta deliberata: il budget è **strategico**, misurato
su settimane, e il ciclo lunare si media da solo — il novilunio torna. L'inquinamento
luminoso invece **non si media**: c'è tutte le notti, e infatti entra nel calendario.

---

## 6. Scelta della strada

I canali di una strada = quelli senza vincolo + quelli che dichiarano quella strada.
`road` accetta una stringa o un elenco, perché un canale appartiene spesso a più
strade ma non a tutte: l'OIII di NGC 7000 sta in HOO e in SHO, non in HaRGB.

Si sceglie **la strada più ambiziosa che sta dentro le ore richieste**: primo dei tre
confronti che passa — ore ≥ costo pieno, poi ≥ ridotto, poi ≥ somma delle soglie. Se
nessuno passa, si tiene la più economica e il livello lo decide il riempimento.

Alcune strade condividono legittimamente lo stesso budget — differiscono per
inquadratura (IC 1805, IC 1396) o per profondità dello stesso canale (M45 IFN). Quelle
dichiarano `same_budget` e l'app lo dice, invece di lasciar credere a un difetto.

---

## 7. Il riempimento

**Fase 1 — tutti alla soglia**, in ordine di priorità: critico, poi quota, poi costo.
Un gruppo che non arriva alla soglia **resta a zero**: non si finanzia a rate, perché
mezze ore sotto soglia non sono mezza immagine, sono rumore.

**Fase 2 — il resto verso l'utile**, a passi piccoli, sempre al gruppo più indietro
rispetto al proprio obiettivo, con il critico pesato ×1,35.

**Fase 3 — il surplus verso la saturazione**, senza pesi. Separare le fasi 2 e 3 è
necessario: con un peso unico, a budget esatto il critico sfonderebbe il proprio utile
rubando ore agli altri.

Con un **dual-band su OSC**, Hα e OIII diventano un solo gruppo di costo: dire «Ha 3h e
OIII 4h» a chi ha un L-Ultimate è una finzione — espone 4h e porta a casa entrambi.

---

## 8. I cinque livelli

Il livello **non è deciso prima**: è l'esito del riempimento.

| livello | condizione |
|---|---|
| `insufficiente` | il gruppo critico non raggiunge la soglia |
| `parziale` | il critico ce la fa, ma almeno un altro gruppo resta fuori |
| `pieno` | nessuno fuori e ore ≥ costo pieno |
| `ridotto` | nessuno fuori e ore ≥ costo ridotto |
| `minimo` | nessuno fuori e ore ≥ somma delle soglie |

Il livello che conta di più è **parziale**: ore che non bastano per tutta la strada ma
bastano per il canale critico intero. È la situazione più frequente sul campo, e la
risposta giusta lì non è «non ci stai» ma «fai il canale che decide e lascia per dopo
quello che perdona».

Su `insufficiente` la prescrizione non mostra nessuna ripartizione — mostrarla sarebbe
un piano che produce un'immagine che non si chiude — e cerca invece fra i preset
dell'utente una configurazione in cui l'oggetto entra.

---

## 9. Da ore a calendario

```
perNight = min( critH × lpF , buio astronomico disponibile )
nights   = ore / perNight
weeks    = nights / (7 × frazione di notti serene)
```

`critH` sono le ore in cui l'oggetto sta sopra la soglia di altezza del canale critico
(OIII/L 35°, B 35°, G 32°, R 28°, Hα/SII 25°).

---

## 10. Il piano per notte — obiettivo ≠ distribuzione

Sono due cose diverse e confonderle rende inutili entrambe. **L'obiettivo** (quante ore
per canale) lo decide la prescrizione, e il numero di notti non lo tocca. **Il piano**
decide solo come quelle ore si distribuiscono su notti che esistono davvero.

### 10.1 La notte è una data, non una frazione

`nightWindows(tg, site, data, n)` percorre il calendario a partire dalla data scelta e
per ogni notte calcola l'intersezione fra due cose che cambiano entrambe:

- la **notte astronomica** di quella data — da Borno a giugno sono quattro ore, a
  dicembre undici;
- il tempo in cui **l'oggetto sta sopra la soglia** del proprio canale critico.

Da lì si sottrae l'**overhead di sessione** (0,6 h di default): messa a fuoco, plate
solve, calibrazione della guida, flip. Non è integrazione, e se non lo togli la sequenza
che esporti sfora la notte.

Una notte che offre meno di un'ora utile **non viene aperta**: si salta e si dichiara
perché. La Luna qui non taglia ore — viene solo *misurata*, come Δmag medio del fondo
sulla finestra utile. Che la Luna sposti i canali e non accorci la notte è la
distinzione che rende il piano un piano.

### 10.2 La guardia sulle combinazioni impossibili

`nightsBounds()` restituisce un intervallo, e fuori da quello **il piano non si
costruisce**:

| | come si calcola | cosa impedisce |
|---|---|---|
| **minimo** | la capienza cumulata delle prime N notti reali deve coprire le ore prescritte | «100 ore in una notte» |
| **massimo** | ore ÷ sessione minima (1 h) | «4 ore su 100 notti» |

Fuori intervallo si spiega il motivo, si propone il valore valido — e si offre anche
l'altra strada, cioè ridurre le ore. Non si corregge in silenzio l'input: sono due
parametri distinti e nessuno dei due deve aggiustare l'altro alle spalle di chi scrive.

### 10.3 Le quote: N notti vuol dire N notti

Chiedere cinque notti e riceverne tre piene e due vuote non è un piano su cinque notti.
Ogni notte riceve una **quota proporzionale alle ore che offre**, e la somma delle quote
è esattamente il fabbisogno. Così tutte le notti vengono usate, nessuna viene caricata
oltre quello che può dare, e la Luna decide *cosa* mettere in quale notte — non *quanto*,
che lo decide la lunghezza della notte.

### 10.4 Due modalità, un motore solo

Ottimizzare il **progetto** e ottimizzare la **notte** sono due cose diverse, e per chi
riprende dall'Italia la seconda conta di più. Se domani piove — e domani piove spesso —
quello che hai preso stanotte deve essere già un'immagine, non un terzo di canale.

| | cosa ottimizza | quando serve |
|---|---|---|
| **Sessione completa** *(default)* | ogni notte contiene tutti i canali della strategia, nelle proporzioni della prescrizione | meteo incerto, vuoi poterti fermare dopo una notte, vuoi già un mono da guardare |
| **Ottimizzazione sul progetto** | i canali si distribuiscono fra le notti secondo la Luna | hai il calendario dalla tua parte e il progetto lo chiudi |

In entrambe le ore per canale sono **identiche**: cambia solo come si posano sulle notti.

#### Il bilanciamento a trasporto

La modalità sessione risolve un problema di trasporto sulla matrice canali × notti:

```
              notte 1   notte 2   notte 3   notte 4   notte 5  │  prescrizione
OIII           2,79      2,83      2,84      2,86      3,06    │    14,38 h  ← esatto
Ha             0,80      0,82      0,83      0,84      0,92    │     4,21 h  ← esatto
RGB            0,45      0,39      0,30      0,26        —     │     1,40 h  ← esatto
─────────────────────────────────────────────────────────────  │
capienza       4,04      4,04      3,97      3,97      3,97    │    20,00 h
```

Si parte dalla matrice dei desideri — proporzionale alle ore, inclinata dalla penalità
lunare di ogni canale in ogni notte — e si normalizzano righe e colonne a turno
(**Sinkhorn**) finché tornano entrambe. Quaranta iterazioni su una matrice minuscola.

**L'ultima passata è sulle righe**, perché fra i due vincoli quello che non si negozia è
la prescrizione: una colonna può restare un minuto sotto la quota, le ore per canale no.

Nella tabella sopra si legge il tilt lunare al lavoro: l'RGB scende da 27′ a 15′ mentre la
Luna cresce dal 69% al 91%, e alla quinta notte — Luna al 96% — esce del tutto. L'OIII a
3 nm non se ne accorge e sale a compensare. Le somme di riga non si muovono.

#### Il pavimento in pose, non in ore

Una casella che scende sotto le **tre pose per filtro** si spegne e la sua massa torna
alle altre notti dello stesso canale. In ore sarebbe un pavimento sbagliato: cinque scatti
da 120 s sono venti minuti e sono un contributo vero, mezz'ora imposta a priori li
vieterebbe. È il motivo per cui la posa si calcola **prima** del piano — dipende solo dal
totale del progetto e dalla configurazione, mai da come le notti si dividono:

```
prescrizione → posa (dal totale) → pianificazione (la posa è solo il pavimento) → sub per notte → export
```

#### L'ordine dentro la notte

Il canale critico apre sempre la sessione. Se le nuvole arrivano a metà — e arrivano —
quello che perdi deve essere il canale che conta meno. Poi la banda stretta, poi il colore.

### 10.5 L'ordine di assegnazione (modalità progetto): chi ha più da perdere sceglie per primo

Non è «prima il critico e poi gli altri»: sarebbe corretto solo a parità di notti.
È **prima il critico, poi per escursione decrescente** fra la notte migliore e la
peggiore per quel canale. Un OIII perde metà resa fra novilunio e Luna piena; una L su
un globulare non se ne accorge. Chi ha molto da perdere sceglie per primo, chi non ha
niente da perdere prende quello che resta: è il costo opportunità, ed è l'unico ordine
che non spreca le notti buie.

Un greedy sul «meglio adesso» farebbe l'opposto — assegnerebbe le notti migliori ai
canali che non le sfruttano.

Il blocco minimo si misura **per filtro** (0,4 h), non per gruppo di costo: mezz'ora di
«RGB» sono dieci minuti a canale, cioè niente da integrare. Le code che restano dopo le
quote non aprono una notte nuova: vanno dove quel canale sta già girando, sfruttando le
ore che la notte offre oltre la quota.

### 10.6 Quando conviene cominciare

`bestStart()` confronta la resa media pesata del canale critico sulle prime N notti a
partire da ogni data candidata del mese successivo, e propone lo spostamento **solo se
il guadagno supera il 15%**. Chiedere tre notti a partire da stasera non è la stessa
cosa che chiedere tre notti: se la Luna è al 77%, le prime tre notti utili sono le tre
peggiori del mese, e il piano lo dice invece di subirlo.

---

## 10-bis. La posa e il numero di sub

Ultimo strato, e il più frainteso. La posa non è una preferenza: è il punto in cui tre
tetti si incontrano, e il consiglio utile non è il numero — è **quale dei tre sta
legando**.

### La figura di merito

Non l'SNR per ora di *integrazione* (sarebbe monotona e direbbe sempre «più lunga
possibile»), ma l'SNR per ora di **orologio**:

```
merito = eff(t) · duty(t)
eff  = √( sky·t / (sky·t + RN²) )          quanto sei vicino al limite del cielo
duty = √( t / (t + scarico + dither/n) )    quanto della notte finisce nei fotoni
```

Entrambi crescono con la posa, quindi **la posa migliore è sempre la più lunga
ammessa**: a fermarla è un tetto, mai il cielo. I tetti:

| tetto | da dove viene | quando lega |
|---|---|---|
| saturazione stellare | pozzetto ÷ picco di una stella alla magnitudine protetta | sistemi corti e veloci, banda larga |
| rischio / montatura | `max_sub_s` della montatura, tetto operativo 600 s | banda stretta da cielo buono |
| conteggio minimo | ore ÷ 15 pose, perché la reiezione statistica ha bisogno di materiale | canali con poche ore |
| pavimento operativo | 60 s: sotto, file e scarichi mangiano la notte | banda larga su focali corte |

### Il fondo cielo, per fotometria

```
e⁻/s/px = 1008 · 10^(−0,4·SQM) · A_eff[cm²] · scala² · QE(λ) · T_filtro · Δλ[Å]
```

1008 fotoni/cm²/s/Å è il flusso di una stella V=0 (3,64·10⁻⁹ erg/cm²/s/Å diviso per
l'energia del fotone a 550 nm). Su OSC la banda larga vale un terzo: la curva QE
pubblicata è già quella del fotosito del colore giusto.

Vale entro un fattore ~2, e la posa ne risente **per la radice** — cioè poco. Il
banco di prova non è un valore di catalogo ma la sequenza N.I.N.A. reale: sull'RC8 a f/8
da Borno il modello dà **L 120 s a gain 0**, che è esattamente quello che c'è nel file.

### I quattro tetti, e chi vince su chi

| tetto | da dove viene | dove lega |
|---|---|---|
| **il soggetto satura** | brillanza superficiale di picco dell'oggetto | planetarie compatte e brillanti, nuclei HDR |
| **saturazione stellare** | pozzetto ÷ picco di una stella alla magnitudine protetta | banda larga su sistemi corti e veloci |
| **tetto di classe** | pratica documentata della comunità | globulari 60 s, ammassi aperti 120 s, planetarie brillanti 180 s |
| **numero minimo di pose** | ore ÷ 15 | canali con poche ore |
| *pavimento operativo* | 60 s: sotto, file e scarichi mangiano la notte | **preferenza, non vincolo** |

#### Il difetto che ha fatto nascere questa sezione

Il modello proteggeva solo le **stelle di campo**. Su un globulare non satura una
stella qualsiasi: satura il **nucleo**, che è un continuo non risolto molto più
brillante della media dell'ammasso. Su una planetaria brillante satura il guscio.
Uscivano 600 s di OIII su una planetaria e pose lunghe sui globulari — l'opposto di
quello che fa chiunque riprenda, e in contraddizione con la scheda di classe, che già
scritta a parole diceva «una serie corta per il nucleo e una più lunga per la
periferia».

Il conto nuovo è lo stesso della fotometria del cielo, applicato all'oggetto:

```
brillanza media    μ = m + 2.5·log₁₀(area in arcsec²)
brillanza di picco μ_p = μ − 2.5·log₁₀(picco/media)
```

e μ_p entra in `skyRateFor` come se fosse un fondo cielo — perché per il pozzetto del
pixel è esattamente la stessa cosa. Il rapporto **picco/media** lo dichiara
l'archetipo (150 per un globulare, da μ_V(0)≈15,5 di Harris contro una media ≈21; 4 per
una planetaria brillante; 60 per un'ellittica), e un **oggetto curato può portarsi il
proprio**: M42 sta a 250, perché nessun valore di classe può descrivere insieme il
Trapezio e una HII qualunque.

In banda stretta c'è una correzione che non si può saltare: la magnitudine V di una
planetaria è fatta quasi tutta di [OIII] 5007. Trattarla come continuo e dividerla per
la larghezza del filtro la sottostimerebbe di cento volte, cioè proprio dove il tetto
serve. Per questo l'archetipo dichiara anche `line_fraction`.

#### Il pavimento vale contro le stelle, non contro il soggetto

Prima il pavimento operativo scavalcava i tetti, ed è metà del motivo per cui uscivano
pose lunghe dove non servono. Ora vale solo contro il tetto **stellare**, e la ragione
è pratica prima che teorica: un nucleo stellare bruciato si cura in elaborazione —
maschera, o una serie corta a parte, ed è quello che la comunità fa («sono contento con
un paio di centinaia di pixel saturi») — mentre un **soggetto** bruciato non si cura.

#### La serie corta per il nucleo

Dove l'archetipo la dichiara, il piano produce anche una serie molto corta sul canale
critico — 25 pose da 10 s su R, G e B per un globulare — presa dalle ore della prima
notte, così le ore per canale restano esattamente quelle prescritte. Dodici minuti su
un progetto di ore, e sono la differenza fra un nucleo con dentro le stelle e una
macchia bianca. Finisce anche nell'export, come Smart Exposure a sé.

#### Il riscontro

Non un valore di catalogo: la pratica documentata.

| soggetto | modello | pratica |
|---|---|---|
| globulari | 60 s + nucleo 10 s | 20–60 s, «30 s, forse 60, mai di più» |
| ammassi aperti | 60–120 s | 30–120 s |
| planetarie brillanti | 120–180 s | pose brevi per salvare il colore |
| NGC 7027 (PN minuscola) | **20 s**, «il soggetto satura» | pose brevissime |
| nebulose estese in banda stretta | 600 s | è lì che le pose lunghe servono |
| luminanza su galassia, RC8 f/8 | 120 s | la sequenza reale dell'utente |

Fonti: [Cloudy Nights, *Correct exposure for globular clusters*](https://www.cloudynights.com/topic/816986-correct-exposure-for-globular-clusters/) ·
[Galactic Hunter, *The Challenges of Imaging and Processing Clusters*](https://www.galactic-hunter.com/post/imaging-and-processing-clusters)

### Il risultato che sorprende

Con filtri da 3 nm da un cielo di montagna il fondo vale ~0,004 e⁻/s/px: per sommergere
il rumore di lettura servirebbero **pose da oltre due ore**. In banda stretta da un buon
cielo **non sei mai limitato dal cielo** — sei limitato dal rumore di lettura, e la posa
la decide la montatura. È il motivo fisico per cui la banda stretta va in HCG e la banda
larga sul pozzetto profondo, e il motore lo *ricava* invece di copiarlo.

A 300 s in banda stretta la resa è il 60% del limite del cielo; a 600 s è il 73%. La
stessa immagine chiede 1,5× le ore se le pose sono la metà.

### Cose che si semplificano

Il binning **non cambia** la posa ottimale: il fondo cresce con bin², il rumore di
lettura con bin, e il rapporto σ²_sky/RN² resta identico. Non è ovvio ed è giusto.

Il modo di guadagno si sceglie **una volta per classe di banda**, non canale per canale:
fra R e G il merito differisce dell'1%, ma cambiare guadagno vuol dire due set di dark
nella stessa notte. A parità di merito entro il 5% vince il pozzetto più profondo, che
salva più stelle e non costa niente.

### Il numero di sub

Intero, e lo scarto fra tempo teorico e tempo reale si dichiara. La posa si decide
**una volta sul totale del progetto**, non notte per notte: cambiarla a metà strada
vuol dire due set di dark e due master flat.

---

## 10-ter. L'export N.I.N.A.

Solo esportazione. ASTROFOTO non parla con N.I.N.A., non comanda niente, non monitora
niente: **scrive un file**.

Il file rispetta la serializzazione Newtonsoft che N.I.N.A. usa davvero — `$id`
progressivi, `$ref` per i genitori, `$type` con l'assembly — perché senza quelli il
sequenziatore non deserializza. La struttura è verificata campo per campo contro una
sequenza reale esportata da N.I.N.A.: **29 tipi di nodo su 29 hanno lo stesso insieme
di campi**.

Dove N.I.N.A. ha già un meccanismo, si usa il suo:

| serve | si usa |
|---|---|
| «Hα 600 s × 25» | **uno** Smart Exposure con `LoopCondition.Iterations = 25` — non venticinque istruzioni |
| dithering | il trigger nativo `DitherAfterExposures` |
| flip al meridiano | `MeridianFlipTrigger` |
| centratura e rotazione | `CenterAndRotate` con il `PositionAngle` scelto |

Un file per notte. `ninaCheck()` verifica prima della consegna che gli `$id` siano unici
e che nessun `$ref` penda nel vuoto: un file che N.I.N.A. rifiuta all'importazione è
peggio di nessun file. Nessun nodo di plugin di terze parti finisce nell'export.

---

## 11. Difetti trovati da questo audit, e corretti

Tre, tutti dello stesso tipo: **il modello fisico era giusto, i dati non gli davano
modo di esprimersi.** Nessuno richiedeva di toccare la fisica.

### 11.1 · Le strade delle schede non erano distinte

8 target su 13 avevano strade descritte a parole ma con lo stesso identico insieme di
canali — quindi lo stesso costo. Il `when` scritto a mano («sopra le 18h», «sotto le
12h») prometteva una scelta che il motore non poteva fare.

Corretto dove il nome della strada lo diceva senza ambiguità: M31 `Ha → lrgb_ha`,
NGC 7635 `SII → sho`, Sh2-129 `OIII → hoo_extreme`, NGC 7000 `OIII → [hoo, sho]`.
Quest'ultimo ha richiesto di accettare un elenco al posto di una stringa.

### 11.2 · Su OSC il canale additivo schiacciava il critico

M31 con 14,5 h su Askar + 2600MC, **prima**: 8,0 h di Hα (soglia riscalata ×4,00 per
la matrice di Bayer) e 3,6 h di luminanza — il canale critico, il soggetto — fermo al
17% fra soglia e utile. Una strategia che nessuno sceglierebbe.

**Dopo** la correzione 11.1: sceglie `lrgb` puro, L 8,3 h + RGB 6,2 h, entrambi oltre
l'utile, niente Hα. Che è esattamente quello che farebbe un astrofotografo esperto con
una camera a colori e 14 ore.

Nessuna modifica al modello: la scheda aveva già la strada giusta, non riusciva a
sceglierla.

### 11.3 · Gli archetipi avevano una strada sola — il difetto peggiore

Una HII **di catalogo** (senza scheda) con 15 h, **prima**: 8,0 h sul SII e OIII critico
al 32% fra soglia e utile. Il SII è il canale che la logica dello stesso archetipo
definisce *«quasi sempre sbagliato: restituisce rumore colorato»*. Il motore faceva
l'opposto di quello che l'archetipo diceva a parole, e lo faceva su tutti i 27 oggetti
HII del catalogo.

Causa: `synthTarget` fabbricava una strada `default` unica, e senza vincoli ogni canale
ci finiva dentro.

Corretto dando **strade proprie a 6 archetipi** — `hii_classic`, `hii_faint_he`,
`wr_bubble`, `snr`, `pn_bright` (HOO vs SHO, con SII solo in SHO) e `spiral_hii`
(LRGB vs LRGB+Ha). Ora: 15 h → HOO con OIII oltre l'utile e niente SII; 30 h → SHO con
il SII alle sue 14 h.

---

## 11-ter · Il secondo audit — quattro difetti nel modello del cielo

Emersi tutti costruendo il pianificatore multi-notte: finché il cielo era un fattore
scalare mostrato una volta sola, nessuno di questi si vedeva.

### 1. La Luna confrontata invece che sommata

```
prima:  dMagV = max(0, SQM − V_luna)
dopo:   dMagV = 2.5·log₁₀( 1 + 10^(−0.4·(V_luna − SQM)) )
```

La vecchia riga confrontava il chiarore lunare con il cielo e, se il primo era più
debole, concludeva che la Luna non contava. I due fondi si **sommano in flusso**. Con
Borno a 20,8 e una mezza Luna che da sola vale 21,0 il fondo totale diventa 20,15 —
quasi il doppio, cioè un terzo di SNR in meno su banda larga — e la vecchia formula
restituiva **zero**.

Misurato sulla matrice di 72 casi: la Luna era rilevata in **0 casi su 72**, ora in 60.
Il 20 settembre 2026, con la Luna al 70%, l'app diceva «nessuna Luna» per ogni oggetto e
ogni sito.

### 2. La Luna campionata a un istante

Un solo campione, a metà della notte astronomica. Una Luna che tramonta all'una
risultava presente tutta la notte o assente tutta la notte a seconda di dove cadeva
quell'istante. Ora è la media sulla finestra in cui l'oggetto è davvero utilizzabile,
dentro il ciclo che già percorreva la notte: costa un campione ogni mezz'ora.

### 3. L'inquinamento luminoso: esponente sbagliato

`lpPenalty` valeva `1/√(rapporto)` — un fattore di **SNR** — ed era usato dove serve un
fattore di **tempo**: `perNight = critH × lpF`, poi `nights = roadH / perNight`. Nel
regime limitato dal fondo, per tenere lo stesso SNR il tempo cresce come il flusso, non
come la sua radice.

L'app **diceva già la cosa giusta**: la riga «l'inquinamento luminoso ti costa ×43,7 il
tempo» mostra `1/lpF²`, cioè il rapporto. E poi calcolava con ×6,6. Testo e aritmetica si
contraddicevano da sempre; il testo aveva ragione.

### 4. Il cielo di riferimento non era dichiarato

Il difetto sotto il precedente. Le ore delle schede sono per una configurazione **ottica**
dichiarata, ma il **cielo** sotto cui valgono non stava scritto da nessuna parte — e senza
uno zero il fattore di inquinamento luminoso non ha un punto da cui partire. Ora è
`reference_config.sqm_zenith = 21.3` in `setups.json`, dichiarato e falsificabile.

21,3 e non `SKY_NATURAL` (21,9): un cielo senza traccia di luce artificiale è un cielo da
cui non riprende quasi nessuno, e le soglie vengono dalla pratica di AstroBin e dei forum,
che è pratica di cieli buoni ma non incontaminati.

### 5. Due cieli moltiplicati invece che sommati

`skyF = moonF × lpF` con i due fattori calcolati ciascuno rispetto al fondo naturale
contava due volte il fondo naturale. Ora:

```
lpF   = (1+x_rif) / (1+x_IL)                  costo del solo inquinamento luminoso
moonF = (1+x_IL)  / (1+x_IL+x_Luna)           costo MARGINALE della Luna
skyF  = (1+x_rif) / (1+x_IL+x_Luna)           e il prodotto torna esatto
```

Il costo marginale è anche la cosa giusta da mostrare: da una città la Luna pesa meno,
perché il fondo è già alto. Ed è vero.

### Cosa si è mosso, misurato

| | settimane (mediana) | verdetti cambiati |
|---|---|---|
| Borno (20,8) | ×0,98 | 0 su 18 |
| Passo alpino (21,5) | ×0,90 | 1 su 18 |
| Fondovalle (19,3) | ×1,41 | 4 su 18 |
| Milano (17,8) | ×1,09 | 8 su 18 |

**Zero prescrizioni cambiate su 72**: le ore per canale sono l'invariante, e sono rimaste
identiche. Il sito su cui il motore è stato tarato non si muove; a muoversi sono i cieli
cattivi, che erano quelli sbagliati.

---

## 11-quater · Altri due difetti, dallo stesso audit

### Il dual-band su OSC calcolato come banda larga

`filterFor('Ha+OIII')` cercava una banda che nel catalogo dei filtri non esiste,
restituiva `null`, e il calcolo della posa ripiegava sui 250 nm della luminanza. Il fondo
cielo usciva **cento volte troppo alto** e la posa consigliata a 60 s invece di 600 —
proprio sulla configurazione OSC + dual-band, la più diffusa che esista.

Ora `bandSpec()` risolve il gruppo al filtro dual vero. Un dual-band apre **due** finestre
strette; su un sensore a colori ogni fotosito ne vede però una sola — i pixel rossi
prendono l'Hα, i blu l'OIII — quindi conta una finestra con la QE media delle due. Su un
mono le vede entrambe.

### Un oggetto con una dimensione sola produceva NaN

`Math.max(1, NaN)` è `NaN`. Con `size_arcmin` di un solo elemento, pannelli, riempimento
e costo del mosaico diventavano tutti `NaN` **in silenzio** — il verdetto usciva «troppo
piccolo» perché nessun confronto con NaN è vero. `objectExtent` la difesa ce l'aveva già,
`mosaicPanels` e `framing` no. I dati distribuiti non contengono questo caso; i target
importati da `progetti.json` sì, potenzialmente.

---

## 11-bis · Rotazione della camera

> **Correzione del 2026-09.** L'angolo era troncato a 0–180°. Corretto per il
> *riempimento* del campo — il rettangolo del sensore è simmetrico a 180°, ed è per
> questo che `bestRotation` cerca ancora solo lì — ma sbagliato per tutto il resto:
> l'angolo che finisce nel rotatore e nel campo `PositionAngle` di N.I.N.A. è un angolo
> di posizione vero, e la differenza fra 65° e 245° è quale lato dell'oggetto ti ritrovi
> in alto. Con il troncamento, digitando «245» il campo si riscriveva in 65 al terzo
> tasto. Ora l'angolo gira su 360°, resta salvato per oggetto e arriva fino all'export.

Ruotare **non cambia mai le ore per canale**. Cambia l'inquadratura e, sugli oggetti
che non ci stanno, quanti pannelli servono — e quello sì che moltiplica le ore.

L'oggetto è un'ellisse con semiasse maggiore `A` lungo il proprio angolo di posizione
(da Nord verso Est) e semiasse minore `B`. Con la camera ruotata di `rot`, l'angolo fra
i due è `θ = PA − rot` e il rettangolo che contiene l'ellisse ha semi-estensioni:

```
lungo l'altezza del sensore   hy = √( (A·cosθ)² + (B·sinθ)² )
lungo la larghezza            hx = √( (A·sinθ)² + (B·cosθ)² )
```

Senza angolo di posizione noto resta l'ipotesi peggiore — asse maggiore attraverso il
lato corto — che è esattamente quello che l'app assumeva sempre prima: il comportamento
senza PA è identico a prima.

### Il consiglio automatico si dà solo dove c'è un costo

Il primo tentativo massimizzava il riempimento del campo. **Sbagliato, e il test l'ha
mostrato subito**: su NGC 4565 nell'RC8 portava da *«ideale 36%»* a *«piccolo 29%»*,
cioè peggiorava l'inquadratura per ottimizzare un numero che non era l'obiettivo.

Quando l'oggetto ci sta già, la rotazione è **composizione**, ed è una scelta di chi
riprende. Dove invece ha una conseguenza misurabile è il **mosaico**: lì il consiglio
si dà, con il costo attaccato.

### Quanto serve, misurato

Su 75.102 combinazioni oggetto × configurazione:

| | quante | % |
|---|---|---|
| richiedono un mosaico a rotazione 0 | 135 | 0,2% |
| di quelle, **senza angolo di posizione in catalogo** | 116 | 86% dei mosaici |
| dove ruotare risparmia pannelli | 12 | 0,02% |

È raro. Ma fra i dodici casi c'è **M31**, e non di poco: sul Tecnosky 115 con riduttore
0,80× si passa da **6 pannelli a 2** ruotando a 115° — tre volte le ore, sull'oggetto
più fotografato del cielo boreale. Sull'Askar 0,75× da 2 pannelli a 1.

Il motivo per cui è raro è in gran parte un **buco nei dati**: OpenNGC dà l'angolo di
posizione su 10.734 oggetti — quasi tutte galassie, che sono piccole e ci stanno — e
quasi mai sulle grandi nebulose, che sono proprio quelle che richiedono il mosaico.
Aggiungere il PA alle nebulose estese del catalogo curato sbloccherebbe la funzione
esattamente dove serve.

### Un difetto del merge, trovato provando

Il curato vince sull'archetipo, e deve. Ma vinceva anche dove **non aveva il dato**: i
169 curati non hanno angolo di posizione, quindi M31 e NGC 4565 lo perdevano pur
avendolo in OpenNGC. Corretto: nel merge vince chi ha il dato, non chi ha lo strato —
l'archetipo resta curato, geometria e magnitudine si innestano da OpenNGC dove mancano.
Stessa cosa per le 13 schede di `targets.json`, che non passavano affatto dal merge.

---

## 12. Cosa resta aperto sul motore

1. **Nessuna validazione empirica delle soglie.** Tutte calcolate, mai confrontate con
   integrazioni reali. È il buco che conta più di ogni altro, e il diario di sessione è
   il meccanismo che lo chiuderebbe. Il modello della posa è l'unica parte che ha un
   riscontro: la sequenza N.I.N.A. reale dell'utente.
2. ~~Il modello lunare sottostima il primo quarto~~ — **corretto**, vedi §11-ter.
   Resta da verificare sul campo la taratura di Krisciunas-Schaefer: a Luna piena e 90°
   di separazione il modello dà 18,9 mag/arcsec², forse mezza magnitudine ottimista.
3. **Il pozzetto in HCG è derivato, non misurato.** 16.000 e⁻ da 65535 ADU × ~0,25
   e⁻/ADU. Il campo `full_well_e` ereditato nelle camere dice 4.600 e non è usato da
   niente: `gain_modes` è quello che conta. Da confermare sui propri dark e bias.
4. **`share` è quasi inutilizzato.** Serve solo all'ordine di priorità in fase 1.
5. **Il pesaggio ×1,35 sul critico è arbitrario.** Sceglie fra strategie tutte
   ragionevoli, ma non deriva da niente.
6. **La magnitudine protetta (V 12,0; V 11,0 sui soggetti stellari) è una convenzione**
   calibrata su un solo caso reale. È modificabile dall'app, come ogni altro parametro
   operativo, ma resta il numero meno solido dello strato posa.
7. **L'orizzonte è piatto.** L'import del `.csv` di N.I.N.A. entrerebbe direttamente in
   `nightWindows`, dove oggi c'è una soglia unica per tutti gli azimut.
8. **Le notti candidate sono consecutive.** Il pianificatore non sa che il 40% saranno
   coperte: `bestStart` sposta l'inizio, ma non modella il meteo.
