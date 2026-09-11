---
title: "Strom 2026 bisher: Solar und Wind liegen fast gleichauf"
date: 2026-09-11
lastUpdated: 2026-09-11
excerpt: "Bis Anfang September stammen 61,7 Prozent der öffentlichen Stromerzeugung aus Erneuerbaren; Wind an Land und Solar liegen fast gleichauf."
image: "/images/dashboards/strommarkt-deutschland.svg"
imageText: "Das laufende Stromjahr 2026 zeigt hohe Beiträge von Wind und Solar."
fullWidthCard: false
topic: ["energie"]
---
<script src="/js/lib/echarts.min.js"></script>

## Die Kurzfassung

Vom 1. Januar bis 9. September 2026 wurden in Deutschland laut Dashboard-Daten rund **317,0 Terawattstunden** Strom ins öffentliche Netz eingespeist. Der Anteil der Erneuerbaren an dieser erfassten Erzeugung lag bei **61,7 Prozent**. Die Netzlast summierte sich im selben Zeitraum auf **320,5 Terawattstunden**.

Besonders auffällig ist die Spitze im Erzeugungsmix: **Wind an Land** lieferte mit 72,3 TWh nur etwas mehr als **Solar** mit 70,5 TWh. Beide Quellen liegen damit fast gleichauf und jeweils deutlich vor Braunkohle, Erdgas und Steinkohle.

<div class="chart-section">
  <h3>Öffentliche Stromerzeugung nach Energieträgern</h3>
  <p class="chart-description">
    Wind an Land und Solar bilden im laufenden Jahr die beiden größten Einzelquellen der öffentlichen Stromerzeugung.
  </p>

  <div id="strom-ytd-2026-mix" style="width: 100%; height: 430px;"></div>
  <script src="/js/charts/strom_ytd_2026/mix.js"></script>

  <div class="chart-sources">
    <strong>Quelle: </strong><a href="https://www.smard.de/home/marktdaten">Bundesnetzagentur / SMARD.de</a>, Databearer-Auswertung aus dem Strom-Dashboard.
  </div>
</div>

## Erneuerbare dominieren, aber fossile Erzeugung bleibt relevant

Die Erneuerbaren setzen sich im Dashboard aus Biomasse, Wasserkraft, Wind auf See, Wind an Land, Solar und sonstigen Erneuerbaren zusammen. In Summe kommen sie im laufenden Jahr auf knapp zwei Drittel der öffentlichen Erzeugung. Das ist ein starkes Bild – aber kein vollständiger Ersatz für den Blick auf die konventionellen Quellen.

Braunkohle kommt bis zum Datenstand auf **44,1 TWh**, Erdgas auf **38,7 TWh** und Steinkohle auf **21,0 TWh**. Zusammen bleibt dieser Block also groß genug, um die Strommarktdynamik, CO₂-Emissionen und Preise weiter stark zu prägen.

## Preise: wenige negative Tage, hohes Mittel

Der zeitgewichtete Day-Ahead-Preis lag im Zeitraum bei **103,92 €/MWh**. Gleichzeitig gab es nur **zwei Tage mit negativem Tagesmittel**. Das zeigt, wie vorsichtig einzelne Preisphänomene interpretiert werden müssen: Negative Preise kommen vor und sind für Flexibilität wichtig, aber sie beschreiben nicht automatisch das gesamte Preisniveau.

In der Jahresansicht zählt das Dashboard negative Tage auf Basis von Tagesmitteln. Negative Stunden innerhalb eines positiven Tagesmittels sind daraus nicht sichtbar; die 1-, 7- und 30-Tage-Ansichten des Dashboards arbeiten dagegen mit Stundenmitteln.

## Ein Teiljahr ist kein Jahresergebnis

Die Zahlen sind ein Zwischenstand bis 9. September und keine Hochrechnung. Herbst und Winter können die Zusammensetzung noch sichtbar verschieben, besonders bei Wind, Solar, Last und Preisen. Deshalb ist der wichtigste Vergleichspunkt nicht ein vermeintlich fertiges Jahr, sondern der jeweils aktuelle Datenstand im [Strom-Dashboard](/dashboards/strom/).

## Methodik und Datenquellen

Die Werte stammen aus der Tageshistorie des Databearer-Strom-Dashboards. Grundlage sind SMARD-Tageswerte der Bundesnetzagentur für die öffentliche Nettoerzeugung, Netzlast und Day-Ahead-Preise. Betrachtet wird der Zeitraum **1. Januar bis 9. September 2026**; alle 252 Tage sind für die Energie-Kennzahlen vollständig.

Energieangaben wurden von GWh in TWh umgerechnet. Der Erneuerbarenanteil ist erneuerbare Energie geteilt durch die gesamte erfasste öffentliche Erzeugungsenergie, einschließlich Pumpspeichern und ohne Mittelung einzelner Tagesanteile. Stromerzeugung im öffentlichen Netz ist nicht identisch mit dem gesamten deutschen Stromverbrauch. Daten: [Bundesnetzagentur / SMARD.de](https://www.smard.de/home/marktdaten), Lizenz [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
