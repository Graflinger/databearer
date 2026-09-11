---
title: "Neu: das tägliche Strom-Dashboard für Deutschland"
date: 2026-09-11
lastUpdated: 2026-09-11
excerpt: "Das neue Strom-Dashboard zeigt Strommix, Netzlast, Börsenpreise und Langfristtrends für Deutschland an einem Ort."
image: "/images/dashboards/strommarkt-deutschland.svg"
imageText: "Das neue Dashboard bündelt Strommix, Netzlast, Preise und Langfristvergleiche für Deutschland."
fullWidthCard: false
topic: ["energie"]
---

## Ein schneller Einstieg in die Stromdaten

Das neue [Strom-Dashboard](/dashboards/strom/) bündelt die wichtigsten Kennzahlen zum deutschen Strommarkt an einem Ort: Strommix, Netzlast, Börsenpreise, Jahresverläufe seit 2015, den kommerziellen Stromhandel sowie Ausbau-, Speicher- und Netzeingriffsdaten.

Der Zweck ist bewusst praktisch: Wer wissen möchte, wie viel Strom gerade in Deutschland im öffentlichen Netz erzeugt wurde, wie hoch der Anteil der Erneuerbaren war oder wie sich Importe, Exporte und Börsenpreise über die Jahre verschoben haben, soll nicht erst mehrere Quellen und alte Artikel zusammensuchen müssen.

## Was das Dashboard zeigt

Oben stehen die aktuellen Zeitraumansichten. Standardmäßig zeigt das Dashboard das laufende Jahr bis zum letzten verfügbaren Tag. Zusätzlich lassen sich frühere Jahre seit 2015 sowie die jüngsten 1, 7 und 30 vollständigen Tage auswählen.

Die wichtigsten Blöcke sind:

- **Strommix:** öffentliche Nettoerzeugung nach Energieträgern, inklusive Erneuerbarenanteil.
- **Netzlast:** der Strombedarf im öffentlichen Netz, einschließlich Netzverlusten.
- **Day-Ahead-Preis:** zeitgewichtete Börsenpreise, inklusive negativer Stunden oder Tage.
- **Langfristvergleich:** Erneuerbare, Kohle, Gas und gesamte Erzeugung über die Jahre.
- **Stromhandel:** geplante kommerzielle Importe und Exporte im Marktgebiet Deutschland–Luxemburg.
- **Ausbau, Speicher & Netze:** Nettonennleistung, gesetzliche Ausbauziele und Netzengpassmanagement.

Damit wird das Dashboard zur Datengrundlage für weitere Beiträge. Einzelne Blogartikel können einen Aspekt herausgreifen und genauer erklären, während das Dashboard den jeweils aktuellen Stand und die Methodik transparent macht.

## Warum keine Live-Abfrage im Browser?

Die Daten werden nicht erst beim Besuch der Seite direkt von SMARD oder anderen Quellen geladen. Stattdessen erzeugt die Pipeline vorbereitete, geprüfte JSON-Dateien, die dann statisch ausgeliefert werden. Das hat drei Vorteile: Die Seite bleibt schnell, Besucherinnen und Besucher brauchen keine Verbindung zu den Ursprungs-APIs, und die veröffentlichten Daten lassen sich reproduzierbar prüfen.

Die aktuellen Stundendaten, die Tageshistorie des laufenden Jahres und die monatlichen Handelsdaten werden automatisch täglich aktualisiert. Ausbau-, Speicher- und Netzdaten folgen einem separaten, manuell geprüften Rhythmus, weil die Quellen und ihre Aktualität nicht identisch sind.

## Was die Zahlen nicht bedeuten

Gerade bei Stromdaten ist Abgrenzung wichtig. Die Stromerzeugung im Dashboard ist die Einspeisung ins öffentliche Netz, nicht der gesamte deutsche Stromverbrauch. Eigenverbrauch, geschlossene Industrie- oder Bahnnetze und selbst verbrauchter Solarstrom sind darin nicht vollständig enthalten.

Auch der Handel ist sauber getrennt: Importe und Exporte sind geplante kommerzielle Austauschmengen, keine physikalischen Stromflüsse. Man sollte sie deshalb nicht aus Erzeugung minus Netzlast ableiten. Ebenso sind Netzeingriffe kein Maß für Stromausfälle und kein einfacher Indikator für „Netzinstabilität“.

## Wie es weitergeht

Zum Start folgen drei vertiefende Beiträge aus derselben Datenbasis: ein Blick auf die Zahlen des laufenden Jahres, eine Einordnung von Importen und Exporten über die Jahre sowie eine Analyse von Netzeingriffen und Netzstabilität. Die Artikel verwenden eingefrorene Datenausschnitte im normalen Blog-Visualisierungsstil; das Dashboard bleibt der lebendige, täglich aktualisierte Überblick.

Zum Dashboard: [Strom in Deutschland](/dashboards/strom/)

## Methodik und Datenquellen

Grundlage sind vorbereitete Datensätze aus dem Databearer-Dashboard. Die Strommarkt-, Handels- und Netzdaten stammen von der [Bundesnetzagentur / SMARD.de](https://www.smard.de/home/marktdaten) und stehen unter [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Änderungen durch Databearer: Auswahl der Reihen und Zeiträume, Umrechnung in GW/GWh/TWh, Aggregation zu Kennzahlen und Visualisierung.

Weitere Details stehen direkt im Dashboard unter „Datenstand & Methodik“ sowie in den Download-Links der jeweiligen Datenblöcke.
