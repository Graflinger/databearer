---
title: "Weniger neue Batteriespeicher, mehr Speicherkapazität"
date: 2026-09-26
lastUpdated: 2026-09-26
excerpt: "2025 gingen weniger Batteriespeicher in Betrieb als 2024, aber mit rund 9 Prozent mehr Speicherkapazität. Den Unterschied machen große Speicher, und 2026 setzt sich der Trend verstärkt fort."
topic: ["energie", "wirtschaft"]
fullWidthCard: false
permalink: /posts/2026/batteriespeicher-wandel/
---

<script defer src="/js/lib/echarts.min.js"></script>

## Weniger Anlagen, mehr Kapazität

Wer auf die Batteriespeicher schaut, die 2025 in Betrieb gegangen sind, sieht zwei gegenläufige Entwicklungen: Es sind **2,02 Prozent weniger Anlagen** als im Jahr davor, sie bringen aber **9,11 Prozent mehr Speicherkapazität** mit. Den Unterschied machen vor allem große Speicher. Wer nur Anlagen zählt, übersieht also einen wichtigen Teil des Bildes.

Dabei handelt es sich um einen **Kohortenvergleich**: Wir zählen die Anlagen, die im aktuellen Register noch in Betrieb sind, und ordnen sie dem Jahr ihrer ersten Inbetriebnahme zu. Das ist nicht dasselbe wie der tatsächliche Zubau eines Jahres, denn stillgelegte Anlagen fehlen und spätere Erweiterungen zählen mit ihrer heutigen Kapazität. Mehr dazu steht in der [Methodik](#methodik).

Insgesamt sind in Deutschland nach unserer Auswertung **2.769.020 Batteriespeicher** mit zusammen **20,22 Gigawatt Leistung** und **33,30 Gigawattstunden Speicherkapazität** in Betrieb. Fast alle davon sind kleine Anlagen mit weniger als 30 kW Leistung und 30 kWh Speicherkapazität. Die nur 652 großen Speicher stellen aber schon fast ein Viertel der gesamten Kapazität.

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

**Quelle:** [Bundesnetzagentur, Marktstammdatenregister (MaStR)](https://www.marktstammdatenregister.de/MaStR/Datendownload), dl-de/by-2-0; eigene gefilterte Auswertung, Stand 26. September 2026. Geplante Anlagen sind nicht enthalten. Durch Rundung können die Summen leicht abweichen.

Grundlage ist der Registerstand des Marktstammdatenregisters vom **26. September 2026**. Das laufende Jahr 2026 betrachten wir [in einem eigenen Abschnitt](#jahr-2026).

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
  <div class="chart-sources"><strong>Quelle:</strong> <a href="https://www.marktstammdatenregister.de/MaStR/Datendownload">Bundesnetzagentur, MaStR</a>; eigene Auswertung, Stand 26. September 2026. Größenschwellen angelehnt an die <a href="https://battery-charts.de/battery-charts/#methodology">Methodik von Battery Charts (RWTH Aachen)</a>.</div>
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

**Abgrenzung:** Klein heißt Leistung **unter 30 kW und** Speicherkapazität **unter 30 kWh**. Groß heißt Leistung **ab 1.000 kW oder** Speicherkapazität **ab 1.000 kWh**. Alle übrigen Anlagen gehören zur mittleren Klasse.

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

**Quelle:** [Bundesnetzagentur, Marktstammdatenregister (MaStR)](https://www.marktstammdatenregister.de/MaStR/Datendownload), dl-de/by-2-0; eigene gefilterte Auswertung, Stand 26. September 2026.

Auch insgesamt liegt die Speicherkapazität 2026 schon nach knapp neun Monaten über dem Wert des gesamten Vorjahres. Weil Nachmeldungen die Zahlen in der Regel noch erhöhen, sind die Werte für 2026 eher als Untergrenze zu verstehen. Hochrechnungen auf das ganze Jahr nehmen wir bewusst nicht vor, und in den Diagrammen oben bleibt 2026 außen vor, bis das Jahr abgeschlossen ist.

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

Der Zusammenhang ist **deskriptiv, kein Kausalnachweis**. Auch Nachfrage, Wind, Kraftwerksverfügbarkeit und Stromhandel mit den Nachbarländern beeinflussen die Preise. Und aus der Differenz zweier Durchschnittspreise folgt noch kein Gewinn für einen Speicher: Dafür fehlen unter anderem Investitions- und Betriebskosten, Wirkungsgrad, Alterung und Netzentgelte.

## Mehr Kapazität pro Anlage

Weniger Anlagen, mehr Kapazität und eine längere Speicherdauer: Die Kohorte 2025 unterscheidet sich deutlich von der des Vorjahres. Im Durchschnitt bringt eine 2025 in Betrieb genommene Anlage rund 12,0 kWh Speicherkapazität mit, 2024 waren es 10,8 kWh. Getragen wird das vor allem von den großen Speichern. Der Zwischenstand für 2026 zeigt, dass sich diese Entwicklung eher noch beschleunigt: Große Speicher stellen dort erstmals seit 2016 wieder mehr Kapazität als kleine.

Der Beitrag knüpft an [„Technologieoffenheit oder Industriepolitik?“](/posts/2025/Industriepolitik/) an, in dem es um fallende Batteriepreise und die Elektrifizierung geht. Aktuelle Erzeugungs- und Preisdaten zeigt das [Stromdashboard](/dashboards/strom/). Dessen Datenstand ändert sich laufend, dieser Beitrag beschreibt den Stand vom 26. September 2026.

<h2 id="methodik">Methodik und Datenquellen</h2>

### Registerstand und Zähleinheit

Grundlage ist der öffentliche [Gesamtdatenexport des Marktstammdatenregisters](https://www.marktstammdatenregister.de/MaStR/Datendownload) vom **26. September 2026**. Aus dem [datierten Archiv](https://download.marktstammdatenregister.de/Gesamtdatenexport_20260926_26.1.zip) haben wir alle **88 Dateien** zu Speichereinheiten, Speicheranlagen, EEG-Speicheranlagen und den zugehörigen Katalogen vollständig geladen, ohne Stichprobe.

Die Quelle enthält **2.824.640 Speichereinheiten** aller Technologien und Betriebszustände. Berücksichtigt werden davon nur Batteriespeicher in Deutschland, die in Betrieb sind und deren Einheiten eindeutig einer Speicheranlage zugeordnet sind. Nach den Plausibilitätsfiltern bleiben **2.769.021 Einheiten in 2.769.020 Anlagen**. Die jüngste enthaltene Inbetriebnahme ist vom **26. September 2026**. Geplante Anlagen sind nicht enthalten.

Gezählt werden **Anlagen**, nicht einzelne Einheiten. Die Leistung (Nettonennleistung) der Einheiten einer Anlage wird addiert, ihre nutzbare Speicherkapazität nur einmal gezählt. Doppelte oder widersprüchliche Einträge schließen wir aus, damit keine Kapazität mehrfach gezählt wird.

### Plausibilitätsfilter

Eingeschlossen werden Anlagen mit gültigem Inbetriebnahmedatum zwischen **1. Januar 1990 und 26. September 2026**, einer Leistung **über 0,3 kW**, einer Speicherkapazität **über 0,3 kWh** und einer nominalen Speicherdauer (E/P) **von 0,1 bis 12 Stunden**. Fehlende oder widersprüchliche Angaben werden nicht als null gewertet, sondern ausgeschlossen.

Die Filter betreffen **12.735 von 2.781.756 Einheiten (0,46 Prozent)**, aber **0,04 GW der bekannten Leistung (0,19 Prozent)** und **1,27 GWh der bekannten Speicherkapazität (3,68 Prozent)**. Nach Anzahl sind die Ausschlüsse also gering, nach Kapazität etwas relevanter. Bei 55 Einträgen ist die Speicherkapazität unbekannt. Ein Eintrag kann aus mehreren Gründen ausgeschlossen werden.

Wir nehmen **keine Betreibertyp-Korrektur und keine Imputation** fehlender Werte vor. Die [Methodik von Battery Charts (RWTH Aachen)](https://battery-charts.de/battery-charts/#methodology) diente als Vergleich für Plausibilitätsschwellen und Größenklassen. Battery Charts prüft und korrigiert zusätzlich Betreiber- und Netzanschlussangaben. Unsere Zahlen sind deshalb **nicht die korrigierten RWTH-Gesamtsummen** und weichen davon ab.

### Kohorten statt Zubau

Jede Anlage wird dem Jahr ihrer **frühesten Inbetriebnahme** zugeordnet. Wurde sie später erweitert, zählt ihre heutige Kapazität trotzdem zum ursprünglichen Jahr. Außerdem enthält der Registerstand nur Anlagen, die heute noch in Betrieb sind. Stillgelegte Anlagen fehlen (**Survivor-Effekt**). Eine echte Zeitreihe des jährlichen Zubaus lässt sich aus einem einzelnen Registerstand deshalb nicht rekonstruieren.

Nachmeldungen und Korrekturen können auch bereits abgeschlossene Jahre noch verändern. Für das laufende Jahr 2026 gilt das besonders, deshalb zeigen die Diagramme nur die Jahre 2019 bis 2025. Die Werte für 2026 weisen wir separat als unvollständigen Zwischenstand aus: Sie können sich durch Nachmeldungen und Korrekturen noch ändern und werden nicht hochgerechnet. Der Index ist der Jahreswert geteilt durch den Wert von 2024, mal 100. Prozentveränderungen berechnen wir aus den ungerundeten Werten. Die nominale Speicherdauer wird je Anlage berechnet und als ungewichteter Median je Kohorte ausgewiesen.

### Strommarktdaten

Das Tagesprofil nutzt die SMARD-Stundenwerte vom **27. August bis 25. September 2026** aus der Datengrundlage des Stromdashboards, eingefroren mit dem Stand vom 26. September 2026. Für jede Stunde (Ortszeit Berlin) mitteln wir die Werte der 30 Tage. Einzelne Speicher und ihr tatsächlicher Betrieb werden dabei nicht betrachtet.

### Quellen und Lizenzen

- **Batteriespeicher:** [Bundesnetzagentur, Marktstammdatenregister – Datendownload](https://www.marktstammdatenregister.de/MaStR/Datendownload), [Datenlizenz Deutschland – Namensnennung – Version 2.0](https://www.govdata.de/dl-de/by-2-0); eigene Filter und Aggregationen wie oben beschrieben.
- **Strommarkt:** [Bundesnetzagentur | SMARD.de](https://www.smard.de/home/marktdaten), [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/); eigene Mittelwerte je Stunde.
- **Methodischer Vergleich:** [Battery Charts – Methodology](https://battery-charts.de/battery-charts/#methodology), RWTH Aachen. Übernommen wurden nur die Größenschwellen als Orientierung, keine Daten.

Der Beitrag zeigt ausschließlich aggregierte Kennzahlen. Einzelne Anlagen-, Einheiten- oder Betreiberdaten veröffentlichen wir nicht.
