import http.server
import socketserver

class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-cache')
        self.send_header('Pragma', 'no-cache')
        super().end_headers()

Handler = NoCacheHandler
with socketserver.TCPServer(('127.0.0.1', 3000), Handler) as httpd:
    print('Serving http://127.0.0.1:3000  (no-cache)')
    httpd.serve_forever()
