# Evidencija prometa robe

Klijent-server program za evidenciju ulaza, izlaza i stanja robe.

## Šta radi

- **Artikli** — šifarnik sa jedinicom mere, PDV-om, nabavnom/prodajnom cenom i minimalnim stanjem
- **Partneri** — dobavljači i kupci
- **Promet** — prijemnice (ulaz) i otpremnice (izlaz), sa nacrtom, potvrdom i stornom
- **Stanje zaliha** — računa se samo iz potvrđenih dokumenata
- **Kartica artikla** — hronološki promet i saldo
- **Prijava** — JWT sesija (admin / operater)

Potvrda izlaza proverava raspoložive zalihe. Storno vraća stanje.

## Pokretanje

Potrebni su Node.js 20+ i dva terminala.

```bash
npm install
npm run server
```

```bash
npm run client
```

- Server: http://localhost:3001
- Klijent: http://localhost:5173

Prijava: `admin` / `admin123`  
Operater: `operater` / `operater123`

Baza je SQLite (`server/data/promet.db`) i pri prvom startu dobija demo artikle, partnere i početni promet.

## Testovi

```bash
npm test
```

## Arhitektura

```
client/   React (Vite) — korisnički interfejs
server/   Express + SQLite — REST API i poslovna pravila
```

Klijent zove `/api/*`. U razvoju Vite proksira te zahteve na server.
