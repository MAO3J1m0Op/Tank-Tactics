/**
 * @typedef {Object} Setting A setting for the game.
 * @property {string} type The type of object
 * @property {[number, number]} [bounds] the low and high bound of the
 * value of the setting.
 * @property {string} [description] the description for the setting.
 * @property {*} default the default value of the object.
 * @property {boolean} allow_null whether null is accepted as a valid value for
 * the setting.
 */

/**
 * @typedef {Object} SettingCategory A group of related settings.
 * @property {string} description the description for the setting category.
 * @property {{ [name: string]: Setting }} settings the settings contained within
 * the category.
 */

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
 * @typedef {Object} Game All the assets of a game.
 * @property {Object} settings the applied settings for this game.
 * @property {Player[]} playerdata the player data for the game.
 * @property {string[]} jury the Discord API IDs of the players that are 
 * jurors.
 */
