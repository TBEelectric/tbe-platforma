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
