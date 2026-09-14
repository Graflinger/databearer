---
title: "Netzeingriffe: 17 Prozent weniger als 2022 – seit 2024 kaum Veränderung"
date: 2026-09-11
lastUpdated: 2026-09-14
excerpt: "Die Maßnahmenenergie sank von 2022 bis 2025 um knapp 17 Prozent. Seit 2024 bleibt sie fast gleich. Die Kosten liegen weiter bei rund drei Milliarden Euro."
image: "/images/dashboards/strommarkt-deutschland.svg"
imageText: "Netzengpassmanagement: Maßnahmenenergie und Kosten im Zeitverlauf."
fullWidthCard: false
topic: ["energie"]
---
<script src="/js/lib/echarts.min.js"></script>

## Erst der Rückgang, dann das Plateau

2022 mussten die Netzbetreiber stärker eingreifen als in jedem anderen Jahr der hier gezeigten Reihe. Bis 2025 sank die Maßnahmenenergie von **36.455 auf 30.327 GWh**, also um **knapp 17 Prozent**. Zuletzt ging es aber kaum noch voran: 2024 waren es bereits 30.318 GWh. Der Unterschied zu 2025 beträgt gerade einmal 9 GWh.

Was heißt **Maßnahmenenergie**? Wenn Leitungen an ihre Grenzen kommen, lassen Netzbetreiber zum Beispiel Kraftwerke vor dem Engpass herunter- und dahinter hochfahren. Die dabei veränderten Energiemengen werden erfasst. **Beide Richtungen zählen**: Wird an einer Stelle 1 GWh weniger und an einer anderen 1 GWh mehr erzeugt, können daraus 2 GWh Maßnahmenenergie werden. Die Summe ist deshalb weder verlorener Strom noch die Menge abgeregelter erneuerbarer Erzeugung.

Zum Netzengpassmanagement gehören Redispatch mit Markt- und Reservekraftwerken sowie Countertrading, also gegenläufige Handelsgeschäfte zur Entlastung des Netzes. Die Zahlen umfassen auch grenzüberschreitende Maßnahmen.

<div class="chart-section">
  <h3>Maßnahmenenergie: seit 2024 rund 30 TWh pro Jahr</h3>
  <p class="chart-description">Nach 36,5 TWh im Jahr 2022 sank die Maßnahmenenergie auf 30,3 TWh. 2024 und 2025 liegen fast gleichauf.</p>
  <p><strong>Vergleichbarkeit:</strong> Umstellung auf Redispatch 2.0 ab Oktober 2021; seit 2022 ist das frühere Einspeisemanagement vollständig im Redispatch mit Marktkraftwerken enthalten. Vergleiche über 2021/2022 hinweg sind daher eingeschränkt.</p>
  <div id="netzeingriffe-jahre-massnahmenenergie" style="width: 100%; height: 410px;"></div>
  <script src="/js/charts/netzeingriffe_stabilitaet/massnahmenenergie.js"></script>
  <div class="chart-sources"><strong>Quelle: </strong><a href="https://www.smard.de/page/home/topic-article/211972/217842/entwicklung-des-netzengpassmanagements">Bundesnetzagentur | SMARD.de</a>, eingefrorener Datenstand aus Commit dd0c7f8.</div>
</div>

Der Methodikwechsel ist beim Blick auf den Anstieg wichtig. Wie viel davon auf die Umstellung entfällt, lässt sich aus diesen Summen aber nicht herausrechnen. Die Daten liefern keine Aufteilung in veränderte Erfassung und veränderte Netzsituation.

## Die Kosten steigen 2025 wieder leicht

2025 kostete das Netzengpassmanagement **3.058 Millionen Euro**. Das waren 104 Millionen Euro oder **3,5 Prozent mehr** als 2024, obwohl die Maßnahmenenergie praktisch gleich blieb. Gegenüber den 3.916 Millionen Euro von 2022 sind die Kosten allerdings deutlich gesunken.

Eine GWh Maßnahmenenergie hat keinen festen Preis. Die Summe enthält unterschiedliche Maßnahmen und Kostenbestandteile: Beim Redispatch mit Marktkraftwerken und beim Countertrading werden Kosten und Erlöse saldiert. Bei Reservekraftwerken zählen Einsatz und Vorhaltung. Die Eurobeträge sind nominal, also nicht inflationsbereinigt.

<div class="chart-section">
  <h3>Nominale Kosten des Netzengpassmanagements</h3>
  <p class="chart-description">Nach dem Höchstwert 2022 gingen die Kosten zurück. 2025 lagen sie wieder etwas über dem Vorjahr, bei rund drei Milliarden Euro.</p>
  <p><strong>Methodikbruch 2021/2022:</strong> Seit 2022 werden frühere Einspeisemanagementkosten und Redispatchkosten zusammengeführt. Die Linie zeigt die veröffentlichten Jahressummen, keine methodisch bereinigte Reihe.</p>
  <div id="netzeingriffe-jahre-kosten" style="width: 100%; height: 400px;"></div>
  <script src="/js/charts/netzeingriffe_stabilitaet/kosten.js"></script>
  <div class="chart-sources"><strong>Quelle: </strong><a href="https://www.smard.de/page/home/topic-article/211972/217842/entwicklung-des-netzengpassmanagements">Bundesnetzagentur | SMARD.de</a>, eingefrorene Jahreswerte.</div>
</div>

| Jahr | Maßnahmenenergie | Nominale Kosten |
| --- | ---: | ---: |
| 2022 | 36.455 GWh | 3.916 Mio. € |
| 2023 | 34.298 GWh | 3.335 Mio. € |
| 2024 | 30.318 GWh | 2.954 Mio. € |
| 2025 | 30.327 GWh | 3.058 Mio. € |

## Die Monate schwanken stark

Im Dezember 2024 waren es **4.624 GWh**, im Mai 2026 **1.120 GWh** Gesamtmaßnahmen. Dazwischen liegen große Ausschläge. Aus zwei einzelnen Monaten lässt sich deshalb kein neuer Jahrestrend ableiten. Für 2026 liegen in diesem Datenstand erst Januar bis Mai vor; 2022 beginnt die Monatsreihe im Juli.

Die zweite Linie zeigt den darin enthaltenen **Redispatch mit Marktkraftwerken** – in der Legende kurz „Markt-Redispatch“. Dazu gehören konventionelle und erneuerbare Anlagen. Redispatch mit Reservekraftwerken ist darin nicht enthalten. Die beiden Linien werden nicht addiert.

<div class="chart-section">
  <h3>Netzeingriffe von Monat zu Monat</h3>
  <p class="chart-description">Redispatch mit Marktkraftwerken macht einen großen Teil der Gesamtmaßnahmen aus. Beide Reihen schwanken deutlich.</p>
  <div id="netzeingriffe-monate" style="width: 100%; height: 430px;"></div>
  <script src="/js/charts/netzeingriffe_stabilitaet/monate.js"></script>
  <div class="chart-sources"><strong>Quelle: </strong><a href="https://www.smard.de/page/home/topic-article/211972/213328/netzengpassmanagement">Bundesnetzagentur | SMARD.de: Gesamtmaßnahmen</a> und <a href="https://www.smard.de/page/home/topic-article/211972/213270/redispatch-mit-marktkraftwerken">Redispatch mit Marktkraftwerken</a>, Juli 2022 bis Mai 2026.</div>
</div>

## Methodik und Datenquellen

Die Auswertung nutzt einen eingefrorenen Auszug der SMARD-Kompaktdaten aus dem Dashboard-Datenstand **dd0c7f8**. Die Jahreswerte reichen von 2015 bis 2025, die Monatswerte von Juli 2022 bis Mai 2026. Das Aktualisierungsdatum dieses Beitrags ist kein neuer Beobachtungsstand. Jahres- und Monatswerte sind eigenständige Quellaggregate; Revisionen und Rundungen können zu Abweichungen zwischen Jahressumme und addierten Monaten führen.

Gemessen werden Energiemengen und Kosten der Engpassbewirtschaftung. Für die Zuverlässigkeit beim Verbraucher wären tatsächliche Versorgungsunterbrechungen relevant; Frequenzstabilität betrifft dagegen Abweichungen der Netzfrequenz vom Sollwert. Beides wird mit diesen Reihen nicht gemessen.

Quelle: **Bundesnetzagentur | SMARD.de**, [Energiedaten kompakt](https://www.smard.de/home/energiedaten-kompakt/strom), Lizenz [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) gemäß [SMARD-Benutzerhandbuch, September 2026](https://www.smard.de/resource/blob/221462/078c832e6e821e841b522f6d46d499af/smard-benutzerhandbuch-09-2026-data.pdf). Bearbeitung: Auswahl der Reihen und Zeiträume, deutsche Spaltennamen sowie Berechnung der Veränderungen. Quellen und Methodik geprüft am 14. September 2026.

Weitere Stromdaten gibt es im [Strom-Dashboard](/dashboards/strom/).
