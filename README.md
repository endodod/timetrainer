# ⏳ TimeTrainer

Picture-based training for **TimeGuessr** (1900–today), made for practising 2v2 ranked with a teammate.

## Modes

| Mode | What you see | What you answer |
|---|---|---|
| 🚗 Cars | Photo of a car model (155 models, 1901–2024, incl. Eastern Bloc, Latin America, India) | Launch year (slider) or model name (4 choices) |
| 👗 Outfits | Photos from the Wikipedia *fashion by decade* articles | Year (slider) |
| 🔤 Languages | Street signs in 54 languages: Spain vs Latin America, Portugal vs Brazil, Nordic, Baltic, Cyrillic, Central/Eastern Europe, East/South/Southeast Asia, Middle East | Language (4 choices from the same family) |
| 🚘 Plates | Current and historic plates for 59 countries | Country (4 choices from the same region) |
| 🥤 Logos | Historic logo files (Coca-Cola, Pepsi, Shell, BP, VW, Apple, Nokia, …) | Years the design was in use (slider) |
| 🏙️ Landmarks | 67 towers, bridges and buildings 1902–2019 (Twin Towers, Burj Khalifa, Shard, Pudong, …) | Year completed (slider) |
| 📷 Photo era | Photos from the Wikipedia decade articles 1900s–2010s | Year, from the photo's look alone (slider) |
| 🪖 Uniforms & helmets | 21 helmets, headgear and camouflage patterns (Pickelhaube → UCP) | Years in use (slider) or name (4 choices) |
| 🌍 Where is it? | A plate photo or street signs plus text clues (driving side, currency, web domain, other tells) for 60 countries | Country (4 choices from the same region) |
| 🧩 Newest clue | A scene with 3–4 dated clues (objects, events, cars, landmarks; optionally as photos) | Earliest possible year (slider) |
| 📅 Timeline | 4 pictures (cars, landmarks, or logos of one brand) | Order them oldest → newest |
| 🏆 Gauntlet | Mix of all of the above | — |

* **Learn galleries:** every mode has a browsable gallery with the tells.
* **Cheat sheets:** every mode has a sheet of its most important tells, grouped into cards (by era, region, brand, …),
  filterable, printable, and downloadable as CSV.
  Everything is also in [`TimeTrainer_Cheatsheets.xlsx`](TimeTrainer_Cheatsheets.xlsx) (one sheet per mode).
* **Era tells:** baseline clues for any photo (photo quality, phones, streetlights, landmarks, events).
* **Timer:** optional 60 / 30 / 15 s per round, to practise under ranked pressure.
* **Weak spots:** items you miss come back more often (stored in your browser).
* **Challenge links:** press *Challenge link* and send it to your teammate. You both get the same rounds; compare scores with *Copy result*.

## Run it

It's a static site with no build step. Either open `index.html` directly, or serve the folder:

```bash
cd timetrainer && python3 -m http.server 8000
```

then open <http://localhost:8000>. It also works on GitHub Pages.

Images are loaded live from Wikipedia / Wikimedia Commons the first time you open a mode, then cached in
your browser. If nothing loads, check that an ad/privacy blocker isn't blocking `wikipedia.org`.

## Editing content

All content is in `data/*.json` (`cars`, `outfits`, `languages`, `plates`, `logos`, `landmarks`, `countries`, `clues`, `photos`, `military`, `general`).
After editing, rebuild the bundle and the Excel file:

```bash
python3 tools/build_data.py
```

```bash
python3 tools/build_xlsx.py
```

Optional: `python3 tools/build_data.py --fetch` pre-resolves all image URLs into `data/images.json`
so the site doesn't have to look them up in the browser. Wikimedia rate-limits shared cloud IPs, so run it from your own machine.

Unofficial fan project, not affiliated with TimeGuessr. Images belong to their Wikimedia Commons authors; every quiz answer links to the file page with its licence.
