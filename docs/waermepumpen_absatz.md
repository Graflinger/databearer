# Wärmepumpen: Neubauanteil ist nicht Absatz

Topic: `waermepumpen-absatz`. Branch: `feature/waermepumpen-absatz`.
Recherche- und Lizenzprüfdatum: **2026-11-05**. Nur Draft-PR gegen `main`;
keine Veröffentlichung, kein Merge, keine Release-Promotion.

## Arbeitsliste

- [x] Aktuellen Branch prüfen und Originaldaten sowie Destatis-Lizenz verifizieren.
- [x] Eingefrorenes Datenpaket, Exporter, Charts und Validator prüfen.
- [x] Artikel und politische Einordnung gegen Originalquellen prüfen.
- [x] Tests, Lint, Build, SEO-Ausgabe und lokale Vorschau prüfen.
- [ ] Commit, Push und Draft-PR; Tracker verlinken.

## Aussage und Abgrenzung

Arbeitstitel: „Wärmepumpen: Im Neubau längst vorn – wie stabil ist der Boom?“
Die Bautätigkeitsstatistik zeigt einen strukturellen Wechsel der vorwiegenden
Heizenergie neu errichteter Wohngebäude. Sie misst **nicht** den Absatz von Geräten,
den Heizungstausch im Gebäudebestand, die Zahl beheizter Wohnungen oder vermiedene
Emissionen. Ein Mehrfamilienhaus zählt ebenso als ein Gebäude wie ein Einfamilienhaus.

Die jährlich vollständige Zeitreihe 2015–2025 stammt aus der offiziellen
[CSV zur Pressemitteilung N038/2026](https://www.destatis.de/DE/Presse/Pressemitteilungen/Grafiken/Newsroom/2026/Interaktiv/Daten/20260610-waermepumpen.csv?__blob=value&v=1).
Wärmepumpe = Geo- und Umweltthermie; sonstige erneuerbare Heizenergie ist nicht enthalten.
2015: 31,4 %, 2025: 73,6 %; Erdgas 51,5 % bzw. 10,5 %.
Der Wert für Erdgas 2021 ist in dieser **konkret abgerufenen CSV 34,3 %**;
keine Übernahme des abweichenden Werts 34,4 % aus Sekundärzusammenstellungen.

## Lizenz-Gate

Alle folgenden Bedingungen wurden am 5. November 2026 direkt beim jeweiligen
Herausgeber geprüft. Öffentlicher Zugriff allein ist keine offene Lizenz.
AdSense ist derzeit ausgeschaltet, aber die Beurteilung setzt eine mögliche
kommerzielle Nutzung und dauerhafte Weiterverbreitung in einem öffentlichen Git-Repo voraus.
Dies ist eine dokumentierte redaktionelle Rechteprüfung, keine Rechtsberatung.

### Destatis: sicher mit Namensnennung und Bearbeitungshinweis

- **Bedingungen:** [Copyright allgemein](https://www.destatis.de/DE/Service/Impressum/copyright-allgemein.html),
  herausgebereigene Nutzungserlaubnis ohne Versionsnummer, Copyright-Vermerk 2026.
- **Geltungsbereich:** Standardveröffentlichungen, Website-Inhalte und Downloads,
  soweit keine abweichenden Bedingungen angegeben sind. In den verwendeten
  Pressemitteilungen und der CSV wurde kein abweichender Datenrechteinhaber ausgewiesen.
- **Ausdrückliche Erlaubnis:** „Vervielfältigung und Verbreitung, auch auszugsweise,
  mit Quellennachweis gestattet.“ Die Bedingungen nennen Texte, Daten und Grafiken,
  gewerbliche und nicht gewerbliche Zwecke sowie uneingeschränkte Verbreitungsformen
  einschließlich Internet. Keine Einzelgenehmigung erforderlich. Damit sind die
  ausgewählten und abgeleiteten Daten im öffentlichen Repo zulässig.
- **Namensnennung:** „Statistisches Bundesamt (Destatis)“ als Herausgeber;
  empfohlen sind genaue Fundstelle/URL, Dokumentart und Abrufdatum. Verwendeter Wortlaut:
  „Quelle: Statistisches Bundesamt (Destatis), Bautätigkeitsstatistik,
  Pressemitteilung N038 vom 10. Juni 2026 und zugehörige CSV, abgerufen am
  5. November 2026; eigene Auswahl, Berechnung und Darstellung.“ Weitere
  Pressemitteilungen werden bei den daraus übernommenen Angaben zusätzlich genannt.
- **Bearbeitung:** Auswahl der Spalten, aufsteigende Sortierung, neues CSV-Format,
  eigene Diagramme sowie näherungsweise Multiplikation gerundeter Gebäudezahlen mit
  gerundeten Anteilen werden kenntlich gemacht.
- **Datenbankrechte:** Die allgemeine Erlaubnis nennt Datenweiterverbreitung ausdrücklich,
  enthält aber keine getrennte Klausel zu sui-generis-Datenbankrechten. Es wird kein
  eigenständiger Verzicht auf alle Datenbankrechte behauptet. Keine Umgehung oder
  systematische Übernahme einer fremden Verbandsdatenbank.
- **Rechte Dritter:** Ausgewiesene Dritt- und Kooperationsrechte bleiben ausgenommen;
  keine Fotos, Logos, Bühnenbilder oder Originalgrafiken werden übernommen.
- **Nicht verwechseln:** Für [GENESIS-Online](https://www.destatis.de/DE/Service/Impressum/copyright-genesis-online.html)
  gilt ausdrücklich **Datenlizenz Deutschland – Namensnennung – Version 2.0**.
  Hier wird aber die direkt verfügbare Website-CSV verwendet, kein GENESIS-Export;
  deshalb lautet die Lizenzzuordnung des Pakets nicht pauschal `dl-de/by-2-0`.

### BWP/BDH: keine freigegebene Datenreihe

- [BWP-Impressum, Abschnitt Urheberrecht](https://www.waermepumpe.de/impressum/),
  keine offene Lizenz und keine Versionsnummer. Verwertung außerhalb der gesetzlichen
  Grenzen bedarf schriftlicher Zustimmung; Downloads/Kopien nur privat und nicht kommerziell.
- Die [Pressemitteilung vom 6. August 2026](https://www.waermepumpe.de/presse/pressemitteilungen/details/waermepumpen-absatz-waechst-im-ersten-halbjahr-auf-195000-anlagen/)
  bestätigt 195.000 Geräte und +40 % im ersten Halbjahr 2026; ausdrücklich Lieferungen
  der Hersteller an Großhandel/Fachhandwerk, keine gemessenen Inbetriebnahmen.
- **Entscheidung:** Nur einzelne zugeschriebene Tatsachen in eigener Formulierung
  mit Originalquellenlink, wie im Auftrag erlaubt. Keine Grafik, kein Pressetext,
  kein Rohdownload und keine Absatzzeitreihe im Repo oder Chart. Keine behauptete
  Lizenz für gewerbliche Datenweiterverbreitung; auch eine Quellenangabe würde eine
  fehlende Erlaubnis zur Datenbankübernahme nicht ersetzen. Dritt- und Datenbankrechte
  bleiben vorbehalten. Kein lizenzvertraglich vorgeschriebener Namensnennungswortlaut,
  da keine entsprechende Lizenz erteilt wurde; redaktionell „BWP/BDH-Absatzstatistik,
  mitgeteilt vom Bundesverband Wärmepumpe (BWP)“ plus Datum/Link.

### Nicht verwendete Alternativen

EHPA-Mitgliederdaten werden weder abgerufen noch verwendet. IEA-Datensätze und
Berichte werden nicht genutzt; deren unterschiedliche Lizenzen werden nicht
gleichgesetzt. Eurostat-Haushaltspreise und BAFA/KfW-Förderstatistiken sind für die
tragfähige Neubau-Story nicht erforderlich und werden nicht ins Datenpaket aufgenommen.
Für diese **nicht genutzten** Alternativen wird keine Lizenzfreigabe behauptet.

### Ergänzende Originalprüfung: BDH, Bestandsanteil, Recht und Förderung

- **BDH:** [Impressum](https://www.bdh-industrie.de/kontakt/impressum) und
  [Datenschutz](https://www.bdh-industrie.de/kontakt/datenschutz) enthalten keine
  festgestellte offene Datenlizenz, Versionsnummer oder Erlaubnis für kommerzielle
  Datenbankweiterverwendung. Das ist keine Feststellung eines pauschalen Verbots,
  sondern einer **nicht nachgewiesenen Freigabe**. Die
  [BDH-Jahresbilanz vom 1. Februar 2026](https://www.bdh-industrie.de/presse/pressemeldungen/artikel/jahresbilanz-heizungsabsatz-faellt-auf-niedrigsten-stand-seit-15-jahren)
  bestätigt 299.000 Geräte und +55 %. Sie dient nur als Gegenprüfung; keine BDH-Datei
  wird übernommen. Kein vorgeschriebener Lizenz-Credit festgestellt; bei Zitierung
  Herausgeber, Titel, Datum und Original-URL nennen.
- **BWP-Bestandsanteil:** In der
  [Jahresbilanz vom 27. Januar 2026](https://www.waermepumpe.de/presse/news/details/ueber-50-prozent-im-plus-waermepumpen-absatz-steigt-2025-deutlich)
  nennt Geschäftsführer Martin Sabel „knapp 80 Prozent des Absatzes“ im Bestand.
  Die Mitteilung beschreibt weder Methode noch exakten Bezugszeitraum („mittlerweile“).
  Deshalb ausschließlich zugeschriebene Branchenschätzung, keine amtliche Quote,
  kein Anteil des Bestands und keine Ableitung aus Neubau und Gesamtabsatz.
- **GModG:** [BGBl. 2026 I Nr. 226](https://www.recht.bund.de/bgbl/1/2026/226/VO.html),
  ausgefertigt am 23. Juli, verkündet am 28. Juli 2026. Die
  [amtliche Regierungserläuterung vom 29. Juli](https://www.bundesregierung.de/breg-de/aktuelles/neues-gebaeudemodernisierungsgesetz-2430284)
  bestätigt Inkrafttreten wesentlicher Neuregelungen am 29. Juli, Wegfall der
  allgemeinen 65-Prozent-Vorgabe und weitere Möglichkeit von Gas-/Ölheizungen.
  [Konsolidierte Fassung](https://www.gesetze-im-internet.de/geg/): früherer § 71
  weggefallen. [§ 42a](https://www.gesetze-im-internet.de/geg/__42a.html) sieht
  ein gesondertes, bis 1. Dezember 2026 vorzulegendes Gesetz zur Grüngas-/Grünheizölquote
  vor. Keine Behauptung, dieses separate Gesetz sei bereits beschlossen.
- **BEG EM:** BMWE, „Förderrichtlinie für die Bundesförderung für effiziente Gebäude –
  Einzelmaßnahmen (BEG EM)“, Fassung **17. August 2026**,
  [BAnz AT 27.08.2026 B1](https://www.bundesanzeiger.de/pub/publication/jLXvW09kHTQoDINAdoC?0=).
  Nummer 10: Wirkung ab 21. Juli 2026, Ende am 31. Dezember 2030. Nummer 7.2:
  kein Rechtsanspruch, verfügbare Haushaltsmittel maßgeblich. Nicht gleichsetzen
  mit garantierter Finanzierung oder unveränderten Fördersätzen bis 2030.
- **Rechtsstatus statt Lizenz:** Einzelne Gesetze und amtliche Bekanntmachungen
  sind nach [§ 5 Absatz 1 UrhG](https://www.gesetze-im-internet.de/urhg/__5.html)
  urheberrechtlich nicht geschützt (keine Lizenzversion; die zitierte Rechtsfassung
  separat nennen). Kein lizenzvertraglich vorgeschriebener Credit; redaktionell
  Gesetz/Paragraph/Fundstelle bzw. BMWE, Richtlinientitel, Datum und BAnz-Nummer.
  Artikel paraphrasiert die Regelungen und verlinkt die Fundstellen, statt Dokumente
  oder Datenbanken weiterzuverbreiten. Kommerzielle Tatsachenberichterstattung hängt
  hier nicht an einer NC-Datenlizenz. Kein Bild oder privater Normtext wird übernommen.
- **Bundesanzeiger-Datenbank:** Das
  [Impressum](https://www.bundesanzeiger.de/pub/de/impressum) beansprucht ausdrücklich
  Datenbankschutz nach §§ 87a ff. UrhG; auch [Rechtliches](https://www.bundesanzeiger.de/pub/de/rechtliches)
  geprüft. Keine Erlaubnis zum Weiterveröffentlichen dieser Datenbank hergeleitet.
  § 5 UrhG für die einzelne amtliche Bekanntmachung hebt diese Datenbankrechte nicht auf.
- **Bundesregierung-Webseite:** Nur Faktengegenprüfung, kein Bild/Text übernommen.
  [Impressum](https://www.bundesregierung.de/breg-de/impressum?view=) weist keine
  hier genutzte pauschale offene Lizenz aus; Artikelfoto mit separatem
  Lars Fröhlich/FUNKE/imago-Credit. Nicht unter die Freistellung amtlicher Gesetzestexte ziehen.

Alle Ergänzungen am **2026-11-05** direkt beim Herausgeber abgerufen. Für nicht
lizenzierte Kontextquellen steht im Manifest ausdrücklich `redistribution: false`;
damit ist keine Absatzdaten- oder Dokumentweitergabe unter Destatis-Bedingungen gemeint.

## Originalbelege und Rechenweg

- [Destatis N025, 4. Juni 2024](https://www.destatis.de/DE/Presse/Pressemitteilungen/2024/06/PD24_N025_31_51.html):
  2023 knapp 96.800 fertiggestellte Wohngebäude, Wärmepumpenanteil 64,6 %.
- [Destatis N031, 4. Juni 2025](https://www.destatis.de/DE/Presse/Pressemitteilungen/2025/06/PD25_N031_31_51.html):
  2024 knapp 76.100 fertiggestellte Wohngebäude, 69,4 % Wärmepumpen;
  rund 54.800 genehmigte Wohngebäude, davon 81,0 % mit geplanter Wärmepumpe und 3,7 % Gas.
- [Destatis N038, 10. Juni 2026](https://www.destatis.de/DE/Presse/Pressemitteilungen/2026/06/PD26_N038_31_51.html):
  2025 rund 58.900 fertiggestellte Wohngebäude, davon 73,6 % Wärmepumpen;
  62.100 genehmigte Wohngebäude, davon 83,0 % Wärmepumpen und 2,2 % Gas.
  Fertigstellungen beruhen wesentlich auf dem Meldestand Anfang Mai 2026.

Näherungsweise Zahl neuer Wohngebäude mit Wärmepumpe = Gebäudezahl × Anteil / 100,
auf Hunderter gerundet: 2023 rund 62.500, 2024 rund 52.800, 2025 rund 43.400.
Das sind **berechnete Näherungen**, keine exakt aus GENESIS abgerufenen Fallzahlen
und keine Gerätezahlen. Die Gesamtzahl neuer Wohngebäude sank 2023–2025 um rund
39 %, die näherungsweise Zahl mit Wärmepumpe um rund 31 %.
Genehmigungen und Fertigstellungen desselben Jahres sind **keine identische Kohorte**;
aus der Differenz darf keine Fertigstellungsquote oder Prognose abgeleitet werden.

Die Primärquelle ist bereits eine kompakte amtliche Aggregation. Ein begrenzter
Artikel-Exporter genügt; keine neue tägliche Quelle, keine Dashboardänderung, kein
vollständiger GENESIS/dbt-Lauf. Rohantworten bleiben außerhalb Git, Provenienz und
kompakte Evidenz werden eingefroren. Hashes sichern Paketkonsistenz, nicht unabhängig
die Wahrheit der Quelldaten.

## Offene Freigabepunkte

- Kein KI-Kartenbild erzeugt. Vor Veröffentlichung Bildentscheidung und ggf. Alttext/Credit.
- Draft bleibt bis zur ausdrücklichen Veröffentlichungsgenehmigung gesetzt.
- Aktuelle Absatz-, Förder- und Rechtslage vor Veröffentlichung erneut prüfen;
  keine Jahreshochrechnung aus einem Halbjahr und keine Förderzusage als Installation zählen.

## Reproduktion und Qualitätssicherung

Evidenzpaket: `frontend/src/data_ingestion/data/2026/waermepumpen/`:
`anteil.csv` (11 Jahreswerte), `neubau.csv` (3 Jahreswerte),
`genehmigungen.csv` (2 Jahreswerte), `manifest.json`. Das Manifest dokumentiert
Original-URLs, Veröffentlichungsdaten, tatsächliche UTC-Abrufzeiten und SHA-256
der Rohantworten sowie Dateigrößen, Hashes, Zeilenzahlen, Spaltenverträge und Lizenzen.
Kontextrechte werden aus `context_licenses.json` neben dem Exporter übernommen;
diese Datei enthält keine Verbandsdatenreihe.

Der Build prüft das komplette Paket vor Chartgenerierung, einschließlich der nur
im Text verwendeten Genehmigungsdaten. Unerwartete oder fehlende Dateien, Symlinks,
vermischte Bytes, ungültige Quellen-/Beobachtungsdaten, abweichende Einheiten,
unplausible Werte und auch nachträglich neu gehashte Änderungen der freigegebenen
Beobachtungen schlagen fehl. Es gibt keinen Netzwerkzugriff beim Frontend-Build.

Mit Node 20 auf `PATH`, von `pipeline/`:

```sh
PYTHONPATH=. python3 src/data_pipelines/export_data/2026/waermepumpen/export.py
PYTHONPATH=. python3 src/data_pipelines/export_data/2026/waermepumpen/export.py --promote
PYTHONPATH=. python3 -m unittest discover -s tests -p 'test_waermepumpen_export.py' -v
```

Der erste Aufruf lädt höchstens fünf begrenzte Destatis-Antworten (je 30 Sekunden,
maximal 2 MB) in ignoriertes Staging. `--promote` lädt nichts nach, validiert den
Kandidaten vollständig, sichert vorhandene freigegebene Evidenz und ersetzt Dateien
einzeln atomar, Manifest zuletzt. Das ist keine atomare Verzeichnistransaktion;
ein unterbrochenes, gemischtes Paket muss fail-closed bleiben. Dann die vollständige
Sicherung aus `.data/output/waermepumpen/previous/` validieren und zurückspielen,
bevor eine erneute Promotion erfolgt. Kein Build darf gemischte Daten akzeptieren.
Ein zukünftiger Datenstand erfordert bewusste gemeinsame Aktualisierung von
Snapshotdatum, Beobachtungen, Lizenzprüfung, Validator, Tests und Artikel; kein
automatischer Refresh bereits veröffentlichter Blogdaten.

Prüfergebnis auf Node **20.20.2**, 5. November 2026:

- `npm test -- --runInBand`: **719 bestanden**, 19 bewusst übersprungen
  (normaler Lauf ohne den separat aktivierten SEO-Ausgabetest).
- `npm run lint`: bestanden.
- `npm run build`: bestanden; final wieder **`draft: true`**.
- `npm run test:seo-output`: **122 bestanden**, darunter keine Draft-HTML-Datei
  und keine Draft-Verweise in Feed, Suche, Sitemap oder `llms.txt`.
- Exporter: **4 Tests bestanden**, deterministische Ausgabe, Rundung,
  HTML-Extraktion und Erhalt des Frontend-Pakets bei Validierungsfehler.
- Temporäre lokale Vorschau mit `draft: false`: Desktop und Mobil visuell geprüft;
  beide Charts mit beschrifteten Achsen, Legenden und passenden Tabellen.
  Zusätzliche lokale Kopie ohne Skripte und mit `script-src 'none'`:
  Tabellen, Zahlen und Quellen weiterhin lesbar. Vorschau wieder auf Draft gesetzt,
  temporäre HTML-Ausgaben durch erfolgreichen finalen Build entfernt, Server beendet.
  Auch die gerenderte Vorschau bestand die SEO-Prüfung (130 Tests).
- Unabhängige Read-only-Gegenprüfung: Artikelwerte stimmen mit CSVs und generierten
  Serien überein; Rohantworten reproduzieren die drei CSVs, Hashes stimmen.
- Keine Buildänderung an `src/css/style.css` im finalen Diff; keine fremden Charts,
  alten Datensätze oder Deploymentdateien geändert.
- `npm ci` meldete **28 bestehende Audit-Befunde** (8 niedrig, 4 mittel, 14 hoch,
  2 kritisch). Kein Dependency-/Lockfile-Upgrade als Nebeneffekt dieses Artikel-PRs.

PR-Vorlagensuche unter `.github/`, Repository-Root und `docs/` ergab keine
eingecheckte Pull-Request-Vorlage. Beschreibung daher mit Zusammenfassung,
Quellen-/Lizenztabelle, Tests, offenen Punkten und `Tracker`-Verweis.
