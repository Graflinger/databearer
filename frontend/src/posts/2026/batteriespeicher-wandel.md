---
title: "Weniger neue Batteriespeicher, mehr Speicherkapazität"
date: 2026-09-26
lastUpdated: 2026-09-26
excerpt: "2025 gingen weniger Batteriespeicher in Betrieb als 2024, aber mit rund 9 Prozent mehr Speicherkapazität. Den Unterschied machen große Speicher, und 2026 setzt sich der Trend verstärkt fort."
image: "/images/blog_card_images/2026/batteriespeicher-wandel.png"
imageAlt: "Reihen weißer Batteriespeicher-Container neben einem Solarpark in ländlicher Landschaft bei Abendsonne"
imageText: "Große Batteriespeicher liefern einen immer größeren Teil der neuen Speicherkapazität"
topic: ["energie", "wirtschaft"]
fullWidthCard: false
permalink: /posts/2026/batteriespeicher-wandel/
---

<script defer src="/js/lib/echarts.min.js"></script>

## Weniger Anlagen, mehr Kapazität

Wer auf die Batteriespeicher schaut, die 2025 in Betrieb gegangen sind, sieht zwei gegenläufige Entwicklungen: Es sind **2,02 Prozent weniger Anlagen** als im Jahr davor, sie bringen aber **9,11 Prozent mehr Speicherkapazität** mit. Den Unterschied machen vor allem große Speicher. Wer nur Anlagen zählt, übersieht also einen wichtigen Teil des Bildes.

Dabei handelt es sich um einen **Kohortenvergleich**: Gezählt werden die Anlagen, die im aktuellen Register noch in Betrieb sind, jeweils im Jahr ihrer ersten Inbetriebnahme. Das ist nicht dasselbe wie der tatsächliche Zubau eines Jahres, denn stillgelegte Anlagen fehlen und spätere Erweiterungen zählen mit ihrer heutigen Kapazität. Mehr dazu steht unter [Daten und Quellen](#daten).

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

Das laufende Jahr 2026 ist noch unvollständig und folgt [in einem eigenen Abschnitt](#jahr-2026).

## Anlagenzahl und Speicherkapazität erzählen verschiedene Geschichten

Die Kohorte 2024 umfasst 574.051 Anlagen mit zusammen 6,20 GWh Speicherkapazität. Für 2025 sind es 562.472 Anlagen mit 6,77 GWh. Die Leistung sinkt dagegen leicht von 4,03 auf 3,96 GW. Mehr Speicherkapazität bedeutet also nicht automatisch mehr Leistung.

Der Unterschied zwischen den beiden Größen ist schnell erklärt: **Leistung (GW)** beschreibt, wie schnell ein Speicher Energie aufnehmen oder abgeben kann. **Speicherkapazität (GWh)** beschreibt, wie viel Energie er insgesamt speichern kann.

<div class="chart-section">
  <h3 id="battery-storage-cohorts-heading">Anlagenzahl und Speicherkapazität, jeweils 2024 = 100</h3>
  <p class="chart-description" id="battery-cohorts-description">Die Kurven vergleichen die Inbetriebnahme-Kohorten 2019 bis 2025 im Registerstand vom 26. September 2026. Beide Reihen sind auf 2024 = 100 normiert: 2025 liegt die Anlagenzahl bei rund 97,98, die Speicherkapazität bei 109,11.</p>
  <div id="battery-storage-cohorts" role="img" aria-labelledby="battery-storage-cohorts-heading" aria-describedby="battery-cohorts-description" style="width: 100%; height: 400px;"></div>
  <script defer src="/js/charts/battery_storage/cohorts.js"></script>
  <div class="chart-sources"><strong>Quelle:</strong> <a href="https://www.marktstammdatenregister.de/MaStR/Datendownload">Bundesnetzagentur, Marktstammdatenregister (MaStR)</a>; eigene gefilterte Auswertung, Stand 26. September 2026.</div>
</div>

<div class="table-scroll" tabindex="0" role="region" aria-label="Tabelle: Kernwerte der Kohorten 2024 und 2025">
  <table id="battery-cohorts-table">
    <caption>Kernwerte der Inbetriebnahme-Kohorten 2024 und 2025, Registerstand 26. September 2026</caption>
    <thead><tr><th scope="col">Kohorte</th><th scope="col">Anlagenzahl</th><th scope="col">Leistung (GW)</th><th scope="col">Speicherkapazität (GWh)</th><th scope="col">Median E/P (Stunden)</th></tr></thead>
    <tbody>
      <tr><th scope="row">2024</th><td>574.051</td><td>4,029</td><td>6,203</td><td>1,66</td></tr>
      <tr><th scope="row">2025</th><td>562.472</td><td>3,965</td><td>6,768</td><td>1,92</td></tr>
    </tbody>
  </table>
</div>

## Der Zuwachs kommt von den großen Speichern

Bei den kleinen Speichern sinkt die Kapazität von 5,06 auf 4,59 GWh. Die mittlere Größenklasse wächst von 0,32 auf 0,44 GWh, die große von 0,83 auf 1,74 GWh. Das ist ein Plus von **110,04 Prozent**. Die großen Speicher gleichen den Rückgang bei den kleinen damit mehr als aus.

Die Größenklassen sind rein technisch abgegrenzt. Sie verraten nicht, wem ein Speicher gehört. Ob also Haushalte, Gewerbebetriebe oder Energieunternehmen investieren, lässt sich daraus nicht direkt ablesen.

<div class="chart-section">
  <h3 id="battery-storage-segments-heading">Speicherkapazität nach Größenklasse</h3>
  <p class="chart-description" id="battery-segments-description">Die gestapelten Balken zeigen die Speicherkapazität je Inbetriebnahme-Kohorte in GWh. Zwischen 2024 und 2025 legt die große Klasse deutlich zu, während die kleine Klasse zurückgeht.</p>
  <div id="battery-storage-segments" role="img" aria-labelledby="battery-storage-segments-heading" aria-describedby="battery-segments-description" style="width: 100%; height: 400px;"></div>
  <script defer src="/js/charts/battery_storage/segments.js"></script>
  <div class="chart-sources"><strong>Quelle:</strong> <a href="https://www.marktstammdatenregister.de/MaStR/Datendownload">Bundesnetzagentur, MaStR</a>; eigene Auswertung, Stand 26. September 2026.</div>
</div>

<div class="table-scroll" tabindex="0" role="region" aria-label="Tabelle: Speicherkapazität nach Größenklasse">
  <table id="battery-segments-table">
    <caption>Speicherkapazität der Größenklassen in GWh, Registerstand 26. September 2026; 2026 unvollständig (1. Januar bis 26. September)</caption>
    <thead><tr><th scope="col">Größenklasse</th><th scope="col">Kohorte 2024</th><th scope="col">Kohorte 2025</th><th scope="col">2026 bis 26. September</th></tr></thead>
    <tbody>
      <tr><th scope="row">Klein</th><td>5,060</td><td>4,591</td><td>3,695</td></tr>
      <tr><th scope="row">Mittel</th><td>0,316</td><td>0,439</td><td>0,440</td></tr>
      <tr><th scope="row">Groß</th><td>0,827</td><td>1,737</td><td>3,768</td></tr>
    </tbody>
  </table>
</div>

<p class="table-note"><strong>Abgrenzung:</strong> Klein heißt Leistung unter 30 kW und Speicherkapazität unter 30 kWh. Groß heißt Leistung ab 1.000 kW oder Speicherkapazität ab 1.000 kWh. Alle übrigen Anlagen gehören zur mittleren Klasse.</p>

## Die Speicher halten etwas länger durch

Teilt man die Speicherkapazität einer Anlage durch ihre Leistung, erhält man ihre nominale Speicherdauer (E/P). Ein Speicher mit 10 kWh und 5 kW kann rechnerisch zwei Stunden lang mit voller Leistung entladen. Wie er tatsächlich betrieben wird, zeigt diese Kennzahl nicht.

Der Median dieser Speicherdauer steigt von **1,66 Stunden** in der Kohorte 2024 auf **1,92 Stunden** in der Kohorte 2025. Die Hälfte der Anlagen liegt darüber, die andere Hälfte darunter. Große und kleine Anlagen zählen dabei gleich viel.

<div class="chart-section">
  <h3 id="battery-storage-duration-heading">Median der nominalen Speicherdauer je Kohorte</h3>
  <p class="chart-description" id="battery-duration-description">Der Median der nominalen Speicherdauer liegt 2025 bei 1,92 Stunden und damit höher als 2024 mit 1,66 Stunden. Die Linie zeigt nur den mittleren Wert, nicht die Streuung der Anlagen.</p>
  <div id="battery-storage-duration" role="img" aria-labelledby="battery-storage-duration-heading" aria-describedby="battery-duration-description" style="width: 100%; height: 400px;"></div>
  <script defer src="/js/charts/battery_storage/duration.js"></script>
  <div class="chart-sources"><strong>Quelle:</strong> <a href="https://www.marktstammdatenregister.de/MaStR/Datendownload">Bundesnetzagentur, MaStR</a>; eigene Auswertung von Speicherkapazität und Leistung, Stand 26. September 2026.</div>
</div>

Die 2025 in Betrieb gegangenen Speicher sind also im Mittel etwas ausdauernder ausgelegt. Ob dahinter neue Geschäftsmodelle stehen, lässt sich aus dem Register allein nicht ablesen, denn Ladezustand, Verluste und Betriebsstrategie werden dort nicht erfasst.

<h2 id="jahr-2026">2026: Große Speicher überholen die kleinen</h2>

Das laufende Jahr ist noch nicht vorbei, und viele Anlagen werden erst mit Verzögerung im Register gemeldet. Trotzdem zeigt der Zwischenstand bereits eine klare Richtung: Bis zum 26. September sind **466.762 Anlagen mit 7,90 GWh** Speicherkapazität hinzugekommen, darunter **215 große Speicher**, nach 131 im gesamten Jahr 2025.

Diese großen Speicher bringen es schon jetzt auf **3,77 GWh**. Das ist mehr als doppelt so viel wie im gesamten Jahr 2025 (1,74 GWh). Damit liegt die Kapazität der großen Klasse erstmals seit 2016 wieder **über der der kleinen Speicher** (3,69 GWh). Damals war der Markt mit insgesamt rund 0,2 GWh allerdings noch winzig.

<div class="table-scroll" tabindex="0" role="region" aria-label="Tabelle: Zwischenstand 2026 im Vergleich zu 2025">
  <table id="battery-2026-table">
    <caption>Inbetriebnahme-Kohorte 2026 bis 26. September (unvollständig) im Vergleich zum vollständigen Jahr 2025, Registerstand 26. September 2026</caption>
    <thead><tr><th scope="col">Kennzahl</th><th scope="col">2025 (ganzes Jahr)</th><th scope="col">2026 bis 26. September</th></tr></thead>
    <tbody>
      <tr><th scope="row">Anlagen insgesamt</th><td>562.472</td><td>466.762</td></tr>
      <tr><th scope="row">Speicherkapazität insgesamt (GWh)</th><td>6,768</td><td>7,902</td></tr>
      <tr><th scope="row">Große Speicher (Anzahl)</th><td>131</td><td>215</td></tr>
      <tr><th scope="row">Große Speicher (GWh)</th><td>1,737</td><td>3,768</td></tr>
      <tr><th scope="row">Median E/P (Stunden)</th><td>1,92</td><td>1,98</td></tr>
    </tbody>
  </table>
</div>

<p class="table-note"><strong>Quelle:</strong> <a href="https://www.marktstammdatenregister.de/MaStR/Datendownload">Bundesnetzagentur, Marktstammdatenregister (MaStR)</a>, dl-de/by-2-0; eigene gefilterte Auswertung, Stand 26. September 2026.</p>

Auch insgesamt liegt die Speicherkapazität 2026 schon nach knapp neun Monaten über dem Wert des gesamten Vorjahres. Weil Nachmeldungen die Zahlen in der Regel noch erhöhen, sind die Werte für 2026 eher als Untergrenze zu verstehen. Auf das ganze Jahr hochgerechnet wird bewusst nicht, und in den Diagrammen oben bleibt 2026 außen vor, bis das Jahr abgeschlossen ist.

## Warum Speicher im Tagesverlauf interessant sind

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

## Mehr Kapazität pro Anlage

Weniger Anlagen, mehr Kapazität und eine längere Speicherdauer: Die Kohorte 2025 unterscheidet sich deutlich von der des Vorjahres. Im Durchschnitt bringt eine 2025 in Betrieb genommene Anlage rund 12,0 kWh Speicherkapazität mit, 2024 waren es 10,8 kWh. Getragen wird das vor allem von den großen Speichern. Der Zwischenstand für 2026 zeigt, dass sich diese Entwicklung eher noch beschleunigt: Große Speicher stellen dort erstmals seit 2016 wieder mehr Kapazität als kleine.

Der Beitrag knüpft an [„Technologieoffenheit oder Industriepolitik?“](/posts/2025/Industriepolitik/) an, in dem es um fallende Batteriepreise und die Elektrifizierung geht. Aktuelle Erzeugungs- und Preisdaten zeigt das [Stromdashboard](/dashboards/strom/). Dessen Datenstand ändert sich laufend, dieser Beitrag beschreibt den Stand vom 26. September 2026.

<h2 id="daten">Daten und Quellen</h2>

Grundlage ist der öffentliche Gesamtdatenexport des Marktstammdatenregisters vom **26. September 2026**. Berücksichtigt sind Batteriespeicher in Deutschland, die in Betrieb sind. Geplante und stillgelegte Anlagen fehlen. Einträge mit offensichtlich unplausiblen oder fehlenden Angaben zu Leistung, Kapazität oder Inbetriebnahmedatum sind ausgeschlossen. Das betrifft weniger als ein Prozent der Anlagen, aber knapp vier Prozent der gemeldeten Kapazität. Die Gesamtwerte dürften daher etwas zu niedrig liegen.

Jede Anlage zählt zum Jahr ihrer ersten Inbetriebnahme, spätere Erweiterungen eingeschlossen. Das Tagesprofil mittelt die SMARD-Stundenwerte vom 27. August bis 25. September 2026 je Stunde.

- **Batteriespeicher:** [Bundesnetzagentur, Marktstammdatenregister](https://www.marktstammdatenregister.de/MaStR/Datendownload), [Datenlizenz Deutschland – Namensnennung – Version 2.0](https://www.govdata.de/dl-de/by-2-0); eigene Auswertung.
- **Strommarkt:** [Bundesnetzagentur | SMARD.de](https://www.smard.de/home/marktdaten), [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/); eigene Mittelwerte je Stunde.
