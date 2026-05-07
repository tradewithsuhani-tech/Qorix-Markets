#!/usr/bin/env node
const http = require('http');
const net = require('net');
const { spawn } = require('child_process');

const FRONT_PORT = parseInt(process.env.PORT || '18311', 10);
const EXPO_PORT = FRONT_PORT + 100;
const UPSTREAM_HOST = '127.0.0.1';

let expoReady = false;

function proxyHttp(req, res) {
  const opts = {
    host: UPSTREAM_HOST,
    port: EXPO_PORT,
    method: req.method,
    path: req.url,
    headers: req.headers,
  };
  const upstream = http.request(opts, (uRes) => {
    res.writeHead(uRes.statusCode, uRes.headers);
    uRes.pipe(res);
  });
  upstream.on('error', () => {
    if (!res.headersSent) res.writeHead(502);
    res.end('upstream unavailable');
  });
  req.pipe(upstream);
}

const server = http.createServer((req, res) => {
  console.log(`[proxy] ${req.method} ${req.url} from ${req.socket.remoteAddress}`);
  if (req.url === '/status' || req.url === '/health' || req.url === '/') {
    res.writeHead(200, { 'content-type': 'text/plain' });
    return res.end('ok');
  }
  if (!expoReady) {
    res.writeHead(200, { 'content-type': 'text/plain' });
    return res.end('starting');
  }
  proxyHttp(req, res);
});

server.on('upgrade', (req, sock, head) => {
  if (!expoReady) {
    sock.destroy();
    return;
  }
  const upstream = net.connect(EXPO_PORT, UPSTREAM_HOST, () => {
    upstream.write(
      `${req.method} ${req.url} HTTP/${req.httpVersion}\r\n` +
        Object.entries(req.headers)
          .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`)
          .join('\r\n') +
        '\r\n\r\n'
    );
    if (head && head.length) upstream.write(head);
    sock.pipe(upstream);
    upstream.pipe(sock);
  });
  upstream.on('error', () => sock.destroy());
  sock.on('error', () => upstream.destroy());
});

server.listen(FRONT_PORT, () => {
  console.log(
    `[proxy] listening on 0.0.0.0:${FRONT_PORT} -> ${UPSTREAM_HOST}:${EXPO_PORT} (/status served locally)`
  );
  startExpo();
});

function startExpo() {
  const env = {
    ...process.env,
    EXPO_PACKAGER_PROXY_URL: `https://${process.env.REPLIT_EXPO_DEV_DOMAIN}`,
    EXPO_PUBLIC_DOMAIN: process.env.REPLIT_DEV_DOMAIN,
    EXPO_PUBLIC_REPL_ID: process.env.REPL_ID,
    REACT_NATIVE_PACKAGER_HOSTNAME: process.env.REPLIT_DEV_DOMAIN,
  };
  const child = spawn(
    'pnpm',
    ['exec', 'expo', 'start', '--localhost', '--port', String(EXPO_PORT)],
    { env, stdio: 'inherit' }
  );
  child.on('exit', (code) => {
    console.log(`[proxy] expo exited ${code}`);
    process.exit(code || 0);
  });
  const probe = () => {
    const c = net.connect(EXPO_PORT, UPSTREAM_HOST);
    c.on('connect', () => {
      c.destroy();
      if (!expoReady) {
        expoReady = true;
        console.log('[proxy] expo upstream ready');
      }
    });
    c.on('error', () => {
      c.destroy();
      setTimeout(probe, 1000);
    });
  };
  setTimeout(probe, 2000);
}

['SIGINT', 'SIGTERM'].forEach((sig) =>
  process.on(sig, () => process.exit(0))
);
