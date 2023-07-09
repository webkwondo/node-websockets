import { readFile, writeFile } from 'fs/promises';
import { getDirName, join } from '../utils/utils.js';

const moduleUrl = import.meta.url;
const __dirname = getDirName(moduleUrl);

interface Db {
  players: Player[],
  rooms: Room[],
  winners: Winner[],
  // games: Game[],
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
  ships: [
    {
      position: {
        x: number,
        y: number,
      },
      direction: boolean,
      length: number,
      type: 'small' | 'medium' | 'large' | 'huge',
    }
  ],
  indexPlayer: number, // id of the player in the current game
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
  name: string,
  wins: number,
}

const dbInitial: Db = {
  players: [],
  rooms: [],
  winners: [],
  // games: [],
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

// export const getRoomsByPlayerId = async (playerId: number) => {
//   const db = await readDB();
//   const rooms = [];

//   for (const room of db.rooms) {
//     const playerInRoom = room.roomUsers.find((user) => user.index === playerId);
//     if (playerInRoom) {
//       rooms.push(room);
//     }
//   }

//   return rooms;
// };

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
