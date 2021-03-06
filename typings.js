/** @typedef {import('discord.js').Guild} Guild */

/**
 * @typedef {[x: number, y: number]} Position
 */

/**
 * @typedef {Object} Player All the data for a player.
 * @property {string} id the Discord API ID of the player.
 * @property {string} color the color of the square occupied by the player's
 * tank.
 * @property {number} health the health of the tank.
 * @property {number} actions the number of actions this tank can take.
 * @property {Position} position the position of the tank.
 */

/**
 * @typedef {Object} Board The data for the board.
 * @property {Position[]} playerpos the positions of the tanks on the board.
 * @property {[low: number, high: number]} xBounds the size of the board in
 * the X direction.
 * @property {[low: number, high: number]} yBounds the size of the board in
 * the Y direction.
 */

/**
 * @typedef {Object} DiscordData The data involving Discord information.
 * @property {string} parentID the ID of the parent category.
 * @property {string} announcementsID the ID of the announcements channel.
 * @property {string} actionsID the ID of the actions channel.
 * @property {string} juryID the ID of the jury channel.
 * @property {string} boardID the ID of the board channel.
 * @property {string} playerRole the ID of the player role.
 * @property {string} jurorRole the ID of the juror role.
 * @property {string} boardMsgID the ID of the board message.
 */

/**
 * @typedef {Object} PlayerData The player data for the game.
 * @property {Position} boardMin the coordinates of the top-left corner of
 * the board (in case the board is resized).
 * @property {Position} boardSize the size of the board.
 * @property {{[userID: string]: Player }} alive the tanks on the board.
 * @property {{[userID: string]: string }} votes the jury votes. The key is
 * the ID of the juror that voted, and the value is the ID of the player for
 * which the juror voted.
 * @property {string[]} jury the IDs of the jurors.
 * @property {boolean} started whether the game has started.
 */

/** 
 * @typedef {Object} Game All the assets of a game.
 * @property {Guild} guild the Guild in which this game runs.
 * @property {string} name the official name of the game.
 * @property {string} path the path to the game files.
 * @property {Object} settings the applied settings for this game.
 * @property {PlayerData} playerdata the player data for the game.
 * @property {DiscordData} discord the Discord data.
 * @property {import('./dailycallback')} dailyCallback the interval that calls 
 * the daily callback.
 */
