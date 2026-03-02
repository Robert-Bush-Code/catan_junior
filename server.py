#!/usr/bin/env python3
"""Simple zero-dependency local server for the Catan Junior Vue app."""

import argparse
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


def main() -> None:
    parser = argparse.ArgumentParser(description="Serve the Catan Junior local web app.")
    parser.add_argument("--host", default="127.0.0.1", help="Host to bind (default: 127.0.0.1)")
    parser.add_argument("--port", type=int, default=8000, help="Port to bind (default: 8000)")
    args = parser.parse_args()

    web_root = Path(__file__).resolve().parent
    handler = partial(SimpleHTTPRequestHandler, directory=str(web_root))
    server = ThreadingHTTPServer((args.host, args.port), handler)

    print(f"Serving {web_root} at http://{args.host}:{args.port}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down...")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
