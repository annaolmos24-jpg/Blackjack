# Blackjack

A browser Blackjack game dealt from a real 6-deck shoe by the free
[Deck of Cards API](https://deckofcardsapi.com). Plain HTML, CSS and JavaScript — no
framework and no build step, so it deploys to Netlify as a static site.

## Features

- 6-deck shoe, reshuffled automatically when 25% of the cards are left (the "cut card")
- Betting with $5 / $25 / $100 / $500 chips; your last bet is offered again each round
- Hit, Stand, Double Down and Split (up to 4 hands; split aces get one card each)
- Blackjack pays 3:2, dealer stands on all 17s, dealer peeks for blackjack
- Bankroll and shoe are saved in your browser, so a refresh doesn't lose your game
- Keyboard shortcuts: **H** hit, **S** stand, **D** double, **P** split, **Enter** deal

## Sign in with Google (Supabase)

Players sign in with Google through Supabase Auth before they can sit at the table. Once
signed in, the header shows their Google name and profile photo, a greeting welcomes them,
and each player gets their own saved bankroll.

Setup checklist:

1. **Publishable key** — paste it into `js/config.js` (`SUPABASE_PUBLISHABLE_KEY`). Find it in
   Supabase → Project Settings → API Keys. It is meant to be public, so committing it is fine.
2. **Google provider** — Supabase → Authentication → Sign In / Providers → Google: enabled, with
   your Google OAuth Client ID and Secret.
3. **Google Cloud Console** — on that OAuth client, *Authorized redirect URIs* must include
   `https://xpohmzyqtwqkwdmxgakg.supabase.co/auth/v1/callback`.
4. **Redirect URLs** — Supabase → Authentication → URL Configuration. Set the Site URL to your main
   address and add every address the game runs on to *Redirect URLs*, e.g.
   - `https://annaolmos24-jpg.github.io/Blackjack/`
   - your Netlify URL, e.g. `https://<your-site>.netlify.app/`
   - `http://localhost:3000/` for local testing

   If an address is missing, Supabase sends people to the Site URL instead after sign-in.
5. **Publish the Google consent screen** — while the Google Cloud app is in *Testing*, only the
   test users you list can sign in. Set it to *In production* so anyone can log in.

## How it uses the API

| What                    | Endpoint                                  |
| ----------------------- | ----------------------------------------- |
| Open the shoe           | `GET /api/deck/new/shuffle/?deck_count=6` |
| Deal / hit              | `GET /api/deck/<deck_id>/draw/?count=N`   |
| Reshuffle the full shoe | `GET /api/deck/<deck_id>/shuffle/`        |
| Card faces / card back  | `card.image`, `/static/img/back.png`      |

The game logic (hand totals, soft aces, payouts) lives in `js/rules.js` and runs entirely
in the browser. Piles aren't used because the API doesn't support piles on multi-deck shoes.

## Project layout

```
index.html        page markup
css/style.css     table styling (responsive down to phone width)
js/rules.js       pure Blackjack rules — no DOM or network
js/api.js         Deck of Cards API wrapper (the Shoe class)
js/main.js        game flow, rendering and controls
js/auth.js        Google sign-in via Supabase Auth
js/config.js      Supabase URL + publishable key
tests/            unit tests for the rules
netlify.toml      Netlify config (publish the repo root, no build)
```

## Run locally

ES modules need to be served over HTTP (opening `index.html` straight from disk won't work):

```bash
npm start
```

Then open the URL it prints. Any static server works, e.g. `python3 -m http.server`.

Run the rules tests (Node 18+):

```bash
npm test
```

## Deploy to GitHub Pages

Every push to `main` runs the tests and publishes the game with
`.github/workflows/pages.yml`. One-time setup: in the repo go to
**Settings → Pages** and set **Source** to **GitHub Actions**. The game is then live at
<https://annaolmos24-jpg.github.io/Blackjack/>.

## Deploy to Netlify

1. In Netlify choose **Add new site → Import an existing project** and pick this GitHub repo.
2. Branch to deploy: `main`. Leave the build command empty; the publish directory is `.`
   (both are already set in `netlify.toml`).
3. Deploy. Netlify redeploys automatically on every push to `main`.

Or drag and drop the project folder onto <https://app.netlify.com/drop> for a manual deploy.
