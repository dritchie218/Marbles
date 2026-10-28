# Marbles

A browser version of the card-and-marble board game "Marbles" (Pegs and Jokers), played with three decks and five marbles each. It is one HTML file with no build step and no dependencies.

**Play it:** https://dritchie218.github.io/Marbles/

## Features

- 4 or 6 players against computer opponents, with Teams (partner sits across) or individual play
- Rules follow the printed "The Joker Game Marbles" sheet (see the Rules section inside the game)
- Choose your marble color and a board skin: MN football (default), Midnight, Oak, or Minnesota hockey and baseball colors
- Playing-card images, cat-eye marbles, a log of every move, and a preview of where each move can land (red sends an opponent to start, green sends your partner to their home gate)
- Evenly spaced board: 18 holes per player, with 10 holes to the left and 8 to the right of each come-out spot (corner holes included)

## Install it as an app (optional)

Open the link on your phone, then:

- **iPhone (Safari):** Share → **Add to Home Screen**
- **Android (Chrome):** tap **Install** when offered, or menu (⋮) → **Add to Home screen**

It gets its own purple & gold icon, opens full screen, and works offline. Updates arrive automatically the next time it is opened with a connection. Playing in the browser without installing works exactly the same.

## Run it locally

Open `index.html` in any browser. Nothing to install.

## Test

```sh
npm test
```

Plays full simulated games on 4 and 6 player boards, with every skin, and checks the hole spacing and counts. Also checks the app manifest, icons and offline service worker. Needs Node 18 or newer.

## App icons

`tools/make-icons.js` draws the icons (`npm run icons`) into `icons/`. They are generated during deployment, so they are not stored in the repository.

## Publish with GitHub Pages

Settings → Pages → Build and deployment → Source → **GitHub Actions**. The `.github/workflows/pages.yml` workflow runs the tests, draws the icons, and deploys on every push to `main` (or run it manually from the Actions tab).

## License

MIT. See [LICENSE](LICENSE).
