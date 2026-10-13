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

- [ ] Schéma `core`: employee, employment, team, team_member, role_assignment, customer, job, site, public_holiday, audit_log
- [ ] Generování státních svátků ČR (včetně Velikonoc)
- [ ] Správa zaměstnanců, úvazků, part a zakázek (jednoduché tabulky a formuláře)
- [ ] Napojit uživatele na zaměstnance, `role_assignment`, nahradit dočasný allow-list (přihlásí se jen aktivní zaměstnanec s e-mailem)
- [ ] Seed s ukázkovými zaměstnanci, partami a zakázkami (podle náhledů obrazovek)
- [ ] Audit log jako sdílená funkce
- [ ] Import zaměstnanců a zakázek z Excelu/CSV s náhledem

## Milník 3 – Docházka: denní zápis

- [ ] Schéma `timesheets`: work_type, time_entry, absence, standby, leave_entitlement, timesheet, period_close, timesheet_settings
- [ ] Pravidla s testy: validace intervalu, překryvy, upozornění (přestávka, 12 h, odpočinek)
- [ ] Obrazovka Můj den (desktop i mobil), „Pokračovat od …“
- [ ] Zápis za jiného zaměstnance s důvodem
- [ ] Absence a dovolená, zůstatek

## Milník 4 – Měsíc, schválení, uzávěrka

- [ ] Výpočty za měsíc s testy (noc, víkend, svátek, pohotovost, fond)
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
