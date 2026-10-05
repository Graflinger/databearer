---
title: "Große Speicher treiben den Batterieausbau"
date: 2026-09-27
excerpt: "Große Batteriespeicher liefern einen immer größeren Teil der neuen Speicherkapazität in Deutschland. 2026 stellen sie schon fast die Hälfte, und das Jahr übertrifft bereits nach knapp neun Monaten das gesamte Vorjahr."
image: "/images/blog_card_images/2026/batteriespeicher-wandel.png"
imageAlt: "Illustration: Batteriespeicher-Schränke zwischen Solarmodulen, dahinter Windräder und ein Bauernhaus in hügeliger Landschaft bei Sonnenuntergang"
imageText: "Große Batteriespeicher liefern einen immer größeren Teil der neuen Speicherkapazität (KI-generiert)"
topic: ["energie", "wirtschaft"]
fullWidthCard: false
permalink: /posts/2026/batteriespeicher-wandel/
---

<script defer src="/js/lib/echarts.min.js"></script>

## Mehr Kapazität, getragen von großen Speichern

In Deutschland geht Jahr für Jahr mehr Batteriespeicherkapazität in Betrieb. Den Unterschied machen inzwischen die großen Speicher: 2024 stellten sie **13 Prozent** der neu installierten Kapazität, 2025 schon **26 Prozent** und 2026 bislang **48 Prozent**, also fast die Hälfte.

2025 kamen Speicher mit **6,77 GWh** hinzu, **9,11 Prozent mehr** als 2024, obwohl die Zahl der Anlagen um 2,02 Prozent sank. Die Kapazität großer Speicher hat sich im selben Zeitraum mehr als verdoppelt (**+110,04 Prozent**). 2026 ist mit **7,90 GWh** nach knapp neun Monaten schon jetzt das stärkste Jahr.

**2026\*** steht in diesem Beitrag für den 1. Januar bis 26. September 2026. Diese Werte sind unvollständig, weil Anlagen oft verspätet gemeldet werden, und daher eher eine Untergrenze. Hochgerechnet wird nicht. Außerdem zählt jede Anlage zum Jahr ihrer ersten Inbetriebnahme: Stillgelegte Anlagen fehlen, spätere Erweiterungen zählen mit ihrer heutigen Kapazität. Das ist also nicht dasselbe wie der tatsächliche Zubau eines Jahres. Mehr dazu unter [Daten und Quellen](#daten).

Insgesamt sind in Deutschland laut Register **2.769.020 Batteriespeicher** mit zusammen **20,22 Gigawatt Leistung** und **33,30 Gigawattstunden Speicherkapazität** in Betrieb. Fast alle davon sind kleine Anlagen mit weniger als 30 kW Leistung und 30 kWh Speicherkapazität. Die nur 652 großen Speicher stellen aber schon fast ein Viertel der gesamten Kapazität.

<div class="table-scroll" tabindex="0" role="region" aria-label="Tabelle: Batteriespeicher in Betrieb nach Größenklasse">
  <table id="battery-stock-table">
    <caption>Batteriespeicher in Betrieb nach technischer Größenklasse, Registerstand 26. September 2026, alle Inbetriebnahmejahre</caption>
    <thead><tr><th scope="col">Größenklasse</th><th scope="col">Anlagenzahl</th><th scope="col">Leistung (GW)</th><th scope="col">Speicherkapazität (GWh)</th><th scope="col">Median E/P (Stunden)</th></tr></thead>
    <tbody>
      <tr><th scope="row">Klein</th><td>2.740.190</td><td>15,008</td><td>23,710</td><td>1,84</td></tr>
      <tr><th scope="row">Mittel</th><td>28.178</td><td>0,829</td><td>1,774</td><td>2,56</td></tr>
      <tr><th scope="row">Groß</th><td>652</td><td>4,384</td><td>7,814</td><td>2,00</td></tr>
      <tr><th scope="row">Gesamt</th><td>2.769.020</td><td>20,222</td><td>33,299</td><td>1,84</td></tr>
    </tbody>
  </table>
</div>

<p class="table-note"><strong>Quelle:</strong> <a href="https://www.marktstammdatenregister.de/MaStR/Datendownload">Bundesnetzagentur, Marktstammdatenregister (MaStR)</a>, dl-de/by-2-0; eigene gefilterte Auswertung, Stand 26. September 2026. Geplante Anlagen sind nicht enthalten. Durch Rundung können die Summen leicht abweichen.</p>

<p class="table-note"><strong>Abgrenzung:</strong> Klein heißt Leistung unter 30 kW und Speicherkapazität unter 30 kWh. Groß heißt Leistung ab 1.000 kW oder Speicherkapazität ab 1.000 kWh. Alle übrigen Anlagen gehören zur mittleren Klasse.</p>

## Große Speicher wachsen am schnellsten

Der Blick auf die einzelnen Inbetriebnahmejahre zeigt, wie steil die großen Speicher zulegen. 2024 gingen 102 große Speicher in Betrieb, 2025 waren es 131 und 2026 bis Ende September bereits **215**. Ihre Kapazität stieg von 0,83 über 1,74 auf **3,77 GWh**. Die gesamte neue Kapazität wuchs im selben Zeitraum deutlich langsamer.

<div class="chart-section">
  <h3 id="battery-storage-trend-heading">Speicherkapazität und große Speicher je Inbetriebnahmejahr</h3>
  <p class="chart-description" id="battery-trend-description">Die neue Speicherkapazität aller Anlagen steigt von 0,46 GWh (2019) auf 6,77 GWh (2025) und liegt 2026* bereits bei 7,90 GWh. Große Speicher wachsen von 1,74 GWh mit 131 Anlagen (2025) auf 3,77 GWh mit 215 Anlagen (2026*). Die Anzahl großer Speicher steht auf der rechten Achse.</p>
  <div id="battery-storage-trend" role="img" aria-labelledby="battery-storage-trend-heading" aria-describedby="battery-trend-description" style="width: 100%; height: 400px;"></div>
  <script defer src="/js/charts/battery_storage/trend.js"></script>
  <div class="chart-sources"><strong>Quelle:</strong> <a href="https://www.marktstammdatenregister.de/MaStR/Datendownload">Bundesnetzagentur, Marktstammdatenregister (MaStR)</a>; eigene Auswertung, Stand 26. September 2026. 2026* = 1. Januar bis 26. September, nicht hochgerechnet.</div>
</div>

## Große Speicher überholen die kleinen

Bei kleinen Speichern ging die neu installierte Kapazität 2025 zurück, von 5,06 auf 4,59 GWh. Die mittlere Größenklasse wuchs leicht, die große hat sich mehr als verdoppelt. 2026\* liegen große Speicher mit 3,77 GWh erstmals seit 2016 wieder **vor den kleinen** (3,69 GWh). Damals war der Markt mit insgesamt rund 0,2 GWh allerdings noch winzig. Nachmeldungen können den Abstand für 2026 noch verändern.

Die Größenklassen sind rein technisch abgegrenzt. Sie verraten nicht, wem ein Speicher gehört. Ob Haushalte, Gewerbebetriebe oder Energieunternehmen investieren, lässt sich daraus nicht direkt ablesen.

<div class="chart-section">
  <h3 id="battery-storage-segments-heading">Neue Speicherkapazität nach Größenklasse</h3>
  <p class="chart-description" id="battery-segments-description">Die gestapelten Balken zeigen die Speicherkapazität je Inbetriebnahmejahr in GWh. Der Anteil großer Speicher wächst seit 2023 deutlich und liegt 2026* mit 3,77 GWh über dem der kleinen mit 3,69 GWh.</p>
  <div id="battery-storage-segments" role="img" aria-labelledby="battery-storage-segments-heading" aria-describedby="battery-segments-description" style="width: 100%; height: 400px;"></div>
  <script defer src="/js/charts/battery_storage/segments.js"></script>
  <div class="chart-sources"><strong>Quelle:</strong> <a href="https://www.marktstammdatenregister.de/MaStR/Datendownload">Bundesnetzagentur, MaStR</a>; eigene Auswertung, Stand 26. September 2026. 2026* = 1. Januar bis 26. September, nicht hochgerechnet.</div>
</div>

<div class="table-scroll" tabindex="0" role="region" aria-label="Tabelle: Speicherkapazität nach Größenklasse">
  <table id="battery-segments-table">
    <caption>Neue Speicherkapazität der Größenklassen in GWh je Inbetriebnahmejahr, Registerstand 26. September 2026</caption>
    <thead><tr><th scope="col">Größenklasse</th><th scope="col">2024</th><th scope="col">2025</th><th scope="col">2026*</th></tr></thead>
    <tbody>
      <tr><th scope="row">Klein</th><td>5,060</td><td>4,591</td><td>3,695</td></tr>
      <tr><th scope="row">Mittel</th><td>0,316</td><td>0,439</td><td>0,440</td></tr>
      <tr><th scope="row">Groß</th><td>0,827</td><td>1,737</td><td>3,768</td></tr>
      <tr><th scope="row">Gesamt</th><td>6,203</td><td>6,768</td><td>7,902</td></tr>
      <tr><th scope="row">Anteil groß</th><td>13 %</td><td>26 %</td><td>48 %</td></tr>
    </tbody>
  </table>
</div>

<p class="table-note"><strong>Quelle:</strong> <a href="https://www.marktstammdatenregister.de/MaStR/Datendownload">Bundesnetzagentur, Marktstammdatenregister (MaStR)</a>, dl-de/by-2-0; eigene gefilterte Auswertung, Stand 26. September 2026. 2026* = 1. Januar bis 26. September, unvollständig.</p>

## Die Speicherdauer steigt wieder

Teilt man die Speicherkapazität einer Anlage durch ihre Leistung, erhält man ihre nominale Speicherdauer (E/P). Ein Speicher mit 10 kWh und 5 kW kann rechnerisch zwei Stunden lang mit voller Leistung entladen. Wie er tatsächlich betrieben wird, zeigt diese Kennzahl nicht.

Bis 2022 lag der Median dieser Speicherdauer bei rund zwei Stunden, 2023 fiel er auf 1,63 Stunden. Seitdem steigt er wieder: von **1,66 Stunden** (2024) auf **1,92 Stunden** (2025) und **1,98 Stunden** (2026). Die Hälfte der Anlagen liegt darüber, die andere Hälfte darunter, große und kleine Anlagen zählen dabei gleich viel. Neue Speicher sind also wieder etwas ausdauernder ausgelegt. Ob dahinter neue Geschäftsmodelle stehen, lässt sich aus dem Register allein nicht ablesen.

<div class="chart-section">
  <h3 id="battery-storage-duration-heading">Median der nominalen Speicherdauer je Inbetriebnahmejahr</h3>
  <p class="chart-description" id="battery-duration-description">Der Median der nominalen Speicherdauer fällt von 2,17 Stunden (2019) auf 1,63 Stunden (2023) und steigt seitdem wieder auf 1,92 Stunden (2025) und 1,98 Stunden (2026*). Die Linie zeigt nur den mittleren Wert, nicht die Streuung der Anlagen.</p>
  <div id="battery-storage-duration" role="img" aria-labelledby="battery-storage-duration-heading" aria-describedby="battery-duration-description" style="width: 100%; height: 400px;"></div>
  <script defer src="/js/charts/battery_storage/duration.js"></script>
  <div class="chart-sources"><strong>Quelle:</strong> <a href="https://www.marktstammdatenregister.de/MaStR/Datendownload">Bundesnetzagentur, MaStR</a>; eigene Auswertung von Speicherkapazität und Leistung, Stand 26. September 2026. 2026* = 1. Januar bis 26. September.</div>
</div>

## Warum Speicher im Tagesverlauf gebraucht werden

Warum lohnt es sich überhaupt, Strom zeitlich zu verschieben? Ein Blick auf die Stundenwerte des Strommarkts der letzten 30 Tage, vom **27. August bis 25. September 2026**, gibt einen Eindruck.

Mittags, wenn die Solaranlagen am meisten Strom liefern, ist der Strom an der Börse am günstigsten: Um **13 Uhr liegt der mittlere Day-Ahead-Preis bei 37,94 EUR/MWh**. Am Abend, wenn die Sonne untergeht, steigt er deutlich an und erreicht **um 19 Uhr 248,93 EUR/MWh**. Das sind Durchschnittswerte über 30 Tage, keine Preise, die an jedem einzelnen Tag erreicht werden.

<div class="chart-section">
  <h3 id="battery-storage-profile-heading">Strompreis und Solarerzeugung im Tagesverlauf</h3>
  <p class="chart-description" id="battery-profile-description">Mittelwerte je Stunde für den 27. August bis 25. September 2026: Der Day-Ahead-Preis ist um 13 Uhr am niedrigsten und um 19 Uhr am höchsten, die Solarerzeugung erreicht ihr Maximum um die Mittagszeit. Beide Diagramme haben eigene Achsen und Einheiten.</p>
  <h4 id="battery-storage-daily-price-heading">Day-Ahead-Preis (DE–LU) in EUR/MWh</h4>
  <div id="battery-storage-daily-price" role="img" aria-labelledby="battery-storage-daily-price-heading" aria-describedby="battery-profile-description" style="width: 100%; height: 400px;"></div>
  <script defer src="/js/charts/battery_storage/daily-price.js"></script>
  <h4 id="battery-storage-daily-solar-heading">Solarerzeugung in Deutschland in GW</h4>
  <div id="battery-storage-daily-solar" role="img" aria-labelledby="battery-storage-daily-solar-heading" aria-describedby="battery-profile-description" style="width: 100%; height: 400px;"></div>
  <script defer src="/js/charts/battery_storage/daily-solar.js"></script>
  <div class="chart-sources"><strong>Quelle:</strong> <a href="https://www.smard.de/home/marktdaten">Bundesnetzagentur | SMARD.de</a>, CC BY 4.0; eingefrorene Stundendaten aus dem <a href="/dashboards/strom/">Databearer-Stromdashboard</a>, eigene Mittelwerte für den 27. August bis 25. September 2026.</div>
</div>

Dieses Muster ist als **„Duck Curve“** bekannt, als Entenkurve. Der Begriff stammt vom kalifornischen Netzbetreiber und beschreibt eigentlich die Residuallast, also den Strombedarf, der nach Abzug von Wind- und Solarstrom noch von anderen Kraftwerken gedeckt werden muss. Mittags drückt der Solarstrom diese Last tief nach unten, das ist der Bauch der Ente. Am Abend fällt er innerhalb weniger Stunden weg, während der Verbrauch hoch bleibt. Die Residuallast steigt dann steil an, das ist der Hals. Die Börsenpreise folgen diesem Verlauf: Zwischen 13 und 19 Uhr sinkt die mittlere Solarerzeugung von rund 37 GW auf unter 1 GW, gleichzeitig steigt der Preis um mehr als 200 EUR/MWh.

Mit jeder weiteren Solaranlage wird der Bauch tiefer und der Abendanstieg steiler. Das ist ein bekanntes Problem des Solarausbaus: Mittags ist zeitweise mehr Strom da als gebraucht wird, abends müssen andere Kraftwerke in kurzer Zeit hochfahren. Genau diese Lücke können Batteriespeicher schließen, indem sie mittags laden und am Abend einspeisen.

Der Zusammenhang ist **deskriptiv, kein Kausalnachweis**. Auch Nachfrage, Wind, Kraftwerksverfügbarkeit und Stromhandel mit den Nachbarländern beeinflussen die Preise. Und aus der Differenz zweier Durchschnittspreise folgt noch kein Gewinn für einen Speicher: Dafür fehlen unter anderem Investitions- und Betriebskosten, Wirkungsgrad, Alterung und Netzentgelte.

## Der Ausbau wird größer, nicht nur breiter

Die Zahl neuer Batteriespeicher ist seit ihrem Höchststand 2023 leicht gesunken, ihre Kapazität wächst dagegen weiter. Eine 2024 in Betrieb genommene Anlage brachte im Schnitt 10,8 kWh mit, 2025 waren es 12,0 kWh und 2026\* bereits 16,9 kWh. Getragen wird das von großen Speichern, die fast die Hälfte der neuen Kapazität stellen. Für die Duck Curve ist das die entscheidende Größe: Je mehr Speicherkapazität zur Verfügung steht, desto mehr Mittagsstrom lässt sich in den Abend verschieben.

Der Beitrag knüpft an [„Technologieoffenheit oder Industriepolitik?“](/posts/2025/Industriepolitik/) an, in dem es um fallende Batteriepreise und die Elektrifizierung geht. Aktuelle Erzeugungs- und Preisdaten zeigt das [Stromdashboard](/dashboards/strom/). Dessen Datenstand ändert sich laufend, dieser Beitrag beschreibt den Stand vom 26. September 2026.

<h2 id="daten">Daten und Quellen</h2>

Grundlage ist der öffentliche Gesamtdatenexport des Marktstammdatenregisters vom **26. September 2026**. Berücksichtigt sind Batteriespeicher in Deutschland, die in Betrieb sind. Geplante und stillgelegte Anlagen fehlen. Einträge mit offensichtlich unplausiblen oder fehlenden Angaben zu Leistung, Kapazität oder Inbetriebnahmedatum sind ausgeschlossen. Das betrifft weniger als ein Prozent der Anlagen, aber knapp vier Prozent der gemeldeten Kapazität. Die Gesamtwerte dürften daher etwas zu niedrig liegen.

Jede Anlage zählt zum Jahr ihrer ersten Inbetriebnahme, spätere Erweiterungen eingeschlossen. 2026\* reicht bis zum 26. September und wird nicht hochgerechnet. Das Tagesprofil mittelt die SMARD-Stundenwerte vom 27. August bis 25. September 2026 je Stunde.

- **Batteriespeicher:** [Bundesnetzagentur, Marktstammdatenregister](https://www.marktstammdatenregister.de/MaStR/Datendownload), [Datenlizenz Deutschland – Namensnennung – Version 2.0](https://www.govdata.de/dl-de/by-2-0); eigene Auswertung.
- **Strommarkt:** [Bundesnetzagentur | SMARD.de](https://www.smard.de/home/marktdaten), [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/); eigene Mittelwerte je Stunde.
