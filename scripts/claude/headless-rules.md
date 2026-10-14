# Pravidla automatického běhu (nikdo nesleduje)

- Nikdo neodpoví na otázky ani neschválí plán. Neptej se a nečekej na souhlas. Nejasnosti rozhodni rozumně podle
  docs/ a CLAUDE.md; rozhodnutí uveď v commit message a v řádku „Výsledek:“ v docs/plan.md.
- Když nejde pokračovat bez člověka (chybí údaj nebo přístup, podklady si zásadně odporují, je potřeba Google Cloud
  Console, tajné klíče, placená služba, instalace nástroje do systému, nevratná operace s daty): nehádej. Pod krok
  v docs/plan.md přidej odsazený řádek `BLOKOVÁNO: <co přesně je potřeba od člověka>`, commitni, pushni a skonči
  posledním řádkem `STATUS: BLOCKED – <důvod>`.
- Když build nebo testy selžou a do tří pokusů o opravu je nespravíš, postupuj stejně (BLOKOVÁNO + STATUS: BLOCKED).
- Nikdy: force push, přepis historie (rebase, reset publikovaných commitů), jiná větev než main, úpravy `.env`
  (jen `.env.example`), mazání dat mimo lokální vývojovou databázi, globální instalace, práce mimo repozitář.
- Nespouštěj procesy, které samy neskončí (`pnpm dev`, tunel, watch). Pokud potřebuješ server ověřit, spusť ho na pozadí
  s časovým limitem a po ověření ukonči.
- Drž se rozsahu kroku. Hotové kroky a jejich kód měň jen kvůli nutné opravě; uveď to ve „Výsledek:“.
- Na konci nesmí v gitu zůstat necommitnuté změny a vše musí být pushnuté.
