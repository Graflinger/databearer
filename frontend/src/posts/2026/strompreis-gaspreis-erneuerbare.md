---
title: "Der Gaspreis gibt den Takt vor: Was den Strompreis an der Börse seit 2019 bewegt"
date: 2026-10-04
excerpt: "Seit 2019 folgt der Börsenstrompreis fast im Gleichschritt dem Gaspreis – und in ruhigen Jahren war Strom in Monaten mit viel Wind und Sonne deutlich billiger. 2026 passt nicht mehr ganz ins Muster: Seit Juni ist Strom teurer, als Gas und Erneuerbare erwarten lassen."
image: "/images/blog_card_images/2026/strompreis-gas-erneuerbare.png"
imageText: "KI-generiertes Symbolbild: Windräder und Solarpark auf der einen, Gasleitung und Gaskraftwerk auf der anderen Seite, verbunden durch Hochspannungsleitungen."
fullWidthCard: false
topic: ["energie", "wirtschaft"]
---
Steigt der Strompreis, ist ein Verdacht schnell zur Hand: Wind und Sonne machten Strom teurer. Die Börsendaten seit 2019 zeichnen ein anderes Bild. Über 84 Monate bewegte sich der deutsche Großhandelsstrompreis fast im Gleichschritt mit dem europäischen Gaspreis: Die Korrelation liegt bei **0,97**. Mit dem Anteil erneuerbarer Stromerzeugung hing er über denselben Zeitraum kaum zusammen (**−0,17**). Eine Korrelation misst, wie eng zwei Größen gemeinsam steigen und fallen: +1 bedeutet vollständigen Gleichlauf, −1 eine vollständige Gegenbewegung, 0 keinen linearen Zusammenhang.

Spielen Wind und Sonne also keine Rolle? Doch – der schwache Gesamtwert täuscht. **Innerhalb** der ruhigeren Jahre vor und nach der Gaspreiskrise war Strom in Monaten mit viel Wind- und Solarstrom deutlich billiger (**−0,90** für 2019–2020, **−0,82** für 2023–2025). Kurz gesagt: Der Gaspreis bestimmte, **auf welchem Niveau** der Strompreis lag. Der Erneuerbarenanteil hängt damit zusammen, wie weit er **innerhalb dieses Niveaus** nach unten ging.

Und dann kommt 2026: Der Strompreis steigt mit dem Gaspreis – seit Juni aber deutlich stärker, als dieses Muster erwarten lässt.

<script defer src="/js/lib/echarts.min.js"></script>

## Wird Gas teurer, zieht Strom mit

Im Jahresmittel kostete eine Megawattstunde Strom am Day-Ahead-Markt 2019 **37,67 Euro** und 2020 **30,47 Euro**. 2022 waren es **235,45 Euro**, danach sank der Preis wieder: auf **78,51 Euro** 2024 und **89,32 Euro** 2025. Der Gaspreis beschreibt denselben Bogen. Im Monatsmittel lag er 2020 bei **9,60 Euro** je Megawattstunde, 2022 bei **132,10 Euro** und 2025 bei **36,41 Euro**.

<div class="chart-section">
<h3 id="strompreis-gaspreis-verlauf-heading">Strompreis und Gaspreis je Monat, 2019–2025, in EUR/MWh</h3>
<p class="chart-description" id="strompreis-gaspreis-verlauf-description">Beide Preise sind in Euro je Megawattstunde angegeben und steigen 2021/2022 gemeinsam steil an. Den Höchstwert erreichten beide im August 2022: Strom kostete im Monatsmittel 465,18 EUR/MWh, Gas 235,96 EUR/MWh. Ab 2023 liegen beide deutlich niedriger, aber über dem Niveau von 2019/2020.</p>
<div id="strompreis-gaspreis-verlauf" role="img" aria-labelledby="strompreis-gaspreis-verlauf-heading" aria-describedby="strompreis-gaspreis-verlauf-description" style="width: 100%; height: 420px;"></div>
<script defer src="/js/charts/strompreis_korrelation/verlauf.js"></script>
<div class="table-scroll" tabindex="0" role="region" aria-labelledby="strompreis-gaspreis-verlauf-heading">
<table id="strompreis-gaspreis-verlauf-table">
<caption>Ausgewählte Monate: Monatsmittel von Strom- und Gaspreis in EUR/MWh</caption>
<thead><tr><th scope="col">Monat</th><th scope="col">Strompreis (EUR/MWh)</th><th scope="col">Gaspreis (EUR/MWh)</th></tr></thead>
<tbody>
<tr><th scope="row"><time datetime="2019-01">Januar 2019</time></th><td>49,39</td><td>21,70</td></tr>
<tr><th scope="row"><time datetime="2020-04">April 2020</time></th><td>17,09</td><td>6,66</td></tr>
<tr><th scope="row"><time datetime="2022-08">August 2022</time></th><td>465,18</td><td>235,96</td></tr>
<tr><th scope="row"><time datetime="2023-07">Juli 2023</time></th><td>77,61</td><td>29,47</td></tr>
<tr><th scope="row"><time datetime="2025-02">Februar 2025</time></th><td>128,52</td><td>50,27</td></tr>
</tbody>
</table>
</div>
<div class="chart-sources"><strong>Quellen: </strong><a href="https://www.smard.de/home/marktdaten">Bundesnetzagentur | SMARD.de – Großhandelspreise Day-Ahead DE-LU</a> (CC BY 4.0); <a href="https://www.worldbank.org/en/research/commodity-markets">World Bank – Commodity Price Data (Pink Sheet), Natural gas, Europe</a> (CC BY 4.0); <a href="https://data.ecb.europa.eu/data/datasets/EXR/EXR.M.USD.EUR.SP00.A">EZB – Referenzkurs US-Dollar/Euro</a>; eigene Umrechnung und Berechnung.</div>
</div>

Warum hängt Strom so eng am Gas? Die Antwort liegt in der Preisbildung. Am Day-Ahead-Markt setzt für jede Stunde das teuerste Kraftwerk den Preis, das noch zur Deckung der Nachfrage gebraucht wird. In Deutschland ist das in vielen Stunden ein Gaskraftwerk. Wird Gas teurer, bietet dieses Kraftwerk höher, und der Strompreis steigt mit. Ein Gaskraftwerk mit einem Wirkungsgrad von 55 Prozent braucht etwa 1,8 Megawattstunden Gas für eine Megawattstunde Strom. Hinzu kommen die Kosten für CO₂-Zertifikate.

## Über alle Jahre wirken Erneuerbare bedeutungslos – ein Trugschluss

Legt man alle 84 Monate in ein Streudiagramm, bilden die Gasmonate fast eine Gerade. Beim Erneuerbarenanteil entsteht dagegen eine Wolke ohne klare Richtung. Erst die Farben verraten, dass diese Wolke aus drei getrennten Gruppen besteht – und innerhalb jeder Gruppe zeigt sich ein klares Muster.

<div class="chart-section">
<h3 id="strompreis-streuung-gas-heading">Strompreis und Gaspreis je Monat, nach Zeitraum, 2019–2025</h3>
<p class="chart-description" id="strompreis-streuung-gas-description">Jeder Punkt ist ein Monat. Je höher der Gaspreis, desto höher der Strompreis. Die Korrelation beträgt 0,97 über alle 84 Monate und liegt auch in jedem Teilzeitraum zwischen 0,75 und 0,96. Die gestrichelten Linien sind lineare Trends je Zeitraum.</p>
<div id="strompreis-streuung-gas" role="img" aria-labelledby="strompreis-streuung-gas-heading" aria-describedby="strompreis-streuung-gas-description" style="width: 100%; height: 440px;"></div>
<script defer src="/js/charts/strompreis_korrelation/streuung-gas.js"></script>
<div class="table-scroll" tabindex="0" role="region" aria-labelledby="strompreis-streuung-gas-heading">
<table id="strompreis-streuung-gas-table">
<caption>Ausgewählte Kennzahlen: Korrelation zwischen Strompreis und Gaspreis, Monatswerte</caption>
<thead><tr><th scope="col">Zeitraum</th><th scope="col">Monate</th><th scope="col">Korrelation</th></tr></thead>
<tbody>
<tr><th scope="row">2019–2025</th><td>84</td><td>0,97</td></tr>
<tr><th scope="row">2019–2020</th><td>24</td><td>0,78</td></tr>
<tr><th scope="row">2021–2022</th><td>24</td><td>0,96</td></tr>
<tr><th scope="row">2023–2025</th><td>36</td><td>0,75</td></tr>
</tbody>
</table>
</div>
<div class="chart-sources"><strong>Quellen: </strong><a href="https://www.smard.de/home/marktdaten">Bundesnetzagentur | SMARD.de</a>; <a href="https://www.worldbank.org/en/research/commodity-markets">World Bank – Pink Sheet</a>; <a href="https://data.ecb.europa.eu/data/datasets/EXR/EXR.M.USD.EUR.SP00.A">EZB</a>; eigene Berechnung.</div>
</div>

<div class="chart-section">
<h3 id="strompreis-streuung-erneuerbare-heading">Strompreis und Erneuerbarenanteil je Monat, nach Zeitraum, 2019–2025</h3>
<p class="chart-description" id="strompreis-streuung-erneuerbare-description">Über alle 84 Monate zeigt sich kaum ein Zusammenhang (Korrelation −0,17). Innerhalb der Zeiträume 2019–2020 und 2023–2025 fallen die Trendlinien jedoch deutlich ab (−0,90 und −0,82): Monate mit höherem Erneuerbarenanteil hatten dort niedrigere Strompreise. In der Krise 2021–2022 überlagert der Gaspreis diesen Zusammenhang (−0,08).</p>
<div id="strompreis-streuung-erneuerbare" role="img" aria-labelledby="strompreis-streuung-erneuerbare-heading" aria-describedby="strompreis-streuung-erneuerbare-description" style="width: 100%; height: 440px;"></div>
<script defer src="/js/charts/strompreis_korrelation/streuung-erneuerbare.js"></script>
<div class="table-scroll" tabindex="0" role="region" aria-labelledby="strompreis-streuung-erneuerbare-heading">
<table id="strompreis-streuung-erneuerbare-table">
<caption>Ausgewählte Kennzahlen: Korrelation zwischen Strompreis und Erneuerbarenanteil, Monatswerte</caption>
<thead><tr><th scope="col">Zeitraum</th><th scope="col">Monate</th><th scope="col">Korrelation</th></tr></thead>
<tbody>
<tr><th scope="row">2019–2025</th><td>84</td><td>−0,17</td></tr>
<tr><th scope="row">2019–2020</th><td>24</td><td>−0,90</td></tr>
<tr><th scope="row">2021–2022</th><td>24</td><td>−0,08</td></tr>
<tr><th scope="row">2023–2025</th><td>36</td><td>−0,82</td></tr>
</tbody>
</table>
</div>
<div class="chart-sources"><strong>Quelle: </strong><a href="https://www.smard.de/home/marktdaten">Bundesnetzagentur | SMARD.de – Stromerzeugung und Großhandelspreise</a> (CC BY 4.0); eigene Berechnung.</div>
</div>

Warum verschwindet der Zusammenhang über den Gesamtzeitraum? Der Erneuerbarenanteil stieg vor allem **nach** der Krise: Im Mittel der Monate lag er 2019–2022 bei knapp 45 Prozent, 2023–2025 bei 58 Prozent. Zugleich waren Strom- und Gaspreis 2023–2025 mehr als doppelt so hoch wie 2019–2020. Mischt man die Phasen, heben sich der Niveausprung beim Gas und der Zusammenhang mit den Erneuerbaren innerhalb der Phasen weitgehend auf. Statistisch ist das ein Beispiel für das [Simpson-Paradoxon](https://de.wikipedia.org/wiki/Simpson-Paradoxon): Ein Zusammenhang, der in jeder Gruppe besteht, kann im zusammengelegten Datensatz verschwinden.

## Nach der Krise schwankt Strom eher mit Wind und Sonne als mit Gas

Eine zweite Prüfung klammert den langfristigen Trend aus. Sie vergleicht nur, wie stark sich die Werte **von einem Monat zum nächsten** verändern. Über den Gesamtzeitraum dominiert auch hier der Gaspreis (**0,89** gegenüber **−0,54**). In den Jahren 2023–2025 kehrt sich das Bild aber um: Veränderungen des Erneuerbarenanteils gehen deutlich enger mit Veränderungen des Strompreises einher (**−0,85**) als Veränderungen des Gaspreises (**0,50**).

<div class="chart-section">
<h3 id="strompreis-korrelationen-heading">Korrelation mit dem Strompreis nach Zeitraum, Monatswerte 2019–2025</h3>
<p class="chart-description" id="strompreis-korrelationen-description">Die Balken zeigen die Korrelation der Monatswerte mit dem Strompreis auf einer Skala von −1 bis +1. Für den Gaspreis liegt sie in allen Zeiträumen zwischen 0,75 und 0,97. Für den Erneuerbarenanteil ist sie über den Gesamtzeitraum schwach (−0,17), 2019–2020 und 2023–2025 aber stark negativ (−0,90 und −0,82).</p>
<div id="strompreis-korrelationen" role="img" aria-labelledby="strompreis-korrelationen-heading" aria-describedby="strompreis-korrelationen-description" style="width: 100%; height: 400px;"></div>
<script defer src="/js/charts/strompreis_korrelation/korrelationen.js"></script>
<div class="table-scroll" tabindex="0" role="region" aria-labelledby="strompreis-korrelationen-heading">
<table id="strompreis-korrelationen-table">
<caption>Ausgewählte Kennzahlen: Korrelation mit dem Strompreis, für Monatswerte und für Veränderungen zum Vormonat</caption>
<thead><tr><th scope="col">Zeitraum</th><th scope="col">Erneuerbare</th><th scope="col">Gas</th><th scope="col">Erneuerbare (Veränderung)</th><th scope="col">Gas (Veränderung)</th></tr></thead>
<tbody>
<tr><th scope="row">2019–2025</th><td>−0,17</td><td>0,97</td><td>−0,54</td><td>0,89</td></tr>
<tr><th scope="row">2019–2020</th><td>−0,90</td><td>0,78</td><td>−0,88</td><td>0,44</td></tr>
<tr><th scope="row">2021–2022</th><td>−0,08</td><td>0,96</td><td>−0,59</td><td>0,89</td></tr>
<tr><th scope="row">2023–2025</th><td>−0,82</td><td>0,75</td><td>−0,85</td><td>0,50</td></tr>
</tbody>
</table>
</div>
<div class="chart-sources"><strong>Quellen: </strong><a href="https://www.smard.de/home/marktdaten">Bundesnetzagentur | SMARD.de</a>; <a href="https://www.worldbank.org/en/research/commodity-markets">World Bank – Pink Sheet</a>; <a href="https://data.ecb.europa.eu/data/datasets/EXR/EXR.M.USD.EUR.SP00.A">EZB</a>; eigene Berechnung.</div>
</div>

Das passt zu einer einfachen Lesart: Während der Krise schwankte der Gaspreis so stark, dass er fast alles andere überdeckte. Seit 2023 ist er vergleichsweise ruhiger. Die Monatsschwankungen des Strompreises hängen dadurch stärker mit Wind und Sonne zusammen.

## 2023–2025: ein Prozentpunkt mehr Erneuerbare, 1,59 Euro weniger

Ein Haken bleibt: Gaspreis und Erneuerbarenanteil hängen auch miteinander zusammen. Im Winter ist Gas meist teurer, und es wird weniger Solarstrom erzeugt. Eine Regression nimmt deshalb beide Größen gleichzeitig auf. Sie zeigt, wie sich der Strompreis im Mittel verändert, wenn sich nur eine der beiden Größen ändert.

**In den Jahren 2023–2025 lag der Strompreis bei gleichem Gaspreis um rund 1,59 Euro je Megawattstunde niedriger, wenn der Erneuerbarenanteil einen Prozentpunkt höher war.** Ein Euro höherer Gaspreis ging bei gleichem Erneuerbarenanteil mit 0,91 Euro höherem Strompreis einher. Über alle Jahre war der Gas-Zusammenhang stärker (**1,68 Euro**), der Erneuerbaren-Zusammenhang dagegen nicht eindeutig von null zu unterscheiden.

Ein Teil des Erneuerbaren-Zusammenhangs ist Jahreszeit. Rechnet man zusätzlich Stromverbrauch und Kalendermonat heraus, bleibt über alle Jahre kein eindeutiger Zusammenhang mit den Erneuerbaren (**−0,24**, Intervall von −0,94 bis 0,45). Der Gas-Zusammenhang bleibt dagegen nahezu unverändert (**1,67**).

<details class="post-data-details">
<summary>Alle Regressionsergebnisse nach Zeitraum</summary>

<div class="table-scroll" tabindex="0" role="region" aria-labelledby="strompreis-regression-caption">
<table id="strompreis-regression-table">
<caption id="strompreis-regression-caption">Ausgewählte Regressionsergebnisse: Veränderung des Strompreises in EUR/MWh je 1 EUR/MWh Gaspreis und je Prozentpunkt Erneuerbarenanteil, Monatswerte, darunter 95-Prozent-Intervalle</caption>
<thead><tr><th scope="col">Zeitraum</th><th scope="col">Gaspreis</th><th scope="col">Erneuerbare</th><th scope="col">R²</th></tr></thead>
<tbody>
<tr><th scope="row">2019–2025</th><td>1,68 <br><small>1,54 bis 1,82</small></td><td>−0,11 <br><small>−0,42 bis 0,20</small></td><td>0,95</td></tr>
<tr><th scope="row">2019–2020</th><td>0,68 <br><small>0,39 bis 0,98</small></td><td>−0,95 <br><small>−1,18 bis −0,71</small></td><td>0,89</td></tr>
<tr><th scope="row">2021–2022</th><td>1,72 <br><small>1,56 bis 1,88</small></td><td>−2,13 <br><small>−3,72 bis −0,54</small></td><td>0,94</td></tr>
<tr><th scope="row">2023–2025</th><td>0,91 <br><small>0,31 bis 1,52</small></td><td>−1,59 <br><small>−2,10 bis −1,07</small></td><td>0,79</td></tr>
<tr><th scope="row">2019–2025*</th><td>1,67 <br><small>1,56 bis 1,78</small></td><td>−0,24 <br><small>−0,94 bis 0,45</small></td><td>0,96</td></tr>
</tbody>
</table>
</div>
<p class="table-note"><strong>Quellen:</strong> <a href="https://www.smard.de/home/marktdaten">Bundesnetzagentur | SMARD.de</a>; <a href="https://www.worldbank.org/en/research/commodity-markets">World Bank – Pink Sheet</a>; <a href="https://data.ecb.europa.eu/data/datasets/EXR/EXR.M.USD.EUR.SP00.A">EZB</a>; eigene Berechnung. * Zusätzlich Stromverbrauch und Kalendermonat berücksichtigt. Die Intervalle berücksichtigen, dass aufeinanderfolgende Monate einander ähneln; bei 24 bis 84 Monatswerten sind sie nur eine Orientierung. R² ist der Anteil der Preisschwankungen, den das Modell abbildet.</p>

</details>

## 2026: Gas erklärt die Richtung, aber nicht mehr die Höhe

Für 2026 liegen Monatswerte bis September vor. Sie fließen in keine der obigen Berechnungen ein – und eignen sich deshalb als Test: Trägt das Muster der Jahre 2023–2025 auch im laufenden Jahr?

Die Richtung stimmt. Im ersten Quartal war Gas günstiger als ein Jahr zuvor, und auch Strom war billiger. Im zweiten und dritten Quartal stieg der Gaspreis deutlich, im dritten Quartal hat er sich fast verdoppelt. Der Strompreis zog mit.

Die Höhe passt aber nicht mehr. Seit Juni lag der Strompreis jeden Monat **20 bis 32 Euro je Megawattstunde** über dem Wert, den Gaspreis und Erneuerbarenanteil nach dem Zusammenhang von 2023–2025 erwarten lassen. Eine so große Abweichung gab es in den Jahren 2023–2025 in keinem einzigen Monat.

<div class="chart-section">
<h3 id="strompreis-erwartung-2026-heading">Strompreis 2026: tatsächlich und nach dem Zusammenhang 2023–2025 erwartet</h3>
<p class="chart-description" id="strompreis-erwartung-2026-description">Von Januar bis Mai weicht der tatsächliche Strompreis höchstens 14 EUR/MWh vom erwarteten ab. Ab Juni liegt der tatsächliche Preis jeden Monat 20 bis 32 EUR/MWh darüber, im dritten Quartal im Mittel bei 126 statt erwarteten 98 EUR/MWh. Der Gaspreis steigt von 34 EUR/MWh im Januar auf 75 EUR/MWh im September.</p>
<div id="strompreis-erwartung-2026" role="img" aria-labelledby="strompreis-erwartung-2026-heading" aria-describedby="strompreis-erwartung-2026-description" style="width: 100%; height: 420px;"></div>
<script defer src="/js/charts/strompreis_korrelation/erwartung-2026.js"></script>
<div class="table-scroll" tabindex="0" role="region" aria-labelledby="strompreis-erwartung-2026-heading">
<table id="strompreis-erwartung-2026-table">
<caption>Ausgewählte Werte: Quartalsmittel in EUR/MWh; Gas- und Strompreis jeweils 2025 → 2026, erwarteter Strompreis 2026</caption>
<thead><tr><th scope="col">Quartal</th><th scope="col">Gaspreis</th><th scope="col">Strompreis</th><th scope="col">Erwartet</th></tr></thead>
<tbody>
<tr><th scope="row">1. Quartal</th><td>47 → 40</td><td>112 → 102</td><td>98</td></tr>
<tr><th scope="row">2. Quartal</th><td>36 → 46</td><td>70 → 95</td><td>82</td></tr>
<tr><th scope="row">3. Quartal</th><td>33 → 64</td><td>83 → 126</td><td>98</td></tr>
</tbody>
</table>
</div>
<div class="chart-sources"><strong>Quellen: </strong><a href="https://www.smard.de/home/marktdaten">Bundesnetzagentur | SMARD.de</a>, Datenstand 2. Oktober 2026; <a href="https://www.worldbank.org/en/research/commodity-markets">World Bank – Pink Sheet</a>, Stand 2. Oktober 2026; <a href="https://data.ecb.europa.eu/data/datasets/EXR/EXR.M.USD.EUR.SP00.A">EZB</a>; eigene Berechnung. „Erwartet“: Ergebnis der Regression 2023–2025 mit den Gaspreisen und Erneuerbarenanteilen von 2026.</div>
</div>

Warum, lässt sich aus diesen Monatsdaten nicht ablesen. Für den Juni nennt die Bundesnetzagentur in ihrer [Auswertung des zweiten Quartals](https://www.smard.de/page/home/topic-article/444/221002/erzeugung-und-verbrauch-leicht-gestiegen) eine Hitzewelle mit sehr hohen Abendpreisen. Zudem lohnt sich für viele konventionelle Kraftwerke im Sommer kein Dauerbetrieb; sie werden nur für die Abendstunden angefahren und preisen die Anfahrkosten ein. Für Juli bis September steht eine solche Auswertung noch aus. Im September lag der Gaspreis zudem über allen Werten der Jahre 2023–2025; die Erwartung für diesen Monat ist deshalb unsicherer.

## Was die Zahlen zeigen – und was nicht

- **Gas bestimmte das Niveau.** Ein Euro höherer Gaspreis je Megawattstunde ging über alle Jahre mit rund 1,7 Euro höherem Strompreis einher. Das liegt in der Größenordnung des Gasbedarfs eines Gaskraftwerks für eine Megawattstunde Strom.
- **Erneuerbare hängen mit dem Abstand nach unten zusammen.** Innerhalb ruhigerer Phasen lag der Strompreis in erneuerbarenstarken Monaten deutlich niedriger. Wie viel davon auf Wind und Sonne selbst zurückgeht und wie viel auf die Jahreszeit, lässt sich mit 84 Monatswerten nicht sauber trennen.
- **Kein Hinweis, dass Erneuerbare den Börsenstrom verteuert haben.** In keinem Zeitraum und in keiner Rechnung ging ein höherer Erneuerbarenanteil mit einem höheren Großhandelspreis einher; alle Werte sind negativ oder nahe null. Das passt zum Preismechanismus: Wind- und Solaranlagen haben kaum Brennstoffkosten und verdrängen am Markt teurere Kraftwerke.
- **Korrelation ist keine Ursache.** Weitere Einflüsse fehlen in dieser Auswertung: CO₂- und Kohlepreise, Stromimporte, Kraftwerksausfälle und das Wetter in den Nachbarländern. Bewegen sich solche Größen gleichzeitig mit dem Gaspreis, steckt ihr Einfluss teilweise im Gas-Zusammenhang.
- **Monatsmittel glätten.** Innerhalb eines Tages wirkt der Erneuerbarenanteil viel direkter: In sonnigen Mittagsstunden fällt der Preis oft stark, abends steigt er wieder. Monatsdaten zeigen diesen Mechanismus nur abgeschwächt. Stündliche Werte zeigt das [Strom-Dashboard](/dashboards/strom/).
- **Großhandel ist nicht Haushaltsstrom.** Haushaltstarife enthalten Netzentgelte, Steuern und Umlagen. Außerdem kaufen Versorger oft Monate im Voraus ein. Die hier gezeigten Zusammenhänge übertragen sich deshalb nur verzögert und abgeschwächt auf Endkundenpreise.

Wer wissen will, wohin der Börsenstrompreis geht, schaut also zuerst auf den Gaspreis – und dann auf Wind und Sonne. Warum Strom 2026 seit Juni teurer ist, als beide zusammen erklären, ist dagegen noch offen.

Wie sich der Anteil erneuerbarer Stromerzeugung langfristig entwickelt hat, beschreibt der Beitrag [Erneuerbare Stromerzeugung auf dem Vormarsch](/posts/2025/Erneuerbare-Stromerzeugung-auf-dem-Vormarsch/). Weitere Analysen gibt es im [Themenbereich Energie](/themen/energie/).

## Daten und Quellen

Grundlage sind Monatswerte von Januar 2019 bis September 2026. Der Strompreis ist der Day-Ahead-Großhandelspreis für Deutschland und Luxemburg, gemittelt über alle Stunden eines Monats. Der Erneuerbarenanteil bezieht sich auf die öffentliche Nettostromerzeugung; Pumpspeicher und Kernkraft zählen zur Erzeugung, aber nicht zu den Erneuerbaren. Der Gaspreis ist das Monatsmittel des europäischen Referenzpreises TTF, umgerechnet von US-Dollar in Euro. Es handelt sich nicht um einen täglichen Day-Ahead-Spotpreis und nicht um den Preis im deutschen Marktgebiet; beide liegen meist eng beieinander, sind aber nicht identisch.

Alle Korrelationen und Regressionen beruhen nur auf den Jahren 2019 bis 2025, aufgeteilt in drei vorab festgelegte Phasen: vor der Gaspreiskrise, die Krise und danach. 2026 ist noch nicht abgeschlossen und wird nur mit dem Zusammenhang von 2023–2025 verglichen. SMARD kann die Werte der letzten Wochen noch geringfügig korrigieren.

- Strompreis und Erzeugung: [Bundesnetzagentur | SMARD.de](https://www.smard.de/home/marktdaten), Lizenz [CC BY 4.0](https://www.smard.de/home/datennutzung), Datenstand 2. Oktober 2026
- Gaspreis: [World Bank, Commodity Price Data (Pink Sheet)](https://www.worldbank.org/en/research/commodity-markets), „Natural gas, Europe“, Stand 2. Oktober 2026, Lizenz [CC BY 4.0](https://datacatalog.worldbank.org/search/dataset/0038238/commodity-prices-history-and-projections)
- Wechselkurs: [EZB-Referenzkurs US-Dollar/Euro](https://data.ecb.europa.eu/data/datasets/EXR/EXR.M.USD.EUR.SP00.A), Monatsmittel ([Nutzungsbedingungen](https://www.ecb.europa.eu/services/disclaimer/html/index.en.html)); eigene Umrechnung des Gaspreises in Euro je Megawattstunde
