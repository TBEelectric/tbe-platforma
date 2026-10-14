# Technický návrh jádra a docházky

První verze obsahuje společné jádro (přihlášení, zaměstnanci, týmy, zakázky) a modul docházky
s intervaly od–do, měsíčním potvrzením, schválením vedoucím a exportem pro mzdovou účetní.

## Slovník

Kód, databáze a API používají anglické názvy podle této tabulky; rozhraní a dokumenty jsou česky.
Nový pojem se nejdřív zapíše sem.

| Česky | V kódu | Význam |
| --- | --- | --- |
| Zaměstnanec | `employee` | Osoba v evidenci (HPP, DPP, DPČ); nemusí mít přihlášení |
| Eviduje docházku | `tracks_time` | Zaměstnanec vykazuje docházku; vypnuté u účtů bez docházky (např. administrátor mimo firmu) |
| Uživatel | `user` | Přihlašovací účet (Google), navázaný na zaměstnance |
| Pracovní poměr | `employment` | Typ úvazku a platnost od–do |
| Tým / parta | `team` | Skupina zaměstnanců s vedoucím |
| Vedoucí | `team_lead` | Schvaluje výkazy svého týmu |
| Zákazník | `customer` | Odběratel zakázek |
| Zakázka | `job` | Číslo, název, místo a zákazník; v rozhraní se zobrazuje jako „Firma, místo“ |
| Místo | `site` | Sídlo, sklad, stavba, adresa zákazníka |
| Druh práce | `work_type` | Montáž, revize, cesta, režie |
| Interval | `time_entry` | Úsek od–do: práce na zakázce, nebo přestávka |
| Absence | `absence` | Dovolená, nemoc, OČR, lékař |
| Žádost o absenci | `absence.status = requested` | Absence podaná zaměstnancem, čeká na schválení (`approved`) nebo zamítnutí (`rejected`) |
| Celodenní absence | `absence.hours is null` | Absence na celé dny; s `hours` jde o část jednoho dne (např. lékař) |
| Pohotovost | `standby` | Pracovní pohotovost od–do |
| Měsíční výkaz | `timesheet` | Měsíc jednoho zaměstnance se stavem schválení |
| Uzávěrka | `period_close` | Uzavření měsíce pro všechny zaměstnance |
| Zakázky party | `team_job` | Zakázky připnuté vedoucím pro rychlý výběr |
| Šablona dne | `day_template` | „Obvyklý den“ zaměstnance pro rychlé vyplnění |
| Fond pracovní doby | `work_schedule` | Plánovaná doba a režim (pružná, nerovnoměrná) |
| Nárok na dovolenou | `leave_entitlement` | Roční nárok a zůstatek v hodinách |
| Historie změn | `audit_log` | Kdo, kdy, co a původní hodnota |
| Modul | `module` | `timesheets`, `fleet`, … |

## Datový model

Každá tabulka má `id` (UUID), `created_at`, `updated_at`; záznamy se nemažou, ale archivují (`archived_at`).
Sazby se zatím neevidují, `employment` i `job` je mohou dostat později.

### Jádro (`core`)

| Tabulka | Klíčová pole | Poznámka |
| --- | --- | --- |
| `user` | email, name, employee_id, locale (výchozí `cs`) | Vytváří Better Auth; přihlásí se jen aktivní zaměstnanec s tímto e-mailem, propojení podle e-mailu |
| `employee` | first_name, last_name, personal_number, email, active, tracks_time | Základ pro všechny moduly; e-mail = povolený účet |
| `employment` | employee_id, type (`hpp`,`dpp`,`dpc`), valid_from, valid_to, weekly_hours, schedule_type (`flexible`,`uneven`) | Výpočty berou úvazek platný v daný den |
| `team` | name, lead_employee_id | Parta s vedoucím |
| `team_member` | team_id, employee_id, valid_from, valid_to | Členství s historií |
| `role_assignment` | employee_id, module, role | Role po modulech; přiřazuje se zaměstnanci, aby šla zadat před prvním přihlášením |
| `customer` | name, ico, external_id | |
| `job` | code, name, customer_id, site_id, status (`active`,`closed`), external_id | Místo (`site_id`) povinné; v rozhraní se zakázka zobrazuje jako **„Firma, místo“**, číslo jen ve vyhledávání, správě a exportech |
| `site` | name, type, address, lat, lng, customer_id | `name` = krátký název místa pro montéry („Jihlava, hala A“); použije i vozový park |
| `team_job` | team_id, job_id, pinned_by, pinned_at | „Zakázky party“ – vedoucí připne zakázky, které parta právě dělá |
| `public_holiday` | date, name | Státní svátky ČR, generované na roky dopředu |
| `audit_log` | actor_user_id, entity, entity_id, action, before, after, reason, at | |

### Docházka (`timesheets`)

| Tabulka | Klíčová pole | Poznámka |
| --- | --- | --- |
| `work_type` | code, name, counts_as_work, requires_job | Montáž, revize, cesta (se zakázkou), režie (bez zakázky) |
| `time_entry` | employee_id, work_date, start_at, end_at, kind (`work`,`break`), job_id, work_type_id, note, created_by_user_id, source (`self`,`manager`) | Práce vyžaduje druh práce a zakázku; druh „režie“ (`requires_job = false`) zakázku nevyžaduje. `work_date` = den začátku (Europe/Prague). Smazání v otevřeném měsíci je skutečné, zůstává v auditu |
| `absence` | employee_id, type (`vacation`,`sick`,`ocr`,`doctor`,`other`), date_from, date_to, hours, note, status (`requested`,`approved`,`rejected`), decided_by, decided_at, decision_reason | `hours` jen u jednoho dne (část dne); bez `hours` celé dny podle úvazku. Absenci zadanou vedoucím nebo správcem rovnou schválí |
| `standby` | employee_id, start_at, end_at, note | |
| `leave_entitlement` | employee_id, year, hours_entitled, hours_carried_over | Zůstatek = nárok + převod − čerpáno |
| `timesheet` | employee_id, month, status, confirmed_at, approved_by, approved_at, return_reason | Jeden řádek na zaměstnance a měsíc |
| `period_close` | month, closed_by, closed_at, reopened_by, reopened_at, reopen_reason, export_version | |
| `timesheet_settings` | key, value, valid_from | Prahy a limity; výchozí šablona „Obvyklý den“ |
| `day_template` | employee_id, items (JSON: od, do, typ), updated_at | Šablona „Obvyklý den“ zaměstnance; bez ní platí výchozí z nastavení |

## Stavy výkazu

```
otevřený (open) ──potvrdí zaměstnanec──▶ potvrzený (confirmed) ──schválí vedoucí──▶ schválený (approved)
     ▲                                        │                                          │
     └──────── vedoucí vrátí s důvodem ───────┘                       uzávěrka (správce, všechny schválené)
     ▲                                                                                   ▼
     └──────────── správce znovu otevře s důvodem (nová verze exportu) ─────────── uzavřený (closed) ──▶ export
```

Od potvrzení jsou intervaly zamčené. Uzávěrku lze provést, až jsou všechny výkazy měsíce schválené.
Výkaz vedoucího schvaluje správce docházky.

## Pravidla a výpočty

Všechna pravidla jsou čisté funkce v `src/modules/timesheets/rules` s testy.

**Validace (blokuje uložení):** konec po začátku, max 24 h; bez překryvů (i exclusion constraint v DB);
práce má druh práce a aktivní zakázku (kromě režie); nelze měnit potvrzený/schválený/uzavřený měsíc; nekoliduje
s celodenní absencí (žádost nebo schválená; zamítnutá a absence na hodiny neblokují).

**Upozornění (neblokuje):** přes 6 h práce bez přestávky ≥ 30 min (přestávka = interval `break` nebo mezera
mezi intervaly; části aspoň 15 min); přes 12 h za den; odpočinek mezi dny
pod 11 h, týdenní pod 35 h; pracovní den bez záznamu a absence (e-mail další ráno); DPP u limitu.

| Hodnota | Výpočet |
| --- | --- |
| Odpracováno | Součet intervalů `work` |
| Podle zakázek a druhů práce | Součet `work` po `job_id` a `work_type_id` |
| Noční práce | Část intervalů 22:00–6:00 |
| Sobota, neděle | Část intervalů v těchto dnech |
| Svátky | Část intervalů ve dnech z `public_holiday` |
| Pohotovost | Součet `standby` mimo odpracované intervaly |
| Absence | Hodiny po typech; dovolená snižuje zůstatek |
| Fond a přesčasy | Fond podle úvazku a pracovních dnů; přesčas až po potvrzení pravidel s účetní |

## Oprávnění

| Akce | Zaměstnanec | Vedoucí (svůj tým) | Správce docházky | Administrátor |
| --- | --- | --- | --- | --- |
| Vlastní intervaly v otevřeném měsíci | Ano | Ano | Ano | Ano |
| Zápis za jiného | Ne | Ano | Ano | Ano |
| Potvrdit vlastní výkaz | Ano | Ano | Ano | Ano |
| Vidět výkazy jiných | Ne | Ano | Ano | Ano |
| Schválit / vrátit výkaz | Ne | Ano | Ano | Ne |
| Absence a dovolená | Žádost | Ano | Ano | Ne |
| Uzávěrka, znovuotevření, export | Ne | Ne | Ano | Ne |
| Zakázky a druhy práce | Ne | Ne | Ano | Ano |
| Zaměstnanci, týmy, úvazky, nároky | Ne | Ne | Ano | Ano |
| Role a povolené účty | Ne | Ne | Ne | Ano |

Role v `role_assignment` (přes `employee_id`): `module = '*'`, `role = 'admin'` (administrátor) a `module = 'timesheets'`, `role = 'manager'`
(správce docházky). Zaměstnanec = každý přihlášený uživatel navázaný na aktivního zaměstnance, bez další role.
Vedoucí není samostatná role; práva plynou z `team.lead_employee_id`. Tabulky Better Auth (`user`, `session`,
`account`, `verification`) jsou ve schématu `core`.

## Export a audit

Podklad pro mzdy jen z uzavřeného měsíce: XLSX (list Souhrn po zaměstnancích, list Intervaly) a PDF
výkaz na zaměstnance; každý export má číslo verze. Samostatně CSV hodin po zakázkách za libovolné období.
Každá změna se zapisuje do `audit_log`; zápis za jiného a znovuotevření vyžadují důvod.
