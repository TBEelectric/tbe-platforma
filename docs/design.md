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
| Launcher | `01-launcher` | všichni | Dlaždice modulů, karta „Čeká na vás“ (viz níže) |
| Můj den | `02-muj-den` → **aktuální je prototyp `prototypes/Den.dc.html`** | zaměstnanec; vedoucí a správce i za jiného | Časová osa, kartičky intervalů, kontroly, součty po zakázkách, stav měsíce |
| Můj měsíc | `03-muj-mesic`, detail dne `03b-muj-mesic-detail-dne` (jen HTML) | zaměstnanec; vedoucí (parta), správce a administrátor i „Měsíc zaměstnance“ | Kalendář s hodinami, chybějící dny, součty, pohotovost, průběh schválení, upozornění, Potvrdit měsíc, Stáhnout PDF; klik na den otevře detail dne |
| Schvalování | `04-schvalovani` | vedoucí (své party), správce (všechny) | Přepínání měsíců, karty počtů, záložky, tabulka party, detail s upozorněními a přesčasem u intervalů, Schválit / Vrátit s důvodem, hromadné schválení, Připomenout |
| Uzávěrka | `05-uzaverka` | správce | Kontrola před uzávěrkou, stav part, Připomenout chybějícím, Uzavřít měsíc, podklad pro mzdy (XLSX, PDF), CSV hodin po zakázkách, uzavřené měsíce s verzemi, Znovu otevřít |
| Nastavení | bez náhledu | správce | Prahy, lhůty a čas připomínek po oddílech, „Platí od“, historie změn |
| Mobil – den | `06-mobil-den` | zaměstnanec | **Nahrazeno** svislou osou, viz „Mobil – zápis dne na ose“; platí jen hlavička a spodní navigace |

**Launcher – „Čeká na vás“** (vpravo od pozdravu, na mobilu pod ním; bez úkolů se karta nezobrazí). Řádek = štítek
modulu, text úkolu, lhůta vpravo („dnes“ nebo „do 5. 10.“, po lhůtě tučně v barvě upozornění); celý řádek je odkaz přímo
na obrazovku. Úkoly v tomto pořadí (pravidlo `launcherTasks`):
- zaměstnanec: **Opravit vrácený výkaz** (s důvodem) → Můj měsíc; **Doplnit** nejstarší chybějící den otevřeného měsíce
  („a N dalších dnů“) → Můj den; **Potvrdit výkaz** za skončený měsíc, jakmile ho jde potvrdit → Můj měsíc,
- vedoucí: **Schválit N výkazů** za minulý měsíc (potvrzené výkazy jeho party) → Schvalování, záložka Ke schválení,
- správce: **Schválit N výkazů vedoucích** (výkazy vedoucích, správců a part bez vedoucího) a **Uzavřít měsíc**
  (skončený a neuzavřený, „Zbývá schválit N výkazů“) → Uzávěrka.
Vrácený výkaz a chybějící den mají štítek v barvě upozornění, ostatní tyrkysový.

Chybí dokreslit: absence a dovolená, správa zaměstnanců a part, zakázky, import z Excelu.

## Responzivita (mobil × desktop)

Jedna aplikace a jedna adresa; rozložení se přepíná **automaticky podle šířky displeje**, ne ručně.

| Šířka | Rozložení |
| --- | --- |
| < 1024 px (telefon, tablet na výšku) | Spodní navigace, svislá osa dne, spodní panel (bottom sheet), výběr zakázky přes celou obrazovku |
| ≥ 1024 px (počítač, tablet na šířku) | Boční menu, vodorovná osa, panel vybraného intervalu pod osou vedle kartiček (od 1280 px; užší okno ho dá nad kartičky) |

- Jediná hranice je **1024 px** (Tailwind `lg`, u osy `matchMedia`): iPad na výšku (768–1023 px) je mobil, na šířku desktop.
  Ostatní obrazovky se na 768–1023 px jen skládají do jednoho sloupce se spodní navigací.
- Většina obrazovek se jen přeskládá (Tailwind breakpointy `sm`, `lg`, `xl`).
- Osa dne má dvě komponenty (svislá pro mobil, vodorovná pro desktop) nad **společnou logikou** v `rules`;
  vybírá se podle šířky, obě se chovají stejně.
- Mobil se instaluje jako PWA na plochu (bez lišty prohlížeče).
- Vývoj stavět **mobile-first**: nejdřív mobilní rozložení, desktop jako rozšíření.

### Mobilní rozložení obrazovek měsíce

- **Můj měsíc:** karty 2×2, kompaktní kalendář (číslo dne a hodiny, barva stavu), pod ním lišta chybějících dnů
  a seznamy (podle zakázek, podle druhu práce, pohotovost, průběh schválení, upozornění); Potvrdit měsíc jako tlačítko
  dole nad spodní navigací. Detail dne je spodní panel (max. ~¾ výšky, ztmavené pozadí, klepnutí mimo zavře, Tab
  zůstává v panelu); na desktopu plovoucí panel pod / nad dnem.
- **Schvalování:** místo tabulky seznam karet; detail výkazu přes celou obrazovku s „Zpět na seznam“.
- **Uzávěrka a Nastavení:** jeden sloupec; tabulka part se mění na karty, dialogy (Uzavřít, Znovu otevřít) přes
  celou šířku.

## Zobrazení zakázky

Montéři se orientují podle firmy a místa, ne podle čísla. Všude v rozhraní pro zaměstnance (tlačítka, bloky na ose,
seznamy, výběr zakázky) se zakázka zobrazuje ve formátu **„Firma, místo“**, např. „Strojírny Vysočina, Jihlava, hala A“:
- firma bez právní formy (s.r.o., a.s.), aby byl popisek kratší,
- ve víceřádkovém výpisu (výběr zakázky): tučně **firma**, pod ní **místo**, drobně **název zakázky**
  (rozliší víc zakázek na stejném místě),
- na tlačítku a v bloku na ose „Firma, místo“ zkráceně s trojtečkou, celý text v nápovědě,
- **číslo zakázky se nezobrazuje**, ale vyhledávání ho najde; v exportech a správě zakázek zůstává,
- sekce „Všechny aktivní“ je řazená podle firmy.
- **barva zakázky** je stálá (stejná na všech dnech a obrazovkách): odvozená z id zakázky z palety 8 barev;
  správce ji může ve správě zakázky změnit, kdyby dvě souběžné zakázky měly stejnou barvu (`job.color`).

## Interaktivní časová osa (Můj den)

Zdrojáky klikacích prototypů jsou v `docs/design/prototypes/` (viz README tam) – reference chování a rozložení.
Desktop: `Den.dc.html` je celá obrazovka Můj den s osou (nahrazuje statický náhled `02-muj-den`). Mobil: `MobilOsa.dc.html`.

Osa na obrazovce Můj den slouží i k zápisu. Docházka se zapisuje hlavně **zpětně po skončeném dni**, ne živě;
osa je stavěná na rychlé poskládání dne. Prototyp je v návrhu obrazovek (artboard „Můj den – interaktivní osa“).

**Nahrazuje stávající statický pruh** na obrazovce Můj den (02-muj-den), nevzniká druhá osa. Zbytek obrazovky zůstává:
pod osou kartičky intervalů (výběr na ose a na kartičce je propojený) a vedle nich (od šířky 1280 px, v užším okně nad
nimi) panel vybraného intervalu (viz „Klik na interval“ níže). Starý formulář „Přidat interval“ a tabulka jsou
odstraněné, úprava je jen na tomto jednom místě. Důvod zápisu za jiného zaměstnance je pole nad osou (ne dialog).
Pravý sloupec (součty, kontroly, stav měsíce) beze změny.

**Mobil je primární zařízení** (montéři nemají počítač). Na mobilu je osa **svislá jako denní pohled kalendáře** –
viz níže „Mobil – zápis dne na ose“. Desktopová vodorovná osa je pro vedoucí a kancelář.

- **Rozsah osy a sbalená noc (desktop i mobil):** osa standardně ukazuje **5:00–24:00**. Noc je sbalená za
  **jedinou šipkou** (bez ikony a bez textu; popis jen pro čtečky / tooltip), umístěnou **ve sloupci s časy, mimo plochu
  pro kreslení**: nad popiskem 5:00 šipka nahoru = „Zobrazit noc 0:00–5:00“, pod popiskem 24:00 šipka dolů = „Zobrazit čas
  po půlnoci (do 6:00)“. Po rozbalení se šipka otočí a slouží ke sbalení. Žádný řádek navíc, žádné místo navíc.
  Pojistky: šipka není v ploše osy, klepnutí jen rozbalí/sbalí (nikdy nevytvoří interval, tažení z ní nic nekreslí),
  po rozbalení noci nahoře se **zachová pozice** (5:00 zůstane na stejném místě displeje), prázdná noc se při přechodu
  na jiný den sama sbalí. **Když den v noci něco má, je noc rozbalená automaticky a šipka se neukazuje.**
  Na desktopu (vodorovná osa) stejně: šipka vlevo od osy (před 5:00, ←) a vpravo od osy (za 24:00, →), svisle
  uprostřed osy, v okraji mimo plochu pro kreslení; po rozbalení se otočí. Stav sdílí oba rozvrhy (`useNight`).
  Krok přichytávání na desktopu 5 min (tažení na mobilu 15 min). Jediná hranice mezi mobilní a desktopovou osou je
  1024 px (viz „Responzivita“).
- **Noc a půlnoc:** rozbalená osa končí v 6:00 dalšího dne (popisky „0:00 +1“); interval přes půlnoc se kreslí jedním
  tahem a patří ke dni, kdy začal. Noční pásma 22:00–6:00 jsou jemně podbarvená; v panelu vybraného nočního intervalu
  nenápadná poznámka „Noční práce – zkontrolujte čas“ (nic neblokuje).
- **Hover:** svislá čára a štítek s časem pod kurzorem. Dnes je vidět i čára „teď“ s aktuálním časem.
- **Tažení po prázdném místě nakreslí nový interval** od–do (hlavní způsob zápisu). Nový interval je hned vybraný,
  aby mu šla nastavit zakázka a druh práce; výchozí je poslední použitá zakázka.
- **Klik do prázdného místa:** v mezeře mezi dvěma intervaly ji **celou vyplní**; před prvním nebo za posledním intervalem vloží 1 h
  (zkrácenou, pokud se nevejde).
- Dnes nejde zapisovat za čáru „teď“. Běžící interval (stopky) se nepoužívá.
- **Tažení intervalu:** levý / pravý okraj mění začátek / konec, tažení středu posouvá celý interval. Nejde zapisovat
  do budoucna, minimální délka 5 min.
- **Navazující intervaly – společná hranice:** když dva intervaly na sebe navazují (konec = začátek), tažení okraje
  posouvá jejich **společnou hranici**: jeden se prodlouží, druhý o stejný kus zkrátí (např. delší přestávka = kratší
  následující práce). Soused se nezkrátí pod 5 min a nikdy nezmizí. Když je mezi intervaly mezera, okraj se zarazí
  o souseda. Posun celého intervalu se o sousedy vždy zarazí (žádné prohazování). Stejně fungují tlačítka −/+.
- **Interval, se kterým se hýbe, se vybere**; panel / tabulka během tažení ukazuje jeho aktuální čas.
- **Klik na interval** ho vybere (i v tabulce) a otevře panel úprav **sjednocený s mobilem**: začátek a konec s −/+ 5 min;
  tlačítko **Přestávka** (ikona kávy, teplá barva) + tlačítka naposledy použitých zakázek (max 4); pod nimi
  **vyhledávací seznam zakázek** (combobox: psaním filtruje podle čísla, názvu i zákazníka bez diakritiky, bez psaní
  ukáže posuvný seznam se sekcemi Naposledy použité / Zakázky party / Všechny aktivní); **druh práce jako tlačítka**
  (ne rozbalovací seznam); Smazat interval / Hotovo. Na desktopu se tento panel použije místo dosavadního
  formuláře „Přidat interval“ s rozbalovacími seznamy.
- Přestávky na ose i na kartičkách: béžová, jemné šrafování, ikona kávy – stejně jako na mobilu.
- Každá změna se ukládá hned (server action, optimistická aktualizace, při chybě návrat a hláška) a zapisuje se do auditu.
- Zamčený měsíc (potvrzený, schválený, uzavřený) a den s celodenní absencí: osa **jen pro čtení** na mobilu i desktopu
  (nejde kreslit, táhnout, vyplnit mezeru ani otevřít panel, klávesy nic nemění, nejsou šablony ani „Uložit jako můj
  obvyklý den“); nahoře hláška se zámkem podle stavu: „Měsíc je potvrzený / schválený / uzavřený, intervaly už nelze
  měnit“ (nebo o absenci). Vrácený výkaz zůstává upravitelný a nad osou je hláška „Výkaz byl vrácen k opravě: <důvod>“.
  Pravidlo je čistá funkce `dayEditability`.
- **Přístupnost a klávesnice:** bloky jsou `option` (`aria-selected`) v `listbox` osy, Tab přechází po blocích, Enter /
  mezerník = výběr; vybraný interval: ←/→ = konec ±5 min, Shift+←/→ = začátek, Backspace/Delete = smazat, Esc = zrušit
  výběr. Úchyty, šipka noci, špendlík a −/+ mají `aria-label`; fokus je viditelný (3px obrys v barvě `ring`).
  Barva textu na bloku se volí podle jasu zakázky (`readableTextColor`, kontrast ≥ 4,5 : 1).

## Mobil – zápis dne na ose (primární)

Prototyp: `MobilOsa.dc.html`. Nahrazuje dosavadní mobilní obrazovku 06-mobil-den (seznam intervalů); platí pro šířky pod 1024 px.

- **Svislá osa** 5:00–24:00 se sbalenou nocí (viz „Rozsah osy a sbalená noc“ výše), hodina ≈ 56 px, den se posouvá
  prstem. Po otevření dne se osa posune na první zapsaný interval, u prázdného dne na 6:00. Vlevo popisky hodin,
  čáry po hodinách a jemné čáry po půlhodinách.
  Intervaly jsou bloky v barvě zakázky s časem, zakázkou, druhem práce a délkou.
- **Nový interval:** podržet prst na prázdném místě (~300 ms, haptická odezva) a táhnout = nakreslit od–do;
  klepnutí do mezery mezi intervaly ji **celou vyplní**, jinde vloží 1 h. Bez podržení se den normálně posouvá –
  tažení nesmí kolidovat se scrollem.
- **Přichytávání při tažení 15 min**, jemné doladění tlačítky −/+ po **5 min** ve spodním panelu.
- **Úprava:** klepnutím se blok vybere; úchyty nahoře a dole jsou jen na vybraném bloku (dotyková plocha ≥ 44 px,
  přesahuje přes okraj), podržet (300 ms) a táhnout střed = posun. Tažený blok se vybere a kompaktní panel ukazuje jeho čas živě během tažení.
  Navazující bloky sdílejí hranici (viz výše).
- **Spodní panel (bottom sheet), kompaktní – max. ~⅓ výšky displeje:** řádek začátek −/+ – konec −/+ a zavřít (×);
  vodorovně posuvný řádek: **Přestávka** (ikona hrnku kávy, teplá oranžová barva, oddělená svislou čárou)
  + max. 4 naposledy použité zakázky zaměstnance (vždy i zakázka vybraného intervalu) + **„Další zakázky…“**;
  vodorovně posuvný řádek druhů práce; délka a „Smazat interval“. Den nad panelem zůstává posouvatelný (spodní odsazení).
  **Klepnutí mimo panel ho zavře.** Žádné psaní na klávesnici v běžném případě.
- **Výběr zakázky („Další zakázky…“)** – celá obrazovka: vyhledávání podle čísla, názvu i zákazníka bez ohledu na
  diakritiku; bez hledání sekce **Naposledy použité** (5), **Zakázky party** (připnuté vedoucím), **Všechny aktivní**
  (podle firmy). Řádek = barva, tučně firma, pod ní místo, drobně název zakázky (viz „Zobrazení zakázky“). Uzavřené
  zakázky se nezobrazují. Výběr zavře obrazovku.
- **Zakázky party (připínání):** vedoucí party vidí ve výběru zakázky (mobil i desktopový combobox) u každé zakázky
  **špendlík**; klepnutím ji připne / odepne pro celou partu. Ostatní špendlík nevidí, jen sekci „Zakázky party“.
  Připnuté zakázky vidí všichni členové party v sekci „Zakázky party“; nový člen bez historie je má i jako tlačítka
  v panelu. Připnutí platí do odepnutí; uzavřená zakázka ze zakázek party zmizí sama. Přehled a úprava připnutých
  zakázek je i v detailu party (Zaměstnanci → parta) pro vedoucího a správce docházky.
- **Přestávka** se všude (tlačítko, blok na ose, tabulka) pozná bez čtení: ikona hrnku kávy, teplá oranžová barva,
  na ose jemné šrafování. Ikony pomáhají i kolegům, kteří čtou česky hůř.
- **Prázdný den:** tlačítka **„Obvyklý den“** (šablona zaměstnance, jinak výchozí šablona firmy 7:00–11:30, přestávka
  11:30–12:00, 12:00–15:30; bloky práce dostanou naposledy použitou zakázku a druh „Montáž“) a **„Jako včera“** (kopie
  posledního vyplněného pracovního dne). Pak se jen opraví rozdíly.
- **Vlastní obvyklý den** si zaměstnanec nastaví sám: na vyplněném dni pod osou (jen v otevřeném měsíci) tlačítko **„Uložit jako můj obvyklý den“** → potvrzení se shrnutím („7:00–15:30 · 2× práce, 1× přestávka“,
  případně „dosavadní se přepíše“). Ukládají se jen časy a typ bloku (práce / přestávka), ne zakázky ani druh práce.
  Tlačítko „Obvyklý den“ pak zní „Můj obvyklý den“. **Správce docházky** vidí šablonu v detailu zaměstnance a může ji
  smazat (vrátí se výchozí šablona firmy); výchozí šablonu firmy nastavuje v nastavení modulu. Vedoucí do šablon nezasahuje.
- Hlavička: den se šipkami (výchozí je nejstarší nevyplněný pracovní den, jinak dnes), součet práce, přestávek a od–do.
- Ukládá se okamžitě po každé změně; při výpadku signálu se změna uloží do fronty a odešle po připojení
  (offline je v plánu později – do té doby jasná hláška, že se nic neuložilo).
- Spodní navigace: Den · Měsíc · Absence · Více.

## Menu modulu Docházka

Můj den · Můj měsíc · Absence · Schvalování · Uzávěrka · Zaměstnanci · Nastavení (dole u profilu).
Položky bez oprávnění se nezobrazují. Zaměstnanci jsou jen odkaz do modulu Zaměstnanci (`/employees`);
Zakázky mají vlastní modul (`/jobs`) a v menu Docházky nejsou:

| Položka | Kdo ji vidí |
| --- | --- |
| Můj den, Můj měsíc | kdo eviduje vlastní docházku |
| Zápis za jiné, Měsíc zaměstnance | účet bez vlastní docházky, který smí zapisovat za jiné (administrátor); ostatní volí zaměstnance přímo na Můj den / Můj měsíc |
| Absence | kdo eviduje docházku, vedoucí, správce docházky |
| Schvalování | vedoucí party, správce docházky |
| Uzávěrka, Nastavení | správce docházky |
| Zaměstnanci (odkaz na `/employees`) | správce docházky, administrátor |

Spodní navigace na mobilu: Den · Měsíc · Absence · Více (celé menu modulu ve spodním panelu).

## Moduly Zakázky a Zaměstnanci

Vlastní dlaždice v launcheru; kdo k modulu nemá oprávnění, dlaždici nevidí (stránky to kontrolují i na serveru).

| Modul | Menu | Kdo ho vidí |
| --- | --- | --- |
| Zakázky (`/jobs`) | Zakázky · Zákazníci | správce docházky, administrátor |
| Zaměstnanci (`/employees`) | Zaměstnanci · Party · Import z Excelu (jen administrátor) | správce docházky, administrátor |

Detail zaměstnance skládá karty jádra (údaje, role, úvazky, parta) a karty Docházky (dovolená, obvyklý den).
