# Gasimporte und Abhängigkeit

Topic: `gas-importabhaengigkeit`. Artikel bleibt bis zur Freigabe `draft: true`.

## Lizenz-Gate (vor Datenübernahme geprüft, 2026-11-05)

Primärbedingungen direkt beim Herausgeber:

- [Eurostat: Copyright notice and free re-use of data](https://ec.europa.eu/eurostat/web/main/help/copyright-notice), abgerufen 2026-11-05.
- [EU-Kommission: Legal notice](https://commission.europa.eu/legal-notice_en), abgerufen 2026-11-05.
- Rechtsgrundlage: [Beschluss 2011/833/EU vom 12. Dezember 2011](https://eur-lex.europa.eu/eli/dec/2011/833/oj). EUR-Lex liefert im Text-Fetch keinen auslesbaren Inhalt; die aktuelle Eurostat-Seite nennt und erläutert die Grundlage ausdrücklich.

| Quelle / geplanter Umfang | Lizenzname und Version | Befund |
| --- | --- | --- |
| Eurostat `nrg_ind_id`, Deutschland und EU-27, Jahresindikatoren | Eurostat free re-use policy, Beschluss 2011/833/EU (keine separate nummerierte Datenlizenz) | Genutzt, mit Auflagen; kommerzielle und nichtkommerzielle Weiterverbreitung einschließlich abgeleiteter CSVs im öffentlichen Repo erlaubt. |
| Eurostat `nrg_ti_gas`, nur Deutschland als meldendes Gebiet | Dieselbe Eurostat-Weiterverwendungsregel | Genutzt, mit Auflagen; Partner sind keine meldenden Drittstaaten. Keine Übernahme von US-/russischen Eigenmeldungen. |
| Eurostat `nrg_cb_gasm`, nur Deutschland und EU-27 | Dieselbe Eurostat-Weiterverwendungsregel | Genutzt, mit Auflagen; statistische Aggregate, keine personenbezogenen Daten. |
| Eurostat Statistics Explained: Natural gas supply statistics (Text/Methoden) | EU-eigener redaktioneller Inhalt: CC BY 4.0 International; zusätzlich Eurostat-Hinweise | Eigene Zusammenfassung mit Beleg; keine Übersetzung der Publikation, keine Übernahme fremder Bilder. |
| GIE AGSI+/ALSI, Bruegel, BNetzA-Gasdaten, AG Energiebilanzen, BMWK-FAQ | Für diesen Entwurf nicht freigegeben / nicht benötigt | Keine Datenübernahme. Kein AGSI-Speicherstand, keine unbestätigte 55-%-Zahl. Nicht als generell unzulässig bewertet. |

### Auflagen und Abgrenzung

- Eurostat unterscheidet **CC BY 4.0 für redaktionelle Inhalte** von seiner ausdrücklichen Weiterverwendungserlaubnis für statistische Daten. Die CSVs werden deshalb nicht pauschal als CC BY 4.0 umetikettiert.
- Geforderte Datensatz-Zitation laut Herausgeber: `Source: [digital object identifier (DOI) number of the Eurostat dataset], [access date]`; für angepasste Auszüge: `Source: [Eurostat dataset datacode link], [access date]`. Umsetzung: `Quelle: Eurostat, <Datensatzcode mit Link>, Abruf 05.11.2026. © Europäische Union.`
- Bearbeitungshinweis auf jeder Grafik und am Datensatz: `Eigene Auswahl, Umrechnung und Darstellung. Eurostat ist für diese Bearbeitung nicht verantwortlich.`
- Für Textprodukte: `Source: Eurostat, [Title of the product], [link to the product], [access date]`. Es wird ein eigener Artikel verfasst, keine Übersetzung; die gesonderte Übersetzungsformel ist daher nicht einschlägig.
- AdSense kann wieder eingeschaltet werden: Prüfung erfolgt ausdrücklich **für kommerzielle Nutzung**, nicht aufgrund des aktuellen Werbeschalters.
- Datenbankrechte: Die Herausgeberregel erlaubt Download und Weiterverwendung statistischer Daten ausdrücklich auch kommerziell, damit die hier vorgenommene Extraktion und Weiterverbreitung. Keine Rechtefreiheit oder pauschale Aufgabe sämtlicher Datenbankrechte behauptet; Hinweis und Herkunft bleiben im Manifest erhalten.
- Ausgenommen bleiben gekennzeichnete Drittinhalte, Logos/Marken, gemeinsame Publikationen mit abweichendem Copyright und einzelne restriktive Datensatzhinweise. Eurostat behandelt veröffentlichte Daten mangels ausdrücklicher Ausnahme als Eurostat-Daten. Bei einem abweichenden Hinweis wird der betroffene Auszug verworfen.
- Nicht-EU-/EFTA-/Beitritts-/Kandidatenländer als **meldende** Länder werden nicht exportiert. Deutschlands bzw. der EU Angaben über Handel mit einem Drittland sind keine Eigenmeldungen dieses Drittlands. Die Eurostat-Seite erläutert diese Melder-/Partner-Unterscheidung ausdrücklich am Schweizer Beispiel.
- Spezielle Handelsausnahmen (Schweiz/Liechtenstein als Melder, bestimmte Warenklassifikationen; Österreich als Melder auf KN-8-Ebene) treffen die ausgewählten DE-/EU-Energiereihen nach SIEC nicht.
- Rohantworten bleiben unter ignoriertem `.data/`; veröffentlicht werden nur geprüfte, kompakte Aggregate und Provenienz. Es werden weder API-Schlüssel noch Zugangsdaten benötigt.

## Quellen- und Methodenprüfung

Eurostat [Natural gas supply statistics](https://ec.europa.eu/eurostat/statistics-explained/index.php?title=Natural_gas_supply_statistics&oldid=711429), Stand Juni 2026, am 2026-11-05 direkt geprüft: Die Scouting-Zahlen 87,6 % und +21,0 % beziehen sich auf **kumulierte Monatsdaten 2025**, nicht automatisch auf `nrg_ind_id` oder die jährliche Herkunftsstatistik. Die aktuellen Rohdaten werden separat dagegen geprüft.

Seit Januar 2013 erfassen monatliche Gas-Handelsreihen Eintritte aus dem letzten Transitland einschließlich durchgeleitetem Gas; jährliche Reihen erfassen laut Eurostat den letztlichen Ursprung und schließen Transit aus. Daher keine unmarkierte Verkettung der Reihen und kein Schluss von Grenzland auf Förderland.

Die [Eurostat-Metadaten zu Energieprodukten](https://ec.europa.eu/eurostat/cache/metadata/en/nrg_prd_esms.htm), Abschnitt 6.2, bestätigen für diese Energiedaten ausdrücklich „free re-use, both for non-commercial and commercial purposes“. In den API-Annotationen wird Eurostat als Quelle genannt; kein abweichender Rechtehinweis. Der dort verlinkte Informationshinweis vom 17. September 2026 (Anhang aktualisiert 14. Oktober) betrifft die Navigation/Umbenennung der Energiedatensätze, nicht eine neue Lizenz. Die drei genutzten Datensatzcodes bleiben erhalten. `nrg_ind_idogas` und `nrg_cb_gas` werden nicht benötigt und nicht exportiert.

[Indikatormetadaten](https://ec.europa.eu/eurostat/cache/metadata/en/nrg_ind_id_esmsip2.htm): Nettoimporte / Bruttoenergieverfügbarkeit. Nationale Werte enthalten Intra-EU-Handel; im EU-Saldo fällt er grundsätzlich weg, abgesehen von Meldeasymmetrien. Kernenergie zählt definitionsgemäß als inländisch unabhängig vom Brennstoffursprung. Die Gesamtquote ist deshalb keine Messung sämtlicher Rohstoff-/Technologieabhängigkeiten. Eurostat versieht den Indikator nicht mit Flags; er ist nicht dynamisch mit den Quellbilanzen verknüpft, Revisionen werden nicht sofort übernommen.

### Verifizierte Befunde und abgelehnte Gleichsetzungen

| Befund | Rechnung / eingefrorene Evidenz |
| --- | --- |
| Deutsche Gasquote 2024 91,6 %, 2021 90,7 % | `nrg_ind_id`, G3000, PC, DE: 91.578 bzw. 90.686. Anstieg 0.892 Prozentpunkte, kein Rückgang gegenüber 2021. |
| EU-Gasquote 2024 85,0 % | `nrg_ind_id`, EU27_2020: 84.981. Konstante heutige EU-27-Abgrenzung auch historisch. |
| DE Öl 96,9 %, feste fossile Brennstoffe 44,9 %, insgesamt 66,8 % (2024) | SIEC O4000XBIO: 96.941; C0000X0350-0370: 44.866; TOTAL: 66.812. Öl ohne Bioanteil; Kohlegruppe nicht mit Steinkohle allein gleichsetzen. |
| Gemeldetes Russland 2021 600,5 TWh, 2024 0 | `nrg_ti_gas`: 2,161,622.681 TJ / 3600; 2024 explizite veröffentlichte Null. Kein Schluss auf alle indirekten Lieferketten. |
| LNG 2024 59,9 TWh, 7,8 % der jährlichen Gasimporte, davon 84,0 % USA | 215,700.067 / 3600; 215,700.067 / 2,762,678.208 × 100; 181,188.056 / 215,700.067 × 100. G3200 ist Teilmenge von G3000, nicht addieren. |
| Bruttoimporte DE 2025 +21,0 %, netto nur +0,7 % | Je 12 Monatswerte IMP/EXP in TJ_GCV summiert; 3,843,073.541 / 3,175,657.203 − 1 = 21.0166 %. Netto: 2,782,994.109 / 2,764,379.578 − 1 = 0.6734 %. |
| 97,2 % des Importzuwachses steht Exportzuwachs gegenüber | (1,060,079.432 − 411,277.625) / (3,843,073.541 − 3,175,657.203). Rein rechnerische Saldozerlegung, kein Nachweis der Weiterleitung bestimmter Moleküle. |
| Beobachteter DE-Verbrauch +3,4 %; Netto-Speicherentnahme 55,0 TWh 2025 | IC_OBS: 3,114,236.512 / 3,013,048.578 − 1; STK_CHG_MG: −198,097 TJ / 3600. Negative MOS-GAS-Bestandsänderung = Abbau. Kein Füllstand. |
| EU 2025 87,6 % aus Monatsdaten bestätigt | (18,521,668.280 − 7,054,243.332) / 13,093,254.201 × 100 = 87.5827 %. Nenner IC_OBS, nicht IC_CAL_MG; mit letzterem wären es 87,4 %. |

Der Juni-Artikel nennt für EU IC_OBS 2025 noch 13,093,256 TJ; der Abruf vom November enthält 13,093,254.201 TJ. Der minimale Revisionsunterschied ändert die gerundete Quote nicht. Ein solches Monatsergebnis ist nicht der Jahresindikator `nrg_ind_id`. Die deutsche Monatsquote 2025 wäre 89,4 %, wird aber nicht als Fortschreibung des Jahresindikators verwendet.

**Partnergrenze:** Die Jahresquelle ist dem Anspruch nach eine Herkunftsstatistik, enthält in den deutschen Meldungen aber seit 2023 große Posten unter BE/NL. Eine lückenlose Förderland-Zuordnung ist damit nicht nachgewiesen. 2021 sind 464,428.539 TJ nicht spezifiziert, 2024 105,074.660 TJ. Frankreich wird für den Chart mit NSP zum Rest zusammengefasst; die Unterstützungstabelle erhält beide separat. Der Artikel nennt ausdrücklich „gemeldete Partner“, keine Förderland-Rangliste und keinen Diversifizierungsindex. Die 2021 implizite Russlandquote dieser Reihe ist rund 66,4 % und ist **nicht** die ungeprüfte BMWK-55-%-Aussage. Unterschiedliche Abgrenzungen dürfen nicht stillschweigend gleichgesetzt werden; die 55 % werden deshalb nicht übernommen. Ein genaues Datum des Pipeline-Lieferstopps und ein Speicherfüllstand November 2026 werden ohne zusätzliche benötigte Quelle ebenfalls nicht behauptet.

## Eingefrorenes Datenpaket

Pfad: `frontend/src/data_ingestion/data/2026/gas_importe/`.

| Datei | Grain / Schlüssel | Umfang |
| --- | --- | --- |
| `dependency.csv` | Jahr, fünf ausgewählte Indikatorreihen in Prozent | 35 Jahre, 1990–2024 |
| `partners.csv` | Jahr, DE, gemeldete Partner und LNG-Teilmengen, TJ_GCV | 4 Jahre, 2021–2024 |
| `partner_comparison.csv` | Partnergruppe, Vergleich 2021/2024, TWh_GCV | 6 Gruppen; vollständig mit Summe abgestimmt |
| `monthly.csv` | Geo × Monat, sechs Bilanzpositionen, TJ_GCV | 48 Zeilen, DE und EU27_2020, 2024–2025 |
| `balance_de.csv` | DE × Kalenderjahr, aus 12 Monatswerten, TWh_GCV | 2 Zeilen; Import, Export, Netto, Förderung, Verbrauch, Speicheränderung |
| `quality.json` | Monats-Summen je Geo/Jahr, Flags, Reconciliation | keine imputierten Werte, keine Quellflags im verwendeten Abruf |
| `manifest.json` | Herkunft, URLs, Lizenzen, Zeitfenster, Einheiten, Exporter, Hashes | SHA-256, Bytes, Zeilenzahl und Spaltenvertrag für jedes Payload |

API-Datenstände: `nrg_ind_id` 2026-07-16; `nrg_ti_gas` 2026-10-09; `nrg_cb_gasm` 2026-11-03. Tatsächliche Downloads: **2026-11-05 19:42:45–19:42:47 UTC**, mit Einzelzeitstempeln und SHA-256 der unveränderten JSON-Antworten im Manifest. Rohantworten und Receipts bleiben unter `pipeline/.data/gas_importe/frozen/` und werden nicht eingecheckt. Die früheren explorativen Abrufe unter `.data/gas_importe/` sind nicht die Exportquelle.

UTF-8, LF, feste Reihenfolge, Zahlen mit sechs Dezimalstellen; Ganzjahre/-monate gemäß Quellenkalender, keine Zeitzonenverschiebung. Fehlende/ungültige Pflichtzellen führen zum Abbruch, nie zu Null. Ausgelassene Partner müssen explizite veröffentlichte Nullen sein. Quelleinheiten sind TJ auf **Brennwertbasis**, keine Heizwerte; 1 TWh = 3600 TJ. Prozentquoten sind keine Energieanteile am Gesamtmix und werden nicht auf 100 begrenzt.

### Reproduktion und bewusste Aktualisierung

Die Quelle liefert bereits amtliche Aggregate. Der begrenzte Python-Exporter wählt, prüft und pivotiert diese direkt; eine persistente DuckDB oder zusätzliche dbt-Modelle wären hier kein notwendiger Transformationsschritt. Er wird ausschließlich manuell gestartet, niemals vom Frontend-Build.

Aus `pipeline/` (Node 20 für die anschließende Frontend-Validierung):

```sh
# Erster Bezug: leeres Rohverzeichnis und leeres Stagingziel erforderlich.
PYTHONPATH=. python3 src/data_pipelines/export_data/2026/gas_importe/export_gas_importe.py --fetch

# Offline-Reproduktion derselben Downloads in ein neues leeres Verzeichnis.
PYTHONPATH=. python3 src/data_pipelines/export_data/2026/gas_importe/export_gas_importe.py \
  --raw-dir .data/gas_importe/frozen --output .data/output/gas_importe-replay
```

Es gibt drei feste, zeitlich/räumlich begrenzte Requests, je maximal 5 MB und 90 Sekunden; keine Schlüssel oder Zugangsdaten. Ein neuer Abruf verlangt neue leere Zielverzeichnisse. Vor einem späteren Datenupdate Lizenzen, Metadaten, Vergleichbarkeit und alle Artikelzahlen neu prüfen. Die jetzige Build-Validierung pinnt Abrufdatum/Fenster/Datenstände bewusst; Refresh nur als gemeinsames Update von Export, Manifest, Validator, Tests, Charts und Artikel.

Aus `frontend/` vor Übernahme:

```sh
node -e "require('./src/data_ingestion/utils/gasImporteValidation').validateGasImporte('../pipeline/.data/output/gas_importe')"
```

Erst nach erfolgreicher Prüfung alle Payloads ins Artikelverzeichnis übernehmen und das Manifest **zuletzt** ersetzen. Anschließend dort erneut validieren. Das ist keine atomare Verzeichnistransaktion: Ein unterbrochener/mischalter Stand muss im Build scheitern; vor Änderungen am bestehenden Paket eine lokale Kopie behalten. Hashes beweisen Paketkonsistenz, keine unabhängige Quellenauthentizität.

## Frontend und QA

Artikel: `frontend/src/posts/2026/gasimporte-abhaengigkeit.md`; vier Charts in `charts/gas_importe.js`, generierte Skripte unter `src/js/charts/gas_importe/`. Jeder Chart hat eine beschreibende Überschrift, zugängliche Beschreibung, 2–6 statische Tabellenzeilen und Lizenz-/Bearbeitungshinweis. Beide internen Links sind bestehende veröffentlichte Routen.

Die Partnerbeschriftungen wurden im mobilen Preview zunächst automatisch ausgedünnt. Die optionale Bar-Builder-Einstellung `rotateXAxisLabels: true` zeigt alle sechs Labels bei 45° und reserviert 30 % unteren Abstand. Andere Konfigurationen behalten ihre bisherige Ausgabe.

Build-Time-Prüfung: exakte Dateiliste, reguläre Dateien statt Symlinks, Hashes/Bytes, CSV-Spalten und Zeilen, Kalender/Schlüssel, finite Zahlen, Lizenz-Gate, Partner- und LNG-Summen, Einheitenumrechnung, monatliche Vollständigkeit, Salden, Nenner und deutscher Speicherbilanz-Zusammenhang. Fokussierte Tests prüfen absichtlich auch manipulierte Pakete nach passender Hash-Anpassung, nicht nur Hashfehler, sowie alle Tabellen gegen die Chartdaten.

### Abschlussprüfung am 5. November 2026

- Node 20.20.2; `npm test -- --runInBand`: 28 Suites / 691 Tests bestanden, 19 Output-Tests im normalen Modus erwartungsgemäß übersprungen.
- `npm run lint` und `npm run build`: bestanden.
- `npm run test:seo-output`: 122 Tests bestanden im finalen Draft-Build; Entwurf fehlt in HTML, Sitemap, Feeds, Suche und llms.txt. Zuvor bestand auch die temporäre lokale Vorschau inklusive Artikelroute die Output-Prüfung (130 Tests).
- Vier Charts visuell geprüft: Desktop (1440 px) und mobile Darstellung (390 px), darunter die korrigierten vollständigen Partnerlabels. Statische HTML-Tabellen ohne Skriptausführung gegen CSVs geprüft. Browser meldete bei den geprüften Ansichten keine Fehler; die lokalen Chart-Assets wurden mit HTTP 200 geladen.
- Offline-Reproduktion aus denselben Rohantworten: alle sechs Payloads byte-identisch; lediglich Manifest-Erstellungszeitpunkt ist laufabhängig.
- `draft: true` nach lokaler Vorschau wiederhergestellt. Kein Kartenbild erzeugt. Keine beiläufige CSS-Änderung und keine Änderungen an bestehenden generierten Charts im Commit.
- PR-Vorlage im Repository gesucht: keine gefunden. PR erhält Zusammenfassung, Lizenzbefund pro Quelle, Prüfungen, offene Punkte und `Tracker: gas-importabhaengigkeit`.

## Offene redaktionelle Punkte

- Kartenbild bewusst nicht erzeugt; Bildauswahl und Nutzungsrechte vor Veröffentlichung klären.
- Nutzerfreigabe und Publikationsdatum vor Entfernung von `draft: true`.
