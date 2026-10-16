# Bezpečnost

Bezpečnostní kontrola před pilotem (krok 5.2 v `docs/plan.md`) a jak ji opakovat před každým nasazením.
Pravidla, která se ověřují, jsou v `docs/technicky-navrh.md` (sekce Oprávnění, Export a audit).

## Jak kontrolu spustit

```
docker compose up -d db
pnpm security:check            # build + kontrola (1–2 minuty)
pnpm security:check --no-build # se stávajícím produkčním buildem (.next)
pnpm security:check --keep     # databázi tbe_security po běhu nesmaže (ladění)
```

Co příkaz dělá (`src/scripts/security-check/`):

1. **Pojistka:** běží jen proti lokálnímu PostgreSQL (`DATABASE_URL` na `localhost`/`127.0.0.1`), jinak skončí.
   `SMTP_HOST` je pro build, server i skript vždy prázdný, takže žádný e-mail neodejde (`sendMail` jen loguje).
2. **Databáze:** v lokálním kontejneru vytvoří samostatnou databázi `tbe_security`, nasadí migrace a `pnpm db:seed`.
   Vývojová databáze `tbe` zůstane netknutá. Na konci (i po chybě) se `tbe_security` smaže.
3. **Testovací data** (`fixtures.ts`): party Secchk A a B, zaměstnanci, vedoucí, správce, administrátor,
   archivovaný a deaktivovaný administrátor; záznamy se značkami (`SecchkEb`, `secchk-note-eb`), podle kterých se
   v HTML pozná únik cizích dat; měsíce otevřený (minulý), potvrzený/schválený (předminulý) a leden 2016, který
   během kontroly uzavře správce (snímek pro mzdy v1).
4. **Server:** `pnpm build` a `next start` na portu 3100 s `DEV_LOGIN=true` (produkční build ho musí ignorovat).
   Session vytvoří skript přímo v databázi a cookie podepíše `BETTER_AUTH_SECRET`, stejně jako po přihlášení
   přes Google.
5. **Volání:** stránky a route handlery přes HTTP `GET`; server akce přes HTTP `POST` s hlavičkou `Next-Action`
   (ID z `.next/server/server-reference-manifest.json` podle souboru a jména exportu) a argumenty zakódovanými
   Reactovým `encodeReply`, tedy přesně jako prohlížeč. Bound argumenty (ID, měsíc, zaměstnanec) jsou jen první
   argumenty volání, kontrola je proto podvrhuje stejně jako útočník.
6. **Verdikt:** zamítnutý pokus nesmí změnit sledované řádky ani přidat řádek do `audit_log`; ke každé akci
   patří povolený kontrolní případ, který změnu provede (důkaz, že požadavek akci opravdu volá).
   Stránka bez oprávnění musí vykreslit `notFound()` a nesmí obsahovat značky cizích dat.
7. **Pokrytí:** kontrola selže, když build obsahuje server akci, stránku nebo route handler, pro který nemá
   případ. Nová akce bez bezpečnostního případu tedy kontrolu shodí – doplňte případ do `suites/`.

Výstup: řádek na každou kontrolu, souhrn a kód 1 při chybě; výstup serveru (včetně zalogovaných e-mailů) je
v `logs/security-check-server.log` (necommituje se).

## Soupis

Stav po kroku 5.2. „Brána“ = první kontrola v kódu (`requirePermission(…)` vrátí 404, `requireUser()` přesměruje
na přihlášení); „Konkrétní kontrola“ = kde se rozhoduje o konkrétním zaměstnanci, partě, měsíci nebo záznamu.
Vstupy od klienta jsou vždy podvrhnutelné: pole formuláře, bound argumenty akcí, `searchParams`, `params`.

### Stránky

| Stránka | Brána | Vstupy | Konkrétní kontrola |
| --- | --- | --- | --- |
| `/` (launcher) | `requireUser` | – | dlaždice a úkoly jen z vlastních oprávnění |
| `/employees`, `/employees/new`, `/employees/teams` | `canManageEmployees` | – | – |
| `/employees/[id]` | `canManageEmployees` | `id` | role mění jen `canManageAccess`; stav administrátora jen administrátor |
| `/employees/teams/[id]` | `canManageEmployees` | `id` | – |
| `/employees/import` | `canManageAccess` | – | – |
| `/jobs`, `/jobs/new`, `/jobs/[id]`, `/jobs/customers…` | `canManageJobs` | `id` | – |
| `/timesheets` | `requireUser` | – | přehled jen z vlastních oprávnění |
| `/timesheets/day` | `canRecordOwnTime ∨ canWriteForSomeoneElse` | `date`, `employee` | cizí zaměstnanec: `canWriteTimeFor` (parta k danému dni), jinak 404 |
| `/timesheets/day/someone` | `canWriteForSomeoneElse` | `date` | seznam `listWritableEmployees` (vedoucí jen svou partu) |
| `/timesheets/month` | `canRecordOwnTime ∨ canWriteForSomeoneElse` | `month`, `employee` | `getMonth` → `canViewTimeOf`, jinak 404 |
| `/timesheets/month/someone` | `canWriteForSomeoneElse` | `month` | seznam `listWritableEmployees` |
| `/timesheets/absences` | `canOpenAbsences` | – | vlastní absence; k rozhodnutí jen `listDecidableEmployees` (administrátor nikoho) |
| `/timesheets/approval` | `canApproveTimesheets` | `month`, `team`, `tab`, `employee` | `team` jen z `listApprovalTeams`; data z `getTeamMonth` (vedoucí své party); `employee` jen ze seznamu |
| `/timesheets/close`, `/timesheets/settings` | `canCloseTimesheetPeriod` | `month` | – |
| `/login` | veřejná | `error` | vývojové přihlášení jen při `devLoginEnabled()` |

### Server akce

| Akce | Brána | Konkrétní kontrola |
| --- | --- | --- |
| **Jádro** (`src/modules/core/actions.ts`) | | |
| `createEmployeeAction` | `canManageEmployees` | přihlašovací e-mail jen `canManageAccess` |
| `updateEmployeeAction(id)` | `canManageEmployees` | změna e-mailu jen `canManageAccess` |
| `setEmployeeStateAction(id, change)` | `canManageEmployees` | `change` jen z výčtu; nikdo sám sebe nedeaktivuje/nearchivuje; stav administrátora (deaktivace, archivace, aktivace, obnovení) mění jen administrátor |
| `addEmploymentAction(employeeId)`, `updateEmploymentAction(employmentId)`, `changeTeamAction(employeeId)` | `canManageEmployees` | – |
| `setRolesAction(employeeId)` | `canManageAccess` | služba nedovolí odebrat posledního administrátora |
| `createTeamAction`, `updateTeamAction(id)`, `setTeamArchivedAction(id)` | `canManageEmployees` | – |
| `pinTeamJobAction(teamId)`, `unpinTeamJobAction(teamId, jobId)` | `canPinAnyTeamJobs` | `canPinTeamJobs(teamId)` (vedoucí jen svou partu); služba: parta a zakázka existují |
| `createJobAction`, `updateJobAction(id)`, `setJobArchivedAction(id)`, `createCustomerAction`, `updateCustomerAction(id)`, `setCustomerArchivedAction(id)` | `canManageJobs` | – |
| **Docházka** (`src/modules/timesheets/actions.ts`) | | |
| `setLeaveAction(employeeId)` | `canManageEmployees` | – |
| `deleteDayTemplateAction(employeeId)`, `setDefaultDayTemplateAction` | `canManageDayTemplates` | – |
| `createAbsenceAction` | `canOpenAbsences` | služba: vlastní = žádost (`canRecordOwnTime`), za jiného `canDecideAbsence` (parta ke dni začátku) + důvod; zamčené měsíce odmítne |
| `decideAbsenceAction(id, decision)` | `canOpenAbsences` | služba: `canDecideAbsence` vlastníka uloženého záznamu (nikdy sám sobě, administrátor ne) |
| `cancelAbsenceAction(id)` | `canOpenAbsences` | služba: vlastní žádost, nebo `canDecideAbsence` + důvod; ne v zamčeném měsíci |
| `createStandbyAction`, `updateStandbyAction(id)`, `deleteStandbyAction(id)` | `canRecordOwnTime ∨ canWriteForSomeoneElse` | služba `standbyChangeError`: `canWriteTimeFor` vlastníka (u úpravy z uloženého záznamu, zaměstnanec se nemění), důvod za jiného, zámek měsíce |
| `setOvertimeAction(entryId, overtime)` | `canApproveTimesheets` | služba `overtimeFlagError`: `canFlagOvertime` vlastníka intervalu, ne vlastní, jen před schválením a uzávěrkou, s důvodem |
| `confirmTimesheetAction(month)` | `canRecordOwnTime` | jen vlastní výkaz (zaměstnanec ze session); `timesheetTransition` |
| `decideTimesheetAction(employeeId, month, decision)` | `canApproveTimesheets` | `decision` jen `approve`/`return`; `timesheetTransition`: vedoucí své party v měsíci, správce kohokoli, nikdo sám sebe |
| `bulkApproveAction(month, employeeIds)` | `canApproveTimesheets` | služba bere jen výkazy, které smí viewer schválit |
| `remindEmployeeAction(employeeId, month)` | `canApproveTimesheets` | služba `canRemind` (vedoucí své party, správce) |
| `closePeriodAction(month)`, `reopenPeriodAction(month, employeeIds)`, `saveSettingsAction`, `remindMissingAction(month)` | `canCloseTimesheetPeriod` | pravidla uzávěrky (`rules/period-close.ts`) |
| **Časová osa** (`src/modules/timesheets/timeline-actions.ts`) | | |
| `timelineAction(input)` | `canRecordOwnTime ∨ canWriteForSomeoneElse` | služba `planTimelineChange`: `canWriteTimeFor` (parta ke dni), důvod za jiného, zámek měsíce; ID intervalu jen z daného dne daného zaměstnance |
| `loadTimelineDayAction(employeeId, date)` | totéž | `canWriteTimeFor`, jinak `null` |
| `pinTeamJobAction(employeeId, date, jobId, pinned)` | totéž | `canPinTeamJobs` pro partu zaměstnance k danému dni |
| `saveOwnTemplateAction(items)` | `canSaveOwnDayTemplate` | jen vlastní šablona (zaměstnanec ze session) |
| **Ostatní** | | |
| `importAction` (`timesheets/import/actions.ts`) | `canManageAccess` | náhled nic nezapisuje; zápis v jedné transakci |
| `signOut` (`src/lib/auth-actions.ts`) | – | Better Auth zruší session z cookie (řádek v `session`) |
| `devSignInAction` (`src/lib/dev-login-actions.ts`) | `devLoginEnabled()`, jinak 404 | jen aktivní zaměstnanec s e-mailem |

### Route handlery

| Route | Brána | Konkrétní kontrola |
| --- | --- | --- |
| `/api/auth/[...all]` | Better Auth | jen Google; `validateUserInfo` pustí jen aktivního zaměstnance s e-mailem; kontrola originu |
| `/employees/import/template` | `getCurrentUser` + `canManageAccess` | jinak 404 |
| `/timesheets/export/payroll/[month]/[version]/xlsx`, `…/pdf` | `requireUser` | `getPeriodSnapshot` → `canCloseTimesheetPeriod`, jinak 404; jen snímek |
| `/timesheets/export/month-pdf?employee=&month=` | `requireUser` | `getMonth` → `canViewTimeOf`, jinak 404 |
| `/timesheets/export/job-hours?from=&to=` | `requireUser` | `getJobHours` → `canCloseTimesheetPeriod`, jinak 404 |

## Nálezy

Doplní se v průběhu kroku 5.2.
