from __future__ import annotations


def translate_countries(df, country_column='country'):
    country_translation = {
        'Austria': 'Österreich',
        'Belgium': 'Belgien',
        'Bulgaria': 'Bulgarien',
        'Croatia': 'Kroatien',
        'Cyprus': 'Zypern',
        'Czechia': 'Tschechien',
        'Denmark': 'Dänemark',
        'Estonia': 'Estland',
        'Euro area': 'Eurozone',
        'Euro area (19 countries)': 'Eurozone (19 Länder)',
        'European Union': 'Europäische Union',
        'Finland': 'Finnland',
        'France': 'Frankreich',
        'Germany ("linked")': 'Deutschland',
        'Germany': 'Deutschland',
        'Greece': 'Griechenland',
        'Hungary': 'Ungarn',
        'Ireland': 'Irland',
        'Italy': 'Italien',
        'Latvia': 'Lettland',
        'Lithuania': 'Litauen',
        'Luxembourg': 'Luxemburg',
        'Malta': 'Malta',
        'Netherlands': 'Niederlande',
        'Poland': 'Polen',
        'Portugal': 'Portugal',
        'Romania': 'Rumänien',
        'Slovakia': 'Slowakei',
        'Slovenia': 'Slowenien',
        'Spain': 'Spanien',
        'Sweden': 'Schweden',
    }

    df_translated_countries = df.map(lambda x: country_translation[x] if x in country_translation else x)

    return df_translated_countries
