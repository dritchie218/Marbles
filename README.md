# Marbles

A browser version of the card-and-marble board game "Marbles" (Pegs and Jokers), played with three decks and five marbles each. It is one HTML file with no build step and no dependencies.

**Play it:** https://dritchie218.github.io/Marbles/

## Features

- 4 or 6 players against computer opponents, with Teams or individual play: 4 players = 2 teams of 2 (partner across), 6 players = 2 teams of 3 (every other seat). Finished players play for the teammate to their left (clockwise); a 7 can be shared with any teammate
- Pass-and-play: before each game, choose **Person** or **Computer** for every seat. People share one phone; a “Pass to …” screen hides the cards between turns
- Rules follow the printed "The Joker Game Marbles" sheet (see the Rules section inside the game)
- Choose your marble color and a board skin: MN football (default), Midnight, Oak, or Minnesota hockey and baseball colors
- Playing-card images, cat-eye marbles, a log of every move, and a preview of where each move can land (red sends an opponent to start, green sends a teammate to their home gate)
- Evenly spaced board: 18 holes per player, with 10 holes to the left and 8 to the right of each come-out spot (corner holes included)

## Install it as an app (optional)

Open the link on your phone, then:

- **iPhone (Safari):** Share → **Add to Home Screen**
- **Android (Chrome):** tap **Install** when offered, or menu (⋮) → **Add to Home screen**

The game also links a printable one-page guide with these steps and a QR code: [Marbles-Home-Screen-Directions.pdf](https://dritchie218.github.io/Marbles/Marbles-Home-Screen-Directions.pdf).

It gets its own purple & gold icon, opens full screen, and works offline. Updates arrive automatically the next time it is opened with a connection. Playing in the browser without installing works exactly the same.

## Run it locally

Open `index.html` in any browser. Nothing to install.

## Test

```sh
npm test
```

Plays full simulated games on 4 and 6 player boards, with every skin, and checks the hole spacing and counts. Checks the team rules (teams of 2 and 3, playing for teammates, shared 7s, team wins) and pass-and-play (seat choices, pass screens, mixed person/computer games). Also checks the app manifest, icons and offline service worker. Needs Node 18 or newer.

## App icons

`tools/make-icons.js` draws the icons (`npm run icons`) into `icons/`. They are generated during deployment, so they are not stored in the repository. `tools/make-guide.py` (Python + reportlab) builds the directions PDF the same way.

## Publish with GitHub Pages

Settings → Pages → Build and deployment → Source → **GitHub Actions**. The `.github/workflows/pages.yml` workflow runs the tests, draws the icons, and deploys on every push to `main` (or run it manually from the Actions tab).

## License

MIT. See [LICENSE](LICENSE).
