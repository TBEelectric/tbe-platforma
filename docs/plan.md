# Plán vývoje

Docházka má prioritu. Vozový park se připravuje souběžně (Traccar, ověření dat), vývoj modulu až po docházce.

## Milník 1 – Základ projektu

- [x] Založit Next.js projekt (TypeScript, Tailwind, ESLint, App Router, `src/`), pnpm, Prettier.
      `create-next-app` odmítne neprázdnou složku (je tu `CLAUDE.md` a `docs/`): vygeneruj ho do dočasné složky
      a soubory přesuň sem, nic z `docs/` ani `CLAUDE.md` nepřepiš.
- [x] `docker-compose.yml` s PostgreSQL 16 pro lokální vývoj
- [x] Drizzle: připojení v `src/lib/db.ts`, Postgres schéma `core` (`pgSchema`, v drizzle-kit `schemaFilter`), první migrace, kostra seed skriptu
- [x] shadcn/ui, barvy a písmo podle `design.md`
- [x] Layout s bočním menu, přepínač modulů, launcher s dlaždicemi (Docházka aktivní, ostatní moduly jako „Plánováno“)
- [x] Better Auth + Google (tabulky Better Auth ve schématu `core`), dočasný allow-list e-mailů v `.env` (`AUTH_ALLOWED_EMAILS`); role přijdou v milníku 2
- [x] Vitest nastavený, první test projde
- [x] Doplnit sekci Commands v `CLAUDE.md`

## Milník 2 – Jádro

- [x] Schéma `core`: employee, employment, team, team_member, role_assignment, customer, job, site, public_holiday, audit_log
- [x] Generování státních svátků ČR (včetně Velikonoc)
- [x] Správa zaměstnanců, úvazků, part a zakázek (jednoduché tabulky a formuláře)
- [x] Napojit uživatele na zaměstnance, `role_assignment`, nahradit dočasný allow-list (přihlásí se jen aktivní zaměstnanec s e-mailem)
- [x] Seed s ukázkovými zaměstnanci, partami a zakázkami (podle náhledů obrazovek)
- [x] Audit log jako sdílená funkce
- [x] Import zaměstnanců a zakázek z Excelu podle `docs/import/sablona-importu.xlsx` (listy Zaměstnanci a Zakázky):
      náhled změn a chyb po řádcích před uložením, opakovaný import aktualizuje podle osobního čísla / čísla zakázky, nic nemaže.
      Šablona je zdrojem formátu; data v ní jsou smyšlená a slouží jako testovací vstup.

## Milník 3 – Docházka: denní zápis

- [x] Schéma `timesheets`: work_type, time_entry, absence, standby, timesheet, period_close, timesheet_settings
      (leave_entitlement už je z milníku 2); výchozí druhy práce a nastavení v seedu
- [x] Pravidla s testy: validace intervalu, překryvy, zamčený měsíc, kolize s absencí, upozornění
      (přestávka, 12 h, odpočinek), interval přes půlnoc a změna času
- [x] Obrazovka Můj den (desktop i mobil), „Pokračovat od …“
- [x] Zápis za jiného zaměstnance s důvodem
- [x] Absence a dovolená, zůstatek; žádost zaměstnance, schválení vedoucím nebo správcem
- [x] Seed: intervaly za aktuální měsíc pro ukázkové zaměstnance (jeden den Jana Nováka prázdný)

## Milník 3b – Interaktivní časová osa (mobil primárně)

Reference: prototypy `docs/design/prototypes/MobilOsa.dc.html` (primární) a `Den.dc.html` (celá obrazovka Můj den) – převzít chování
(výpočty jako čisté funkce s testy) a rozložení, UI postavit znovu.

- [ ] **Jazyky (první úkol milníku):** zavést `next-intl`, převést dosavadní texty rozhraní (milníky 1–3) na klíče
      v `messages/cs.json`, přidat `user.locale` (výchozí `cs`); nové obrazovky už rovnou s klíči. Bez překladu.
- [ ] Pravidla s testy: společná hranice navazujících intervalů (soused min. 5 min, nezmizí), vložení intervalu do mezery, změna začátku/konce a posun bez překryvů, přichytávání
      (15 min tažení na mobilu, 5 min jinak), ne do budoucna; šablona „Obvyklý den“ a „Jako včera“ (vynechá kolize)
- [ ] **Mobil:** svislá osa dne podle `docs/design.md` („Mobil – zápis dne na ose“): podržet a táhnout = nový interval,
      klepnutí = 1 h, úchyty a posun, spodní panel s −/+ 5 min, zakázkami jako tlačítky (naposledy použité nahoře) a druhem práce
- [ ] Výběr zakázky: řádek s naposledy použitými (max 4) + „Další zakázky…“ = obrazovka s vyhledáváním (bez diakritiky)
      a sekcemi Naposledy použité / Zakázky party / Všechny aktivní; tabulka `team_job` a připínání zakázek vedoucím
- [ ] Zakázka má povinné místo (`job.site_id`): migrace, formulář zakázky, seed; **import zakázek** podle nové šablony
      (`docs/import/sablona-importu.xlsx`, list Zakázky má nové sloupce Místo a Adresa místa – upravit parser a testy)
- [ ] Zobrazení zakázky ve formátu „Firma, místo“ všude v rozhraní zaměstnance (viz `design.md`, Zobrazení zakázky)
- [ ] Přestávka s ikonou hrnku a teplou barvou (tlačítko, blok, tabulka)
- [ ] Prázdný den: „Obvyklý den“ (šablona v nastavení zaměstnance, výchozí v `timesheet_settings`) a „Jako včera“;
      výchozí den = nejstarší nevyplněný pracovní den
- [ ] **Desktop:** vodorovná osa místo statického pruhu na Můj den (hover s časem, čára „teď“, tažení, výběr propojený s tabulkou)
- [ ] Ukládání každé změny přes server action s optimistickou aktualizací a auditem; zamčený měsíc jen pro čtení
- [ ] Testování na telefonu během vývoje: dočasný tunel (např. Cloudflare Tunnel) s veřejnou HTTPS adresou,
      přidat ji do Google OAuth a `BETTER_AUTH_URL`; postup zapsat do `CLAUDE.md`
- [ ] Ovládání klávesnicí (šipky ±5 min); otestovat na skutečném telefonu (iPhone Safari i Android Chrome)

## Milník 4 – Měsíc, schválení, uzávěrka

- [ ] Výpočty za měsíc s testy (noc, víkend, svátek, pohotovost, fond); zadávání pohotovosti
- [ ] Můj měsíc, potvrzení zaměstnancem
- [ ] Schvalování vedoucím, vrácení s důvodem
- [ ] Uzávěrka, znovuotevření, verze exportu
- [ ] Export XLSX + PDF pro mzdy, CSV po zakázkách
- [ ] Připomínky nevyplněných dnů (worker, e-mail)

## Milník 5 – Pilot

- [ ] Nasazení na VPS (Docker Compose, Caddy, zálohy, ověřená obnova)
- [ ] PWA (instalace na plochu firemních telefonů)
- [ ] Playwright testy hlavních scénářů (zápis dne, potvrzení, schválení, uzávěrka)
- [ ] Pilot na 3–5 lidech jeden měsíc, souběžně s Excelem

## Souběžně – příprava vozového parku

- [ ] Převod Traccaru z H2 na PostgreSQL
- [ ] Ověřit, která auta posílají skutečný tachometr (OBD) a která GPS odometr
- [ ] Vzorek dat z Traccaru za několik dní u 2–3 aut pro testy rozdělování jízd
