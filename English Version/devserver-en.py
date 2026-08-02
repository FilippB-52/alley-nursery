#!/usr/bin/env python3
"""English-preview server. Serves en/index.html at "/" and every asset from the
project root untouched, so the English page is byte-identical in behaviour to the
Russian one. Separate port, separate process: the Russian site on 8756 is unaffected.
"""
import http.server, socketserver, os, pathlib

PORT = 8757
HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parent

class EnHandler(http.server.SimpleHTTPRequestHandler):
    def translate_path(self, path):
        if path.split("?")[0] in ("/", "/index.html"):
            return str(HERE / "index.html")
        return super().translate_path(path)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

class ThreadedServer(socketserver.ThreadingMixIn, http.server.HTTPServer):
    daemon_threads = True   # one thread per connection, or a media stream blocks every request
    allow_reuse_address = True


os.chdir(ROOT)
with ThreadedServer(("", PORT), EnHandler) as httpd:
    print(f"English preview at http://localhost:{PORT}")
    httpd.serve_forever()
