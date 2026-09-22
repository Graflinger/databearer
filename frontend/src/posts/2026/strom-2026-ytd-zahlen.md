---
title: "Strom 2026 bisher: Solar und Wind an Land liegen fast gleichauf"
date: 2026-09-11
lastUpdated: 2026-09-14
excerpt: "Solar und Wind an Land liegen 2026 fast gleichauf. Bis 9. September steigen Erzeugung und Erneuerbarenanteil gegenüber 2025 – aber auch der Börsenpreis."
image: "/images/blog_card_images/2026/strom-ytd-2026.png"
imageText: "KI-generiertes Symbolbild: Solarpark und Windräder in einer weiten Landschaft."
fullWidthCard: false
topic: ["energie"]
---
<script src="/js/lib/echarts.min.js"></script>

## Mehr Strom, mehr Erneuerbare

Die öffentliche Stromerzeugung legt 2026 deutlich zu. Vom **1. Januar bis 9. September** wurden in Deutschland **317,0 Terawattstunden** Strom erzeugt, **7,2 Prozent mehr** als im gleichen Zeitraum 2025. Fast der gesamte Zuwachs kommt von den Erneuerbaren. Ihr Anteil steigt von **59,4 auf 61,7 Prozent**.

An der Spitze liegen zwei Energieträger fast gleichauf: **Wind an Land mit 72,3 TWh und Solar mit 70,5 TWh**. Wind auf See kommt zusätzlich auf 19,2 TWh. Die gesamte Windkraft liegt damit weiterhin klar vor Solar. Beim Börsenpreis sieht es weniger erfreulich aus: Er steigt gegenüber dem Vorjahreszeitraum um **17,0 Prozent**.

Alle folgenden Vergleiche betrachten jeweils **1. Januar bis einschließlich 9. September**. Kein vollständiges Vorjahr gegen ein laufendes Jahr, keine Hochrechnung.

<div class="chart-section comparison-section">
  <h3>2025 → 2026 im direkten Vergleich</h3>
  <p class="chart-description">Jeweils 1. Januar bis 9. September. Erzeugung, Erneuerbarenanteil und Börsenpreis steigen.</p>

{% comparisonChart "strom_ytd_2026", "strom-ytd-2026-comparison" %}

  <div class="chart-sources"><strong>Quelle: </strong><a href="https://www.smard.de/home/marktdaten">Bundesnetzagentur / SMARD.de</a>, eingefrorene Tageshistorie, eigene Auswertung. Veränderungen aus ungerundeten Werten berechnet; deshalb ergeben die gerundeten Anteilswerte nicht exakt die ausgewiesenen +2,2 Prozentpunkte.</div>
</div>

Öffentliche Nettoerzeugung umfasst hier auch Pumpspeicher, aber keinen PV-Eigenverbrauch. Der Erneuerbarenanteil bezieht sich auf diese Erzeugung, nicht auf den Bruttostromverbrauch. Netzlast und Erzeugung haben unterschiedliche Abgrenzungen; ihre Differenz ist kein Maß für den kommerziellen Stromhandel.

## Solar bleibt Wind an Land dicht auf den Fersen

Wind an Land steigt von **62,8 auf 72,3 TWh**, Solar von **62,2 auf 70,5 TWh**. Beide wachsen also kräftig. Der Abstand ist trotzdem klein: Gerade einmal **1,8 TWh** trennen die beiden größten Einzelquellen im laufenden Jahr.

<div class="chart-section">
  <h3>Wind an Land und Solar: gleicher Zeitraum, mehr Erzeugung</h3>
  <p class="chart-description">Beide Energieträger legen gegenüber 2025 zu. Gezeigt wird jeweils die öffentliche Erzeugung vom 1. Januar bis 9. September in TWh.</p>
  <div id="strom-ytd-2026-mix" style="width: 100%; height: 400px;"></div>
  <script src="/js/charts/strom_ytd_2026/mix.js"></script>
  <div class="chart-sources"><strong>Quelle: </strong><a href="https://www.smard.de/home/marktdaten">Bundesnetzagentur / SMARD.de</a>, eingefrorene Tageshistorie, eigene Auswertung.</div>
</div>

Der übrige Mix zeigt, warum ein höherer Erneuerbarenanteil noch keinen durchgehenden Rückgang fossiler Erzeugung bedeutet. Braunkohle liefert weniger Strom, Erdgas und Steinkohle dagegen mehr. Insgesamt wächst die Erzeugung schneller als die Netzlast.

<details class="post-data-details">
<summary>Alle Energieträger im Vergleich: jeweils 1. Januar bis 9. September, TWh</summary>

| Energieträger | 2025 | 2026 |
| --- | ---: | ---: |
| Wind an Land | 62,8 | 72,3 |
| Solar | 62,2 | 70,5 |
| Braunkohle | 46,2 | 44,1 |
| Erdgas | 37,6 | 38,7 |
| Biomasse | 24,6 | 24,1 |
| Steinkohle | 19,4 | 21,0 |
| Wind auf See | 15,2 | 19,2 |
| Sonstige Konventionelle | 9,5 | 10,5 |
| Wasserkraft | 10,2 | 8,8 |
| Pumpspeicher | 7,2 | 7,1 |
| Sonstige Erneuerbare | 0,7 | 0,6 |
| Kernenergie | 0,0 | 0,0 |

Quelle: Bundesnetzagentur / SMARD.de, eigene Auswertung. Rundungsdifferenzen zur Summe möglich. Pumpspeicher sind Speicher, keine erneuerbare Primärenergiequelle.

</details>

Die [starken Windkraftausschreibungen 2026](/posts/2026/Windkraftausschreibungen-2026/) zeigen, was künftig hinzukommen kann. Wie viel Strom heute tatsächlich eingespeist wird, hängt neben den bereits installierten Anlagen aber auch vom Wetter ab. Die Erzeugungszahlen allein trennen diese beiden Effekte nicht.

## Der Erneuerbarenanteil steigt – mit Rückschlägen

2019 kamen die Erneuerbaren im gleichen Kalenderfenster auf **43,5 Prozent**, 2026 sind es **61,7 Prozent**. Das ist ein deutlicher Fortschritt. Gleichmäßig verlief er nicht: 2021 fiel der Anteil gegenüber 2020, 2025 lag er unter 2024. Jetzt steigt er wieder.

<div class="chart-section">
  <h3>Erneuerbarenanteil seit 2019</h3>
  <p class="chart-description">2026 liegt der Anteil höher als in allen sieben Vergleichsjahren. Jeder Punkt umfasst nur den Zeitraum 1. Januar bis 9. September, keine Jahresbilanz.</p>
  <div id="strom-ytd-2026-renewable-share" style="width: 100%; height: 400px;"></div>
  <script src="/js/charts/strom_ytd_2026/renewable-share.js"></script>
  <div class="chart-sources"><strong>Quelle: </strong><a href="https://www.smard.de/home/marktdaten">Bundesnetzagentur / SMARD.de</a>, erneuerbare Erzeugung geteilt durch gesamte öffentliche Erzeugung.</div>
</div>

**Mehr als drei Fünftel der öffentlichen Erzeugung sind inzwischen erneuerbar.** Das ist die belastbare Zwischenbilanz. Wer am Jahresende vorne liegt, ist damit noch nicht entschieden: Der windreiche Herbst und Winter stehen noch aus, während ein großer Teil der Solarsaison bereits vorbei ist.

## Strompreise: höher als 2025, weit unter 2022

Der zeitgewichtete Day-Ahead-Preis liegt 2026 bisher bei **103,92 €/MWh**. Im gleichen Zeitraum 2025 waren es **88,84 €/MWh**. Das sind **15,08 €/MWh mehr**, also **17,0 Prozent**.

Der längere Vergleich zeigt aber keinen ungebremsten Preisanstieg. Nach **38,22 €/MWh** im Jahr 2019 fiel der Preis im Vergleichszeitraum 2020 zunächst auf **26,25 €/MWh**. 2022 folgte der Sprung auf **243,53 €/MWh**. Danach ging es zwei Jahre deutlich abwärts, bis auf **70,32 €/MWh** im Jahr 2024. Erst 2025 und 2026 steigen die Werte wieder.

<div class="chart-section">
  <h3>Day-Ahead-Preis im gleichen Kalenderfenster</h3>
  <p class="chart-description">2026 ist teurer als 2025, bleibt aber weit unter dem Krisenniveau 2022. Zeitgewichteter Preis vom 1. Januar bis 9. September, nominal in €/MWh.</p>
  <div id="strom-ytd-2026-price" style="width: 100%; height: 400px;"></div>
  <script src="/js/charts/strom_ytd_2026/price.js"></script>
  <div class="chart-sources"><strong>Quelle: </strong><a href="https://www.smard.de/home/marktdaten">Bundesnetzagentur / SMARD.de</a>, Tagesmittel mit der jeweiligen Tageslänge gewichtet; Marktgebiet Deutschland/Luxemburg.</div>
</div>

<details class="post-data-details">
<summary>Historische Vergleichswerte: jeweils 1. Januar bis 9. September</summary>

| Jahr | Erzeugung (TWh) | Erneuerbarenanteil (%) | Preis (€/MWh) |
| --- | ---: | ---: | ---: |
| 2019 | 356,1 | 43,5 | 38,22 |
| 2020 | 338,0 | 49,5 | 26,25 |
| 2021 | 344,9 | 43,5 | 63,85 |
| 2022 | 350,0 | 47,7 | 243,53 |
| 2023 | 308,1 | 55,1 | 99,43 |
| 2024 | 300,3 | 60,6 | 70,32 |
| 2025 | 295,6 | 59,4 | 88,84 |
| 2026 | 317,0 | 61,7 | 103,92 |

Quelle: Bundesnetzagentur / SMARD.de, eigene Auswertung. In den Schaltjahren 2020 und 2024 ist der 29. Februar enthalten.

</details>

## Warum mehr Erneuerbare nicht automatisch einen niedrigeren Durchschnittspreis bedeuten

Entscheidend ist nicht nur, wie viel Strom über Monate erzeugt wird, sondern **wann welche Kraftwerke gebraucht werden**. Im Day-Ahead-Handel wird Strom für den nächsten Tag gehandelt. Nach dem [Merit-Order-Prinzip](https://www.smard.de/page/home/wiki-article/446/384/so-funktioniert-der-strommarkt) bestimmt das letzte noch benötigte Angebot den Marktpreis. Wird ein teures Gaskraftwerk gebraucht, kann es den Preis setzen, obwohl Wind und Solar über das Jahr viel Strom liefern.

**2022 schlug die Gaskrise auf den Strompreis durch.** Im [SMARD-Rückblick auf 2022](https://www.smard.de/page/home/topic-article/444/209624) beschreibt die Bundesnetzagentur den starken Anstieg der Gas- und Kohlepreise nach Russlands Angriff auf die Ukraine. Gaskraftwerke waren häufig preissetzend; ihre gestiegenen Brennstoffkosten trieben damit auch den Strompreis. Hinzu kamen Ausfälle französischer Kernkraftwerke und im Sommer Probleme durch Trockenheit. Das ist der historische Hintergrund des Ausschlags 2022 in unserer Teiljahresreihe.

**Auch 2025 gab es mehr als einen Preiseffekt.** Für das [zweite Quartal 2025](https://www.smard.de/page/home/topic-article/444/217468/mehr-als-zwei-drittel-erneuerbare) nennt SMARD rund 16 Prozent höhere Gas-Großhandelspreise als im Vorjahresquartal. Trotz hoher erneuerbarer Einspeisung lag der Strompreis etwas höher. Für das [dritte Quartal 2025](https://www.smard.de/page/home/topic-article/444/218232/erneuerbare-auf-quartalshoch) erklärt SMARD den Anstieg unter anderem mit häufiger teuren Abendstunden: Die Solareinspeisung sinkt, der Verbrauch steigt, teurere Kraftwerke werden gebraucht. Beide Quellen beschreiben vollständige Quartale, nicht unser bis 9. September begrenztes Vergleichsfenster.

Die Mechanismen erklären, warum ein steigender Erneuerbarenanteil und ein höherer Durchschnittspreis zusammen auftreten können. **Welcher Faktor den Anstieg 2026 um wie viele Euro erklärt, lässt sich aus den Tagesaggregaten nicht bestimmen.** Dafür bräuchte es zusätzlich Brennstoffpreise, Kraftwerksverfügbarkeiten und die zeitliche Verteilung von Angebot und Nachfrage. Aus „mehr Erneuerbare, höherer Preis“ folgt jedenfalls nicht, dass die Erneuerbaren den Anstieg verursacht haben.

Zwei Tage hatten 2026 bisher einen negativen Tagesdurchschnitt. Das zählt keine negativen Stunden: Solche Stunden können auch in einem insgesamt positiven Tag stecken. Und der Börsenpreis ist kein Haushaltstarif. Netzentgelte, Steuern, Vertrieb und die Beschaffung des jeweiligen Versorgers kommen hinzu.

<details class="post-methodology">
<summary>Methodik und Datenquellen</summary>

### Datenstand und Vergleichsfenster

Grundlage sind die SMARD-Tagesdaten aus dem Strom-Dashboard, gespeichert am 10. September 2026. Sie reichen bis einschließlich **9. September 2026**. Der Beitrag bleibt auf diesem Datenstand; die Überarbeitung vom 14. September ergänzt Vergleiche und Einordnung.

- **Zeiträume:** In jedem Jahr 2019–2026 vom 1. Januar bis einschließlich 9. September, Zeitzone Europe/Berlin.
  - 2025 und 2026 enthalten jeweils 252 Tage und 6.047 Stunden.
  - Die Schaltjahre 2020 und 2024 enthalten 253 Tage und 6.071 Stunden; der zusätzliche Tag bleibt enthalten. Kalendergleich bedeutet daher nicht in jedem Jahr gleich viele Stunden.

### Berechnung und Abdeckung

- **Erzeugung:** Tagesenergien von GWh in TWh umgerechnet und summiert. Erfasst ist die öffentliche Nettoerzeugung in Deutschland, einschließlich Pumpspeichern und der damaligen Kernenergie. Nicht enthalten sind unter anderem PV-Eigenverbrauch, Industrie- und Bahnstromnetze. Die Netzlast ist eine eigene Kennzahl; die Differenz zur Erzeugung ist kein Maß für den kommerziellen Stromhandel.
- **Anteil:** Biomasse, Wasserkraft, Wind auf See, Wind an Land, Solar und sonstige Erneuerbare geteilt durch die gesamte erfasste Erzeugung. Keine Mittelung täglicher Prozentwerte, kein Anteil am Bruttostromverbrauch.
- **Preis:** Summe aus Tagesmittel mal Tagesstunden, geteilt durch die erfassten Stunden. Die Umstellung auf Sommerzeit wird berücksichtigt. Marktgebiet durchgehend Deutschland/Luxemburg, nominale Preise, keine Inflations- oder Lastgewichtung. Die bereits gerundeten Tagesmittel können kleine Abweichungen gegenüber einer direkten Auswertung aller Handelsintervalle verursachen.
- **Abdeckung:** In allen acht Vergleichsfenstern sind sämtliche Tage, Erzeugungswerte und Tagespreise vorhanden. Das belegt keine lückenlose untertägige Messung: Die historische SMARD-Reihe kann vorgelagerte Teilwerte oder Interpolationen enthalten. Fehlende Werte werden hier nicht zu null; die nach dem Atomausstieg in der Dashboard-Historie ausdrücklich abgeleiteten Kernenergie-Nullwerte bleiben erhalten.

Datenquelle: [Bundesnetzagentur / SMARD.de](https://www.smard.de/home/marktdaten), Lizenz [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Das eingefrorene Datenpaket enthält die Vergleichswerte, den vollständigen Energieträgermix, die ursprüngliche gerundete CSV sowie Quellpfade, Prüfsummen und Rechenmethodik. Die verlinkten SMARD-Artikel liefern die historische Einordnung; ihre Quartals- und Jahreswerte werden nicht mit unseren Teiljahreswerten vermischt.

</details>

Die Zwischenbilanz ist klar: Wind an Land und Solar wachsen kräftig, der Erneuerbarenanteil steigt. Beim Börsenpreis bleibt 2026 bisher teurer als 2025. Wie sich das im weiteren Jahresverlauf entwickelt, zeigt das [Strom-Dashboard](/dashboards/strom/).
