import { httpServer } from './http-server/http-server.js';
import WebSocket, { WebSocketServer } from 'ws';
import { loadDB } from './model/model.js';
import { wsController } from './controller/controller.js';

const HOST = '127.0.0.1';
const HTTP_PORT = 8181;
const WS_PORT = 3000;

httpServer.listen(HTTP_PORT, HOST, () => {
  console.info(`Started static http server on the ${HTTP_PORT} port`);
});

await loadDB();

const wss = new WebSocketServer({ port: WS_PORT }, () => {
  console.info(`Started websocket server on the ${WS_PORT} port`);
});

wss.on('connection', (ws: WebSocket) => {
  wsController(ws, wss);
});

wss.on('close', () => {
  console.info('Disconnected');
});
