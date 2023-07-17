import WebSocket from 'ws';
import {
  Player,
  PlayerData,
  PlayerGameBoard,
  addPlayer,
  addPlayerGameBoard,
  addToRoom,
  checkGameBoards,
  createRoom,
  getRoomIdsByPlayerId,
  getSingleRooms,
  getWinners,
  calculateAttackResult,
  Coords,
  AttackResultStatus,
  getOtherPlayerIdInRoom,
  getRandomHit,
  addWinner
} from '../model/model.js';

interface Received {
  type:
  'reg'
  | 'create_room'
  | 'add_user_to_room'
  | 'add_ships'
  | 'attack'
  | 'randomAttack',
  data: string,
  id: number,
}

interface Sent {
  type:
  'reg'
  | 'update_winners'
  | 'update_room'
  | 'create_game'
  | 'start_game'
  | 'attack'
  | 'turn'
  | 'finish',
  data: string,
  id: number,
}

interface AddToRoomData {
  indexRoom: number,
}

interface PlayerGameData {
  idGame: number,
  idPlayer: number,
}

interface SentPlayerBoardData extends Omit<PlayerGameBoard, 'gameId' | 'indexPlayer' | 'hits'> {
  currentPlayerIndex: number,
}

interface TurnData {
  currentPlayer: number,
}

interface AttackData {
  gameId: number,
  x: number,
  y: number,
  indexPlayer: number,
}

interface RandomAttackData {
  gameId: number,
  indexPlayer: number,
}

interface AttackFeedbackData {
  position: Coords,
  currentPlayer: number,
  status: AttackResultStatus,
}

interface FinishData {
  winPlayer: number,
}

const sendRooms = async (clients: Set<WebSocket> | WebSocket) => {
  const rooms = await getSingleRooms();

  const resRooms: Sent = {
    type: 'update_room',
    data: JSON.stringify(rooms),
    id: 0,
  };

  if (clients instanceof Set) {
    clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(resRooms));
      }
    });
  } else {
    clients.send(JSON.stringify(resRooms));
  }
};

const sendWinners = async (clients: Set<WebSocket> | WebSocket) => {
  const winners = await getWinners();

  const resWinners: Sent = {
    type: 'update_winners',
    data: JSON.stringify(winners),
    id: 0,
  };

  if (clients instanceof Set) {
    clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(resWinners));
      }
    });
  } else {
    clients.send(JSON.stringify(resWinners));
  }
};

const sendGame = async (gameId: number, clients: Set<WebSocket>) => {
  clients.forEach((client) => {
    const connectionInfo = connections.get(client);

    if (!connectionInfo) {
      return;
    }

    const game: PlayerGameData = {
      idGame: gameId,
      idPlayer: connectionInfo.playerId,
    };

    const resGame: Sent = {
      type: 'create_game',
      data: JSON.stringify(game),
      id: 0,
    };

    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(resGame));
    }
  });
};

const sendStart = async (board: PlayerGameBoard, clients: Set<WebSocket>) => {
  const currentPlayerBoard: SentPlayerBoardData = {
    ships: board.ships,
    currentPlayerIndex: board.indexPlayer,
  };

  const resStart: Sent = {
    type: 'start_game',
    data: JSON.stringify(currentPlayerBoard),
    id: 0,
  };

  clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(resStart));
    }
  });
};

const sendTurn = async (currentPlayer: number, clients: Set<WebSocket>) => {
  const data: TurnData = {
    currentPlayer
  };

  const resTurn: Sent = {
    type: 'turn',
    data: JSON.stringify(data),
    id: 0,
  };

  clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(resTurn));
    }
  });
};

const sendAttackFeedback = async (data: AttackFeedbackData, clients: Set<WebSocket>) => {
  const resAttackFeedback: Sent = {
    type: 'attack',
    data: JSON.stringify(data),
    id: 0,
  };

  clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(resAttackFeedback));
    }
  });
};

const sendFinish = async (winPlayer: number, clients: Set<WebSocket>) => {
  const data: FinishData = {
    winPlayer
  };

  const resFinish: Sent = {
    type: 'finish',
    data: JSON.stringify(data),
    id: 0,
  };

  clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(resFinish));
    }
  });
};

let playerCounter = 0;

const generatePlayerId = () => {
  playerCounter += 1;
  return playerCounter;
};

let gameCounter = 0;

const generateGameId = () => {
  gameCounter += 1;
  return gameCounter;
};

const connections: Map<WebSocket, {
  playerId: number,
  roomIds: number[],
  gameId: number | null,
}> = new Map();

const getConnectionsByRoomId = (roomId: number) => {
  const matchingConnections: Set<WebSocket> = new Set();

  for (const [ws, connectionInfo] of connections) {
    if (connectionInfo.roomIds.includes(roomId)) {
      matchingConnections.add(ws);
    }
  }

  return matchingConnections.size ? matchingConnections : null;
};

const getConnectionsByGameId = (gameId: number) => {
  const matchingConnections: Set<WebSocket> = new Set();

  for (const [ws, connectionInfo] of connections) {
    if (connectionInfo.gameId === gameId) {
      matchingConnections.add(ws);
    }
  }

  return matchingConnections.size ? matchingConnections : null;
};

export const wsController = async (ws: WebSocket, wss: WebSocket.Server) => {
  let playerId = generatePlayerId();
  let roomIds = await getRoomIdsByPlayerId(playerId);
  connections.set(ws, { playerId, roomIds, gameId: null });
  let connectionInfo = connections.get(ws);
  let player: Omit<Player, 'password'> | null = null;

  ws.on('error', console.error);

  ws.on('message', async (msg) => {
    console.info('Received: %s', msg);

    const { type, data, id } = JSON.parse(msg.toString()) as Received;

    switch (type) {
      case 'reg':
        const playerData = JSON.parse(data) as PlayerData;
        const playerResponse = await addPlayer({ index: playerId, ...playerData });

        playerId = playerResponse.index;
        connectionInfo = connections.get(ws);
        roomIds = connectionInfo?.roomIds || await getRoomIdsByPlayerId(playerId);
        connections.set(ws, {
          playerId: playerResponse.index,
          roomIds,
          gameId: connectionInfo?.gameId || null,
        });

        player = { index: playerResponse.index, name: playerResponse.name };

        const resReg: Sent = {
          type: 'reg',
          data: JSON.stringify(playerResponse),
          id,
        };

        ws.send(JSON.stringify(resReg));

        // Update room state (send rooms list with only one player)
        await sendRooms(wss.clients); // 'update_room'

        await sendWinners(wss.clients); // 'update_winners'

        // console.info(`Registered or logged in player: ${playerResponse.name}, index: ${playerResponse.index}`);
        break;
      case 'create_room':
        // Create game room and add yourself there

        await createRoom(player);

        roomIds = await getRoomIdsByPlayerId(playerId);
        connectionInfo = connections.get(ws);
        connections.set(ws, {
          playerId,
          roomIds,
          gameId: connectionInfo?.gameId || null,
        });

        await sendRooms(ws); // 'update_room'

        // console.info(`Created room with roomId ${roomIndex}`);
        break;
      case 'add_user_to_room':
        // Add youself to somebody's room, then remove room from rooms list
        const addToRoomData = JSON.parse(data) as AddToRoomData;

        await addToRoom(addToRoomData.indexRoom, player);

        roomIds = await getRoomIdsByPlayerId(playerId);
        connectionInfo = connections.get(ws);
        connections.set(ws, {
          playerId,
          roomIds,
          gameId: connectionInfo?.gameId || null,
        });

        const wsSet = getConnectionsByRoomId(addToRoomData.indexRoom);

        if (wsSet) await sendRooms(wsSet); // 'update_room'

        // Send 'create_game' for both players in the room

        const gameId = generateGameId();

        if (wsSet) {
          await sendGame(gameId, wsSet);

          wsSet.forEach(async (ws) => {
            const connectionInfo = connections.get(ws);

            if (!connectionInfo) return;

            const roomIds = await getRoomIdsByPlayerId(connectionInfo.playerId);

            connections.set(ws, {
              playerId: connectionInfo.playerId,
              roomIds,
              gameId,
            });
          });
        }

        console.info(`Created game with gameId ${gameId}`);
        break;
      case 'add_ships':
        // Add ships to the game board
        const board = JSON.parse(data) as PlayerGameBoard;
        console.info(`Recieved ships data for: ${player?.name}, index: ${player?.index}`);

        // Add playerGameBoard to the rooms data
        await addPlayerGameBoard(board);

        // Start game (only after server receives both player's ships positions)

        const check = await checkGameBoards(board.gameId);

        if (check) {
          // Send 'start_game' to both players in the room
          const wsSet = getConnectionsByGameId(board.gameId);

          if (wsSet) {
            await sendStart(board, wsSet);
            console.info(`Started game with gameId ${board.gameId}`);
            await sendTurn(board.indexPlayer, wsSet);
          }

          // id of the player in the current game who have sent his ships
        }

        break;
      case 'randomAttack':
      case 'attack':
        // Attack feedback (should be sent after every shot, miss and after kill sent miss for all cells around ship too)

        let attackData: AttackData | null = null;

        connectionInfo = connections.get(ws);

        if (type === 'randomAttack') {
          const randomAttackData = JSON.parse(data) as RandomAttackData;
          const randomHit = await getRandomHit(connectionInfo?.gameId, randomAttackData.indexPlayer);

          if (randomHit) {
            attackData = {
              gameId: randomAttackData.gameId,
              x: randomHit?.x,
              y: randomHit?.y,
              indexPlayer: randomAttackData.indexPlayer
            };
          }
        } else if (type === 'attack') {
          attackData = JSON.parse(data) as AttackData;
        }

        if (attackData) {
          const feedback = await calculateAttackResult(
            connectionInfo?.gameId,
            attackData.indexPlayer,
            attackData.x,
            attackData.y
          );

          if (feedback && connectionInfo?.gameId) {
            const wsSet = getConnectionsByGameId(connectionInfo.gameId);

            const attackFeedbackData: AttackFeedbackData = {
              position: {
                x: attackData.x,
                y: attackData.y,
              },
              currentPlayer: attackData.indexPlayer,
              status: feedback.result,
            };

            if (wsSet) {
              await sendAttackFeedback(attackFeedbackData, wsSet);

              if (feedback.missedCells) {
                for await (const cell of feedback.missedCells) {
                  const missedCellData: AttackFeedbackData = {
                    ...attackFeedbackData,
                    position: {
                      x: cell.x,
                      y: cell.y,
                    },
                    status: 'miss',
                  };

                  await sendAttackFeedback(missedCellData, wsSet);
                  await sendTurn(attackData.indexPlayer, wsSet);
                }
              }

              let playerIdTurn: number | null = attackData.indexPlayer;

              if (feedback.result === 'miss') {
                const otherPlayerId = await getOtherPlayerIdInRoom(attackData.indexPlayer, connectionInfo.gameId);
                playerIdTurn = otherPlayerId;
              }

              if (playerIdTurn !== null) await sendTurn(playerIdTurn, wsSet);

              console.info(`Attack result: ${feedback.result}`);
              console.info(`Player ${playerIdTurn} turn`);

              if (feedback.isGameOver && playerIdTurn) {
                await sendFinish(playerIdTurn, wsSet);
                const winner = await addWinner(playerIdTurn);
                await sendWinners(wss.clients);

                if (winner) {
                  console.info(`Game over, winner ${winner?.name}, wins: ${winner.wins}`);
                }
              }
            }
          }
        }

        break;
      default:
        break;
    }
  });

  ws.on('close', () => {
    connections.delete(ws);
    console.info(`Player ${player?.name} ${player?.index} left the room`);
  });
};
