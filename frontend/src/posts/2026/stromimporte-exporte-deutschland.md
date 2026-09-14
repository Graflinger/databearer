---
title: "Stromhandel seit 2019: vom Export- zum Importüberschuss"
date: 2026-09-11
lastUpdated: 2026-09-14
excerpt: "Seit 2023 importiert das Marktgebiet Deutschland–Luxemburg mehr Strom, als es exportiert. Was die Jahresbilanz über Handel, Kosten und Sicherheit aussagt."
image: "/images/dashboards/strommarkt-deutschland.svg"
imageText: "Der deutsche Stromhandel hat sich seit 2019 sichtbar verschoben."
fullWidthCard: false
topic: ["energie", "wirtschaft"]
---
<script src="/js/lib/echarts.min.js"></script>

## Der Saldo hat sich gedreht

Von 2019 bis 2022 exportierte das Marktgebiet **Deutschland–Luxemburg (DE–LU)** im Jahresverlauf mehr Strom, als es importierte. Seit 2023 ist es umgekehrt. Der Importüberschuss erreichte 2024 **31,9 TWh** und betrug 2025 **25,4 TWh**. Das ist eine deutliche Verschiebung im Handel. Ob Strom damit günstiger oder die Versorgung sicherer wurde, ist eine andere Frage.

Die Reihe erfasst **geplante kommerzielle Austauschmengen zwischen Gebotszonen**. DE–LU umfasst auch Luxemburg; die Zahlen sind deshalb keine geografische Strombilanz Deutschlands. Gehandelte Mengen und physikalische Stromflüsse sind unterschiedliche Größen. Ebenso wenig lässt sich dieser Handel aus Erzeugung minus Netzlast berechnen.

<div class="chart-section">
  <h3>Importe und Exporte im Jahresvergleich</h3>
  <p class="chart-description">
    Seit 2023 liegen die kommerziellen Stromimporte deutlich über den Exporten; bis 2022 war es in dieser Reihe umgekehrt.
  </p>

  <div id="stromhandel-jahre-importe-exporte" style="width: 100%; height: 420px;"></div>
  <script src="/js/charts/stromhandel_jahre/importe_exporte.js"></script>

  <div class="chart-sources">
    <strong>Quelle: </strong><a href="https://www.smard.de/home/marktdaten">Bundesnetzagentur / SMARD.de</a>, Databearer-Auswertung aus dem Strom-Dashboard.
  </div>
</div>

## Die Verschiebung ist deutlich

2019 standen **62,8 TWh** Exporten **31,9 TWh** Importe gegenüber. Der Exportüberschuss betrug **30,8 TWh**. Auch 2022 überwogen die Exporte noch um **23,0 TWh**.

2023 überstiegen die Importe die Exporte erstmals in dieser Reihe, um **15,3 TWh**. 2024 stiegen die Importe auf **77,2 TWh**, während die Exporte auf **45,3 TWh** sanken. 2025 lagen die Importe mit **76,7 TWh** fast auf Vorjahresniveau; die Exporte nahmen auf **51,3 TWh** zu. Der kleinere Importüberschuss ging damit vor allem auf höhere Exporte zurück.

<div class="chart-section">
  <h3>Nettoexport: positiv bedeutet Exportüberschuss</h3>
  <p class="chart-description">
    Der Nettoexport fällt ab 2023 unter null: Aus Exportüberschüssen werden Importüberschüsse.
  </p>

  <div id="stromhandel-jahre-nettoexport" style="width: 100%; height: 400px;"></div>
  <script src="/js/charts/stromhandel_jahre/nettoexport.js"></script>

  <div class="chart-sources">
    <strong>Quelle: </strong><a href="https://www.smard.de/home/marktdaten">Bundesnetzagentur / SMARD.de</a>, Databearer-Auswertung aus dem Strom-Dashboard.
  </div>
</div>

Die vollständige Reihe lässt sich auch ohne interaktive Diagramme lesen. Alle Mengen in TWh; Nettoexport = Export minus Import.

| Jahr | Importe | Exporte | Nettoexport |
| --- | ---: | ---: | ---: |
| 2019 | 31,923 | 62,756 | 30,833 |
| 2020 | 40,817 | 55,531 | 14,714 |
| 2021 | 47,173 | 61,037 | 13,864 |
| 2022 | 43,815 | 66,773 | 22,958 |
| 2023 | 63,701 | 48,450 | −15,251 |
| 2024 | 77,210 | 45,342 | −31,868 |
| 2025 | 76,693 | 51,280 | −25,413 |

## Zwei Fragen: Was kostet Strom, und ist er verfügbar?

**Wirtschaftlich zählt, zu welchen Kosten die Nachfrage gedeckt wird.** Die Bundesnetzagentur erklärt auf SMARD die [Marktkopplung](https://www.smard.de/page/home/wiki-article/518/548/grenzueberschreitender-stromhandel): Nachfrage wird auch durch günstigere Angebote anderer Gebotszonen bedient, soweit die Übertragungskapazitäten reichen. Ein Import kann deshalb teurere Erzeugung im Inland ersetzen. Weniger Nettoimporte sind für sich genommen kein wirtschaftlicher Erfolg – mehr Nettoimporte kein Beleg für einen Strommangel.

Die Jahressummen enthalten aber keine Preise und keine Aufteilung nach Handelspartnern oder Energieträgern. Woher die Importe kamen, aus welchen Kraftwerken sie stammten und wie günstig sie waren, lässt sich daraus nicht ablesen. Dafür braucht es Handels- und Preisdaten zu den jeweiligen Lieferzeiten sowie Informationen zur Erzeugung.

**Für die physische Versorgung zählt, ob Strom im benötigten Moment verfügbar ist.** Besonders bei hoher Nachfrage und wenig Wind und Sonne kommt es auf verfügbare Kraftwerke, Speicher, flexible Nachfrage und nutzbare Verbindungen zu Nachbarmärkten an. Eine Jahresbilanz zeigt weder, welche Importleistung dann bereitstand, noch ob Nachbarländer gleichzeitig knapp versorgt waren.

Auch eine gewachsene Flexibilität belegt der Wechsel zum Nettoimport nicht. Jahressummen verdecken, wann und wie schnell Erzeugung, Verbrauch und Handel aufeinander reagierten. Die belastbare Aussage dieser Reihe ist konkreter: Seit 2023 überwiegen im Marktgebiet DE–LU die kommerziellen Importe; 2025 wurde der Abstand vor allem durch höhere Exporte kleiner.

## Methodik und Datenquellen

Grundlage sind die monatlichen DE–LU-Handelsdaten der [Bundesnetzagentur / SMARD.de](https://www.smard.de/home/marktdaten), Lizenz [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/), aus dem gespeicherten Databearer-Datenstand `dd0c7f8`. Für diesen Beitrag sind die **vollständigen Kalenderjahre 2019–2025** festgehalten. Jeweils zwölf Monatswerte werden summiert, GWh durch 1.000 in TWh umgerechnet und auf drei Nachkommastellen gerundet. Der Saldo wird vor der Rundung als Export minus Import berechnet; deshalb können gerundete Einzelwerte geringfügig abweichen.

Die Ausgangsreihe summiert bilaterale Handelsmengen. Dokumentierte Anlauf-Lücken beim Handel mit Belgien und Norwegen 2020 wurden aus Tageswerten ergänzt; Zeiten vor Handelsbeginn sind als strukturelle Null behandelt. Alle 84 berücksichtigten Monate sind vorhanden. Der aus Importen und Exporten berechnete Saldo weicht 2021 und 2022 geringfügig von SMARDs separater Nettoreihe ab; hier bleibt er konsequent aus den Bruttomengen abgeleitet. Vollständige Monatsaggregate garantieren keine lückenlose Stundenreihe.

Die aktuellen Monatswerte und weitere Strommarktdaten findest du im [Strom-Dashboard](/dashboards/strom/)
