---
title: "Vom Nettoexporteur zum Nettoimporteur: Deutschlands Stromhandel seit 2019"
date: 2026-09-11
lastUpdated: 2026-09-11
excerpt: "Deutschlands kommerzieller Stromhandel hat sich gedreht: Seit 2023 übersteigen die Importe die Exporte deutlich."
image: "/images/dashboards/strommarkt-deutschland.svg"
imageText: "Der deutsche Stromhandel hat sich seit 2019 sichtbar verschoben."
fullWidthCard: false
topic: ["energie", "wirtschaft"]
---
<script src="/js/lib/echarts.min.js"></script>

## Der Saldo hat sich gedreht

Deutschland war in den Dashboard-Daten von 2019 bis 2022 im kommerziellen Stromhandel klarer Nettoexporteur. Seit 2023 sieht das anders aus: Die Importe liegen über den Exporten. 2024 war der Nettoimport mit **31,9 TWh** besonders groß, 2025 blieb Deutschland mit **25,4 TWh** netto ebenfalls Importeur.

Wichtig ist die Abgrenzung: Diese Werte beschreiben geplante kommerzielle Austauschmengen im Marktgebiet Deutschland–Luxemburg. Sie sind keine physischen Stromflüsse und auch keine Bilanz aus Erzeugung minus Netzlast.

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

2019 standen **62,8 TWh** Exporten nur **31,9 TWh** Importe gegenüber. Der Nettoexport betrug damit **30,8 TWh**. 2022 war Deutschland mit **23,0 TWh** Nettoexport noch klar im Plus.

Danach kippt der Saldo: 2023 übersteigen die Importe die Exporte um **15,3 TWh**. 2024 steigt der Nettoimport auf **31,9 TWh**, während die Exporte auf **45,3 TWh** fallen und die Importe auf **77,2 TWh** steigen. 2025 entspannte sich der Saldo etwas, blieb aber mit **25,4 TWh Nettoimport** klar negativ.

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

## Nettoimport ist nicht automatisch Knappheit

Ein Importüberschuss bedeutet nicht automatisch, dass Deutschland „zu wenig Strom“ hätte. Stromhandel folgt Preisen, Grenzkuppelkapazitäten, Kraftwerksverfügbarkeit, Wetter, Nachfrage und europäischen Marktregeln. Wenn Strom im Ausland günstiger verfügbar ist, kann Import wirtschaftlich sinnvoll sein – gerade in einem gekoppelten europäischen Strommarkt.

Gleichzeitig ist die Entwicklung politisch und ökonomisch relevant. Sie zeigt, dass Deutschlands Rolle im europäischen Stromsystem flexibler geworden ist: weniger dauerhafter Exportüberschuss, mehr Austausch je nach Marktlage. Wer daraus Versorgungssicherheit, Kosten oder Klimawirkung ableiten will, braucht zusätzliche Daten – etwa Erzeugungsmix, Last, Preise und Emissionen.

## 2026 ist bewusst nicht in den Jahrescharts

Das Dashboard enthält bereits Handelsdaten bis August 2026. Für diesen Beitrag zeigen die Diagramme aber nur vollständige Kalenderjahre bis 2025. Das vermeidet eine irreführende Gegenüberstellung eines Acht-Monats-Zwischenstands mit ganzen Jahren. Der laufende Stand 2026 bleibt im [Strom-Dashboard](/dashboards/strom/) sichtbar.

## Methodik und Datenquellen

Grundlage sind die monatlichen DE–LU-Handelsdaten aus dem Databearer-Strom-Dashboard. Betrachtet werden vollständige Kalenderjahre 2019 bis 2025. Importe und Exporte werden jeweils als positive Mengen gezeigt; der Nettoexport ist **Export minus Import**. Positive Werte bedeuten Exportüberschuss, negative Werte Importüberschuss.

Die Daten beschreiben geplante kommerzielle Austauschmengen, keine physischen Flüsse. Geschlossene Jahre bleiben im Dashboard eingefroren; nur die jüngsten Monate des laufenden Jahres werden im normalen Aktualisierungsfenster korrigiert. Daten: [Bundesnetzagentur / SMARD.de](https://www.smard.de/home/marktdaten), Lizenz [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
