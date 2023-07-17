import { readFile, writeFile } from 'fs/promises';
import { getDirName, join } from '../utils/utils.js';

const moduleUrl = import.meta.url;
const __dirname = getDirName(moduleUrl);

interface Db {
  players: Player[],
  rooms: Room[],
  winners: Winner[],
}

export interface Player {
  index: number;
  name: string;
  password: string;
}

export interface PlayerData {
  name: string;
  password: string;
}

export interface PlayerResponse {
  name: string,
  index: number,
  error: boolean,
  errorText: string,
}

export interface PlayerGameBoard {
  gameId: number,
  ships: Ship[],
  indexPlayer: number,
  hits?: Coords[],
}

export interface Ship {
  position: Coords,
  direction: boolean,
  length: number,
  type: 'small' | 'medium' | 'large' | 'huge',
}

export interface Coords {
  x: number,
  y: number,
}

interface roomUser extends Omit<Player, 'password'> {
  gameBoard: PlayerGameBoard | null,
}

interface Room {
  roomId: number,
  roomUsers: roomUser[],
  gameId?: number,
}

interface Winner {
  // id: number;
  name: string,
  wins: number,
}

const dbInitial: Db = {
  players: [],
  rooms: [],
  winners: [],
};

// let storageFilePath = join(__dirname, '..', 'data.json');
let storageFilePath = join(__dirname, '..', 'storage.json');
// console.log(storageFilePath)
// let playerIndexCounter = 1;
let roomIndexCounter = 1;

export const loadDB = async (jsonFilePath?: string) => {
  let db = { ...dbInitial };

  try {
    if (jsonFilePath) {
      storageFilePath = jsonFilePath;
      // const contents = await readFile(jsonFilePath, { encoding: 'utf-8' });
      // db = (contents) ? await JSON.parse(contents) : [];
    }
    // else {
    // db = [];
    await writeFile(storageFilePath, JSON.stringify(db));
    // }
  } catch (error) {
    console.error('Error processing the database');
  }
};

const writeDB = async (db: Db, filePath = storageFilePath) => {
  try {
    await writeFile(filePath, JSON.stringify(db));
  } catch (error) {
    console.error('Error processing the database');
  }
};

const readDB = async () => {
  let db: Db = { ...dbInitial };

  try {
    const contents = await readFile(storageFilePath, { encoding: 'utf-8' });
    db = (contents) ? await JSON.parse(contents) : [];
    return db;
  } catch (error) {
    console.error('Error processing the database');
    return db;
  }
};

export const findPlayer = async (name: string) => {
  const db = await readDB();
  return db.players.find((player) => player.name === name);
};

export const findPlayerById = async (id: number) => {
  const db = await readDB();
  return db.players.find((player) => player.index === id);
};

export const addPlayer = async ({ index, name, password }: Player) => {
  // let playerIndex = playerIndexCounter;
  // const obj = { index: playerIndex, name, password };
  const obj = { index, name, password };

  const player = await findPlayer(name);

  const playerResponse: PlayerResponse = {
    name,
    index,
    error: false,
    errorText: '',
  };

  if (!player) {
    // playerIndexCounter += 1;
    const db = await readDB();
    db.players.push(obj);
    await writeDB(db);
    console.info(`Registered player, name: ${name}, index: ${index}`);
  } else {
    // playerIndex = player.index;
    playerResponse.index = player.index;
    console.info(`Player already exists, name: ${name}, index: ${player.index}`);

    if (password !== player.password) {
      playerResponse.error = true;
      playerResponse.errorText = 'Wrong password';
      console.info(`Player entered wrong password`);
    } else {
      console.info(`Logged in player, name: ${name}, index: ${player.index}`);
    }
  }

  return playerResponse;
};

export const findRoom = async (index: number) => {
  const db = await readDB();
  return db.rooms.find((room) => room.roomId === index);
};

export const findRoomByGameId = async (gameId: number) => {
  const db = await readDB();
  return db.rooms.find((room) => room.gameId !== undefined && room.gameId === gameId);
};

export const getRoomIdsByPlayerId = async (playerId: number) => {
  const db = await readDB();
  const roomIds = [];

  for (const room of db.rooms) {
    const playerInRoom = room.roomUsers.find((user) => user.index === playerId);
    if (playerInRoom) {
      roomIds.push(room.roomId);
    }
  }

  return roomIds;
};

export const createRoom = async (player: Omit<Player, 'password'> | null) => {
  if (!player) {
    console.info(`No player provided`);
    return;
  }

  const roomIndex = roomIndexCounter;

  const obj = {
    roomId: roomIndex,
    roomUsers: [
      {
        index: player.index,
        name: player.name,
        gameBoard: null,
      }
    ],
  };

  roomIndexCounter += 1;
  const db = await readDB();
  db.rooms.push(obj);
  await writeDB(db);
  console.info(`Created room with roomId ${roomIndex}`);
};

export const addToRoom = async (roomIndex: number, player: Omit<Player, 'password'> | null) => {
  if (!player) {
    console.info(`No player provided`);
    return;
  }

  // const room = await findRoom(roomIndex);
  const db = await readDB();
  const room = db.rooms.find((room) => room.roomId === roomIndex);

  if (!room) {
    console.info(`No room found with index ${roomIndex}`);
    return;
  }

  if (room.roomUsers.length > 1) {
    console.info(`The room ${roomIndex} is already full`);
    return;
  }

  room.roomUsers.push({
    index: player.index,
    name: player.name,
    gameBoard: null,
  });

  await writeDB(db);

  console.info(`Added player ${player.name} to the room ${roomIndex}`);

  return room;
};

export const addPlayerGameBoard = async (board: PlayerGameBoard) => {
  const roomIds = await getRoomIdsByPlayerId(board.indexPlayer);
  const db = await readDB();

  db.rooms.forEach((room) => {
    if (roomIds.includes(room.roomId)) {
      const roomUser = room.roomUsers.find((user) => user.index === board.indexPlayer);

      if (roomUser) {
        room.gameId = board.gameId;
        roomUser.gameBoard = board;
        roomUser.gameBoard.hits = [];
        console.info(`Added game board for the player with playerId ${board.indexPlayer}`);
      }
    }
  });

  await writeDB(db);
};

export const checkGameBoards = async (gameId: number) => {
  const room = await findRoomByGameId(gameId);

  if (room) {
    return room.roomUsers.every((user) => user.gameBoard);
  }

  return false;
};

export const getWinners = async () => {
  const db = await readDB();
  return db.winners;
};

export const getSingleRooms = async () => {
  const db = await readDB();
  return db.rooms.filter((room) => room.roomUsers.length <= 1);
};

export const getOtherPlayerIdInRoom = async (playerId: number, gameId: number) => {
  const db = await readDB();

  const room = db.rooms.find((room) => room.gameId === gameId);

  if (!room) return null;

  const otherRoomUser = room.roomUsers.find((user) => user.index !== playerId);

  return otherRoomUser ? otherRoomUser.index : null;
};

const getMissedCellsAroundSunkShip = (ship: Ship) => {
  const { position, direction, length } = ship;
  const missedCells: Coords[] = [];

  if (direction) {
    // Ship is placed vertically
    for (let i = -1; i <= length; i++) {
      const x = position.x;
      const y = position.y + i;

      // For the surrounding cells
      missedCells.push({ x: x - 1, y });
      missedCells.push({ x: x + 1, y });
    }

    const x = position.x;
    const y = position.y - 1;
    const yEnd = position.y + length;

    // For cells above and below the ship ends
    missedCells.push({ x, y });
    missedCells.push({ x, y: yEnd });
  } else {
    // Ship is placed horizontally
    for (let i = -1; i <= length; i++) {
      const x = position.x + i;
      const y = position.y;

      // For the surrounding cells
      missedCells.push({ x, y: y - 1 });
      missedCells.push({ x, y: y + 1 });
    }

    const x = position.x - 1;
    const xEnd = position.x + length;
    const y = position.y;

    // For cells left and right of the ship ends
    missedCells.push({ x, y });
    missedCells.push({ x: xEnd, y });
  }

  return missedCells;
};

export type AttackResultStatus = 'miss' | 'killed' | 'shot';

interface AttackFeedback {
  result: AttackResultStatus,
  missedCells?: Coords[],
  isGameOver: boolean,
}

const checkIsGameOver = (ships: Ship[], hits: Coords[]) => {
  for (const ship of ships) {
    const cells: Coords[] = [];

    if (ship.direction) {
      // Ship is placed vertically
      for (let i = 0; i < ship.length; i++) {
        cells.push({
          x: ship.position.x,
          y: ship.position.y + i
        });
      }
    } else {
      // Ship is placed horizontally
      for (let i = 0; i < ship.length; i++) {
        cells.push({
          x: ship.position.x + i,
          y: ship.position.y
        });
      }
    }

    const filteredCells = cells.filter((cell) => {
      return !(hits.find((hit) => hit.x === cell.x && hit.y === cell.y));
    });

    if (filteredCells.length) {
      return false;
    }
  }

  return true;
};

export const calculateAttackResult = async (
  gameId: number | null | undefined,
  playerId: number,
  x: number,
  y: number
): Promise<AttackFeedback | null> => {
  if (gameId === null || gameId === undefined) return null;

  const db = await readDB();

  const room = db.rooms.find((room) => room.gameId === gameId);

  if (!room) return null;

  const roomUser = room.roomUsers.find((user) => user.gameBoard && user.gameBoard.indexPlayer === playerId);
  const otherRoomUser = room.roomUsers.find((user) => user.gameBoard && user.gameBoard.indexPlayer !== playerId);

  if (!roomUser || !otherRoomUser) return null;

  const otherPlayerShips: Ship[] = otherRoomUser.gameBoard?.ships || [];
  const hits: Coords[] = roomUser.gameBoard?.hits || [];
  let isGameOver = false;

  for (const ship of otherPlayerShips) {
    const cells: Coords[] = [];

    if (ship.direction) {
      // Ship is placed vertically
      for (let i = 0; i < ship.length; i++) {
        cells.push({
          x: ship.position.x,
          y: ship.position.y + i
        });
      }
    } else {
      // Ship is placed horizontally
      for (let i = 0; i < ship.length; i++) {
        cells.push({
          x: ship.position.x + i,
          y: ship.position.y
        });
      }
    }

    const filteredCells = cells.filter((cell) => {
      return !(hits.find((hit) => hit.x === cell.x && hit.y === cell.y));
    });

    const hit = filteredCells.find((cell) => cell.x === x && cell.y === y);

    if (hit && filteredCells.length === 1) {
      const missedCells = getMissedCellsAroundSunkShip(ship);
      hits.push(...missedCells);
      hits.push({ x, y });
      await writeDB(db);
      isGameOver = checkIsGameOver(otherPlayerShips, hits);
      return { result: 'killed', missedCells, isGameOver };
    }

    if (hit) {
      hits.push({ x, y });
      await writeDB(db);
      isGameOver = checkIsGameOver(otherPlayerShips, hits);
      return { result: 'shot', isGameOver };
    }
  }

  hits.push({ x, y });
  await writeDB(db);
  isGameOver = checkIsGameOver(otherPlayerShips, hits);

  return { result: 'miss', isGameOver };
};

const generateRandomNumber = (min = 0, max = 10) => {
  // including the min value, excluding the max value
  const difference = max - min;
  let randomNumber = Math.random();

  randomNumber = Math.floor(randomNumber * difference);

  randomNumber = randomNumber + min;

  return randomNumber;
};

export const getRandomHit = async (
  gameId: number | null | undefined,
  playerId: number,
): Promise<Coords | null> => {
  if (gameId === null || gameId === undefined) return null;

  const db = await readDB();

  const room = db.rooms.find((room) => room.gameId === gameId);

  if (!room) return null;

  const roomUser = room.roomUsers.find((user) => user.gameBoard && user.gameBoard.indexPlayer === playerId);

  if (!roomUser) return null;

  const hits: Coords[] = roomUser.gameBoard?.hits || [];

  let randomCoords: Coords | null = null;

  const generateCoords = () => {
    randomCoords = {
      x: generateRandomNumber(),
      y: generateRandomNumber(),
    };

    // if randomCoords is in hits array then generate another randomCoords, check again and so on
    const found = hits.find((hit) => hit.x === randomCoords?.x && hit.y === randomCoords?.y);

    if (found) {
      generateCoords();
    }
  };

  const boardSize = 10;
  const totalCells = boardSize * boardSize;
  const hitCellsCount = hits.length;
  const remainingCells = totalCells - hitCellsCount;

  if (remainingCells > 0) {
    generateCoords();
  }

  console.info('Random hit coordinates', randomCoords);

  return randomCoords;
};


export const addWinner = async (playerId: number) => {
  const db = await readDB();

  const player = await findPlayerById(playerId);

  if (!player) return null;

  const existingWinner = db.winners.find((winner) => winner.name === player.name);

  let winner: Winner | null = null;

  if (existingWinner) {
    existingWinner.wins += 1;
  } else {
    winner = {
      name: player.name,
      wins: 1
    };

    db.winners.push(winner);
  }

  await writeDB(db);

  return existingWinner || winner;
};
