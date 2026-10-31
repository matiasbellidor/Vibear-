# Vibear admin guide

Vibear has **no login and no admin panel**, on purpose: visitors are anonymous. This guide covers what the API keeps about them, how to count them, how to erase one visitor's data when they ask, and how to clean up.

## Who a visitor is

- **In the browser:** on the first visit the web app makes up an id (a UUID) and keeps it in `localStorage` under `vibear:profile` (`user`). Saved products are in `vibear:saved`.
- **In the API:** the first time a visitor saves a product, or answers or skips the style test, the API gives the browser a random id (32 hex characters) in an HttpOnly cookie, `vibear_closet`, valid 400 days and renewed on each visit. That id names the visitor's files. Nothing is created for a visitor who only browses.

## What is stored

Everything lives under the API's data folder: `apps/api/data/` locally (`DATA_DIR`), or the `api-data` volume in Docker (`/app/data` inside the `api` container).

| Folder | Per visitor? | What it holds |
|---|---|---|
| `closets/<id>.json` | yes | Saved products: title, shop link, thumbnail URL, price, similarity, when it was saved |
| `profiles/<id>.json` | yes | The style test: the browser's UUID, status (`new`, `done`, `skipped`), answers as short keys (`"aesthetics": ["clean-girl"]`), the colour season (`"otono-suave"`) |
| `images/<hash>.jpg` | no (shared) | Photos uploaded to the scanner and their garment crops, named by content hash |
| `looks/<hash>.json` | no (shared) | What was detected in each uploaded photo |
| `cache/*.json` | no | Search results, reused for 72 h |

No names, emails, phone numbers or passwords are stored anywhere. Note that `images/` holds the photos people scan, which can show people: treat that folder as personal data. The fitting room's photos are never stored (the browser keeps them in IndexedDB).

## Everyday commands

Run them from `apps/api` (locally) or prefix them with `docker compose exec api` and use `/app/data`.

```bash
# How many anonymous visitors saved something / took the test
ls data/closets | wc -l
ls data/profiles | wc -l

# How the colour seasons are distributed
python -c "import json,glob,collections; print(collections.Counter(json.load(open(f))['color']['season'] for f in glob.glob('data/profiles/*.json') if json.load(open(f)).get('color')))"

# One visitor's data, by cookie id
cat data/closets/<id>.json data/profiles/<id>.json
```

## Erasing a visitor's data

A visitor who wants their data erased can find either id in their browser:

- the cookie `vibear_closet` (DevTools → Application → Cookies → the site): that is `<id>`;
- or their UUID, in DevTools → Application → Local Storage → `vibear:profile` → `user`.

```bash
# By cookie id
rm data/closets/<id>.json data/profiles/<id>.json

# By UUID: find the profile that holds it, then erase both files with that name
grep -l '"<uuid>"' data/profiles/*.json
```

Their browser keeps its own copy until they clear the site's data; tell them to do that too (or to use "Hacer el test de nuevo" and remove their saved products).

## Clean-up

The cookie lasts 400 days and is renewed on every visit, so a file untouched for 400 days belongs to a visitor who will not come back with it:

```bash
find data/closets data/profiles -name "*.json" -mtime +400 -delete
# Scanned photos, if you want a shorter retention (their /look links stop working):
find data/images data/looks -mtime +90 -delete
```

Erase everything: delete the `closets/` and `profiles/` folders (they are recreated on start). With Docker, `docker compose down -v` deletes the whole `api-data` volume, photos and cache included.

## Backups

Copy the data folder (or the volume) while the API runs: every file is written whole, and the newest copy of a closet or profile wins when browsers sync, so a restored backup never overwrites newer changes.

## If accounts are added later

The anonymous id is the bridge: on sign-in, attach the visitor's cookie id to the account and move `closets/<id>.json` and `profiles/<id>.json` under the account. Until then, a visitor's closet and profile are per browser: a phone and a laptop are two visitors.
