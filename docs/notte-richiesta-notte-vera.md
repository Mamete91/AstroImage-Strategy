# La notte richiesta e la notte vera

*Correzione. Suite **483/483**, tutti i gate verdi, zero regressioni.*

---

## Il sintomo

Chiedendo **NGC 2392** per l'**11 settembre 2026** da Borno, il piano usciva su
**1, 2, 3 ottobre**. Nessuna riga spiegava perché.

Due precisazioni, in ordine di importanza.

**Le date erano di ottobre, non di settembre.** «gio 1 ott» è il 1° ottobre 2026,
e cade davvero di giovedì. Il pianificatore scandisce **solo in avanti** dalla
data scelta: non ha mai proposto una notte passata, e non poteva. La lettura «1
settembre» era un abbaglio sul mese abbreviato — ma il difetto che indicava
esisteva, ed era più grosso di così.

## Il difetto

**Due variabili temporali che non si parlavano.**

La data nel campo serviva a calcolare fondo cielo, Luna e quindi le **ore** della
prescrizione. Il piano invece chiamava `nightWindows()`, che scandisce avanti e
**scarta** le notti in cui l'oggetto non sale abbastanza. NGC 2392 è in Gemini: a
settembre, da Borno, sorge quando la notte astronomica è già finita.

Il motore scartava venti notti di fila, e per ognuna sapeva perché:

| notte | perché scartata |
|---|---|
| 11–12 set | oggetto sempre sotto la soglia |
| 13 set | solo 0,1 h sopra i 35° |
| 14 set | solo 0,2 h |
| … | … |
| 30 set | solo 1,6 h |
| **1 ott** | **1,07 h utili → ammessa** |

Il calcolo era giusto. **Nessuno lo diceva.** E soprattutto:

- le **ore** restavano calcolate sull'11 settembre, dove le ore utili sull'OIII
  valevano **0,00 h** e la Luna non era nemmeno misurabile (`dMagV = null`);
- il **piano** si eseguiva sull'1–3 ottobre, con la Luna al **69 / 56 / 44%**;
- la barra mostrava «Luna 1%, sotto l'orizzonte» — la Luna di una notte che il
  piano non usava.

Prescrizione su una notte, esecuzione su un'altra. E la scheda diceva «la
finestra utile è troppo corta da qui» proprio perché leggeva `critH = 0` sulla
notte sbagliata, mentre il piano elencava tre nottate da 1,1–1,3 h.

Una trappola dentro la trappola: `dMagV` valeva `null`, e in JavaScript
`isFinite(null)` è **true** perché `null` diventa zero. Una notte inesistente si
travestiva così da notte senza Luna — ed è esattamente il modo in cui un canale
critico si guadagnava un «la Luna non lo tocca» che non aveva verificato.

## La correzione

**La data è una richiesta, non un fatto: «non prima di questa notte».** Il motore
la risolve nella prima notte in cui l'oggetto esiste davvero, e **tutta la catena
a valle usa quella** — ore, Luna, soglie, posa, piano.

```
resolveNight(tg, site, chiesta) →
  { wanted, date, shift, past, usable, skipped[], floor, minNight }
```

Una funzione, un punto di verità. `renderRx()` la chiama appena il bersaglio è
noto e da lì in giù non si rilegge più il campo; `rxPlanHtml()` prende la notte
risolta invece di rileggere `$('date')`, che era il punto esatto in cui le due
variabili si separavano. Lo stesso vale nella CLI (`plan.js`).

**E si dichiara, in tre modi diversi per tre situazioni diverse.**

| situazione | cosa fa |
|---|---|
| l'oggetto quella notte non c'è | si sposta, e lo scrive: giorni di salto, motivo, notti scartate |
| la notte chiesta è passata | **non** si corregge: lo segnala e offre il salto a stanotte |
| l'oggetto non sale mai da qui | lo dice, e non inventa una data |

Il passato non si corregge da solo perché chiedere una notte trascorsa è una
richiesta legittima — si guarda cosa si è ripreso. Correggerla in silenzio
sarebbe lo stesso errore da cui parte tutto.

## Il prima e il dopo, sul caso segnalato

| | prima | dopo |
|---|---|---|
| barra, data | 11/09/2026 | 11/09/2026 **→ gio 1 ott** |
| barra, Luna | 1%, sotto l'orizzonte | **69%, alta 36°** |
| barra, avviso | nessuno | **spostata di 20 g** |
| ore utili sul critico | 0,00 h | **1,67 h** |
| ΔmagV della Luna | `null` | **1,52** |
| verdetto | «la finestra utile è troppo corta da qui» | «≈ 2 settimane di calendario con il 33% di notti serene» |
| rifiuto del piano | «nelle prime 3 notti utili **da qui**» | «nelle prime 3 notti utili **a partire dal 1 ottobre**» |
| spiegazione del salto | nessuna | riquadro con motivo e notti scartate |

Le **ore per canale non si muovono** — OIII 5,1 h, Hα 2,3 h, RGB 0,6 h — ed è
corretto: sono una profondità richiesta, non una proprietà della nottata. La
Luna sposta le soglie e la resa, non il totale. Un OIII da 3 nm regge davvero il
69% di Luna: quel «la Luna non lo tocca» ora è verificato sulla notte giusta
invece di essere il residuo di una notte vuota.

## Un dettaglio di fuso

`toISOString()` converte in UTC: a mezzogiorno, a est di Greenwich, restituisce
il giorno giusto per caso, a ovest no. Sostituito con un `isoDay()` locale — un
pianificatore di notti non può sbagliare il giorno per un fuso orario.

## Copertura

Ventuno verifiche nuove nella suite:

- lo spostamento è un numero, non un silenzio; la notte risolta è sempre ≥ quella chiesta
- ogni notte scartata dichiara il proprio perché
- sulla notte chiesta le ore utili sono zero e la Luna è `null`; sulla notte vera esistono entrambe
- il piano parte dalla notte risolta e non scarta più nulla
- **nessun falso positivo**: lo stesso oggetto in stagione non si muove di un giorno, e nemmeno un oggetto estivo chiesto d'estate
- una notte passata si conta in giorni e **non** si sposta di nascosto
- un oggetto a dec −70° da 46°N si dichiara non utilizzabile, dice quante notti ha guardato, e non inventa una data
- senza bersaglio non c'è niente da risolvere: la notte chiesta resta intatta

Più cinque strade d'uscita verificate in browser — oggetto spostato, nome
inesistente, una stella, oggetto normale, campo vuoto — perché legare la barra
alla risoluzione l'aveva lasciata, per un attimo, con il contenuto della
richiesta precedente. Ora si disegna sempre subito sulla notte chiesta e si
ridisegna solo se c'è qualcosa di nuovo da dire.
