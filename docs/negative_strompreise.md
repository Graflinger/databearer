# Negative Strompreise: Recherche und Lizenz-Gate

Topic-ID: `negative-strompreise` · Branch: `feature/negative-strompreise`

Draft-PR: [#58](https://github.com/Graflinger/databearer/pull/58) gegen `main`.

## Status und Aufgaben

**Lizenz-Gate für Energinet am 2026-11-05 bestanden.** Zwei Preisabrufe sind erfolgt;
das vollständige Intervallraster und die Aggregationen sind geprüft. Eingefrorenes
Evidenzpaket, vier Charts und Entwurfsartikel liegen vor; QA bestanden, Draft-PR #58 offen.
SMARD und die unten abgelehnten Preisalternativen werden nicht verwendet.
Kein Deployment autorisiert.

- [x] Branch nach `git fetch origin` auf `origin/main` korrigiert: `33c23ea`;
  `git rev-list --count origin/main..HEAD` ergab vor Änderungen 0.
- [x] Projektvorgaben, Stilvorbild und Historienvertrag gelesen.
- [x] Aktuelle Bedingungen von SMARD, MaStR und Energy-Charts direkt geprüft.
- [x] Begrenzte Alternativensuche anhand offizieller Bedingungen abgeschlossen;
  Lizenz-Gate für Energinet unter CC BY 4.0 am 2026-11-05 bestanden.
- [x] Energinet-Zeitreihen beschaffen; DE-Abdeckung, Gebotszone und Intervall-QA prüfen.
- [x] Kennzahlen, eingefrorenes Evidenzpaket und Charts erstellen.
- [x] Entwurfsartikel (`draft: true`), Tests und visuelle QA abschließen.
- [x] Commit, Push und Draft-PR gegen `main`; kein Merge und keine Promotion.
- [ ] Kartenbild und redaktionelle Freigabe durch den Nutzer.

## Lizenzprüfung (Abrufdatum aller folgenden Seiten: 2026-11-05)

Dies dokumentiert die öffentlich sichtbaren Bedingungen und eine konservative
Verwendungsentscheidung, keine abschließende juristische Bewertung. Die
Prüfung betrifft auch ein öffentliches Git-Repo und mögliche kommerzielle Nutzung
(unabhängig davon, ob AdSense momentan abgeschaltet ist).

### SMARD / Bundesnetzagentur: Großhandelspreise – nicht genutzt

- Herausgeberbedingungen: <https://www.smard.de/home/datennutzung>.
- Allgemeine Lizenz: **Creative Commons Namensnennung 4.0 International (CC BY 4.0)**
  für Marktdaten visualisieren / Daten herunterladen.
- Verlangter Namensnennungs-Wortlaut: **„Bundesnetzagentur | SMARD.de“**.
- Lizenztext: <https://creativecommons.org/licenses/by/4.0/legalcode.de>.
  Bei erfassten Daten sind Weitergabe, Bearbeitung und kommerzielle Nutzung erlaubt;
  Quelle, Lizenzlink, vorhandene Hinweise und Bearbeitungskennzeichnung erhalten.
  Abschnitt 4 erfasst Sui-generis-Datenbankrechte, aber nur soweit der Lizenzgeber
  die entsprechenden Rechte gewähren kann (Abschnitt 1 und 2).
- **Spezifischer Vorbehalt auf derselben Herausgeberseite:**
  „Wir überprüfen rechtliche Fragen zur Lizenzierung der Großhandelspreise derzeit
  umfassend im Rahmen des aktuellen Festlegungsverfahrens HEDWIG. Diese sollten
  daher bis auf weiteres nicht weiterverwendet werden.“
- Verlinktes Verfahren: <https://www.bundesnetzagentur.de/1067894>,
  „Festlegung zur Herausgabe von Energiemarktdaten zur Weitergabe und Information
  nach § 111g EnWG (HEDWIG)“. Die gelesene Verfahrensseite beschreibt eine
  Konsultation, keine hieraus folgende Freigabe der Preisweiterverwendung.
- Entscheidung: **keine neuen Preisabrufe, keine Übernahme lokaler Preisexporte,
  keine abgeleiteten Preisdatensätze für diesen Artikel**. Börsen-/Drittrechte
  sind gerade Gegenstand der offenen Prüfung. Auch Aggregate werden nicht als
  vermeintlicher Ausweg behandelt. Die allgemeine CC-Angabe genügt nicht für das Gate.
- Daraus folgt nicht, dass wirksam früher gewährte CC-Lizenzen widerrufen wären:
  CC BY 4.0 ist grundsätzlich unwiderruflich. Eine belastbare historische
  Rechtekette für die vorhandenen Preisexporte wurde hier jedoch nicht nachgewiesen.
- Andere SMARD-Daten (z. B. Erzeugung) werden durch den zitierten Hinweis nicht
  ausdrücklich ausgeschlossen; sie lösen das fehlende Preis-Evidenzproblem nicht.
  Es wurden auch davon keine Daten für diesen Artikel übernommen.

### Energy-Charts / Fraunhofer ISE: keine unabhängige Preisalternative

- Direkte API-Dokumentation: <https://api.energy-charts.info/> und deren dort
  verlinkte maschinenlesbare Spezifikation <https://api.energy-charts.info/openapi.json>.
  Gelesen wurden Metadaten und die Beschreibung von `/price`, keine Preisantwort.
- Allgemein nennt die Dokumentation **CC BY 4.0**, soweit nicht anders angegeben,
  mit Namensnennung **„Energy-Charts.info“**.
- Die spezifische `/price`-Beschreibung nennt für **DE-LU und DE-AT-LU** ausdrücklich
  **„Bundesnetzagentur | SMARD.de“**, **CC BY 4.0**, unveränderte Weitergabe.
  Sie liefert damit keine unabhängige Rechtekette gegenüber dem SMARD-Vorbehalt.
- Für die anderen, nicht als SMARD-lizenziert aufgeführten Preiszonen beschränkt
  dieselbe Beschreibung die Nutzung auf privat/intern und untersagt ausdrücklich
  externe oder kommerzielle Verwendung sowohl roher als auch abgeleiteter Daten.
  Als Ansprechpartner für Lizenzen werden Originalanbieter wie EPEX SPOT genannt.
- Entscheidung: **nicht genutzt**. Die SMARD-Preise über Energy-Charts abzurufen
  beseitigt den Konflikt nicht; andere Preiszonen sind weder sachlich noch lizenzseitig
  ein Ersatz. Rohdaten-/Aggregatweitergabe ins öffentliche Repo nicht freigegeben.
- Bei einer später belastbar erlaubten Verwendung wären Quellen-/Lizenzhinweise
  beider Beteiligten und eigene Bearbeitungen anzugeben; Datenbank-/Drittrechte
  bleiben durch den Umfang der tatsächlich eingeräumten Rechte begrenzt.

### Marktstammdatenregister: mit Auflagen verwendet

- Herausgeber-Datensatzseite: <https://www.marktstammdatenregister.de/MaStR/Datendownload>.
  Sie weist die XML-Gesamtdatenauszüge ausdrücklich mit **Datenlizenz Deutschland –
  Namensnennung – Version 2.0 (dl-de/by-2-0)** aus, einschließlich historischer Exporte.
- Verlinkte Bedingungen: <https://www.marktstammdatenregister.de/MaStR/Startseite/Impressum>.
  Dort werden XLS/CSV/Webdienst-Daten, falls nicht anders gekennzeichnet, ebenfalls
  unter diese Lizenz gestellt. Die allgemeine CC-BY-ND-3.0-DE-Angabe für sonstige
  Seiteninhalte ersetzt nicht die spezifische Datenlizenz der Downloadseite.
- Lizenztext: <https://www.govdata.de/dl-de/by-2-0>.
  Erlaubt ausdrücklich kommerzielle/nichtkommerzielle Vervielfältigung, Bearbeitung,
  Übermittlung an Dritte und Einbindung in öffentliche elektronische Netzwerke.
  Damit grundsätzlich auch öffentliches Git für die so lizenzierten Daten.
- Quellenvermerk muss Bereitsteller, Lizenzname/-link und Datensatz-URI nennen;
  Änderungen müssen gekennzeichnet sein. Kein zusätzlicher, exakter Sonderwortlaut
  für den Bereitsteller auf den geprüften Seiten gefunden. Vorgesehener Vermerk:
  **„Bundesnetzagentur, Marktstammdatenregister – Datenlizenz Deutschland –
  Namensnennung – Version 2.0; eigene Filterung und Aggregation“**, ergänzt um Links.
- Die breite Datennutzungserlaubnis deckt die bereitgestellten Daten/Metadaten ab;
  der Text enthält keine eigenständige Datenbankrechtsklausel wie CC BY 4.0.
  Keine pauschale Freigabe fremder Rechte oder personenbezogener Daten daraus ableiten.
  Abweichend gekennzeichnete Bestandteile ausschließen, Quellsystem nicht belasten.
  Für diesen Artikel nur geprüfte anonyme Batterieaggregate, keine Betreiber- oder
  Einheitsdaten veröffentlichen. Vorhandene Batterie-Dateien mit SMARD-Preisanteil
  nicht als rein MaStR-lizenziert übernehmen.
- Entscheidung: **mit Auflagen verwendet**. Nur die bereits eingefrorenen,
  hashgeprüften Inbetriebnahmejahrgänge 2019–2025 aus `battery_storage_yearly.csv`
  werden übernommen. Kein neuer Gesamtdownload, kein Preisprofil.

## Begrenzte Alternativensuche (Prüfstand: 2026-11-05)

Geprüft wurden die folgenden offiziellen Lizenz-/Datensatzseiten und die verlinkten
ENTSO-E-Rechtsdokumente. Das Ergebnis gilt für diesen Beschaffungsweg und ersetzt
keine vollständige Prüfung sämtlicher europäischer Preisangebote.

### ENTSO-E Transparency Platform: Day-Ahead-Preise nicht offen freigegeben

- Aktueller Rechtseinstieg:
  <https://transparencyplatform.zendesk.com/hc/en-us/articles/40921911218961-Legal-Terms-and-Conditions>.
- Dort neueste verlinkte **„List of Data available for free re-use“, 18.10.2023**:
  <https://transparencyplatform.zendesk.com/hc/article_attachments/40921869379729>.
  Ihre CC-BY-4.0-Freigabe gilt für die aufgeführten Datenarten; **Day-Ahead-Preise
  nach Artikel 12.1.d sind nicht enthalten**. Andere Preisarten in der Liste
  (z. B. Regelenergiepreise) erweitern den Umfang nicht auf Day-Ahead-Preise.
- Terms of Use:
  <https://transparencyplatform.zendesk.com/hc/article_attachments/40921869376401>.
  Ziffer 2.5 beschreibt ausdrücklich eine Teilmenge als Open Data. Ziffer 3.1 verlangt,
  Rechte der „Primary Owner of Data“ zu beachten und bei drohender Beeinträchtigung
  deren vorherige Zustimmung einzuholen; die Freigabeliste ist vor Wiederverwendung
  zu prüfen. Öffentliche Verfügbarkeit ist keine pauschale Weiterverteilungslizenz.
- Entscheidung: **nicht genutzt**; keine nachgewiesene offene Lizenz für die benötigte
  Preisreihe, auch nicht allein durch einen API-Zugang.

### EPEX SPOT und Nord Pool direkt: vertragliche Freigabe erforderlich

- EPEX SPOT: <https://www.epexspot.com/en/GCDataUse>.
  Die General Conditions unterscheiden Internal, External und Derived Usage.
  Ziffern 3.1/3.2 binden externe Veröffentlichung und abgeleitete Nutzung an den
  Umfang des Market Data Agreement. Website-Darstellung, öffentliche Weitergabe und
  kommerzielle Berichte sind External Usage; Aggregation ist keine pauschale Ausnahme.
  **Keine offene Lizenz gefunden; direkter Bezug nicht genutzt.**
- Nord Pool:
  <https://www.nordpoolgroup.com/en/About-us/terms-and-conditions-for-useofwebsite/>.
  Die Website-Bedingungen erlauben bestimmte interne Handels-/Analysezwecke,
  verlangen aber für Wiederveröffentlichung und Weiterverteilung eine ausdrückliche
  vorherige schriftliche Zustimmung. **Direkte Website-Daten nicht genutzt.**
  Diese Bedingungen gelten nicht automatisch für einen gesondert von Energinet
  lizenzierten Vertriebsweg (siehe Entscheidung unten).

### Ember: CC-Angabe, aber Rechtekette und Methodik ungeeignet

- Datensatz: <https://ember-energy.org/data/european-wholesale-electricity-price-data/>;
  Lizenzseite: <https://ember-energy.org/creative-commons/>.
- Ember stellt seine Inhalte allgemein unter **CC BY 4.0**. Die Preisdatensatzseite
  nennt ENTSO-E als Quelle (daneben EMR für UK und SEMOpx für Irland). Eine gesonderte
  Freigabe der hier relevanten, nicht in ENTSO-Es Freigabeliste enthaltenen Preise
  ist auf den geprüften Seiten nicht belegt; die Upstream-Rechtefrage bleibt offen.
- Zusätzlich werden fehlende Werte aus Nachbarwerten interpoliert und stündliche
  Durchschnittspreise bereitgestellt; bei mehreren Börsen bzw. 15-/60-Minuten-Angeboten
  beschreibt Ember eine Mittelung. Das eignet sich nicht zur exakten Zählung
  tatsächlich negativer Originalintervalle, ihrer Dauer oder untertägiger Minima.
- Entscheidung: **nicht genutzt**. Die CC-Angabe ist dokumentiert, aber weder eine
  geklärte spezifische Rechtekette noch die benötigte unverfälschte Intervallmethodik.

### Netztransparenz und RTE: keine offene Preisalternative

- Netztransparenz: <https://www.netztransparenz.de/de-de/Impressum>.
  Vervielfältigung von Seiten oder Inhalten erfordert vorherige schriftliche Zustimmung
  der deutschen Übertragungsnetzbetreiber, soweit nicht bereits gesetzlich gestattet.
  Eine offene Lizenz für die benötigte Preisweitergabe wurde nicht gefunden.
- Die [Spotmarktpreis-Seite nach § 3 Nr. 42a EEG](https://www.netztransparenz.de/de-de/Erneuerbare-Energien-und-Umlagen/EEG/Transparenzanforderungen/Marktprämie/Spotmarktpreis-nach-3-Nr-42a-EEG)
  beschreibt seit 2021 mengengewichtete Preise aller Strombörsen; davor EPEX-SPOT-
  Stundenkontrakte. Die EPEX-Daten werden ausdrücklich aus urheberrechtlichen Gründen
  nicht zum Download bereitgestellt. Ein Download neuerer Aggregate bedeutet für
  sich genommen keine offene Weiterverteilungslizenz. **Nicht genutzt.**
- RTE éCO2mix:
  <https://www.rte-france.com/donnees-publications/eco2mix-donnees-temps-reel/donnees-marche>.
  Die spezifischen Preisbedingungen erlauben nur nichtkommerzielle Ansicht;
  Download und Abruf über éCO2mix sind ausdrücklich untersagt. Weitere Nutzung,
  insbesondere Kopie/Verteilung für Dritte oder kommerzielle Nutzung, erfordert
  schriftliche Zustimmung der Rechteinhaber. **Nicht genutzt.**

### Energinet / Energi Data Service: Lizenz-Gate bestanden

- Herausgeberbedingungen: <https://www.energidataservice.dk/terms-and-conditions>.
  „Data published on Energi Data Service is subject to the conditions of Creative
  Commons CC-BY 4.0.“ Kopieren, Bearbeiten und Weiterverteilen sind ausdrücklich
  auch kommerziell erlaubt. Die Freigabe umfasst nach ihrem Wortlaut die dort
  veröffentlichten Daten; auf den geprüften Seiten keine spezifische Preisausnahme.
- Vorgeschlagener Quellenwortlaut: **„Source: Energinet (www.energidataservice.dk).“**
  Bei Veröffentlichung zusätzlich Datensatz- und
  [CC-BY-4.0-Lizenzlink](https://creativecommons.org/licenses/by/4.0/) angeben,
  vorhandene Hinweise erhalten und eigene Filterung/Aggregation bzw. Änderungen
  kennzeichnen. Keine Unterstützung oder Billigung durch Energinet suggerieren.
- Offizielle Metadaten:
  <https://api.energidataservice.dk/meta/dataset/DayAheadPrices>.
  `DayAheadPrices` beschreibt Day-Ahead-Preise im Nord-Pool-Markt einschließlich
  Deutschland, führt `PriceArea = DE`, EUR/MWh und **15 Minuten (PT15M)** auf und
  nennt als Datensatzbeginn **2025-10-01**. `TimeUTC` bezeichnet den Intervallbeginn.
- Vorgänger: <https://api.energidataservice.dk/meta/dataset/Elspotprices>.
  `Elspotprices` hat **Stundenauflösung (PT1H)**, führt ebenfalls `DE` und verweist
  für Daten nach 2025-09-30 auf `DayAheadPrices`. Beide Metadatensätze nennen
  `author: Energinet`; `caution` ist leer. Das ist kein eigenständiger Rechtsnachweis,
  enthält aber auch keinen datensatzspezifischen Gegenvorbehalt zur Herausgeberlizenz.
- **Entscheidung am 2026-11-05: Lizenz-Gate bestanden; Datenbeschaffung darf beginnen.**
  Grundlage ist die ausdrückliche CC-BY-4.0-Veröffentlichung durch Energinet,
  einschließlich Weitergabe im öffentlichen Repo und kommerzieller Nutzung.
  Ein vorgelagerter Vertrag zwischen Energinet und Nord Pool ist öffentlich nicht
  nachgewiesen. Das bleibt der übliche CC-Vorbehalt: Die Lizenz gewährt nur Rechte,
  die der Lizenzgeber einräumen kann, einschließlich erfasster Datenbankrechte;
  fremde Rechte werden nicht pauschal beseitigt und Gewähr wird nicht übernommen.
  Nord Pools direkte Website-Bedingungen werden jedoch nicht automatisch auf diese
  gesondert lizenzierte Energinet-Verteilung übertragen. Anders als bei SMARD liegt
  hier kein konkreter gegenteiliger Herausgeberhinweis vor, der das Gate blockiert.
- **Fachliche Eignung geprüft:** Das globale `dataFrom` des Vorgängers wurde nicht
  als DE-Abdeckungsbeginn verwendet. Die tatsächlichen DE-Antworten enthalten das
  vollständige Raster 2019-01-01 bis 2026-10-31 einschließlich Intervallwechsel.
  Gebotszonenzuordnung und verbleibende Provenienzgrenzen sind unten dokumentiert.

## Methodische Grenze der vorhandenen Historie

`docs/german_electricity_history.md` (Consumer rules) dokumentiert ausdrücklich:
Tagesmittel erlauben die Zählung negativer **Tagesmittel**, nicht negativer Stunden,
untertägiger Minima oder zusammenhängender Preisphasen. Auch die jüngste rollierende
Stundenansicht ist keine langfristige Viertelstundenhistorie. Energinet liefert die
benötigten Originalauflösungen; das tatsächliche DE-Raster wurde validiert.

Bei der Datenanalyse: negative Dauer als Summe tatsächlich negativer Intervalldauern,
nicht als Vorzeichen eines zuvor gebildeten Stundenmittels bestimmen. Den
Wechsel zum Viertelstunden-Day-Ahead am 1. Oktober 2025 belegen die Energinet-
Metadaten für ihren Datensatz sowie die unten verlinkte Marktmitteilung.
Stundenäquivalente, Auflösungsbruch, Europe/Berlin/DST und fehlende Werte
ausweisen. Fehlende Preisintervalle nicht interpolieren.
Keine kausale Speicherwirkung aus parallelen Trends ableiten; EEG-Regeln, Wetter,
Nachfrage und Marktbedingungen gesondert belegen. Negative Preise sind kein Maß
für Abregelung. 2026 nur mit belegtem Beobachtungsende und vergleichbaren Vorjahresfenstern.

## Datenvertrag, Reproduktion und Befunde

Das Evidenzpaket liegt in `frontend/src/data_ingestion/data/2026/negative_strompreise/`.
Sechs CSVs plus Manifest: vollständige Jahre 2019–2025 (7 Zeilen), Januar–Oktober
2024/2025/2026 (3), Monatswerte 2019-01–2026-10 (94), Q1–Q3 2024–2026 (9),
Q2-Tagesstundenprofil (24), Batterie-Inbetriebnahmejahrgänge (7). Der Validator
prüft alle Dateien, auch nicht direkt geplottete Werte; keine Live-Abhängigkeit.

Nur zwei Zeitreihenabrufe: `Elspotprices` (59.159 Stundenintervalle) und
`DayAheadPrices` (38.020 Viertelstundenintervalle), stets `PriceArea=DE`.
Zusammen **97.179 Intervalle**, **7.576.128 Antwortbytes**, keine fehlenden,
doppelten oder nullwertigen Intervalle, keine Interpolation. HTTP-URLs, tatsächliche
Abrufzeiten, Byteumfänge und SHA-256 der Rohantworten stehen im Manifest. Rohantworten
verbleiben ausschließlich im ignorierten `pipeline/.data/negative_strompreise/`.
Prüfsummen belegen Konsistenz der gespeicherten Antworten, keine unabhängige
Authentizitätsprüfung des Herausgebers. Keine Dashboard-Datei wurde konsumiert,
neu abgerufen oder überschrieben.

Energinet bezeichnet `DE` als deutsches Preis-/Gebotsgebiet. Die
[Nord-Pool-Marktmitteilung von 2019](https://www.nordpoolgroup.com/en/message-center-container/newsroom/exchange-message-list/2019/q3/nord-pool-first-to-offer-day-ahead-markets-across-europe/)
beschreibt das gemeinsame Gebiet Deutschland/Luxemburg. Für den gewählten Zeitraum
ab 2019 wird `DE` diesem Gebiet zugeordnet, nicht dem alten DE–AT–LU-Gebiet.
Die Energinet-Historie reicht vor Nord Pools eigenen CWE-Handelsstart zurück;
der vorgelagerte Lieferant dieser frühen Werte ist nicht unabhängig festgestellt.
Deshalb im Artikel **Energinet-Reihe**, nicht durchgehend „eigene Nord-Pool-Auktionen“.
Die [MTU-Mitteilung von Nord Pool](https://www.nordpoolgroup.com/en/trading/transition-to-15-minute-market-time-unit-mtu/)
nennt den Handelsstart der Viertelstundenkopplung am 30. September 2025; Energinets
Nachfolgedatensatz und die Lieferung beginnen am 1. Oktober. UTC-Intervallanfänge
werden für die Gruppierung nach Europe/Berlin umgerechnet; DST zählt reale Dauer.

Negative Zeit ist `sum(interval_hours where price < 0)`. Null ist unbekannt, null
Euro ist nicht negativ. Durchschnitt negativer Preise ist zeitgewichtet nur über
negative Intervalle. Längste Phase ist eine ununterbrochene UTC-Folge negativer
Intervalle; Nulls, Lücken und nichtnegative Preise unterbrechen sie, Periodengrenzen
schneiden sie ab. Aus Stundenmitteln rekonstruierte negative Viertelstunden sind
nicht zulässig. Die feinere Auflösung ab Oktober 2025 bleibt trotz Zeitnormierung
ein methodischer und marktlicher Bruch, insbesondere bei Extremwerten und Phasen.

Kernbefunde (Energinet, nicht SMARD): Q2 2025/2026 **345 / 251,5 h** negativ
(−27,10 %), Minimum **−250,32 / −499,99 EUR/MWh**, zeitgewichtetes Negativmittel
**−15,3156 / −29,3363 EUR/MWh**, längste negative Phase **10 / 17 h**.
Q3 **136 / 168,75 h** (+24,08 %). Januar–Oktober **574,75 / 465 h**;
die vollen Monate sind kalendergleich verglichen, kein Jahreshochrechnen.
Im Tagesfenster 13–14 Uhr in Q2: **65,9341 / 46,4286 %** negative Zeit.
MaStR-Kohorten 2019/2025: **0,459497598 / 6,768137764 GWh**, keine historischen
Gesamtbestände oder Nettozubauwerte. Bestands-/Überlebendenselektion, Registerfehler
und die vorhandenen Plausibilitätsfilter sind Grenzen des Batterievergleichs.

### Scouting geprüft, Abweichungen nicht verdeckt

- Die [BNetzA-Pressemitteilung](https://www.bundesnetzagentur.de/SharedDocs/Pressemitteilungen/DE/2026/20260105_Smard.html)
  datiert **5. Januar 2026**, nicht 4. Januar. Sie nennt tatsächlich 573/457 Stunden
  für 2025/2024. Diese Zahlen werden nicht in CSVs übernommen. Die Energinet-Reihe
  ergibt **574,75 / 459 Stundenäquivalente**. Unterschiedliche Quellreihen,
  Datenstände und Zählweisen sind auseinanderzuhalten; die genaue Zerlegung der
  Abweichung ist mangels lizenzgeklärter SMARD-Intervallverwendung nicht geprüft.
  Insbesondere die Differenz 2024 kann nicht durch die erst spätere Umstellung auf
  Viertelstunden erklärt werden. Keine Gleichheit behaupten und keine Werte angleichen.
- Der [SMARD-Q2-Artikel vom 3. August 2026](https://www.smard.de/page/home/topic-article/444/221002/erzeugung-und-verbrauch-leicht-gestiegen)
  nennt 1.006/1.380 Viertelstundeneinheiten und −500 EUR/MWh. Die **unabhängig aus
  Energinet** berechnete Dauer entspricht diesen Zeitäquivalenten, dessen Minimum
  beträgt aber −499,99 EUR/MWh. Es wurde kein SMARD-Rohpreisdatensatz übernommen.
  Die redaktionellen Seiten dienen hier nur der Prüfung des Handoffs, nicht als
  Lizenzgrundlage oder Quelle der Preis-CSV.

### Redaktionelle Quellen (keine zusätzlichen Datenreihen)

- [DWD-Sommerbilanz, 31. August 2026](https://www.dwd.de/DE/presse/pressemitteilungen/DE/2026/20260831_deutschlandwetter_sommer_news.html):
  bestätigt außergewöhnliche Hitze/Sonne als Kontext; im Artikel keine Wetterzahlen,
  Bilder oder Attributionsstudie übernommen. [Herausgeberbedingungen](https://www.dwd.de/DE/service/rechtliche_hinweise/rechtliche_hinweise_node.html)
  nennen **CC BY 4.0**; [Namensnennung](https://www.dwd.de/DE/service/rechtliche_hinweise/vorlagen_quellenangabe.html)
  **„Quelle: Deutscher Wetterdienst“**, eigene Zusammenfassung gekennzeichnet.
  Kommerzielle/öffentliche Weitergabe der erfassten Inhalte erlaubt; markierte
  Drittinhalte separat klären, kein pauschaler Rechtetransfer. Abruf 2026-11-05.
- [§ 51 EEG](https://www.gesetze-im-internet.de/eeg_2014/__51.html) und
  [§ 100 EEG](https://www.gesetze-im-internet.de/eeg_2014/__100.html), Abruf 2026-11-05:
  Förderungsausfall und Ausnahmen, Absatz 45 Stundenmittel für ältere Stundenregeln,
  Absatz 46 Bestandsregelung vor 25. Februar 2025. Gesetzestexte sind nach § 5 Abs. 1
  UrhG nicht urheberrechtlich geschützt, keine versionierte Datenlizenz.
  Eigene knappe Einordnung, keine individuelle Rechtsberatung oder Site-Kopie.

### Offline-Reproduktion

Aus `pipeline/`:

```sh
python3 src/data_pipelines/export_data/2026/negative_strompreise/export.py
python3 -m unittest discover -s tests -p 'test_negative_strompreise.py' -v
```

Das erste Kommando verwendet nur vorhandene, hashgeprüfte Rohantworten und schreibt
nach `.data/output/negative_strompreise/`. Ohne lokale Rohantworten fehlt bewusst
die vollständige numerische Reproduktion, nicht die Frontend-Buildfähigkeit.
`--fetch` ist ausschließlich für einen ausdrücklich gewollten Neuabruf, verweigert
das Überschreiben vorhandener Caches und muss mit erneutem Lizenzcheck, Review und
zusammenhängender Aktualisierung des ganzen Pakets verbunden werden. Keine neuen
Dependencies/dbt-Modelle nötig: begrenzte Intervallaggregation mit Python-Standardbibliothek.

Vor Übernahme `validateNegativeStrompreise(stageDirectory)` aus dem Frontend-Modul
aufrufen; anschließend nur manifestgelistete CSVs und zuletzt das Manifest übernehmen,
danach Zielpaket erneut validieren. Manifest-last ist keine atomare Verzeichnisoperation:
bei Unterbrechung nicht bauen/publizieren, sondern vollständiges Paket wiederherstellen.
Normaler Frontend-Build lädt keine externen Daten nach.

Die 12 Pipeline-Tests prüfen synthetische DST-/Null-/Phasenfälle, Lizenz-Gate,
Cache-Identität, Offline-Replay und ausschließlich MaStR-Kohorten. Zwei vollständige
Offline-Exporte waren byteidentisch. Frontend-Tests prüfen zusätzlich Dateimischung,
Korruption, Kalender, aggregierte Summen, Quellen und jeden statischen Tabellenwert
gegen die eingefrorenen Daten sowie die generierten Chartwerte.

## Fortsetzung / Auswirkungen außerhalb dieses Topics

### Abschlussprüfung am 2026-11-05

- Node **20.20.2**, `npm ci` aus bestehendem Lockfile, keine Dependencyänderung.
- `npm test -- --runInBand`: **794 bestanden**, 19 bestehende/bedingte Checks
  übersprungen (darunter der separat aktivierte Output-Test).
- `npm run lint`, `npm run build`: bestanden.
- `npm run test:seo-output`: **122 bestanden**, Artikel bleibt als Draft aus HTML,
  Feeds, Sitemap, Suche und `/llms.txt` ausgeschlossen.
- Zusätzlich temporäre lokale Vorschau mit `draft: false` gebaut: **130 Output-Checks
  bestanden**, einschließlich neuer Artikelseite. Mobile (390 px) und Desktop
  (1440 px) im Browser geprüft; Charts und scrollbare Tabellen dargestellt, keine
  gemeldeten Browserfehler. Statische Evidenz automatisiert ohne Skriptausführung
  gegen CSVs geprüft; keine gesonderte Browser-Einstellung für deaktiviertes JS.
- Anschließend `draft: true` wiederhergestellt und volle Checks wiederholt;
  Vorschau-HTML durch normalen erfolgreichen Build entfernt.
- Unabhängiger Read-only-Review berechnete Kennzahlen erneut aus allen Rohintervallen;
  keine fachlichen Blocker für einen Draft-PR. Veralteten MaStR-Änderungshinweis korrigiert.

Noch ausstehend: Review des Draft-PR, redaktionelle Nutzerfreigabe und Kartenbild.
Keine Kontaktaufnahme ohne Auftrag. Keine PR-Vorlage im Repository gefunden.

Der SMARD-Vorbehalt betrifft potenziell auch bestehende Preisverwendungen im Repo.
Diese wurden **nicht geändert**; eine gesonderte Rechteprüfung bestehender Inhalte
und Dashboard-Exporte ist offen. Keine Aussage über deren rückwirkende Unzulässigkeit.
