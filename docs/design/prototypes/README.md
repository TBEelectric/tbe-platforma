# Interaktivní prototypy (reference)

Zdrojáky klikacích prototypů z návrhu obrazovek v Claude (https://claude.ai/artifact/18uNW7md6Egvqk6AFEM6hb).
Exportují se sem po každé změně prototypu.

| Soubor | Co ukazuje | Poslední změna |
| --- | --- | --- |
| `MobilOsa.dc.html` | **Mobil (primární):** svislá osa dne, kreslení intervalu tažením, klepnutí vyplní mezeru, úchyty, společná hranice navazujících bloků, kompaktní spodní panel (−/+ 5 min, přestávka s ikonou kávy, naposledy použité zakázky), výběr zakázky přes celou obrazovku s vyhledáváním a sekcemi, šablony „Obvyklý den“ / „Jako včera“ | 14. 10. 2026 |
| `Den.dc.html` | **Desktop – celá obrazovka Můj den:** boční menu, přehledové karty, vodorovná interaktivní osa (hover s časem, čára „teď“, kreslení tažením, vyplnění mezery, okraje, posun, společná hranice), intervaly jako kartičky, panel vybraného intervalu (−/+ 5 min, přestávka, naposledy použité zakázky jako tlačítka, vyhledávací seznam zakázek, druh práce jako tlačítka), pravý sloupec se součty po zakázkách a kontrolami | 14. 10. 2026 |

**Zobrazení zakázky (oba):** formát **„Firma, místo“** (firma bez právní formy s.r.o./a.s.); v seznamech tučně firma,
pod ní místo, drobně název zakázky. Číslo zakázky se nezobrazuje, ale vyhledává se.

## Jak je používat

- **Nejsou to kód k převzetí.** Formát `.dc.html` je formát nástroje na návrhy (vlastní runtime `DCLogic`,
  inline styly, data natvrdo, pevný čas „teď“, žádné ukládání). Aplikace se staví v Next.js + shadcn/ui + Tailwind.
- **Převzít se má chování:** výpočty v `<script type="text/x-dc">` (přichytávání, zarážky o sousedy, společná hranice,
  vyplnění mezery, šablony dne, řazení naposledy použitých zakázek, hledání bez diakritiky) přepiš jako čisté funkce
  v `src/modules/timesheets/rules` s testy a chovej se stejně.
- **Převzít se má rozložení:** pořadí a velikosti prvků, barvy, obsah panelu a výběru zakázky.
- Kde se prototyp a `docs/design.md` liší, platí `docs/design.md` (prototyp nemá např. podržení prstu před tažením,
  skutečný scroll na telefonu, ukládání ani zamčený měsíc).
