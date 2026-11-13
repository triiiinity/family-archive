# Family Archive

The Sloan and Lester family photo archive. This is a plain HTML/CSS/JS site, with no build step, hosted on Cloudflare Workers.

## Folder layout

```
family-archive/
├── wrangler.jsonc        Cloudflare settings (serves everything in /public)
└── public/
    ├── index.html
    ├── styles.css
    ├── app.js
    ├── data/
    │   ├── collections.csv   the folders: Mema, Poppy, Lesters, Lesters Now
    │   ├── people.csv        one row per person
    │   └── photos.csv        one row per photo (the inventory)
    └── images/web/           web-size JPEGs, named by ID (SLO-MMF-0001.jpg)
```

## How the spreadsheets drive the site

The site reads the three CSV files every time it loads. To change the site, edit the spreadsheet, save it as CSV (Excel: File > Save As > CSV UTF-8), and replace the file in `public/data/`.

**photos.csv**: one row per photo, kept in Mom's original order

| Column | What goes in it | Shown on site |
| --- | --- | --- |
| id | SLO-MMF-0001 (permanent, never reused) | yes |
| file | SLO-MMF-0001.jpg, the file in images/web. Leave blank and the site draws a stand-in | — |
| original_file_name | The name the file had when Mom sent it | yes, small |
| original_position | Its place in Mom's folder (1, 2, 3…) | yes, small; also sets the grid order |
| collection | Code from collections.csv (SLO-MMF) | yes, as the folder |
| date | As written: 1974 / circa 1970s / unknown | yes |
| date_sort | A plain year for sorting (1975), or blank | no; used to put person pages oldest first |
| people | person_ids from people.csv, separated by semicolons: `mema; mom` | yes, as links |
| place | Mema's house, Coney Island… | yes |
| event | birthday, Easter, vacation… | yes |
| description | One or two sentences | yes |
| back_of_photo | Text written on the back, word for word | yes |
| info_source | Who identified it: Mom, interview 2026-12 | yes, small |
| tags | From your fixed tag list, separated by semicolons | yes |
| private | Yes / No. Yes hides the photo from every page | no |
| notes | Your working notes and questions | no |

**people.csv**: person_id (short, lowercase, no spaces: `mema`, `aunt-pat`), name (full name), known_as (what the family calls them), born, died, side, relation (to you), notes.

**collections.csv**: code, slug (the page address, e.g. `mema` → `#mema`), title, side (`sloan` or `lester`), description, order.

Adding a new folder later is one new row in collections.csv. It shows up in the menu and on its side's page automatically.

## Preview on your computer

Opening `index.html` by double-clicking won't load the spreadsheets, because browsers block that. Run a tiny local server instead:

```
cd family-archive/public
python3 -m http.server 8000
```

Then open http://localhost:8000.

## Put it online (Cloudflare Workers)

1. **GitHub:** create a new **private** repository called `family-archive` and push this folder to it:
   ```
   cd family-archive
   git init
   git add .
   git commit -m "Family archive: first version"
   git branch -M main
   git remote add origin https://github.com/triiiinity/family-archive.git
   git push -u origin main
   ```
2. **Cloudflare:** dashboard → **Workers & Pages** → **Create** → **Import a repository** → choose `family-archive`.
3. Leave the build command empty. The deploy command is `npx wrangler deploy`, which reads `wrangler.jsonc`. Click **Deploy**.
4. The site is live at `family-archive.<your-subdomain>.workers.dev`. Every push to `main` redeploys it.

## Before real photos go up: privacy

A workers.dev address is public: anyone with the link can see it. Marking a photo Private only hides it in the menus. Its file would still be downloadable if it were in `images/web/`. Before uploading family photos:

- Put the site behind a login. Cloudflare Zero Trust → Access lets you allow only specific family email addresses, and the free plan covers a family-sized list.
- Never put a private photo's image file in `public/` until that login exists.
