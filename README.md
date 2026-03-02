# Catan Junior (Local Vue Prototype)

A local, kid-friendly digital board game inspired by **Catan Junior**, built with plain HTML/CSS/JS using Vue and served by a no-dependency Python server.

## Quick start

```bash
python3 server.py --host 127.0.0.1 --port 8000
```

Open <http://127.0.0.1:8000>.

## Current rules implementation (Catan Junior focused)

- Single die per turn.
  - `1-5`: all players collect from adjacent lairs on matching pip islands.
  - `6`: active player must move Ghost Captain and gains 2 resources from chosen island.
- Ghost Captain starts on Spooky Island and blocks production where placed.
- Build alternation is enforced (`lair -> ship -> lair -> ...`) after initial setup.
- Build costs:
  - Ship: `1 goat + 1 wood`
  - Lair: `1 cutlass + 1 goat + 1 molasses + 1 wood`
- Coco tiles are purchasable (`1 cutlass + 1 molasses + 1 gold`) with immediate effects.
- Trading includes:
  - Marketplace booth trade (`1:1`, once per turn)
  - Stockpile trade (`2 identical -> 1 chosen`, unlimited)
- Win condition: first to 7 lairs (including Coco leader Spooky bonus).

## Files

- `index.html` – app shell/UI
- `styles.css` – styling
- `app.js` – game state and rules logic
- `server.py` – static HTTP server using Python stdlib
