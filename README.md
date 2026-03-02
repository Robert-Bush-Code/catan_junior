# Catan Junior (Local Vue Prototype)

A local, kid-friendly digital board game inspired by **Catan Junior**, built with plain HTML/CSS/JS using Vue and served by a no-dependency Python server.

## Quick start (important)

This project has:

- **Python** only for serving files (`server.py`)
- **JavaScript** for gameplay logic (`app.js`)

✅ Run this:

```bash
python3 server.py --host 127.0.0.1 --port 8000
```

Then open:

- <http://127.0.0.1:8000>

❌ Do **not** run `app.js` with Python.

## If you see this error

```text
File ".../app.js", line 1
  const { createApp } = Vue;
        ^
SyntaxError: invalid syntax
```

You accidentally ran JavaScript with Python (for example: `python app.js`).

Use this instead:

```bash
python3 server.py
```

## What this includes

- Vue 3 single-page app (loaded via CDN)
- Procedurally generated hex board
- 2–4 local hot-seat players
- Dice rolling and resource production
- Ghost blocking mechanic on `7`
- Build ships and hideouts
- Gold as wildcard payment resource
- First to 7 hideouts wins

## Notes on rules

This implementation follows commonly known Catan Junior-style mechanics (resource production by dice value, ghost blocking, expansion with ships, and victory via hideouts).

It is a simplified fan prototype for local family play and not an official licensed game.

## Files

- `index.html` – app shell/UI
- `styles.css` – styling
- `app.js` – game state and rules logic (JavaScript)
- `server.py` – static HTTP server using Python standard library only
