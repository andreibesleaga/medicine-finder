# Data sources: in use, and other national registers checked

Medicine Brand Finder only uses a national register when it is **official, free, reachable by a
server script, and its terms allow reuse**. This page lists the registers in use and every other
register that was checked, with how it could be imported if its status changes. Checked on
24 October 2026; registers change, so re-check a source before adding it.

How a register can be used:

- **Bulk file** — downloaded on a schedule into the server's SQLite database
  (`server/datasets/<name>.js`). Preferred: fast searches, no load on the regulator per search.
- **Live API** — queried on each search (`server/sources/<name>.js`). Used when there is no file.
- **Imported file** — downloaded by hand and placed in `DATA_DIR/imports` on the server, when the
  register blocks scripts but allows reuse; reloaded whenever a newer file is put there.
- **Account** — needs a registration or key. Possible for a private deployment that sets its own key
  in a server variable; not used in the public demo.

## In use

Terms for each source are in [NOTICE.md](../NOTICE.md); row counts and file details are in
[ARCHITECTURE.md](ARCHITECTURE.md#server-data-handling).

| Region | Country | Register | Access | Licence or terms |
|---|---|---|---|---|
| Europe | European Union | EMA medicines | bulk JSON, daily | see NOTICE.md |
| Europe | France | ANSM / BDPM | bulk text, daily | see NOTICE.md |
| Europe | Spain | AEMPS CIMA | live API | see NOTICE.md |
| Europe | Italy | AIFA | bulk CSV, daily | see NOTICE.md |
| Europe | Poland | URPL | bulk CSV, daily | see NOTICE.md |
| Europe | Netherlands | CBG-MEB | bulk CSV, daily | see NOTICE.md |
| Europe | Ireland | HPRA | bulk XML, daily | see NOTICE.md |
| Europe | Switzerland | Swissmedic | bulk XLSX, daily | see NOTICE.md |
| Europe | Czech Republic | SÚKL DLP | bulk zip, monthly | free reuse naming SÚKL |
| Europe | Denmark | Danish Medicines Agency | bulk XLSX, daily | free reuse naming the agency |
| Europe | Sweden | Läkemedelsverket | bulk XLSX, daily | CC BY 4.0 |
| Europe | Finland | Fimea basic register (`Perusrekisteri.xml`) | imported file (fimea.fi blocks scripts); see [DEPLOY.md](DEPLOY.md#finland-imported-file) | CC BY 4.0 |
| Europe | Lithuania | VVKT (data.gov.lt) | bulk CSV, daily | CC BY 4.0 |
| Europe | Ukraine | State Register of Medicinal Products | bulk CSV | CC BY |
| Europe | Malta | Medicines Authority | bulk XLSX, daily | reuse with reference, not commercial |
| North America | Canada | Health Canada DPD | bulk zip, monthly (+ optional live API) | Government of Canada terms (NOTICE.md) |
| North America | United States | FDA NDC Directory | bulk zip, daily | public domain (openFDA: CC0) |
| South America | Colombia | INVIMA CUM (datos.gov.co) | bulk CSV via the portal API | CC BY-SA 4.0 |
| Asia | Taiwan | TFDA drug licences (data.gov.tw) | bulk JSON, weekly | Open Government Data License (CC BY 4.0 compatible) |
| Asia | Singapore | HSA registered products (data.gov.sg) | bulk CSV | Singapore Open Data Licence |
| Oceania | New Zealand | Pharmac Pharmaceutical Schedule | bulk XML, monthly | CC BY 4.0 (funded medicines only) |

## Checked, not in use

Legend: **Possible** = a file or API works and only the terms are missing or unclear;
**Account** = needs a registration or key; **Blocked** = a browser check, CAPTCHA or firewall stops
scripts; **No data** = no file or API found, only a search page.

### Europe

| Country | Register | How it could be imported | Why it is not in use |
|---|---|---|---|
| Estonia | Ravimiregister | bulk downloads page | Blocked: browser check on all Estonian medicines sites. |
| Latvia | ZVA medicinal product register (data.gov.lv) | bulk XML/CSV/JSON | Possible: CC0, but the server refused connections from the test machine; re-test from the deployment. |
| Norway | DMP FEST (SOAP service) | bulk XML, about 95 MB a day | Possible: NLOD 2.0 open licence; large download and a multi-part XML to join. |
| Iceland | Lyfjastofnun list of authorised medicines | bulk XLSX, monthly | Possible: no licence statement found. |
| Slovakia | ŠÚKL list of medicines | bulk zip with XLSX, monthly | Possible: no licence statement found; no separate ingredient column. |
| Turkey | TİTCK licensed medicines list | bulk XLSX, weekly (link changes) | Possible: no licence statement found. |
| Romania | ANMDMR Nomenclator | bulk XLSX | Possible: the site states "all rights reserved"; needs the agency's consent. |
| Belgium | SAM (Authentic Source of Medicines) export | bulk zip of XML, about 114 MB | Possible: publicly accessible, no licence statement; large multi-file XML. |
| Luxembourg | CNS positive list | bulk CSV, monthly | Partial: reimbursed products only, no ingredient names; most products are in the Belgian SAM. |
| United Kingdom | NHSBSA dm+d (NHS TRUD) | bulk XML zip, weekly | Account: free TRUD account and key, Open Government Licence. |
| Sweden (NPL) | NPL product export | bulk XML | Account: free for users in Sweden; the public XLSX above is used instead. |
| Portugal | Infarmed database | bulk, by request | Account: EUR 150 + VAT a year for non-public bodies. |
| Slovenia | Central Medicines Database (CBZ) | XML for authorised users | Account: certificate and written authorisation. |
| Germany | BfArM / PharmNet.Bund | search page only | No data: reuse needs BfArM's explicit consent. |
| Austria | BASG medicines register | manual web export | Blocked by terms: no technical or commercial processing, no public API. |
| Hungary | OGYÉI medicines database | CSV linked from the site | Blocked: the CSV answers 403 to scripts. |
| Croatia | HALMED medicines database | Excel export from the search | Unclear: the site refused connections from the test machine; open licence on data.gov.hr. |
| Bulgaria | BDA register | unknown | Unclear: the site was down for maintenance when checked. |
| Greece | EOF product search | search form only | No data: no file or API; terms allow faithful reuse naming EOF. |
| Serbia | ALIMS medicines search | search form only | No data: the full register is a paid product. |
| Cyprus | Pharmaceutical Services | none found | Blocked / no data. |

### Americas

| Country | Register | How it could be imported | Why it is not in use |
|---|---|---|---|
| Brazil | ANVISA registered medicines (dados.anvisa.gov.br) | bulk CSV, about 46 MB, daily | Possible: the licence is shown only on a page that needs a browser (reported as CC BY); not confirmed. |
| Mexico | COFEPRIS registrations viewer | web viewer only | No data. |
| Argentina | ANMAT Vademécum | search form only | No data. |
| Chile | ISP sanitary register | search form only | No data (site refused connections). |
| Peru | DIGEMID | search form only | Blocked: CAPTCHA. |
| Ecuador | ARCSA | unknown | Unclear. |

### Asia, Middle East and Oceania

| Country | Register | How it could be imported | Why it is not in use |
|---|---|---|---|
| South Korea | MFDS product licences (data.go.kr) | live API, 10,000 calls a day | Account: free service key, Korean-language portal; terms "no restriction". |
| Japan | PMDA | bulk package inserts after registration | Account; names in Japanese only. |
| Thailand | Thai FDA web service (data.go.th) | web service | Unclear: endpoint not found; the listing states no licence. |
| Australia | PBS API (subsidised medicines) | live API, 1 request per 20 s | Account: free subscription key; the full register (ARTG) has no bulk file. |
| China | NMPA data search | search page | Blocked: anti-bot page. |
| India | CDSCO | none | No data. |
| Malaysia | NPRA | cancelled products only (data.gov.my) | No data for registered products. |
| Philippines | FDA verification portal | search page | Blocked. |
| Indonesia | BPOM Cek BPOM | search page | No data. |
| Israel | Ministry of Health Drug Index | web app | Blocked for scripts. |
| Saudi Arabia | SFDA drugs list | search page with CAPTCHA | Blocked. |
| United Arab Emirates | MOHAP product directory | WhatsApp only | No data. |

### Africa and global

| Source | Register | How it could be imported | Why it is not in use |
|---|---|---|---|
| Nigeria | NAFDAC Greenbook | the site's own search feed (JSON) | Possible: not a documented API and no terms stated. |
| South Africa | SAHPRA register | the site's own search feed (JSON) | Possible: not a documented API and no terms stated. |
| Rwanda | Rwanda FDA register | one HTML page with all products | Possible: no terms stated; status from the expiry date. |
| Kenya | Pharmacy and Poisons Board | login required | Account. |
| Egypt | EDA drug database | search form with a verification code | Blocked. |
| Ghana, Uganda | FDA Ghana, NDA | search pages | Blocked (403 to scripts). |
| Morocco, Tunisia | DMP, DPM | none reachable | Blocked / no data. |
| Tanzania | TMDA portal | single-page app | Unclear: no documented endpoint. |
| Ethiopia | EFDA | none | No data. |
| WHO | Prequalified medicines list | bulk CSV | Not useful here: generic names only, no brands; terms exclude commercial use. |

## Adding one

See [CONTRIBUTING.md](../CONTRIBUTING.md#adding-a-data-source): a loader in `server/datasets/`, a
parser test with a small fixture, its terms in `NOTICE.md`, a line in the README table and in the
"In use" table above.
