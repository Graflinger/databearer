---
title: "Strompreis, Gaspreis und Erneuerbare: Was die Monatsdaten 2019–2025 zeigen"
date: 2026-09-26
excerpt: "Von 2019 bis 2025 folgte der deutsche Großhandelsstrompreis vor allem dem Gaspreis. Innerhalb ruhigerer Phasen hängt er zusätzlich deutlich mit dem Anteil erneuerbarer Stromerzeugung zusammen."
image: "/images/blog_card_images/2026/strompreis-gas-erneuerbare.png"
imageText: "KI-generiertes Symbolbild: Windräder und Solarpark auf der einen, Gasleitung und Gaskraftwerk auf der anderen Seite, verbunden durch Hochspannungsleitungen."
fullWidthCard: false
topic: ["energie", "wirtschaft"]
---
Über die 84 Monate von 2019 bis 2025 bewegte sich der deutsche Großhandelsstrompreis fast im Gleichschritt mit dem europäischen Gaspreis: Die Korrelation liegt bei **0,97**. Mit dem Anteil erneuerbarer Stromerzeugung korreliert er über denselben Zeitraum kaum (**−0,17**). Dieser Gesamtwert täuscht jedoch. **Innerhalb** der Phasen vor und nach der Gaspreiskrise war der Strompreis in Monaten mit viel Wind- und Solarstrom deutlich niedriger (**−0,90** für 2019–2020, **−0,82** für 2023–2025).

Kurz gesagt: Der Gaspreis bestimmte, **auf welchem Niveau** der Strompreis lag. Der Erneuerbarenanteil hängt damit zusammen, wie weit er **innerhalb dieses Niveaus** nach unten ging. Beides sind statistische Zusammenhänge, keine gemessenen Ursachen. Warum das wichtig ist, zeigen die Daten Schritt für Schritt.

<script defer src="/js/lib/echarts.min.js"></script>

## Strom- und Gaspreis laufen seit 2019 eng zusammen

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

Dieser Gleichlauf ergibt sich aus der Preisbildung. Am Day-Ahead-Markt setzt für jede Stunde das teuerste Kraftwerk den Preis, das noch zur Deckung der Nachfrage gebraucht wird. In Deutschland ist das in vielen Stunden ein Gaskraftwerk. Wird Gas teurer, bietet dieses Kraftwerk höher, und der Strompreis steigt mit. Ein Gaskraftwerk mit einem Wirkungsgrad von 55 Prozent braucht etwa 1,8 Megawattstunden Gas für eine Megawattstunde Strom. Hinzu kommen die Kosten für CO₂-Zertifikate.

## Über alle Jahre: starker Zusammenhang mit Gas, kaum einer mit Erneuerbaren

Legt man alle 84 Monate in ein Streudiagramm, bilden die Gasmonate fast eine Gerade. Beim Erneuerbarenanteil entsteht dagegen eine Wolke ohne klare Richtung. Die Farben machen allerdings sichtbar, dass diese Wolke aus drei getrennten Gruppen besteht.

<div class="chart-section">
<h3 id="strompreis-streuung-gas-heading">Strompreis und Gaspreis je Monat, nach Zeitraum, 2019–2025</h3>
<p class="chart-description" id="strompreis-streuung-gas-description">Jeder Punkt ist ein Monat. Je höher der Gaspreis, desto höher der Strompreis. Die Pearson-Korrelation beträgt 0,97 über alle 84 Monate und liegt auch in jedem Teilzeitraum zwischen 0,75 und 0,96. Die gestrichelten Linien sind lineare Trends je Zeitraum.</p>
<div id="strompreis-streuung-gas" role="img" aria-labelledby="strompreis-streuung-gas-heading" aria-describedby="strompreis-streuung-gas-description" style="width: 100%; height: 440px;"></div>
<script defer src="/js/charts/strompreis_korrelation/streuung-gas.js"></script>
<div class="table-scroll" tabindex="0" role="region" aria-labelledby="strompreis-streuung-gas-heading">
<table id="strompreis-streuung-gas-table">
<caption>Ausgewählte Kennzahlen: Korrelation zwischen Strompreis und Gaspreis, Monatswerte</caption>
<thead><tr><th scope="col">Zeitraum</th><th scope="col">Monate</th><th scope="col">Pearson</th><th scope="col">Spearman</th><th scope="col">Partiell (Erneuerbarenanteil herausgerechnet)</th></tr></thead>
<tbody>
<tr><th scope="row">2019–2025</th><td>84</td><td>0,97</td><td>0,96</td><td>0,97</td></tr>
<tr><th scope="row">2019–2020</th><td>24</td><td>0,78</td><td>0,72</td><td>0,64</td></tr>
<tr><th scope="row">2021–2022</th><td>24</td><td>0,96</td><td>0,93</td><td>0,97</td></tr>
<tr><th scope="row">2023–2025</th><td>36</td><td>0,75</td><td>0,67</td><td>0,58</td></tr>
</tbody>
</table>
</div>
<div class="chart-sources"><strong>Quellen: </strong><a href="https://www.smard.de/home/marktdaten">Bundesnetzagentur | SMARD.de</a>; <a href="https://www.worldbank.org/en/research/commodity-markets">World Bank – Pink Sheet</a>; <a href="https://data.ecb.europa.eu/data/datasets/EXR/EXR.M.USD.EUR.SP00.A">EZB</a>; eigene Berechnung.</div>
</div>

<div class="chart-section">
<h3 id="strompreis-streuung-erneuerbare-heading">Strompreis und Erneuerbarenanteil je Monat, nach Zeitraum, 2019–2025</h3>
<p class="chart-description" id="strompreis-streuung-erneuerbare-description">Über alle 84 Monate zeigt sich kaum ein Zusammenhang (Pearson −0,17). Innerhalb der Zeiträume 2019–2020 und 2023–2025 fallen die Trendlinien jedoch deutlich ab (−0,90 und −0,82): Monate mit höherem Erneuerbarenanteil hatten dort niedrigere Strompreise. In der Krise 2021–2022 überlagert der Gaspreis diesen Zusammenhang (−0,08).</p>
<div id="strompreis-streuung-erneuerbare" role="img" aria-labelledby="strompreis-streuung-erneuerbare-heading" aria-describedby="strompreis-streuung-erneuerbare-description" style="width: 100%; height: 440px;"></div>
<script defer src="/js/charts/strompreis_korrelation/streuung-erneuerbare.js"></script>
<div class="table-scroll" tabindex="0" role="region" aria-labelledby="strompreis-streuung-erneuerbare-heading">
<table id="strompreis-streuung-erneuerbare-table">
<caption>Ausgewählte Kennzahlen: Korrelation zwischen Strompreis und Erneuerbarenanteil, Monatswerte</caption>
<thead><tr><th scope="col">Zeitraum</th><th scope="col">Monate</th><th scope="col">Pearson</th><th scope="col">Spearman</th><th scope="col">Partiell (Gaspreis herausgerechnet)</th></tr></thead>
<tbody>
<tr><th scope="row">2019–2025</th><td>84</td><td>−0,17</td><td>0,02</td><td>−0,06</td></tr>
<tr><th scope="row">2019–2020</th><td>24</td><td>−0,90</td><td>−0,91</td><td>−0,85</td></tr>
<tr><th scope="row">2021–2022</th><td>24</td><td>−0,08</td><td>−0,04</td><td>−0,44</td></tr>
<tr><th scope="row">2023–2025</th><td>36</td><td>−0,82</td><td>−0,81</td><td>−0,71</td></tr>
</tbody>
</table>
</div>
<div class="chart-sources"><strong>Quelle: </strong><a href="https://www.smard.de/home/marktdaten">Bundesnetzagentur | SMARD.de – Stromerzeugung und Großhandelspreise</a> (CC BY 4.0); eigene Berechnung.</div>
</div>

Warum verschwindet der Zusammenhang über den Gesamtzeitraum? Der Erneuerbarenanteil stieg vor allem **nach** der Krise: Im Mittel der Monate lag er 2019–2022 bei knapp 45 Prozent, 2023–2025 bei 58 Prozent. Zugleich waren Strom- und Gaspreis 2023–2025 mehr als doppelt so hoch wie 2019–2020. Mischt man die Phasen, heben sich der Niveausprung beim Gas und der Zusammenhang mit den Erneuerbaren innerhalb der Phasen weitgehend auf. Statistisch ist das ein Beispiel für das [Simpson-Paradoxon](https://de.wikipedia.org/wiki/Simpson-Paradoxon): Ein Zusammenhang, der in jeder Gruppe besteht, kann im zusammengelegten Datensatz verschwinden.

## Von Monat zu Monat: Erneuerbare erklären zuletzt mehr als Gas

Eine zweite Prüfung klammert den langfristigen Trend aus. Sie vergleicht nur, wie stark sich die Werte **von einem Monat zum nächsten** verändern. Über den Gesamtzeitraum dominiert auch hier der Gaspreis (**0,89** gegenüber **−0,54**). In den Jahren 2023–2025 kehrt sich das Bild aber um: Veränderungen des Erneuerbarenanteils gehen deutlich enger mit Veränderungen des Strompreises einher (**−0,85**) als Veränderungen des Gaspreises (**0,50**).

<div class="chart-section">
<h3 id="strompreis-korrelationen-heading">Korrelation mit dem Strompreis nach Zeitraum, Monatswerte 2019–2025</h3>
<p class="chart-description" id="strompreis-korrelationen-description">Die Balken zeigen die Pearson-Korrelation der Monatswerte mit dem Strompreis. Für den Gaspreis liegt sie in allen Zeiträumen zwischen 0,75 und 0,97. Für den Erneuerbarenanteil ist sie über den Gesamtzeitraum schwach (−0,17), 2019–2020 und 2023–2025 aber stark negativ (−0,90 und −0,82).</p>
<div id="strompreis-korrelationen" role="img" aria-labelledby="strompreis-korrelationen-heading" aria-describedby="strompreis-korrelationen-description" style="width: 100%; height: 400px;"></div>
<script defer src="/js/charts/strompreis_korrelation/korrelationen.js"></script>
<div class="table-scroll" tabindex="0" role="region" aria-labelledby="strompreis-korrelationen-heading">
<table id="strompreis-korrelationen-table">
<caption>Ausgewählte Kennzahlen: Pearson-Korrelation mit dem Strompreis für Monatswerte und Veränderungen zum Vormonat</caption>
<thead><tr><th scope="col">Zeitraum</th><th scope="col">Erneuerbarenanteil</th><th scope="col">Gaspreis</th><th scope="col">Veränderung Erneuerbarenanteil</th><th scope="col">Veränderung Gaspreis</th></tr></thead>
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

## Beide Größen zusammen betrachtet

Gaspreis und Erneuerbarenanteil hängen auch miteinander zusammen. In den Jahren 2019–2020 und 2023–2025 korrelieren sie jeweils mit rund **−0,6**. Im Winter ist Gas meist teurer, und es wird weniger Solarstrom erzeugt. Eine Regression nimmt deshalb beide Größen gleichzeitig auf. Die Koeffizienten geben an, um wie viele Euro je Megawattstunde der Strompreis im Mittel höher lag, wenn der Gaspreis um einen Euro je Megawattstunde oder der Erneuerbarenanteil um einen Prozentpunkt höher war und die jeweils andere Größe gleich blieb.

<div class="table-scroll" tabindex="0" role="region" aria-labelledby="strompreis-regression-caption">
<table id="strompreis-regression-table">
<caption id="strompreis-regression-caption">Ausgewählte Regressionsergebnisse: Strompreis in EUR/MWh, erklärt durch Gaspreis und Erneuerbarenanteil, Monatswerte, in Klammern 95-Prozent-Intervalle</caption>
<thead><tr><th scope="col">Modell und Zeitraum</th><th scope="col">Gaspreis (EUR/MWh je EUR/MWh)</th><th scope="col">Erneuerbarenanteil (EUR/MWh je Prozentpunkt)</th><th scope="col">R²</th></tr></thead>
<tbody>
<tr><th scope="row">2019–2025</th><td>1,68 (1,54 bis 1,82)</td><td>−0,11 (−0,42 bis 0,20)</td><td>0,95</td></tr>
<tr><th scope="row">2019–2020</th><td>0,68 (0,39 bis 0,98)</td><td>−0,95 (−1,18 bis −0,71)</td><td>0,89</td></tr>
<tr><th scope="row">2021–2022</th><td>1,72 (1,56 bis 1,88)</td><td>−2,13 (−3,72 bis −0,54)</td><td>0,94</td></tr>
<tr><th scope="row">2023–2025</th><td>0,91 (0,31 bis 1,52)</td><td>−1,59 (−2,10 bis −1,07)</td><td>0,79</td></tr>
<tr><th scope="row">2019–2025, mit Last und Kalendermonat</th><td>1,67 (1,56 bis 1,78)</td><td>−0,24 (−0,94 bis 0,45)</td><td>0,96</td></tr>
</tbody>
</table>
</div>

In den Jahren 2023–2025 lag der Strompreis bei gleichem Gaspreis um rund **1,59 Euro je Megawattstunde** niedriger, wenn der Erneuerbarenanteil einen Prozentpunkt höher war. Auch während der Krise 2021–2022 ist dieser Koeffizient negativ, sobald der Gaspreis berücksichtigt wird. In der einfachen Korrelation war der Zusammenhang dort vom Gaspreis verdeckt. Über den Gesamtzeitraum gilt das nicht: Der Koeffizient ist klein, und sein Intervall schließt null ein.

Die letzte Zeile ist ein Robustheitstest. Sie berücksichtigt zusätzlich den Stromverbrauch und den Kalendermonat. Dadurch fällt der **übliche jahreszeitliche Verlauf** heraus: sonniger Sommer, dunkler und verbrauchsstarker Winter. Übrig bleibt nur, ob ein Monat mehr oder weniger Erneuerbare hatte, als für die Jahreszeit üblich ist. Über den Gesamtzeitraum lässt sich dafür kein eindeutiger Zusammenhang nachweisen (**−0,24**, Intervall von −0,94 bis 0,45). Ein Teil des Zusammenhangs innerhalb der Phasen ist also Jahreszeit. Der Gaspreis-Koeffizient bleibt dagegen nahezu unverändert (**1,67**).

## Was die Zahlen zeigen und was nicht

- **Gas bestimmte das Niveau.** Ein Euro höherer Gaspreis je Megawattstunde ging über alle Jahre mit rund 1,7 Euro höherem Strompreis einher. Das liegt in der Größenordnung des Gasbedarfs eines Gaskraftwerks für eine Megawattstunde Strom.
- **Erneuerbare hängen mit dem Abstand nach unten zusammen.** Innerhalb ruhigerer Phasen lag der Strompreis in erneuerbarenstarken Monaten deutlich niedriger. Wie viel davon auf Wind und Sonne selbst zurückgeht und wie viel auf die Jahreszeit, lässt sich mit 84 Monatswerten nicht sauber trennen.
- **Korrelation ist keine Ursache.** Weitere Einflüsse fehlen in dieser Auswertung: CO₂- und Kohlepreise, Stromimporte, Kraftwerksausfälle und das Wetter in den Nachbarländern. Bewegen sich solche Größen gleichzeitig mit dem Gaspreis, steckt ihr Einfluss teilweise im Gas-Zusammenhang.
- **Monatsmittel glätten.** Innerhalb eines Tages wirkt der Erneuerbarenanteil viel direkter: In sonnigen Mittagsstunden fällt der Preis oft stark, abends steigt er wieder. Monatsdaten zeigen diesen Mechanismus nur abgeschwächt. Stündliche Werte zeigt das [Strom-Dashboard](/dashboards/strom/).
- **Großhandel ist nicht Haushaltsstrom.** Haushaltstarife enthalten Netzentgelte, Steuern und Umlagen. Außerdem kaufen Versorger oft Monate im Voraus ein. Die hier gezeigten Zusammenhänge übertragen sich deshalb nur verzögert und abgeschwächt auf Endkundenpreise.

Wie sich der Anteil erneuerbarer Stromerzeugung langfristig entwickelt hat, beschreibt der Beitrag [Erneuerbare Stromerzeugung auf dem Vormarsch](/posts/2025/Erneuerbare-Stromerzeugung-auf-dem-Vormarsch/). Weitere Analysen gibt es im [Themenbereich Energie](/themen/energie/).

## Methodik und Datenquellen

- **Strompreis:** Day-Ahead-Großhandelspreis der Gebotszone Deutschland–Luxemburg (DE–LU) von [Bundesnetzagentur | SMARD.de](https://www.smard.de/home/marktdaten), [CC BY 4.0](https://www.smard.de/home/datennutzung). Grundlage sind die Tagesmittel, gewichtet mit der Stundenzahl jedes Tages zu Monatsmitteln. Das ergibt ein zeitgewichtetes Monatsmittel. Die Monatswerte stimmen mit der Monatsauflösung von SMARD auf einen Cent je Megawattstunde überein.
- **Erneuerbarenanteil:** Anteil von Biomasse, Wasserkraft, Wind an Land, Wind auf See, Photovoltaik und sonstigen Erneuerbaren an der gesamten Nettostromerzeugung für das öffentliche Netz. Beide Größen sind je Monat als Energiesumme gebildet, nicht als Mittel täglicher Anteile. Pumpspeicher und Kernkraft zählen zur Erzeugung, aber nicht zu den Erneuerbaren. Das entspricht der Einteilung im [Strom-Dashboard](/dashboards/strom/). Quelle ist ebenfalls SMARD. Alle 2.557 Tage sind vollständig; kein Wert wurde geschätzt.
- **Gaspreis:** „Natural gas, Europe“ aus den monatlichen [Commodity Price Data (Pink Sheet) der World Bank](https://www.worldbank.org/en/research/commodity-markets), Stand 2. September 2026, [lizenziert unter CC BY 4.0](https://datacatalog.worldbank.org/search/dataset/0038238/commodity-prices-history-and-projections). Seit April 2015 ist das der niederländische Handelspunkt TTF, der wichtigste Referenzpreis für Gas in Europa. Es handelt sich um ein **Monatsmittel eines Benchmarkpreises**, nicht um einen täglichen Day-Ahead-Spotpreis und nicht um den Preis im deutschen Marktgebiet THE. Die beiden Handelspunkte liegen meist eng beieinander, sind aber nicht identisch.
- **Umrechnung:** Die World Bank veröffentlicht US-Dollar je MMBtu. Umgerechnet wurde mit dem monatlichen Mittel des [EZB-Referenzkurses US-Dollar/Euro](https://data.ecb.europa.eu/data/datasets/EXR/EXR.M.USD.EUR.SP00.A) (Quelle: EZB, [Nutzungsbedingungen](https://www.ecb.europa.eu/services/disclaimer/html/index.en.html)) und mit 1 MMBtu = 0,29307107 MWh. Die Umrechnung von Monatsmitteln mit einem Monatskurs ist eine Näherung an die Umrechnung einzelner Tageswerte.
- **Zeiträume:** 2019–2020 (vor der Krise), 2021–2022 (Gaspreiskrise), 2023–2025 (danach). Die Einteilung wurde vor der Berechnung festgelegt. Seit Oktober 2018 gilt durchgehend die Gebotszone DE–LU; 2026 ist noch nicht vollständig und daher nicht enthalten.
- **Statistik:** Pearson-Korrelationen der Monatswerte, als Robustheitsprüfung Spearman-Rangkorrelationen. Partielle Korrelationen rechnen die jeweils andere Größe linear heraus. Veränderungen sind Differenzen zum Vormonat innerhalb eines Zeitraums. Die Regressionen sind Kleinste-Quadrate-Schätzungen mit Konstante; die 95-Prozent-Intervalle beruhen auf Newey-West-Standardfehlern mit drei Monaten Verzögerung. Sie berücksichtigen, dass aufeinanderfolgende Monate einander ähneln, sind bei 24 bis 84 Monatswerten aber nur als Orientierung zu verstehen. Alle Kennzahlen lassen sich aus der veröffentlichten Monatstabelle nachrechnen.
- **Reproduzierbarkeit:** Daten, Code und Prüfsummen liegen im [öffentlichen Repository des Blogs](https://github.com/Graflinger/databearer). Gasdaten und Wechselkurse wurden am 26. September 2026 abgerufen.
