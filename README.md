# Astro Imaging Strategy
### *Strategia di Ripresa*

Un motore di **strategia di acquisizione** per l'astrofotografia deep-sky.

Non è un planetario e non è un planner. I planetari dicono *dove* si trova un oggetto;
questo dice **come riprenderlo**: quale tecnica, quali filtri, quante ore per canale,
in quale ordine, cosa aspettarsi e cosa andrà storto in elaborazione.

```
Input  =  oggetto  ×  strumentazione  ×  cielo
Output =  tecnica, filtri, ripartizione del tempo, ordine, risultato atteso, trappole
```

---

## Perché

Esiste una quantità enorme di software che ti dice cosa è visibile stanotte.
Non esiste nulla che ti dica **se vale la pena riprenderlo con il tuo strumento**,
e soprattutto **sotto quante ore un canale non va nemmeno iniziato**.

Quella soglia è l'informazione di maggior valore e non la scrive nessuno.
Un'ora e mezza di SII su una nebulosa che ne richiede quattordici non produce
"un SII debole": produce rumore colorato, che poi costa altro lavoro per essere spento.

## Come è fatto

Due strati deliberatamente disaccoppiati:

| Strato | Dove | Natura |
|---|---|---|
| **Astrofisico** | `data/targets.json` | Statico, curato a mano, con incertezza dichiarata. **Non dipende dalla strumentazione di nessuno.** È il valore del progetto. |
| **Strumentale** | `data/setups.json` + calcolo a runtime | ~12 numeri e due formule. È aritmetica. |

Tenerli separati è ciò che elimina l'esplosione combinatoria: aggiungere un utente
con un setup mai visto costa zero, aggiungere un oggetto costa mezz'ora di bibliografia.

### Le due formule

```
Oggetto esteso (nebulose, dischi):   e⁻/s/px  ∝  D²·(p/F)²  =  p²/N²
                                     → contano SOLO rapporto focale e pixel

Oggetto puntiforme (stelle, nuclei): SNR  ∝  D·√t / θ_FWHM
                                     → contano SOLO apertura e seeing
```

Il motore capisce in quale regime si trova il target e applica quella giusta.

**Rapporto focale e trasmissione sono due cose diverse e restano separate.** Il rapporto
focale è geometria — focale su diametro — e un RC8 è f/8, punto. La trasmissione è quanta
luce arriva davvero: su un RC8 il 45% di ostruzione lineare toglie il 20% dell'area e due
specchi al 94% ne tolgono un altro 12%, per un totale del **70%**.

Tradurre la seconda in un "f/ efficace" è un modo di nascondere una perdita facendola
sembrare geometria, e porta a confondere due grandezze che si comportano in modo diverso.
Il tempo di posa si calcola dal tasso di segnale per pixel — `A_eff × Ω_px` — non da un
rapporto focale corretto a mano.

### Cosa il modello fa e cosa non fa

- Il fondo cielo in banda stretta **non** è derivato dall'SQM: in narrowband il pavimento
  è l'airglow naturale, non l'inquinamento luminoso.
- L'impatto lunare usa Krisciunas & Schaefer (1991) e dipende da altezza della Luna,
  **separazione angolare** dal target, fase e banda del filtro. La separazione conta
  spesso più della fase.
- Estinzione differenziale per banda: a 500 nm è circa il doppio che a 656 nm.
  Per questo la soglia di altezza utile dell'OIII è più alta di quella dell'Hα.
- **La Luna non spegne la notte: riordina la lista.**

## Uso

```bash
# versione mantenibile (JSON separati) — richiede un server per via del CORS
python -m http.server
# → http://localhost:8000

# versione offline con dati incorporati, doppio clic, niente rete
node build.js        # genera astroplan-standalone.html
```

Il doppio clic su `index.html` non funziona: i browser bloccano la lettura di
`data/*.json` da `file://`. Per la postazione usa `astroplan-standalone.html`.

```bash
node test.js         # 259 verifiche sul motore
node diag.js M31 14.5 tec_red_am5 1              # perché queste ore
node plan.js M31 14.5 3 rc8_red_cem70 1 2026-09-20   # in quali notti, con quale posa
node tools/build-openngc.js <path>/NGC.csv   # rigenera lo strato catalografico
```

## Strumentazione e siti: si aggiungono dall'app

Non serve toccare il codice per usare la propria attrezzatura. Il catalogo copre **28
telescopi, 17 camere e 14 montature** fra i più diffusi; per tutto il resto ogni tendina
finisce con **+ Aggiungi…**, che chiede solo i numeri che servono davvero:

- **Telescopio** — apertura, focale, tipo di ottica (precompila ostruzione e trasmissione
  con valori tipici, correggibili), riduttori disponibili
- **Riduttore** — anche la tendina dei riduttori finisce con **+ Aggiungi…**: basta il
  fattore, scritto come viene (`0.8`, `0.8x`, `0,63x`, `x0.7`), e vale anche per i
  moltiplicatori (`1.5x`). Si attacca al telescopio corrente, di catalogo o tuo che sia
- **Camera** — pixel, risoluzione, read noise, mono o Bayer, QE di picco. Non serve la
  curva completa: l'app usa una forma CMOS tipica normalizzata sul picco, e l'errore
  resta di qualche punto percentuale
- **Montatura** — RMS di guida reale (non il PE dichiarato dal costruttore) e posa massima

Quello che aggiungi resta salvato nel browser ed entra in `progetti.json` quando esporti,
così te lo porti su un altro computer.

## Seeing e guida: le due misure che decidono il campionamento

Sono le uniche due grandezze del pannello **modificabili a mano**, e non è un dettaglio:
non hanno valori standard e cambiano da notte a notte. Un numero di catalogo qui non
significa niente.

E non sono indipendenti. L'errore di inseguimento allarga le stelle e **si somma in
quadratura al seeing**:

```
FWHM reale = √( seeing² + (1,7 · RMS)² )
```

| Seeing | RMS | FWHM reale | |
|---|---|---|---|
| 1,6″ | 0,0″ | 1,60″ | — |
| 1,6″ | 0,6″ | 1,90″ | +19% |
| 1,6″ | 1,0″ | 2,33″ | +46% |
| 1,6″ | 1,3″ | 2,73″ | +71% |

**È questa, non il seeing nudo, a decidere se il campionamento è corretto.** Sull'RC8 a
piena focale (0,48″/px) con seeing 1,6″: guida perfetta → *corretto*; guida a 1,3″ RMS →
*sovracampionato*. Stesso telescopio, stesso cielo, verdetto opposto — e la conseguenza
pratica è che a quel punto migliorare la guida vale più che aggiungere ore.

Il pannello lo dice esplicitamente: se la guida allarga le stelle di più del 35%, accanto
all'RMS compare *«limita la guida»*.

Il **seeing appartiene al sito** e viene salvato con lui; l'**RMS appartiene alla
montatura** e quello che scrivi resta legato a quella. Cambiando montatura riparte dal
valore di catalogo — quello a lunga focale se la scala è fine, che è il realistico — finché
non ne scrivi uno tuo.

Il *fattore tempo* è uscito dal pannello: era un numero derivato, non una misura, e la
scheda di ogni oggetto lo riporta comunque dove serve.

## Binning: la terza voce della catena

Accanto a seeing e guida c'è il **binning di ripresa**, e sta lì perché chiude la stessa
catena: pixel → scala → campionamento → ore.

```
pixel effettivo = pixel × bin        scala = 206,265 × pixel_eff / focale
raccolta per arcsec² = A_eff·QE·T·CFA   →   il binning NON la cambia
buio e lettura sono per pixel: /Ω_px    →   crescono con la focale al quadrato
```

Il punto che quasi tutti sbagliano: **sui CMOS il binning non è quello che era sui CCD.**
Sul CCD i pozzetti si sommavano *prima* della lettura e il rumore di lettura restava uno:
segnale ×4, rumore ×1, SNR ×4. Sui CMOS la somma è digitale e avviene *dopo*, quindi su
2×2 il read noise si somma in quadratura e raddoppia: segnale ×4, rumore ×2, SNR ×2.

Nel regime limitato dal fondo cielo — cioè ogni posa deep-sky di durata corretta — il read
noise non conta e il guadagno torna pieno. Ma è esattamente lo stesso guadagno che ottieni
**binnando in elaborazione dopo l'integrazione**. Conseguenza pratica, ed è quella che
l'app ripete ogni volta che consiglia bin > 1:

> La decisione è reversibile. Riprendi a bin 1 e bini in post se la nottata è venuta con
> FWHM larga; se è venuta buona ti tieni la risoluzione. Quello che risparmi binnando in
> ripresa è spazio disco e tempo di calibrazione, non fotoni.

L'eccezione sono i sensori con un *modo* nativo diverso — l'ASI294MM in «bin 2» è il modo
4,63 µm reale, non una somma. Lì la scelta è irreversibile davvero.

Il consiglio accanto alla tendina non è mai «binna sempre» né «non binnare mai»: propone il
binning più alto che resta in **campionamento corretto** rispetto alla FWHM reale di
stanotte. Sull'RC8 nativo con FWHM 2,0″ dice *valuta bin 2* (0,48 → 0,96″/px: campionamento
corretto, stesse ore — il binning non crea fotoni);
sull'Askar 71F, già a 2,11″/px, dice *bin 1* e spiega che lì binnare non è un compromesso,
è solo perdita.

Il punteggio è stato corretto di conseguenza: il termine di campionamento ora pesa 0,12
invece di 0,08 e penalizza il sottocampionamento in proporzione a quanta risoluzione
butti via. Senza quella correzione bastava alzare il binning per far salire il punteggio
di ogni oggetto — cioè barare con sé stessi in modo strutturale.

## Due livelli di budget: ideale e ridotto

Ogni canale ha sempre avuto tre numeri — **soglia**, **utile**, **satura**. Adesso ne ha un
quarto, il **livello ridotto**, e non è una divisione per due:

```
ridotto = max( soglia , k × utile )      k = 0,60 sul canale critico
                                         k = 0,40 sugli altri
```

Due regole, e sono entrambe l'opposto di «dimezza tutto». La prima: **mai sotto la soglia**,
perché sotto quella il canale restituisce rumore colorato e le ore sono perse due volte —
prima a raccoglierle, poi a spegnere quello che hanno raccolto. La seconda: il **canale
critico si taglia meno degli altri**, perché è quello che decide se l'immagine si riconosce.

Sui 13 target in database il totale ridotto viene fra il **52% e il 63%** del progetto
pieno — non il 50% secco, e la differenza è tutta nei canali che la soglia blocca. Su NGC
6888 con l'RC8, per esempio, il taglio tocca solo l'OIII: Hα, SII e RGB sono già alla
soglia e la scheda lo scrive — *«su questi canali non esiste la mezza misura»*. È
l'informazione che mancava quando su quel SII sono finite 1,5 h invece delle 14 necessarie.

Se le soglie mangiassero più dell'85% del budget l'app direbbe che **la versione ridotta
non esiste**. Con i dati attuali non capita mai: il ramo resta come guardia per gli oggetti
aggiunti dagli utenti e per schede future con soglie più aggressive.

Perché conta: la camera cambia davvero il risultato. Sulla stessa ottica, in OIII a 3 nm,
una **2600MC** ha bisogno di **4,4 volte** il tempo di una **2600MM** — matrice di Bayer
più QE — e una **1600MM** di 1,5 volte. Senza questi numeri il budget orario sarebbe
sbagliato per chiunque non abbia esattamente la camera di riferimento.

## Le quattro domande a cui risponde

> **Cosa fotografo stanotte?** La lista, ordinata per resa attesa con il tuo cielo,
> il tuo strumento e i tuoi filtri.
> **Con quale telescopio e sensore?** Il fattore tempo cambia la risposta: la stessa
> ottica con una 2600MC costa 4,4 volte una 2600MM in OIII a 3 nm.
> **Quanto tempo mi serve?** Ore per canale su due livelli — progetto pieno e versione
> ridotta — e soprattutto **settimane di calendario**, che è il numero che decide se
> aprire il progetto.
> **Da Milano posso fare galassie e globulari?** No — servirebbero 25 volte le ore — e
> l'app te lo dice con la ragione, mentre le nebulose a emissione restano in cima.
> **Non so cosa riprendere.** La lista dei migliori di stanotte non è un ordine di
> catalogo: è lo **stesso motore della prescrizione** girato su tutto lo strato curato,
> con la tua configurazione, la tua data, il tuo cielo e la tua Luna. Cambia tubo, camera,
> binning, sito o notte e la classifica si rifà.
> **In quali notti, con quale posa, quante pose?** Il piano operativo: notti vere con la
> loro Luna e la loro lunghezza, blocchi per canale, posa in secondi e numero intero di
> sub — fino al file `.json` da caricare in N.I.N.A.

## Dalla prescrizione al piano — e a N.I.N.A.

Tre strati, e la separazione è il punto: la **prescrizione** dice quante ore per canale,
la **pianificazione** dice in quali notti ci stanno, la **posa** dice come quelle ore si
spezzano in fotogrammi. Cambiare il numero di notti non può cambiare le ore, e cambiare
la posa non può cambiare né le une né le altre.

**Due modalità, un motore solo.** *Sessione completa* (default) fa sì che ogni notte
contenga tutti i canali della strategia, nelle proporzioni della prescrizione: se domani
piove, stanotte è già un'immagine, e dopo una notte hai comunque un mono da guardare.
*Ottimizzazione sul progetto* distribuisce invece i canali fra le notti secondo la Luna —
rende di più sul progetto intero, ma la singola notte non è autonoma. In entrambe le ore
per canale sono identiche: cambia solo come si posano sulle notti. Il bilanciamento è un
problema di trasporto risolto con Sinkhorn, con l'ultima passata sulle righe, perché fra i
due vincoli quello che non si negozia è la prescrizione.

Il numero di notti è un **vincolo, non una divisione**. Le ore di una notte sono
l'intersezione fra la notte astronomica di quella data e il tempo in cui l'oggetto sta
sopra la sua soglia, meno l'overhead di sessione: da Borno il 20 settembre NGC 6888 dà
5,0 h, non «20 h ÷ 5». Se le notti chieste non sono compatibili con le ore, il piano
**non si costruisce**: dice perché, dice il minimo e il massimo, e lascia scegliere.
Nessuna correzione silenziosa.

```
Notte 3 · mar 22 set · 4.9 h disponibili · Luna pesante su questa notte
  OIII   2 h 50′   600 s × 17                                = 2 h 50′
  Ha        50′    600 s × 5                                 =    50′
  RGB       18′    90 s × 4 R · 90 s × 4 G · 90 s × 4 B      =    18′
  totale 3 h 58′ di integrazione · 4 h 03′ di orologio · restano 56′
```

**La posa esce da un'ottimizzazione, non da una tabella.** Si massimizza l'SNR per ora
di *orologio* — non di integrazione — sotto tre tetti: saturazione delle stelle,
rischio di perdere un fotogramma, numero minimo di pose perché la reiezione statistica
funzioni. Ne segue che la posa migliore è sempre la più lunga ammessa, e che a fermarla
è un tetto, **mai il cielo**: con filtri da 3 nm da un cielo di montagna servirebbero
pose da due ore per sommergere il rumore di lettura. È il motivo fisico per cui la banda
stretta va in HCG, e il motore lo ricava invece di copiarlo da un forum. Sull'RC8 a f/8
da Borno il modello dà L 120 s a gain 0 — che è esattamente quello che c'è nella
sequenza N.I.N.A. reale usata come banco di prova.

**L'export è solo un export.** ASTROFOTO non parla con N.I.N.A. e non comanda niente:
scrive un `.json` per notte, con la serializzazione che il Sequenziatore Avanzato si
aspetta, verificata campo per campo contro una sequenza reale. Dove N.I.N.A. ha già un
meccanismo si usa il suo: «Hα 600 s × 25» è **uno** Smart Exposure con `Iterations 25`,
non venticinque istruzioni.

Tutti i parametri operativi — overhead, sessione minima, posa minima e massima, pose
minime per canale, magnitudine protetta, cadenza del dither — sono modificabili
dall'app: nessuno è una costante fisica.

## Inquinamento luminoso

Il sito porta con sé la sua classe **Bortle** e il suo SQM, e l'app li traduce in un costo
reale — diverso per banda, che è il punto:

| Cielo | SQM | Banda larga | Filtri 3 nm |
|---|---|---|---|
| *Riferimento delle schede* | *21,3* | *×1,0* | *×1,00* |
| Passo alpino (Bortle 3) | 21,5 | ×0,8 il tempo | ×1,00 |
| Borno (Bortle 4) | 20,8 | ×1,6 | ×1,01 |
| Fondovalle (Bortle 6) | 19,3 | ×6,3 | ×1,11 |
| **Milano (Bortle 8)** | **17,8** | **×25,1** | **×1,50** |

Il **cielo di riferimento** è dichiarato in `setups.json` (SQM 21,3, Bortle 3): è il cielo
sotto cui valgono le ore scritte nelle schede, e senza uno zero dichiarato il fattore non
aveva un punto da cui partire. Un cielo migliore vale un bonus, non un pareggio.

Da un cielo cittadino le galassie e gli ammassi non sono difficili: sono **fuori portata**,
perché servirebbero quarantaquattro volte le ore. Il bicolore Hα/OIII a 3 nm invece costa
il 50% in più e resta perfettamente praticabile. La ragione è fisica e non estetica:
l'inquinamento luminoso è quasi tutto continuo, un filtro da 3 nm ne lascia passare circa
l'1%, e il pavimento che resta è l'airglow naturale, che non scala con l'IL.

Questo **riordina la lista dei target**, non la accorcia: da Milano le nebulose a emissione
salgono e galassie, ammassi e nebulose a riflessione scendono, ciascuna con la sua ragione
scritta accanto.

### L'SQM segue le coordinate

Cambiare sito e vedere l'SQM fermo su un valore sbagliato rende inutile tutto il resto.
L'app stima l'inquinamento luminoso dalle coordinate con la **legge di Walker** — la
brillanza artificiale di una città a distanza *d* va come `P·d^-2.5` — su una tabella di
**159 centri abitati** italiani e di confine, calibrata su tre **misure di campo**:
Milano centro 17,8 · Sondrio 19,4 · Borno 20,8.

Gli ancoraggi sono misure reali, non valori letti da mappa, e questo rende il modello più
pessimista di quanto ci si aspetti: in Italia un buon sito di montagna sta sul Bortle 3-4,
non sul 2. Un cielo Bortle 1 in Italia non esiste.

| Luogo | SQM stimato | Bortle |
|---|---|---|
| Milano centro | 17,80 | 8 |
| Monza | 17,66 | 8 |
| Brescia | 18,58 | 7 |
| Sondrio | 19,25 | 6 |
| Borno | 20,82 | 4 |
| Passo del Tonale | 21,49 | 3 |
| Livigno | 21,61 | 2 |

### Stimato per default, tuo se lo imposti

L'SQM **segue sempre le coordinate**: cambi sito, rilevi la posizione o modifichi
latitudine e longitudine, e si aggiorna da solo. Anche un sito salvato tempo fa viene
ristimato quando lo riselezioni — altrimenti si porta dietro un valore che non c'entra più
niente, ed è così che un sito chiamato «Milano» finiva per mostrare un cielo rurale.

Se scrivi un valore nel campo, quello **diventa tuo** e il modello non lo tocca più: accanto
compare *impostato da te* invece di *stimato*. Il pulsante **Ristima** riporta alla stima
automatica. Il sito salvato ricorda quale dei due casi era.

È una **stima da modello, non una misura**, ed è dichiarata come tale: il valore vero si
legge sulla mappa satellitare, e l'app genera il link a lightpollutionmap.info già centrato
sulle tue coordinate.

## Filtri

I filtri non sono inventario: **decidono quali strade esistono**. Senza un SII non c'è
nessun SHO, e l'app lo dice invece di proporlo. La larghezza di banda entra nei conti,
perché fra un 3 nm e un 7 nm passa più del doppio di inquinamento luminoso e di Luna:

| Filtro | Costo in tempo da Milano |
|---|---|
| 3 nm | ×1,51 |
| 7 nm | ×2,19 |
| 12 nm | ×3,05 |
| Banda larga | ×43,7 |

Il catalogo copre 34 filtri fra monocromatici, dual-band per sensori a colori
(L-Ultimate, L-eXtreme, L-eNhance, ALP-T, NBZ, Askar Colour Magic…) e anti-inquinamento,
con **+ Aggiungi** per tutto il resto.

**Dual-band su sensore a colori**: raccoglie Hα e OIII nella stessa posa, quindi la strada
HOO costa il tempo del canale più difficile e non la somma dei due. L'app lo calcola e lo
segnala nella lista — è ciò che rende un OSC con L-Ultimate meno svantaggiato di quanto
suggerirebbe il solo conto della matrice di Bayer.

## Fattibilità

Accanto all'inquadratura c'è un giudizio secco per **quel cielo, quello strumento, quei
filtri**: *fattibile* (entro una settimana e mezza di notti serene) · *impegnativo* (fino a
cinque) · *lungo* (fino a quattordici) · *fuori portata* · oppure *manca il filtro X*, che
batte qualunque durata.

Da Borno l'ordine è M27, NGC 6888, NGC 7635. Da Milano le nebulose a emissione restano in
cima e M45 e Sh2-155 scendono a *fuori portata*. Togliendo il filtro OIII, i target a banda
stretta crollano e risalgono le galassie: **la lista si riordina secondo quello che puoi
davvero fare.**

### Posizione

Il sito si sceglie da un elenco, si rileva con **Rileva posizione** (Geolocation del
browser), o si incolla nel campo latitudine — accetta `45.95, 10.20` e le forme in
gradi/primi/secondi, cioè quello che dà Google Maps.

Due cose oneste sulla geolocalizzazione:

- **La precisione non è un problema.** 0,1° di latitudine sono 11 km e spostano l'altezza
  di 0,1°; 0,1° di longitudine sono 24 secondi di tempo siderale. Anche la localizzazione
  via IP, che sbaglia di chilometri, è abbondantemente sufficiente. Per questo
  `enableHighAccuracy` resta `false`: niente GPS acceso, niente attesa.
- **Su un computer, offline non funziona.** Senza GPS integrato la posizione arriva da rete
  e WiFi. Su telefono con GPS funziona anche senza connessione. In postazione la risposta
  giusta è comunque salvare il sito una volta e non pensarci più.

## Perché il profilo fisico non arriva da Wikipedia in diretta

Wikipedia è ottima su meccanismo di eccitazione, stella centrale e storia — e **non ha i
rapporti fra righe**, che sono l'unico dato che cambia la scelta dei filtri. Verificato
sulla voce del Crescent: descrive benissimo la collisione fra i venti di WR 136 e non dice
quale riga domini.

Ci sono poi tre ragioni pratiche per non fare la query dal browser:

- **La traduzione è un atto editoriale, non una fetch.** Una pagina statica che scarica
  Wikipedia inglese ottiene prosa inglese su distanze e scoperte. Trasformarla in
  «regione HII fotoionizzata, quindi Hα forte e OIII confinato» richiede giudizio.
- **Offline non funziona**, cioè proprio in postazione.
- Darebbe l'impressione che l'app conosca l'oggetto quando conosce solo la sua biografia.

Quindi l'estrazione è fatta a monte e una volta sola, e si concentra sull'unica cosa che
poi decide tutto: il **meccanismo di eccitazione**. Da lì discende l'archetipo, e
dall'archetipo il budget. Ogni oggetto del catalogo porta un **archetipo curato** — non più
dedotto da un campo `type`, che sbagliava sistematicamente: le planetarie di Abell
finivano fra le compatte brillanti e le ellittiche fra le spirali con regioni HII — e i 63
oggetti più fotografati hanno anche un **profilo fisico scritto per la ripresa**.

Il link a Wikipedia resta nella scheda, per quello che sta davvero lì: distanza,
magnitudine, storia della scoperta. Cose che non entrano nella scelta dei filtri.

## Tre strati, un solo indice

Il database non è una lista di nomi, sono **tre strati sovrapposti**, e la differenza è
dichiarata ovunque compaia un numero.

| | Cosa contiene | Quanti | Confidenza dell'archetipo |
|---|---|---|---|
| **OpenNGC** | Tutto NGC e IC: nome, alias, coordinate, dimensioni, magnitudine, tipo — archetipo **dedotto** dal tipo e dalla morfologia | ~13.300 | `alta` · `media` · `da collaudare` |
| **Catalogo curato** | I 169 più fotografati, con **archetipo scelto a mano** e profilo fisico scritto per la ripresa. Copre anche ciò che OpenNGC non ha: Sharpless, Barnard, planetarie di Abell, vdB | 169 | curata |
| **Archetipo** | Budget per canale, strade, ordine, resa attesa, trappole — **della classe fisica** | 13 | bassa, dichiarata |
| **Scheda curata** | Righe di emissione con morfologia e fonte, soglie e trappole di *quell'oggetto* | 13 | alta/media, per riga |

**Un solo indice, non due sistemi.** Il curato vince sempre: dove c'è una mano, la
macchina si fa da parte. OpenNGC riempie tutto il resto — e ogni oggetto che ne arriva
passa esattamente per lo stesso motore: `floor/useful/saturates`, strade, canale critico,
fattore tempo, binning, Luna, livelli, piano per notte. Nessuna logica parallela.

### I tre livelli di certezza dell'archetipo

| livello | quando | quanti | cosa dice l'app |
|---|---|---|---|
| `alta` | il tipo OpenNGC corrisponde uno-a-uno a un archetipo (OCl, GCl, HII, RfN, SNR) | 995 | *archetipo certo* |
| `media` | serve un campo secondario: morfologia di Hubble per le galassie, brillanza superficiale per le planetarie | 10.420 | *archetipo dedotto* |
| `da collaudare` | il tipo di catalogo è generico (`Neb`, `Other`) o mancano i dati | 1.102 | *classificazione da collaudare*, in rosso, con il motivo e l'invito a correggerla |

Le 792 stelle e coppie di stelle non ricevono archetipo: cercarle dà una risposta
esplicita — *non è un bersaglio deep-sky esteso* — invece di un vicolo cieco.

### La verifica incrociata, che ha trovato errori da entrambe le parti

152 oggetti sono classificati **due volte in modo indipendente**: a mano nel catalogo
curato, e per deduzione da OpenNGC. Confrontarli è il miglior controllo di regressione
che il progetto abbia, ed è un test permanente.

Al primo confronto: **129 concordi, 24 discordi**. Le discordanze hanno trovato:

- **due errori miei** — NGC 891 e NGC 4565 erano marcati come ellittiche. Sono spirali
  di taglio, tipo di Hubble Sb. Corretti.
- **un errore di mappatura mio** — avevo mandato il tipo generico `Neb` a *riflessione*,
  ragionando che la banda larga è la scelta prudente perché su un continuo la banda
  stretta non raccoglie nulla. Teoricamente pulito, **smentito dai dati**: dei 14 oggetti
  `Neb` con nome comune, 11 sono nebulose a emissione (Laguna, Aquila, Trifida,
  California, Rosetta, Omega, Testa di Scimmia…) e 3 a riflessione. In OpenNGC la
  riflessione ha il suo tipo (`RfN`) e le oscure pure, quindi `Neb` è il secchio dei
  residui e lì resta soprattutto emissione. Corretto — undici volte su quattordici
  avrebbe sbagliato.

Dopo le correzioni: **140 concordi, 12 discordi**, e le dodici rimaste sono volute — il
curato è deliberatamente più specifico (NGC 2359 è una bolla Wolf-Rayet, non una HII
generica; NGC 5907 vale per la sua marea stellare, non per i bracci).

Comporre catalogo + archetipo dà una **prescrizione sensata senza scrivere una riga di
scheda**. Scrivi `M56` e l'app risponde: *ammasso globulare in Lira, 7′, niente banda
stretta, RGB 2,5 h e L 1,5 h, il problema è il nucleo che satura* — con la confidenza bassa
scritta sopra il numero, non sotto.

Non serve — e non servirà mai — una scheda per ogni oggetto. Servono **molti oggetti
catalogati, pochi archetipi affidabili, poche schede molto approfondite**.

### Il difetto che questo ha corretto

Prima, un oggetto di catalogo senza scheda finiva in un vicolo cieco: *«nessuna scheda»* e
un modulo da compilare a mano. Con il modulo che partiva da **«Regione HII fotoionizzata
classica»** come primo elemento della tendina — quindi bastava non toccarlo per ottenere una
prescrizione Ha/OIII/SII dall'aria scientifica su un ammasso globulare.

Tre correzioni:

1. **Nessun archetipo di default.** La tendina parte da *«— non determinato —»* e finché
   resta lì non viene proposto nessun budget. Un numero inventato è peggio di nessun numero.
2. **Il catalogo determina la classe** — e la conosce per tutti e 169 gli oggetti, perché
   l'archetipo è curato a mano uno per uno, non dedotto da un campo `type`.
3. **Niente modulo.** L'oggetto di catalogo viene prescritto direttamente. Il modulo resta
   per ciò che il catalogo non copre.

### Globulari e aperti, separati

L'archetipo `cluster` è stato diviso in **`cluster_globular`** e **`cluster_open`**. Hanno
in comune solo *«niente banda stretta»*; il resto è opposto:

- **Globulare** — il problema non è il segnale, che abbonda, ma la **dinamica**: il nucleo
  satura molte magnitudini prima che la periferia esca dal fondo, e si risolve in ripresa con
  una serie di pose corte da fondere, non in elaborazione. Il pregio dell'immagine è quante
  stelle separi nel nucleo, e quello lo decide il **seeing**, non le ore.
- **Aperto** — poche decine di stelle brillanti su campo largo. Il problema è il **colore**
  e la qualità del campo: bordi, vignettatura, aloni. Si chiude in un'ora e mezza, ed è il
  soggetto giusto per le notti con la Luna.

I 59 oggetti sono stati ritaggati dal campo `type` già presente in catalogo: nessuna ipotesi.
Le Pleiadi restano `reflection`, perché il soggetto fotografico lì è la nebulosità, non
l'ammasso.

## Aggiungere un oggetto

Il pulsante **+ Aggiungi un oggetto** serve ora solo per ciò che il catalogo **non** copre:
gli oggetti catalogati vengono prescritti direttamente. Il form ha
**autocompletamento su 169 oggetti** — tutti i 110 Messier più i NGC/IC/Sh2/Abell più
fotografati, con 214 alias in italiano e in inglese. Scrivi `Rosetta`, `Iris`, `Vortice`,
`Cocoon` o `M51` e coordinate, dimensioni, costellazione e archetipo si compilano da soli.

Se l'oggetto ha già una **scheda curata**, l'app te lo dice e ti propone di aprirla invece
di ricrearla: rifarla a mano ti farebbe perdere righe, soglie e trappole per riguadagnare
solo la geometria.

Un oggetto aggiunto da te riceve lo stesso trattamento degli altri su visibilità,
inquadratura, finestra utile, Luna e inquinamento luminoso — quelli sono calcolati davvero.
Il budget invece viene dall'**archetipo** che scegli ed è dichiarato a **confidenza bassa**:
è una stima per analogia di classe, non una scheda. L'app lo scrive, non lo nasconde.

L'autocompletamento vale anche per la strumentazione: nei form telescopio, camera e
montatura il nome è un campo con suggerimenti, e scrivendo un nome di catalogo i campi
numerici si compilano. Serve a evitare che lo stesso strumento finisca censito con dieci
nomi diversi.

## Stato dei progetti

L'unità di pianificazione è il **progetto multi-notte**, non la sessione: in banda stretta
nessun progetto si chiude in una notte.

Lo stato vive in un `progetti.json` che tieni tu — portabile fra macchine, versionabile
in git. Il browser ne conserva una copia di comodo, ma **la verità è il file**.

Il pannello *Progetti* legge le ore già raccolte direttamente dai nomi dei master:

```
masterLight_BIN-1_6248x4176_EXPOSURE-300.00s_FILTER-O_mono_autocrop.xisf
                                    └── 300 s ──┘        └── OIII ──┘
```

Trascini la cartella, l'app conta i file per filtro e ti dice dove sei rispetto al budget.

## Struttura

```
index.html                 app (single-file, nessuna dipendenza esterna)
astroplan-standalone.html  generato da build.js, per l'uso offline
build.js                   incorpora i JSON nell'HTML
test.js                    verifica del motore
data/setups.json           telescopi, camere, filtri, montature, siti
data/targets.json          database astrofisico (schede curate)
data/catalog.json          catalogo: 169 oggetti con archetipo curato e 63 profili fisici
data/cities.json           159 centri abitati per la stima dell'inquinamento luminoso
CONTRIBUTING.md            come proporre un nuovo target
```

## Contributi

Il database è aperto: chiunque può proporre i propri target.
Vedi **[CONTRIBUTING.md](CONTRIBUTING.md)** — con un vincolo che non è negoziabile:
**il campo confidenza è obbligatorio**. Senza dichiarare se un rapporto fra righe viene
da letteratura o da analogia di classe, il database degenera in folklore, che è
esattamente il problema che questo progetto esiste per risolvere.

## Limiti dichiarati

- **Non esiste una survey all-sky in [OIII] né in [SII].** Per l'Hα c'è la mappa composita
  di Finkbeiner (WHAM+VTSS+SHASSA); per le altre righe si va di spettroscopia oggetto per
  oggetto o di analogia di classe. Da qui l'obbligo di dichiarare la confidenza.
- Le soglie sono **calcolate dal modello fisico**, non ancora validate su dati reali.
  La validazione per archetipo su AstroBin è prevista, con le ore normalizzate in
  fotoni/arcsec² usando la strumentazione dichiarata — le ore grezze non sono confrontabili.
- AstroBin ha **bias di sopravvivenza**: mostra cosa ha funzionato, è cieco su cosa non
  funziona. Ed è proprio il pavimento l'informazione di maggior valore.
- Il database copre ~13 target: una **tassonomia con esemplari**, non un catalogo.
  Fuori da quelli l'app non finge di sapere.
- Il **livello ridotto è derivato**, non curato: nasce da soglia e utile con una regola
  fissa. Il che significa che vale esattamente quanto valgono le soglie — vedi il punto
  sopra sulla validazione mancante.
- Il guadagno del binning è calcolato nel **regime limitato dal fondo cielo**. Con pose
  troppo corte, o in banda stretta molto spinta su cieli molto bui, il read noise torna a
  contare. Corretto in v1.4: il binning non divide le ore, cambia il campionamento.

## Licenza

**Software proprietario.** © 2026 Alessandro Curci — tutti i diritti riservati.

Questo **non** è software open source. L'uso è consentito attraverso il servizio web
ufficiale, per finalità personali e non commerciali. Il codice sorgente è pubblicato per
trasparenza e consultazione: non è concessa alcuna licenza per copiarlo, modificarlo,
distribuirlo, forkarlo, incorporarlo in altri prodotti o servizi, né per usarlo a fini
commerciali. Ogni uso ulteriore richiede autorizzazione scritta preventiva.

Termini completi in **[LICENSE](LICENSE)**.

> **Eccezione — dati di terze parti.** `data/openngc.json` è derivato da
> [OpenNGC](https://github.com/mattiaverga/OpenNGC) di Mattia Verga ed è distribuito
> sotto **CC-BY-SA-4.0**, insieme al testo di licenza e all'attribuzione che lo
> accompagnano — vedi [data/OPENNGC-CREDITS.md](data/OPENNGC-CREDITS.md). Quel materiale
> resta soggetto alla propria licenza e non è coperto dalle restrizioni proprietarie.
