# OpenNGC — attribuzione

Lo strato catalografico di questa app (`data/openngc.json`, ~13.300 oggetti NGC e IC)
è derivato da:

> **OpenNGC** — Mattia Verga
> https://github.com/mattiaverga/OpenNGC
> Licenza **CC-BY-SA-4.0**

Il file `openngc.json` è un'**opera derivata**: i campi originali sono stati filtrati,
riscalati e arricchiti con la mappatura tipo → archetipo definita in
`tools/build-openngc.js`. In quanto derivato, è distribuito **sotto la stessa licenza
CC-BY-SA-4.0** (testo completo in `OPENNGC-LICENSE.txt`).

Cosa è stato fatto sui dati originali:

- scartate le righe `Dup` (usate però come alias) e `NonEx`;
- coordinate convertite da sessagesimali a gradi decimali;
- nomi normalizzati nella forma d'uso — `NGC0224` → `NGC 224`, con la forma compatta
  conservata come alias;
- alias costruiti da numero di Messier, nomi comuni e identificatori Caldwell, UGC,
  LBN, PK, Cr, Mel, Tr, Ced, vdB;
- **aggiunto** l'archetipo astrofotografico, dedotto dal tipo OpenNGC e — per galassie e
  planetarie — dalla morfologia di Hubble o dalla brillanza superficiale stimata, con
  il livello di certezza e la motivazione dichiarati per ogni oggetto.

La mappatura è nostra e non fa parte di OpenNGC: eventuali errori di classificazione
astrofotografica sono da attribuire a questo progetto, non alla fonte.

Il resto del progetto (codice, catalogo curato, schede, archetipi) resta sotto licenza
MIT come dichiarato nel README.
