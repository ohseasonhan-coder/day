const net = require('net');

const DEFAULT_PORT = Number(process.env.PORT || 3000);
const MAX_PORT_ATTEMPTS = 20;

function canUsePort(port) {
  return new Promise((resolve) => {
    const server = net.createServer();

    server.once('error', () => resolve(false));
    server.once('listening', () => {
      server.close(() => resolve(true));
    });

    server.listen(port, '0.0.0.0');
  });
}

async function findOpenPort(startPort) {
  for (let offset = 0; offset < MAX_PORT_ATTEMPTS; offset += 1) {
    const port = startPort + offset;
    if (await canUsePort(port)) return port;
  }
  throw new Error(`No open port found from ${startPort} to ${startPort + MAX_PORT_ATTEMPTS - 1}.`);
}

findOpenPort(DEFAULT_PORT)
  .then((port) => {
    if (port !== DEFAULT_PORT) {
      console.log(`Port ${DEFAULT_PORT} is busy. Starting on port ${port} instead.`);
    }
    process.env.PORT = String(port);
    require('react-scripts/scripts/start');
  })
  .catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
