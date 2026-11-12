"""Local-only portfolio preview. Does not send analytics to production."""
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
import json
ROOT = Path(__file__).resolve().parents[1]
class Preview(SimpleHTTPRequestHandler):
    def __init__(self,*a,**kw): super().__init__(*a,directory=str(ROOT),**kw)
    def do_GET(self):
        path=self.path.split('?')[0]
        if path.startswith(('/backend','/.','/review')) or path.endswith(('.md','.json','.py')):
            self.send_error(404);return
        if path=='/' or path.endswith('.html'):
            file=ROOT/('index.html' if path=='/' else path.lstrip('/'))
            if file.is_file() and file.resolve().parent==ROOT:
                content=file.read_text().replace("window.API_BASE = 'https://jeremyavalos-production.up.railway.app';","window.API_BASE = location.origin;")
                self.send_response(200);self.send_header('Content-Type','text/html; charset=utf-8');self.end_headers();self.wfile.write(content.encode());return
        super().do_GET()
    def do_POST(self):
        if self.path=='/api/analytics/track':
            self.rfile.read(int(self.headers.get('Content-Length',0)))
            self.send_response(200);self.send_header('Content-Type','application/json');self.end_headers();self.wfile.write(b'{"returning_visitor":false}');return
        self.send_error(404)
print('Portfolio review: http://127.0.0.1:4180 — production analytics isolated',flush=True)
ThreadingHTTPServer(('127.0.0.1',4180),Preview).serve_forever()
