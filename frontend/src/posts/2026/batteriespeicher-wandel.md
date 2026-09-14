---
title: "Weniger neue Batteriespeicher, mehr Speicherkapazität"
date: 2026-09-11
lastUpdated: 2026-09-11
excerpt: "Rechercheentwurf: Die Registerkohorte 2025 umfasst weniger Anlagen als 2024, aber mehr Speicherkapazität. Ein Blick auf Größenklassen und nominale Speicherdauer."
topic: ["energie", "wirtschaft"]
fullWidthCard: false
eleventyExcludeFromCollections: true
excludeFromSitemap: true
permalink: /posts/2026/batteriespeicher-wandel/
---

**DRAFT – explorativer Rechercheentwurf, noch nicht redaktionell freigegeben.** Die folgenden Zahlen beschreiben einen gefilterten Registerstand vom **30. Juni 2026**. Sie sind kein aktueller Bestandsbericht für September 2026.

In der Inbetriebnahme-Kohorte 2025 stehen **2,48 Prozent weniger Batteriespeicheranlagen**, aber **8,68 Prozent mehr Speicherkapazität** als in der Kohorte 2024. Besonders die große Größenklasse trägt zu diesem Unterschied bei. Wer nur Anlagen zählt, übersieht damit einen wichtigen Teil des Bildes.

Die Überschrift ist eine Kurzfassung dieses **Kohortenvergleichs**: Gezählt werden im Registerstand noch betriebene Anlagen, gruppiert nach dem frühesten Inbetriebnahmedatum ihrer zugeordneten Einheiten. Das sind **keine historisch beobachteten jährlichen Neuinstallationen**. Stillgelegte Anlagen fehlen; spätere Erweiterungen können mit ihrer heutigen Kapazität einem früheren Jahr zugerechnet werden. Die [Methodik unten](#methodik) erläutert diese Grenzen.

<script src="/js/lib/echarts.min.js"></script>

## 1. Anlagenzahl und Speicherkapazität erzählen verschiedene Geschichten

Die Kohorte 2024 umfasst 573.235 Anlagen mit zusammen rund 6,179 GWh Speicherkapazität. Für 2025 sind es 559.016 Anlagen mit rund 6,715 GWh. Die zugeordnete Nettonennleistung sinkt zugleich von rund 4,028 auf 3,935 GW. Mehr Energieinhalt bedeutet also nicht automatisch mehr Leistung.

**GW beschreibt Leistung:** Wie schnell kann ein Speicher Energie abgeben? **GWh beschreibt Energieinhalt:** Wie viel Energie kann er speichern? Für die Frage, wie lange ein Speicher bei einer bestimmten Leistung durchhalten könnte, braucht man beide Größen.

<div class="chart-section">
  <h3>Anlagenzahl und Energieinhalt, jeweils 2024 = 100</h3>
  <p class="chart-description" id="battery-cohorts-description">Die Kurven vergleichen die Inbetriebnahme-Kohorten 2019–2025 im Registerstand vom 30. Juni 2026. Beide Reihen sind separat auf 2024 = 100 normiert; 2025 liegt die Anlagenzahl bei rund 97,52 und die Speicherkapazität bei 108,68. Der Index vergleicht Veränderungen, keine absoluten Einheiten.</p>
  <div id="battery-storage-cohorts" role="img" aria-label="Index von Anlagenzahl und Speicherkapazität, Basis 2024 gleich 100" aria-describedby="battery-cohorts-description" style="width: 100%; height: 400px;"></div>
  <script src="/js/charts/battery_storage/cohorts.js"></script>
  <div class="chart-sources"><strong>Quelle:</strong> <a href="https://www.marktstammdatenregister.de/MaStR/Datendownload">Bundesnetzagentur, Marktstammdatenregister (MaStR)</a>; eigene gefilterte Auswertung, Stand 30. Juni 2026.</div>
</div>

<div style="overflow-x: auto;">
  <table id="battery-cohorts-table">
    <caption>Kernwerte der gefilterten Registerkohorten, Stand 30. Juni 2026; keine historischen Jahreszubauten</caption>
    <thead><tr><th scope="col">Kohorte</th><th scope="col">Anlagenzahl</th><th scope="col">Nettonennleistung (GW)</th><th scope="col">Speicherkapazität (GWh)</th><th scope="col">Median E/P (Stunden)</th></tr></thead>
    <tbody>
      <tr><th scope="row">2024</th><td>573.235</td><td>4,027772</td><td>6,178516</td><td>1,6461</td></tr>
      <tr><th scope="row">2025</th><td>559.016</td><td>3,935269</td><td>6,714984</td><td>1,9200</td></tr>
    </tbody>
  </table>
</div>

Die Tabellen und Kernaussagen bleiben auch ohne JavaScript lesbar. Die Nachkommastellen dokumentieren die Registerauswertung, nicht eine entsprechend hohe Messgenauigkeit.

## 2. Der Unterschied liegt vor allem in der großen Größenklasse

Die kleine Größenklasse fällt von rund 5,041 auf 4,544 GWh. Die mittlere wächst von rund 0,313 auf 0,424 GWh, die große von rund 0,824 auf 1,746 GWh. Der höhere Energieinhalt der großen Klasse überwiegt damit den Rückgang bei den kleinen Anlagen.

Diese Gruppen sind **technische Größenklassen**, keine nachgewiesenen Eigentümer- oder Nutzungsgruppen. Aus ihnen lässt sich nicht direkt ablesen, ob Haushalte, Gewerbebetriebe oder Energieunternehmen investieren.

<div class="chart-section">
  <h3>Speicherkapazität nach Größenklasse</h3>
  <p class="chart-description" id="battery-segments-description">Die gestapelten Balken zeigen den Energieinhalt je Registerkohorte in GWh. Zwischen 2024 und 2025 nimmt die große Klasse deutlich zu, während die kleine Klasse zurückgeht. Die Gesamthöhe zeigt Kapazität, nicht Anlagenzahl.</p>
  <div id="battery-storage-segments" role="img" aria-label="Gestapelte Speicherkapazität in GWh nach kleiner, mittlerer und großer Größenklasse" aria-describedby="battery-segments-description" style="width: 100%; height: 400px;"></div>
  <script src="/js/charts/battery_storage/segments.js"></script>
  <div class="chart-sources"><strong>Quelle:</strong> <a href="https://www.marktstammdatenregister.de/MaStR/Datendownload">Bundesnetzagentur, MaStR</a>; eigene Auswertung, Stand 30. Juni 2026. Größenschwellen nach dem <a href="https://battery-charts.de/battery-charts/#methodology">Methodenvergleich mit Battery Charts der RWTH Aachen</a>.</div>
</div>

<div style="overflow-x: auto;">
  <table id="battery-segments-table">
    <caption>Speicherkapazität der Größenklassen in GWh, Registerstand 30. Juni 2026</caption>
    <thead><tr><th scope="col">Größenklasse</th><th scope="col">Kohorte 2024</th><th scope="col">Kohorte 2025</th></tr></thead>
    <tbody>
      <tr><th scope="row">Klein</th><td>5,041173</td><td>4,544400</td></tr>
      <tr><th scope="row">Mittel</th><td>0,313054</td><td>0,424486</td></tr>
      <tr><th scope="row">Groß</th><td>0,824290</td><td>1,746098</td></tr>
    </tbody>
  </table>
</div>

**Abgrenzung:** Klein heißt Leistung **unter 30 kW UND** Energieinhalt **unter 30 kWh**. Groß heißt Leistung **mindestens 1.000 kW ODER** Energieinhalt **mindestens 1.000 kWh**. Alle übrigen eingeschlossenen Anlagen gehören zur mittleren Klasse. Rundungen können minimale Abweichungen zwischen den Segmenten und der Gesamtsumme verursachen.

## 3. Wie sich die nominale Speicherdauer verändert

Das Verhältnis **E/P**, also Speicherkapazität in kWh geteilt durch Nettonennleistung in kW, ergibt eine nominale Speicherdauer in Stunden. Eine Anlage mit 10 kWh und 5 kW kommt rechnerisch auf zwei Stunden. Das ist keine Messung ihres tatsächlichen Lade- oder Entladebetriebs.

Der Median dieses Verhältnisses steigt zwischen den Kohorten 2024 und 2025 von **1,6461 auf 1,9200 Stunden**. Er wird über die einzelnen Anlagen berechnet, ohne Gewichtung nach Größe. Er ist weder das Verhältnis der Jahressummen noch die durchschnittliche Autarkiedauer eines Haushalts.

<div class="chart-section">
  <h3>Median der nominalen Speicherdauer je Kohorte</h3>
  <p class="chart-description" id="battery-duration-description">2025 liegt der Median von E/P höher als 2024. Die Linie zeigt nur die Mitte der Anlagenwerte, keine Verteilung: Streuung, Quantile und Unterschiede innerhalb der Größenklassen sind hier nicht dargestellt.</p>
  <div id="battery-storage-duration" role="img" aria-label="Median des nominalen Energie-Leistungs-Verhältnisses in Stunden je Registerkohorte" aria-describedby="battery-duration-description" style="width: 100%; height: 400px;"></div>
  <script src="/js/charts/battery_storage/duration.js"></script>
  <div class="chart-sources"><strong>Quelle:</strong> <a href="https://www.marktstammdatenregister.de/MaStR/Datendownload">Bundesnetzagentur, MaStR</a>; eigene Auswertung von Kapazität und Nettonennleistung, Stand 30. Juni 2026.</div>
</div>

Ein höherer Median ist mit einer Verschiebung zu längeren nominalen Speicherdauern vereinbar. Er beweist weder einen Wechsel der Geschäftsmodelle noch, dass alle Speicher länger laufen. Ladezustand, Verluste, Betriebsstrategie und Netzanschluss sind hier nicht beobachtet.

## 4. Solarstrom und Börsenpreise im Tagesverlauf: ein illustratives Fenster

Warum ist die zeitliche Verschiebung von Energie interessant? Einen anschaulichen Kontext liefern die Stundenprofile aus dem Strommarkt. Dafür verwenden wir einen **separaten, eingefrorenen Zeitraum vom 11. August bis 9. September 2026 (30 Tage)**. Dieser spätere Zeitraum ist nicht der Stichtag der Batteriespeicherdaten.

Die Werte werden nach lokaler Stunde (**Europe/Berlin**) zusammengefasst. Für jede Stunde zeigen die Kurven das Mittel über die 30 Tage. Der mittlere DE–LU-Day-Ahead-Preis liegt um **13 Uhr bei 39,05 EUR/MWh**, um **20 Uhr bei 209,61 EUR/MWh**. Das sind Stundenprofil-Mittelwerte, keine für jeden Tag garantierten Kauf- und Verkaufspreise.

<div class="chart-section">
  <h3>Ein Stundenprofil, zwei getrennte Maßstäbe</h3>
  <p class="chart-description" id="battery-profile-description">Illustration für den 11. August bis 9. September 2026: Die Preisreihe zeigt einen deutlich höheren Mittelwert um 20 Uhr als um 13 Uhr; die Solarreihe zeigt den Tagesgang der Erzeugung. Beide Diagramme verwenden dieselben Stunden, aber getrennte y-Achsen und Einheiten. Kurvenhöhen zwischen den Diagrammen sind nicht vergleichbar.</p>
  <h4>DE–LU-Day-Ahead-Preis in EUR/MWh</h4>
  <div id="battery-storage-daily-price" role="img" aria-label="Mittlerer Day-Ahead-Preis je Stunde in EUR pro MWh, 30 Tage" aria-describedby="battery-profile-description" style="width: 100%; height: 400px;"></div>
  <script src="/js/charts/battery_storage/daily-price.js"></script>
  <h4>Solarerzeugung in Deutschland in GW</h4>
  <div id="battery-storage-daily-solar" role="img" aria-label="Mittlere Solarerzeugung je Stunde in GW, derselbe 30-Tage-Zeitraum" aria-describedby="battery-profile-description" style="width: 100%; height: 400px;"></div>
  <script src="/js/charts/battery_storage/daily-solar.js"></script>
  <div class="chart-sources"><strong>Quelle:</strong> <a href="https://www.smard.de/">Bundesnetzagentur, SMARD</a>; eingefrorene Stundendaten aus der Datengrundlage des <a href="/dashboards/strom/">Databearer-Stromdashboards</a>, eigene Mittelwerte für 11. August bis 9. September 2026.</div>
</div>

Das Nebeneinander ist **deskriptiv, kein Kausalnachweis**: Nachfrage, Wind, Kraftwerksverfügbarkeit und grenzüberschreitender Handel beeinflussen die Preise ebenfalls. Aus diesem 30-Tage-Fenster folgt weder ein ganzjähriges Muster noch eine Erklärung für die Registerkohorten 2024 und 2025.

Auch **Rentabilität** lässt sich daraus nicht ableiten. Dafür fehlen unter anderem Investitions- und Betriebskosten, Wirkungsgrad, Alterung, Entgelte sowie die tatsächlich nutzbaren Handels- und Netzbedingungen. Die Differenz zwischen zwei Stundenmittelwerten ist kein erreichbarer Speichergewinn.

## Was sich aus dem Vergleich mitnehmen lässt

Die gefilterten Registerkohorten zeigen einen interessanten Strukturunterschied: Weniger Anlagen gehen mit mehr Energieinhalt und einem höheren Median der nominalen Speicherdauer einher. Der Kapazitätsunterschied konzentriert sich auf die große Größenklasse. Ob dahinter ein dauerhafter Wandel steht, bleibt eine Frage für weitere Registerstände und eine Prüfung der Verteilungen.

Das knüpft an den Beitrag [„Technologieoffenheit oder Industriepolitik?“](/posts/2025/Industriepolitik/) an, der Batteriepreise und Elektrifizierung behandelt. Die vorliegende Auswertung ergänzt diese Perspektive um deutsche stationäre Speicher; sie prüft weder die dort diskutierten Kostentrends noch konkrete Geschäftsmodelle. Aktuelle Erzeugung und Preise sind im [Stromdashboard](/dashboards/strom/) zu finden, dessen Datenstand sich unabhängig von diesem eingefrorenen Artikel verändert.

<h2 id="methodik">Methodik und Datenquellen</h2>

### Registerstand und Zähleinheit

Grundlage ist der öffentliche [MaStR-Gesamtdatenauszug der Bundesnetzagentur](https://www.marktstammdatenregister.de/MaStR/Datendownload) mit dem hier ausgewerteten Stichtag **30. Juni 2026**. Die Analyse verbindet Speicheranlagen mit ihren zugeordneten Speichereinheiten. Berücksichtigt werden aktive Batterieeinträge in Deutschland mit übereinstimmendem Betriebsstatus „in Betrieb“ und konsistenter Anlagen-Einheiten-Verknüpfung. Geplante Anlagen sind nicht Teil der gezeigten Werte.

Gezählt werden **Anlagen**, nicht einzelne Registereinheiten. Die Nettonennleistungen der zugeordneten Einheiten werden addiert; der Energieinhalt wird nur einmal je Anlage berücksichtigt. Doppelte oder widersprüchliche Identifikatoren und Anlagenverknüpfungen werden ausgeschlossen, statt Kapazität mehrfach zu zählen.

### Plausibilitätsfilter und ihre Folgen

Eingeschlossen werden nur Anlagen mit gültigen Inbetriebnahmedaten ihrer Einheiten zwischen **1. Januar 1990 und 30. Juni 2026**, einer Leistung **über 0,3 kW**, einem Energieinhalt **über 0,3 kWh** und einem Verhältnis **E/P von 0,1 bis 12 Stunden**. Fehlende, nicht endliche oder widersprüchliche Angaben werden nicht als null interpretiert.

Die Qualitätsausschlüsse betreffen **0,4523 Prozent der ausgewählten betriebenen Einheiten**, aber **4,5745 Prozent des bekannten Energieinhalts** in der betrachteten Ausgangsauswahl. Der zweite Anteil bezieht sich auf bekannte Kapazitätsangaben, nicht auf einen vollständig bekannten Gesamtmarkt. Die Filter sind also nach Anlagenzahl relativ klein, nach Energieinhalt jedoch deutlich relevanter. Die Einheitenbasis dieser Ausschlussquote ist von der Anlagenzählung in den Tabellen zu unterscheiden.

Es gibt **keine Betreibertyp-Korrektur und keine Imputation** fehlender oder ausgeschlossener Werte. Die [Methodik von Battery Charts (RWTH Aachen)](https://battery-charts.de/battery-charts/#methodology) dient als Vergleich für Plausibilitätsschwellen und Größenklassen. Battery Charts verwendet zusätzliche Betreiber- und Netzanschlussprüfungen sowie Korrekturen. Wir bilden deshalb **nicht die korrigierten RWTH-Gesamtsummen** nach. Insbesondere sind „klein“, „mittel“ und „groß“ hier keine Belege für Haushalt, Gewerbe oder einen bestimmten Betreiber.

### Kohorten statt historischer Zubauzeitreihe

Jede eingeschlossene Anlage wird dem Jahr des **frühesten Inbetriebnahmedatums** ihrer Einheiten zugeordnet. Bei späteren Erweiterungen wird damit auch deren im Snapshot erfasster Energieinhalt dem früheren Jahr zugeschlagen. Die Auswertung enthält nur die am Stichtag noch betriebenen Anlagen: Dieser **Survivor-Effekt** lässt frühere Stilllegungen aus dem Vergleich verschwinden. Eine historische Bestands- oder Zubauzeitreihe lässt sich aus diesem einzelnen Registerstand nicht rekonstruieren.

Nachmeldungen und Registerkorrekturen können auch abgeschlossene Kohorten verändern. Für das erste Halbjahr 2026 sind Meldeverzögerungen besonders relevant; deshalb gibt es hier keinen Schlagzeilenvergleich mit 2026 H1. Die Diagramme der Registerkohorten zeigen 2019–2025. Der Index berechnet sich jeweils als Jahreswert geteilt durch den Wert der Kohorte 2024, mal 100. Größenklassen werden aus den im Snapshot erfassten Anlagenwerten bestimmt; E/P wird je Anlage berechnet und anschließend als ungewichteter Median je Kohorte ausgewiesen.

### Getrennter Strommarkt-Snapshot und Quellen

Das Stundenprofil nutzt ausschließlich den eingefrorenen Zeitraum **11. August bis 9. September 2026** aus den SMARD-Stundendaten der bestehenden Dashboard-Datengrundlage. Es mittelt die Stundenwerte je lokaler Stunde und verbindet keine einzelnen Speicher mit beobachteten Lade- oder Entladevorgängen. Das Registerdatum und dieses Strommarktfenster sind bewusst getrennt ausgewiesen.

- **Primärquelle Speicher:** [Bundesnetzagentur – öffentlicher MaStR-Datendownload](https://www.marktstammdatenregister.de/MaStR/Datendownload), [Datenlizenz Deutschland – Namensnennung 2.0](https://www.govdata.de/dl-de/by-2-0); eigene Filter und Aggregationen wie oben beschrieben.
- **Methodischer Vergleich:** [Battery Charts – Methodology](https://battery-charts.de/battery-charts/#methodology), RWTH Aachen. Kein Übernehmen korrigierter Marktsummen.
- **Primärquelle Strommarkt:** [Bundesnetzagentur – SMARD](https://www.smard.de/), [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/); eigene Stundenprofil-Aggregation. Weitere Erläuterungen im [Stromdashboard](/dashboards/strom/).

Der Artikel zeigt ausschließlich aggregierte Kennzahlen. Einzelne Anlagen-, Einheiten- oder Betreiberdatensätze werden hier nicht veröffentlicht.
