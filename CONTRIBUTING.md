# Contribuire

Ci sono due cose diverse che si possono aggiungere, e solo una passa da qui.

**La tua strumentazione e i tuoi siti non si aggiungono su GitHub: si aggiungono
dall'app.** Ogni tendina finisce con *+ Aggiungi…*, e quello che inserisci resta salvato
e viaggia con `progetti.json`. Non serve fork, non serve PR, non serve saper leggere
il codice. Se il tuo strumento manca dal catalogo e pensi che meriti di esserci per
tutti, apri pure una issue con i dati — ma per usarlo non devi aspettare nessuno.

**I target sì**: quelli sono il database condiviso, e per quelli vale tutto il resto
di questo documento.

---

# Proporre un nuovo target

Il valore di questo progetto non sta nel codice — sta nel database astrofisico.
Il codice è aritmetica; il database è mesi di bibliografia. Per questo i contributi
sono benvenuti, e per questo hanno una regola rigida.

## La regola non negoziabile

**Ogni riga di emissione deve dichiarare `confidence` e `source`.**

Un contributo senza confidenza dichiarata viene rifiutato, per quanto sia accurato.
Non è burocrazia: senza quel campo il database diventa un thread di forum, cioè
esattamente il problema che questo progetto esiste per risolvere.

| `confidence` | Significa |
|---|---|
| `alta` | Misurato su questo oggetto specifico, o mappato da survey (Finkbeiner per Hα, HASH/Frew per le planetarie) |
| `media-alta` | Spettroscopia in letteratura su questo oggetto, ma non recente o non completa |
| `media` | Analogia con oggetti della stessa classe fisica, corroborata da riscontri fotografici concordi |
| `bassa` | Stima per analogia di classe senza riscontri. Potrebbe essere fuori di un fattore 3-5 |

`source` deve dire **da dove viene il numero**, non ripetere la confidenza.
`"analogia di classe HII fotoionizzata"` va bene. `"esperienza"` no.

## Cosa merita una scheda

Il criterio non è la popolarità: è **l'ambiguità**.

- Se su AstroBin l'oggetto è ripreso in modi divergenti (HOO, SHO, LRGB+HO tutti
  ben rappresentati) → **serve una scheda**, perché c'è una decisione da prendere.
- Se tutti fanno la stessa cosa e funziona → cinque righe bastano.

Sono benvenuti anche oggetti poco noti con buona realizzabilità: una scheda su
un target che nessuno racconta vale più della centesima su M42.

## Il formato

Aggiungi un oggetto all'array `targets` di `data/targets.json`.

```jsonc
{
  "id": "ngc1234",                          // slug univoco, minuscolo
  "names": ["NGC 1234", "Nome comune"],     // il primo è quello mostrato
  "constellation": "Cygnus",
  "archetype": "hii_classic",               // deve esistere in "archetypes"
  "ra_deg": 123.456,                        // J2000, gradi decimali
  "dec_deg": 45.678,
  "size_arcmin": [30, 20],                  // [maggiore, minore]
  "ambiguity": "alta",                      // alta | media | bassa
  "ambiguity_note": "Perché la community diverge, o perché no.",

  "physics": "Cinque righe: che tipo di oggetto è e QUALE MECCANISMO DI ECCITAZIONE lo governa (fotoionizzazione, shock, riflessione, continuo stellare). È questo che determina tutto il resto.",

  "lines": [
    {
      "band": "Ha",                         // Ha | OIII | SII | L/RGB
      "strength": "forte",
      "morphology": "DOVE sta spazialmente. Se due righe tracciano strutture diverse, dillo: è l'informazione più utile della scheda.",
      "confidence": "alta",                 // OBBLIGATORIO
      "source": "mappato (Finkbeiner)"      // OBBLIGATORIO
    }
  ],

  "key_insight": "La cosa che un astrofotografo esperto saprebbe e un catalogo non dice.",
  "field_notes": "Contesto: campo stellare, gradienti, mosaico, oggetti vicini.",

  "roads": [
    {
      "id": "hoo",
      "name": "HOO + stelle RGB",
      "default": true,                      // esattamente UNA strada con default
      "when": "La condizione che la rende giusta: ore disponibili, Luna, seeing.",
      "pro": "Cosa guadagni.",
      "contro": "Cosa perdi."               // sempre presente: non esistono scelte gratis
    }
  ],

  "budget": {
    // Ore per la CONFIGURAZIONE DI RIFERIMENTO dichiarata in setups.json
    // (Tecnosky 115 con riduttore 0.80x + ASI2600MM: 640 mm f/5.6, pixel 3.76 µm,
    //  bin 1). L'app riscala da sola per ottica, camera, QE, filtri e binning.
    "OIII": {
      "floor": 4,          // sotto questo NON iniziare: restituisce rumore
      "useful": 8,         // resa piena
      "saturates": 14,     // oltre, guadagno marginale
      "share": 0.50,
      "critical": true,    // OBBLIGATORIO su un canale: è quello che decide l'immagine
      "warning": "Testo mostrato in evidenza se la soglia è insidiosa."
      // NB: non si scrive un "livello ridotto". Lo calcola l'app come
      //     max(floor, 0.60 x useful) sul canale critico e max(floor, 0.40 x useful)
      //     sugli altri. Questo rende "floor" doppiamente importante: non è solo
      //     l'avvertimento di non iniziare, e' anche il pavimento sotto cui il
      //     progetto ridotto non puo' scendere. Se lo metti troppo basso stai
      //     autorizzando un taglio che non regge; se lo metti troppo alto togli
      //     all'oggetto la sua versione accessibile. Deve essere il punto in cui
      //     il canale smette di restituire rumore, ne' un dito piu' su ne' piu' giu'.
    },
    "SII": { "floor": 0, "useful": 0, "saturates": 0, "share": 0,
             "note": "Non riprenderlo. Non c'è." }
  },

  "order": "Quale canale con la Luna, quale con oggetto alto, e — la domanda che nessuno scrive — se hai UNA notte sola, cosa ti porti a casa.",

  "expect": {
    "5h":  "Descrizione onesta. Se a 5h non è un'immagine, dillo.",
    "12h": "...",
    "20h": "..."
  },

  "traps": [
    "Cosa andrà storto in elaborazione e perché.",
    "Quale canale darà problemi, e se la cura è in ripresa o in post."
  ],

  "provenance": {                           // OBBLIGATORIO per i contributi esterni
    "contributor": "nome o handle",
    "gear": "es. RC8 + ASI2600MM, filtri 3 nm",
    "sky": "es. Bortle 4, montagna 950 m",
    "date": "2026-08"
  }
}
```

## Correggere i modi di guadagno di una camera

Il calcolo della posa usa `gain_modes` in `data/setups.json`: per ogni modo, guadagno,
offset, **rumore di lettura** e **pozzetto**. Sono gli unici due numeri che decidono
quanto lunga può essere una posa, e sono anche fra i meno affidabili del catalogo — il
pozzetto in HCG delle ASI2600 qui è *derivato* (65535 ADU × ~0,25 e⁻/ADU), non misurato.

Se li misuri sui tuoi bias e sui tuoi flat, quella è una correzione preziosa: aggiungi o
correggi il blocco e scrivi `confidence` e `source` come per qualunque altro dato.

```jsonc
"gain_modes":[
  {"name":"LCG","gain":0,"offset":50,"read_noise_e":3.3,"full_well_e":50000,
   "use":"banda larga","confidence":"media-alta","source":"come l'hai ottenuto"},
  {"name":"HCG","gain":100,"offset":50,"read_noise_e":1.5,"full_well_e":16000,
   "use":"banda stretta","confidence":"media","source":"..."}
]
```

Una camera senza `gain_modes` funziona lo stesso: si usa l'unico modo dichiarato nei
campi `read_noise_e` / `full_well_e`, e l'app segnala che è un assunto.

`gain_modes` **non entra** nei fattori di tempo né in nessun'altra parte del motore:
serve solo alla posa. Cambiarlo non sposta ore, settimane o punteggi.

## Correggere una classificazione OpenNGC

~13.300 oggetti arrivano da OpenNGC con l'archetipo **dedotto**, e 1.102 di quelli sono
marcati `da collaudare` perché il tipo di catalogo è generico. Se ne riprendi uno e
scopri che la classe è sbagliata, quella è l'informazione più preziosa che il progetto
possa ricevere: è una misura sul campo contro una deduzione.

Due modi, in ordine di valore:

1. **Aggiungilo al catalogo curato** (`data/catalog.json`) con l'archetipo giusto. Il
   curato vince sempre sul dedotto, e il test di verifica incrociata registrerà la
   discordanza come voluta.
2. **Correggi la mappatura** in `tools/build-openngc.js` se l'errore è sistematico e non
   del singolo oggetto — cioè se riguarda un intero tipo OpenNGC. È già successo una
   volta: il tipo `Neb` era mandato a riflessione e i dati hanno dimostrato che va a
   emissione.

In entrambi i casi scrivi **perché**, non solo cosa: la ragione è ciò che rende la
correzione riutilizzabile.

## Contribuire a un archetipo invece che a una scheda

Spesso è più utile. Un archetipo vale per **tutti** gli oggetti di quella classe fisica, e
il catalogo ne ha 169: migliorare `cluster_globular` migliora la risposta su ventinove
oggetti in un colpo solo, mentre una scheda nuova ne migliora uno.

Ogni archetipo in `archetypes` deve avere:

```jsonc
{
  "label": "Ammasso globulare",
  "logic": "Cosa lo governa fisicamente e cosa ne consegue in ripresa. Due o tre frasi.",
  "default_budget": { /* stessi campi del budget di una scheda, un canale critical */ },
  "order":  "Quale canale con la Luna, quale con l'oggetto alto — di CLASSE, non di oggetto.",
  "expect": { "1h": "…", "2.5h": "…", "5h": "…" },   // almeno due soglie
  "traps":  [ "…", "…" ],                            // almeno due, scritte davvero
  "default_confidence": "bassa"                       // sempre bassa: è analogia di classe
}
```

`order`, `expect` e `traps` non sono decorazione: sono ciò che rende utile la prescrizione
di un oggetto **senza scheda**, che è il caso di gran lunga più frequente. I test rifiutano
un archetipo che ne sia privo o che li riempia di segnaposto.

Regola: in un archetipo si scrive solo ciò che è vero **per l'intera classe**. Se una frase
vale solo per un oggetto, quella frase appartiene a una scheda.

## Principi editoriali

Se scrivi una scheda, questi sono i criteri con cui verrà letta:

1. **L'unità di consiglio è una soglia con una conseguenza, non un numero.**
   Non «SII 35%» ma «sotto le 5h il SII ti costa più di quanto ti dia».
2. **L'incertezza si dichiara sempre.** «Misurato entro un fattore 2» è
   un'affermazione diversa da «stimato per analogia, potrebbe essere fuori di 5».
3. **La fisica prima della prescrizione.** Il «perché» è ciò che permette al lettore
   di generalizzare al prossimo oggetto invece di restare dipendente dal catalogo.
4. **Le alternative si espongono tutte**, ma agganciate a ciò che le decide
   (ore, Luna, seeing, montatura) e con un default dichiarato. Un elenco di tre
   opzioni equivalenti non aiuta chi ha tre ore di sereno.
5. **Il costo opportunità va reso esplicito.** Ogni ora è sottratta a un altro canale.

## Come proporre

1. Fai un fork, aggiungi il target a `data/targets.json`
2. `node test.js` — le verifiche controllano campi obbligatori, confidenza e canale critico
3. Apri una PR con, nella descrizione, le fonti da cui vengono i rapporti fra righe

Se non usi git: apri una issue incollando il blocco JSON. Va benissimo.

## Cosa non viene accettato

- Righe senza `confidence` e `source`
- Rapporti fra righe dedotti da un'immagine invece che da fotometria o letteratura
  (un'immagine elaborata dice quanto hai saturato, non quanto emette l'oggetto)
- Budget copiati da un post di forum senza normalizzazione strumentale:
  «6h di OIII» a f/2 e a f/8 differiscono di un fattore 16
- Schede su oggetti dove non c'è nessuna decisione da prendere
