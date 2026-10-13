# Design

Celá platforma používá styl screenshotu vozového parku: tmavé boční menu, světlá pracovní plocha,
tyrkysové akcenty, přehledové karty a tabulky. Návrh obrazovek docházky:
https://claude.ai/artifact/18uNW7md6Egvqk6AFEM6hb

## Tokeny (z návrhu obrazovek)

| Token | Hodnota | Použití |
| --- | --- | --- |
| `sidebar` | `#0f2f45` | Boční menu, horní lišta launcheru, mobilní hlavička |
| `primary` | `#0e7c72` | Aktivní položka menu, hlavní tlačítka, akcent |
| `primary-soft` | `#e3f3f1` / text `#0b5f57` | Štítky, zvýraznění řádku `#eef7f6` |
| `background` | `#f3f5f8` | Plocha |
| `card` | `#ffffff`, okraj `#e2e7ee`, radius 14 px | Karty |
| `text` | `#142433` | Text |
| `muted` | `#5b6877` | Sekundární text (kontrast ≥ 4.5:1) |
| `warning` | pozadí `#fdf0e1`, text `#9a4a06` | Chybějící den, upozornění |
| `success` | pozadí `#e4f4ea`, text `#14663d` | Schváleno, OK |
| `info` | pozadí `#e6eef9`, text `#244f8f` | Potvrzeno, cesta |
| `neutral` | pozadí `#eef1f4`, text `#46525f` | Přestávka, plánováno |
| druhá zakázka v grafech | `#3a68a8` | |

Písmo: **Figtree** (400, 500, 600, 700). Tlačítka a pole výšky 44 px, radius 10 px.
Ikony: tahové 24×24, stroke 1.8 (doporučeno lucide-react).

## Obrazovky docházky

Ve složce `docs/design/screens/` je ke každé obrazovce samostatné HTML (otevři v prohlížeči, odkazy v menu
fungují) a PNG náhled. Jsou to **vzory vzhledu a rozložení**, ne kód k převzetí: v aplikaci se postaví
z shadcn/ui komponent a Tailwindu, s tokeny výše. Data v nich jsou ukázková. Formulářový řádek
„Přidat interval“ je na desktopu stísněný; v aplikaci ho rozlož do dvou řádků.

| Obrazovka | Soubor | Kdo | Obsah |
| --- | --- | --- | --- |
| Launcher | `01-launcher` | všichni | Dlaždice modulů, „Čeká na vás“ |
| Můj den | `02-muj-den` | zaměstnanec | Časová osa, tabulka intervalů, řádek „Přidat interval“, kontroly, součty po zakázkách |
| Můj měsíc | `03-muj-mesic` | zaměstnanec | Kalendář s hodinami, chybějící dny, součty, průběh schválení, Potvrdit měsíc |
| Schvalování | `04-schvalovani` | vedoucí | Tabulka party, upozornění, detail, Schválit / Vrátit s důvodem |
| Uzávěrka | `05-uzaverka` | správce | Kontrola před uzávěrkou, stav part, export, uzavřené měsíce s verzemi |
| Mobil – den | `06-mobil-den` | zaměstnanec | Intervaly dne, „Pokračovat od …“, spodní navigace |

Chybí dokreslit: absence a dovolená, správa zaměstnanců a part, zakázky, import z Excelu.

## Menu modulu Docházka

Můj den · Můj měsíc · Absence · Schvalování (vedoucí) · Uzávěrka (správce) · Zakázky · Zaměstnanci · Nastavení.
Položky bez oprávnění se nezobrazují.
