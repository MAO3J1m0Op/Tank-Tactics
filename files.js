/*
 * This file handles the file structure of each game of tank tactics.
 */

const fs = require('fs').promises

const settings = require('./settings_default.json')

/**
 * Creates the file structure for a new game.
 * @param {string} path the path to which the game data will be written.
 * @param {Game} game the complete data of the game.
 */
module.exports.newGame = async function(path, game) {
    await fs.mkdir(path, { recursive: true })
    return Promise.all([
        module.exports.writeSettings(path, game, { assumeDirMade: true}),
        module.exports.writePlayerData(path, game, { assumeDirMade: true})
    ])
}

/**
 * @typedef {Object} WriteOptions the options for a call to a Game write
 * function.
 * @property {boolean} [assumeDirMade] if true, the function will assume the
 * folder structure is as it should be.
 */

/**
 * Writes the settings to file.
 * @param {string} path the root path of the game.
 * @param {Game} game a game object containing complete settings data.
 * @param {WriteOptions} options
 */
module.exports.writeSettings = async function(path, game, options) {
    if (!game) return // Null check
    if (!options.assumeDirMade) await fs.mkdir(path, { recursive: true })
    return fs.writeFile(path + "/settings.json", JSON.stringify(game.settings, null, 4))
}

/**
 * Writes the settings to file.
 * @param {string} path the root path of the game.
 * @param {Game} game a game object containing complete settings data.
 * @param {WriteOptions} options
 */
module.exports.writePlayerData = async function(path, game, options) {
    if (!game) return // Null check
    if (!options.assumeDirMade) await fs.mkdir(path, { recursive: true })
    let obj = {
        alive: game.playerdata,
        jury: game.jury
    }
    return fs.writeFile(path + "/playerdata.json", JSON.stringify(obj, null, 4))
}
