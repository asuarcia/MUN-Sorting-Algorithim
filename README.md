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

1. **Import.** In Airtable, open the registration table and **Download CSV** (or export to Excel), then drop the file in. It's set up for the 2027 GPY Model UN registration form, so no columns need renaming. Other forms work too.
2. **Committees.** The default line-up is the 18 committees on the [GPY Model UN committees page](https://www.gpyce.org/mun-committees), each tagged with the form interests its 2027 topics cover. Adjust names, seats, topics and whether each is Beginner, Intermediate or Advanced to fit your conference. The app remembers them for next time.
3. **Run.** Click **Run Assignment**. Every delegate gets a seat, and the app warns you first if you don't have enough seats.
4. **Review & export.** Click any committee to see who's in it and **Move** people by hand. Hand placements stick if you re-run. Then **Export rosters (Excel)** to get one file with:
   - a summary,
   - every delegate and *why* they got their committee,
   - a list per school for faculty advisors,
   - a roster per committee for chairs.

**Save session** keeps your work in a file so you can close the app and pick up later, or hand it to a co-organizer.

---

## Your spreadsheet

The defaults match the **2027 GPY Model UN** Airtable registration form. These are the fields the app reads, under the form's own names. Headers are case-insensitive, any order, and close variants (`Full Name`, `School`, `Interests`, `Committee size`) work too.

| Form field | Answers |
|---|---|
| First Name · Last Name · Preferred First Name | Rosters use the preferred first name when there is one |
| Delegation | The delegate's school delegation. Used to spread delegations across rooms |
| Grade | 9 · 10 · 11 · 12 |
| Are you a first year delegate or returning? | First year delegate · Returning |
| What are your interests in Model UN? | Any of: Technology · Health · Environment · Economic · Law · Social Justice/Human Rights · History · Military/Conflict Resolution · Social Media |
| Please select ALL committee sizes you are interested in | Small (20-40) · Medium (40-70) · Large (70+) · No preference on committee size |
| Seniority Pick *(optional, not on the form; add the field in Airtable)* | A committee name or acronym (`ICJ`, `Security Council`) |

A sheet with a `Preferred Type` column (Regional Summit, Court, …) is still scored on it. The GPY form doesn't ask for it, so it's ignored when absent. There's a **Download blank template** button on the Import screen that uses the same headers.

### 🔒 Privacy

Everything runs on your computer. Nothing is uploaded, not even in the browser version. The app reads **only** the fields above. Birthday, gender, pronouns, email, address, emergency contacts, insurance, allergies, signatures and every other field are ignored and never stored, and the import screen lists exactly what was read and what was skipped.

---

## How it decides

- **First-years are kept out of Advanced committees, with a few exceptions.** It isn't a hard rule. A first-year only lands in an Advanced committee when it fits their interests and sizes much better than any other committee (by more than a whole extra interest), and each Advanced committee takes at most 10% of its seats in first-years (at least 1, so 2 of 25). In practice that's a handful per conference: 2 of 358 first-years in the 855-delegate test data. Their placement reason says so, so you can move them out by hand if you want. Returning delegates are steered toward Advanced committees.
- **Seniority picks** get a very strong boost, as long as the committee has room. A first-year's pick for an Advanced committee also counts against that committee's first-year seats.
- **Interests** are matched against each committee's topics. Committees use the form's nine interests by default, and older words like "Healthcare" or "Security" still count.
- **Sizes:** committees in a size the delegate ticked are favored, and ones they left unticked are avoided. "No preference" (or ticking all three) is neutral.
- **Grade:** returning 11th and 12th graders get an extra nudge toward Advanced committees and pick before younger delegates.
- **Delegations are spread out** so no single school dominates a room.
- If every committee a delegate is allowed into is full, they're **flagged** so you can place them by hand.

After each run you see how many delegates got one of their interests and a size they picked, how many seniority picks were honored, and the largest share of any room held by one school. Before a run, the app warns about committees whose seat count doesn't fit the form's size ranges, and interests no committee covers.

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
| `engine.js` | Parsing + assignment rules. Shared by the app **and** the tests. `FIRST_YEAR_ADVANCED` sets the first-year penalty and seat share |
| `main.js` | Electron desktop wrapper |
| `vendor/` | Excel reader/writer (SheetJS) and fonts, bundled so it works offline |
| `test/verify.js` | Rule and confidentiality checks |

**Releasing:** bump `version` in `package.json`, then `git tag v1.x.x && git push --tags`. GitHub Actions builds Windows, Mac and Linux and attaches them to a release. The download links above always point to the latest one. Every push to `main` also redeploys the browser version.

</details>

MIT License
