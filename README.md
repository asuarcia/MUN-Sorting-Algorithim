# MUN Committee Sorter

Sorts Model UN delegates into committees from your registration spreadsheet in seconds.

## ⬇ Download

| Your computer | Download |
|---|---|
| **Windows** | **[MUN-Committee-Sorter-Windows.exe](https://github.com/asuarcia/MUN-Sorting-Algorithim/releases/latest/download/MUN-Committee-Sorter-Windows.exe)** |
| **Mac** | **[MUN-Committee-Sorter-Mac.dmg](https://github.com/asuarcia/MUN-Sorting-Algorithim/releases/latest/download/MUN-Committee-Sorter-Mac.dmg)** |
| **Linux** | [MUN-Committee-Sorter-Linux.AppImage](https://github.com/asuarcia/MUN-Sorting-Algorithim/releases/latest/download/MUN-Committee-Sorter-Linux.AppImage) |
| **No install** (Chromebook, school laptops) | **[Open in your browser](https://asuarcia.github.io/MUN-Sorting-Algorithim/)** |

Nothing to install: download it and double-click.

> **First launch warning:** the app isn't code-signed, so your computer will ask once.
> - **Windows:** "Windows protected your PC" → **More info** → **Run anyway**
> - **Mac:** open the `.dmg`, drag the app to Applications, open it. If it's blocked, go to **System Settings → Privacy & Security → Open Anyway**.

![The assignment results screen](docs/screenshot.png)

---

## How to use it

1. **Import.** Export your registration responses (Google Forms, Airtable, Excel…) as CSV or Excel and drop the file in.
2. **Committees.** Enter your conference's committees: name, seats, topics, and whether each is Beginner, Intermediate or Advanced. The app remembers them for next time.
3. **Run.** Click **Run Assignment**. Every delegate gets a seat, and the app warns you first if you don't have enough seats.
4. **Review & export.** Click any committee to see who's in it and **Move** people by hand. Hand placements stick if you re-run. Then **Export rosters (Excel)** to get one file with:
   - a summary,
   - every delegate and *why* they got their committee,
   - a list per school for faculty advisors,
   - a roster per committee for chairs.

**Save session** keeps your work in a file so you can close the app and pick up later, or hand it to a co-organizer.

---

## Your spreadsheet

The app needs these columns. Headers are case-insensitive, any order, and common variants like "Full Name" or "Delegation" work too.

| Column | What to put in it |
|---|---|
| Name | Delegate's full name |
| School | School or delegation |
| Year | `First` / `New` / `Novice` → first-year. Anything else → returning |
| Preferred Type | Regional Summit · Topic-based · Court · General · Historical · Press |
| Preferred Topics | Up to 3, separated by `;` (e.g. `Law;History;Justice`) |
| Preferred Size | Small · Medium · Large |
| Seniority Pick *(optional)* | A committee name or acronym (`ICJ`, `Security Council`) |

There's a **Download blank template** button on the Import screen.

### 🔒 Privacy

Everything runs on your computer. Nothing is uploaded, not even in the browser version. The app reads **only** the columns above. Emails, phone numbers, addresses, medical info and every other column are ignored and never stored, and the import screen lists exactly what was read and what was skipped.

---

## How it decides

- **First-years never go into Advanced committees.** This is a hard rule. Returning delegates are steered toward them.
- **Seniority picks** get a very strong boost, as long as the committee has room.
- **Preferences:** committee type, topics and size are all scored.
- **Schools are spread out** so no single school dominates a room.
- If every committee a delegate is allowed into is full, they're **flagged** so you can place them by hand.

After each run you see how many delegates got their preferred type and topics, how many seniority picks were honored, and the largest share of any room held by one school.

---

<details>
<summary><b>For developers</b></summary>

```bash
npm install
npm start          # run the desktop app
npm test           # headless checks: rules, CSV parsing, confidentiality
npm run dist       # build the Windows .exe into dist/
npm run web        # build the browser version into _site/
python make_mock_data.py   # regenerate fake test spreadsheets (includes fake PII on purpose)
```

| File | Purpose |
|---|---|
| `index.html` | The whole UI |
| `engine.js` | Parsing + assignment rules. Shared by the app **and** the tests |
| `main.js` | Electron desktop wrapper |
| `vendor/` | Excel reader/writer (SheetJS) and fonts, bundled so it works offline |
| `test/verify.js` | Rule and confidentiality checks |

**Releasing:** bump `version` in `package.json`, then `git tag v1.x.x && git push --tags`. GitHub Actions builds Windows, Mac and Linux and attaches them to a release. The download links above always point to the latest one. Every push to `main` also redeploys the browser version.

</details>

MIT License
