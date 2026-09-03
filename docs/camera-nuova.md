# Il percorso di una camera nuova

*Verifica architetturale, nessuna modifica al motore. Camera di prova: ASI294MC —
aggiunta a mano dall'interfaccia, e confrontata con la stessa camera già presente
in matrice e con la 2600MC, che è l'unica OSC con dati misurati.*

---

## Prima cosa: la 294MC **è** in matrice

`data/setups.json` la contiene (`asi294mc`). Non è però una scheda piena: ha
`qe_peak` scalare invece della tabella spettrale, e il blocco `cfa_fraction`
**generico** — 0,29 / 0,71 / 0,28 — cioè esattamente i valori che il gate v1.6 ha
sostituito sulla 2600MC perché sottostimavano l'Hα del 22% e il SII del 32%.

Restano quindi **tre livelli di camera**, non due:

| livello | esempio | QE | Bayer banda stretta |
|---|---|---|---|
| scheda piena | `asi2600mc` | tabella a 9 punti | `cfa_fraction` **misurata** |
| scheda parziale | `asi294mc`, altre 6 | `qe_peak` | `cfa_fraction` **ereditata** |
| aggiunta a mano | dal modulo | `qe_peak` | **niente** → modello |

## 1 · Che cosa chiede il modulo

Sei numeri, `saveGear('cam')`:

| campo | obbligatorio | default |
|---|---|---|
| Nome | sì | — |
| Sensore: mono / colore | sì | mono |
| Pixel µm | sì, `>0` | — |
| Larghezza px · Altezza px | sì, `>0` | — |
| Read noise e⁻ | no | 1,5 |
| QE di picco % | no | 80 |

## 2 · Che cosa ricava da solo

| grandezza | come |
|---|---|
| `qe(λ)` | `qe_peak × QE_SHAPE(λ)`, forma CMOS tipica normalizzata |
| `cfa_penalty` | 0,25 se «colore» — usato solo come **bandiera** «è una matrice» |
| `dark_e_s` | **0,003 cablato nel modulo**: non chiesto, non mostrato |
| scala, campo, Ω_px, `rnEff` | da `derive()`, pura geometria |
| modo di guadagno | **assente** → modo unico assunto, pozzetto **20000 e⁻** |
| `cfa_fraction` | **assente** → nessun dato dichiarato in banda stretta |

## 3 · I due rami, e quale si prende

`oscEfficiency(cam, band, sp)` è l'unico punto in cui la matrice entra nel conto.

**Banda larga** (`sp.narrow === false`) — integrale spettrale, `cfa_fraction`
**non viene nemmeno letto**:

```
eta = < QE_pub(λ) · mosaico(λ)/migliore(λ) >_banda / QE_pub(λ_eff)
```

dove `mosaico(λ) = (R + 2G + B)/4` viene da `mosaicFrac()`. Una camera nuova qui
**non perde niente**: RGB 0,498 · L 0,503 contro 0,490 / 0,493 della 2600MC —
la differenza è solo la QE, non il mosaico. Confidenza *media-alta (±6%)*, ramo
validato.

**Banda stretta** (`sp.narrow === true`) — precedenza a tre livelli:

```
cfa_fraction[banda] dichiarato   →   mosaicFrac(λ) modello   →   cfaLegacy 0,25/0,50
```

Una camera aggiunta a mano non ha il primo, quindi prende il **modello spettrale**.

| banda | 2600MC (misurata) | 294MC matrice (ereditata) | 294MC a mano (modello) |
|---|---|---|---|
| Hα | 0,357 | 0,290 | **0,374** |
| OIII | 0,641 | 0,710 | **0,640** |
| SII | 0,393 | 0,280 | **0,414** |

## 4 · I fallback, e quale scatta davvero

| fallback | quando | scatta? |
|---|---|---|
| `qe_peak × QE_SHAPE` | manca la tabella QE | **sì**, sempre |
| modello spettrale in banda stretta | manca `cfa_fraction` | **sì** |
| `cfaLegacy` 0,25 / 0,50 | manca anche il modello | **mai** |
| `OSC_BB = 0,34` in banda larga | l'integrale non si chiude | **mai** |
| modo di guadagno unico, pozzetto 20000 | manca `gain_modes` | **sì** |

Gli ultimi due non scattano perché `bayerDye()` legge `DB.cfa_response`, che c'è
sempre. Sono rami dichiarati e irraggiungibili con i dati di serie — vale la pena
saperlo prima di fidarsi della loro esistenza come rete di sicurezza.

## 5 · Le confidenze restituite

| ramo | confidenza | `validated` |
|---|---|---|
| mono | *esatta* | sì |
| dato dichiarato, λ ∈ [470, 580] | *alta (±5%)* | sì |
| dato dichiarato, fuori | *media (±35%)* | sì |
| modello, λ ∈ [470, 580] | *alta (±5%)* | sì |
| modello, fuori | *bassa (±35%)* | **no** → pastiglia gialla sul fattore |
| integrale banda larga | *media-alta (±6%)* | sì |

---

# I cinque reperti

## I · La precedenza è invertita sulle camere a scheda parziale

Stessa camera, due percorsi, stessa notte, NGC 6888, Askar 71F 0,80× + AM5:

| | η Hα | fattore Hα | **soglia Hα+OIII** |
|---|---|---|---|
| 294MC dalla matrice | 0,290 *dichiarato* | ×30,01 | **45,0 h** |
| 294MC aggiunta a mano | 0,374 *modello* | ×19,06 | **28,6 h** |

**Il 57% di scarto, e la strada «curata» è quella sbagliata.** Il modello dà 0,374
contro lo 0,357 misurato sul sensore gemello: −5%. Il valore in matrice dà 0,290:
−19%.

La causa non è il numero, è la regola. «Chi ha il dato vince sul modello» è giusta
finché il campo contiene una **misura**. Su sette camere a matrice contiene invece
un'**elaborazione congelata** — un modello di ieri, scritto in un campo dati, che
oggi batte per regola un modello migliore. La v1.6 ha corretto quei numeri sulla
2600MC e li ha lasciati sulle altre, perché per quei sensori non esistono misure:
la conseguenza non prevista è che ora sopravanzano il modello.

## II · La confidenza descrive il ramo, non il numero

`green = λ ∈ [470, 580]` decide l'etichetta. Quindi l'OIII **dichiarato 0,710**,
che sappiamo essere l'11% sopra il misurato, esce come *alta (±5%)*; e il modello
0,374 sull'Hα, che è il 5% dal misurato, esce come *bassa*. L'etichetta dice dove è
stato calcolato il numero, non quanto lo si conosce.

## III · Il pozzetto assunto è il buco più grande, e non è spettrale

Senza `gain_modes`, `gainModes()` restituisce un modo unico con **20000 e⁻**.
ZWO dichiara per la 294MC **63,7 ke⁻**.

| | Hα | RGB | L |
|---|---|---|---|
| 294MC a mano (20000 assunto) | 600 s | **60 s** | **60 s** |
| stessa camera con i due modi | 600 s | **180 s** | **180 s** |

**Tre volte la posa in banda larga.** Tre volte le pose, tre volte gli eventi di
lettura, tre volte lo scarico. La banda stretta non se ne accorge: lì il limite è
il rumore di lettura, non la saturazione.

E il motore **lo sa**: `gainModes()` scrive `assumed: true`. Nessuno legge quel
campo nell'interfaccia. L'utente vede una posa da 60 s senza sapere che nasce da un
pozzetto segnaposto.

Stessa forma il `dark_e_s = 0,003` cablato: giusto per un CMOS raffreddato
moderno, sbagliato di 3× su una 1600MM (0,01) e di 7× su una reflex non
raffreddata (0,02).

## IV · `cam.cfa_response` è un campo morto

`bayerDye()` legge `DB.cfa_response` — la curva **globale**. Il campo per camera,
presente su nove schede, non viene mai dereferenziato. Oggi non cambia un numero,
perché di curva ce n'è una sola; il giorno in cui se ne aggiungesse una seconda,
nove camere continuerebbero in silenzio a usare la prima.

## V · Il ripiego sulla QE è la parte che funziona

`qe_peak × QE_SHAPE` contro la tabella vera della 2600MC:

| λ | 400 | 450 | 500 | 550 | 600 | 656 | 700 |
|---|---|---|---|---|---|---|---|
| scarto | +16% | −3,0% | −2,4% | −4,0% | −1,7% | +1,2% | +6,7% |

Da 450 a 700 nm sta entro il 4%, e a 400 nm — dove sbaglia — non c'è quasi niente
da riprendere. Quanto dichiara il modulo è verificato. **Con un limite onesto:** è
verificato contro l'IMX571, cioè contro la famiglia da cui la forma è stata
ricavata. Per un IMX294, con un altro stack di microlenti, resta un'assunzione
ragionevole e non una validazione.

---

# Valutazione — come affrontare le camere nuove

L'architettura ha la forma giusta e una premessa sbagliata: **tratta «il campo
esiste» come equivalente a «il dato si conosce»**. `cfa_fraction` e `full_well_e`
sbagliano nei due versi opposti — uno contiene un modello congelato che scavalca un
modello migliore, l'altro non contiene niente e riceve un segnaposto in silenzio.

Sei interventi, nell'ordine in cui li farei.

**1 · Chiedere i due modi di guadagno nel modulo.** È l'errore numerico più grande
(×3 sulla posa) e, a differenza della QE, non è indovinabile da una forma: il
pozzetto non ha una curva tipica, ha un valore. Due righe, con un «non li conosco»
esplicito che mantiene l'assunzione attuale **e la stampa**.

**2 · Chiedere la corrente di buio,** con 0,003 come default invece che cablato. Un
campo, e separa una 2600 raffreddata da una reflex.

**3 · Mostrare `assumed`.** Il motore già sa quando sta assumendo. Ovunque compaia
una posa nata da un pozzetto assunto, deve dirlo.

**4 · Un livello di provenienza su ogni campo fisico**, al posto della semplice
presenza:

```
misurato   letto da una carta per canale, o misurato dall'utente
modello    calcolato adesso dal motore su una curva spettrale
ereditato  valore congelato da una derivazione precedente
```

e la precedenza diventa `misurato > modello > ereditato`. Con una riga di
ordinamento la 294MC passa al numero migliore senza toccare la fisica, e il motore
**classifica** invece di **cedere**.

**5 · Declassare, non cancellare, i sette blocchi `cfa_fraction` generici.**
Marcati `ereditato` restano visibili e documentati — lo stesso trattamento che
`cfa_fraction_previous` ha già sulla 2600MC — e il modello vince dove è migliore.

**6 · Un registro di curve di Bayer davvero dereferenziato**: `cam.cfa_response` →
`DB.cfa_responses[id]`, con `sony_bayer_generic` come default. È il gancio da cui
una curva reale dell'IMX294 o dell'IMX533, il giorno che diventasse pubblica,
entrerebbe senza toccare il codice.

I primi tre sono ingresso dati e valgono subito; il quarto e il quinto sono
l'architettura della precedenza; il sesto paga solo quando arrivano dati nuovi.

**Il principio da tenere:** una camera nuova deve degradare **in modo dichiarato**,
mai in silenzio. Oggi degrada bene e dichiarandolo sulla QE e sulla banda larga —
quelle due parti funzionano davvero — e in silenzio sul pozzetto, che è dove costa
di più.
