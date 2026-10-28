# Marbles

A browser version of the card-and-marble board game "Marbles" (Pegs and Jokers), played with three decks and five marbles each. It is one HTML file with no build step and no dependencies.

**Play it:** https://dritchie218.github.io/Marbles/

## Features

- 4 or 6 players against computer opponents, with Teams (partner sits across) or individual play
- Rules follow the printed "The Joker Game Marbles" sheet (see the Rules section inside the game)
- Choose your marble color and a board skin: Midnight, Oak, or Minnesota football, hockey and baseball colors
- Playing-card images, cat-eye marbles, a log of every move, and a preview of where each move can land (red sends an opponent to start, green sends your partner to their home gate)
- Evenly spaced board: 18 holes per player, with 10 holes to the left and 8 to the right of each come-out spot (corner holes included)

## Run it locally

Open `index.html` in any browser. Nothing to install.

## Test

```sh
npm test
```

Plays full simulated games on 4 and 6 player boards, with every skin, and checks the hole spacing and counts. Needs Node 18 or newer.

## Publish with GitHub Pages

Settings → Pages → Build and deployment → Source → **GitHub Actions**. The `.github/workflows/pages.yml` workflow runs the tests and deploys on every push to `main` (or run it manually from the Actions tab).

## License

MIT. See [LICENSE](LICENSE).
