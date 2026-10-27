import { createServer } from 'node:http';

const server = createServer((request, response) => {
  response.writeHead(200, { 'content-type': 'application/json' });
  response.end(JSON.stringify({ ok: true, path: request.url }));
});

server.listen(3000, '0.0.0.0', () => console.log('Listening on port 3000'));
