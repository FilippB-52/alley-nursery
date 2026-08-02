#!/usr/bin/env python3
"""Local dev server with caching disabled so browsers always load the latest files.

Threaded on purpose: the single-threaded TCPServer this used to be could only answer one
connection at a time, so while the browser streamed the 3.5 MB hero video (or a screenful
of catalog photos) every other request — the next page, its CSS, its JS — queued behind it
for ~10 seconds. That looked like the site freezing on navigation; it was the server.
"""
import http.server
import socketserver

PORT = 8756


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    protocol_version = "HTTP/1.1"  # keep-alive; safe now that each connection has a thread

    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()


class ThreadedServer(socketserver.ThreadingMixIn, http.server.HTTPServer):
    daemon_threads = True   # don't let an open media stream keep the process alive
    allow_reuse_address = True


with ThreadedServer(("", PORT), NoCacheHandler) as httpd:
    print(f"Serving with no-cache at http://localhost:{PORT}")
    httpd.serve_forever()
