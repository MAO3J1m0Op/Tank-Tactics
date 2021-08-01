/*
 * This file handles the file structure of each game of tank tactics.
 */

const fs = require('fs').promises

const bot = require('./bot')
const channels = require('./channels')
const settings = require('./settings_default.json')

/** @type {{ [guildLookup: string]: { [nameLookup: string]: Game }}} */
const loadedGames = {}

/**
 * Loads all games into memory.
 */
module.exports.loadAllActive = async function() {
    const guilds = await fs.readdir('./data/active')

    // Get all the promises to loading in
    const promises = guilds.map(async guildID => {

        // Read each directory
        return fs.readdir('./data/active/' + guildID)
            .then(names => names.map(name => {

                // Load in each game
                const guild = bot.fetchGuild(guildID)
                return module.exports.loadGame(guild, name)
                    .then(() => console.log(`Loaded game ${name} from guild `
                        + `${guild.name} (ID ${guild.id}).`))
                    .catch(err => {
                        console.log(`Error loading game ${name} from guild `
                            + `${guild.name} (ID ${guild.id}).`)
                        console.error(err)
                    })
            }))
    })

    return Promise.all(promises)
        .then(() => console.log('All games loaded.'))
}

/**
 * 
 * @param {discord.Guild} guild the game's guild.
 * @param {string} name the name of the game.
 * @returns {Game} the game within the specified guild and with the specified name.
 */
module.exports.getGame = function(guild, name) {
    return module.exports.getGames(guild)[name]
}

/**
 * Gets all the games within the guild.
 * @param {discord.Guild} guild the game's guild. 
 * @returns {{ [nameLookup: string]: Game }}
 */
module.exports.getGames = function(guild) {
    const check = loadedGames[guild.id]
    return check ? check : {}
}

/**
 * Adds a game to the list of loaded games.
 * @param {discord.Guild} guild the game's guild.
 * @param {string} name the name of the game.
 * @param {Game} game the game to add.
 */
function addGame(guild, name, game) {
    if (!loadedGames[guild.id]) loadedGames[guild.id] = []
    loadedGames[guild.id][name] = game
} 

/**
 * Sets up a new game.
 * @param {discord.Guild} path the path to which the game data will be written.
 * @param {string} name the name of the game.
 */
module.exports.newGame = async function(guild, name) {

    /** @type {Game} */
    const game = {
        path: './data/active/' + guild.id + '/' + name,
        guild: guild,
        name: name,
        settings: {},
        playerdata: {
            alive: {},
            jury: [],
            started: false
        },
        discordData: {}
    }

    // Create Discord channels
    game.discordData.parentID = (await channels.parent.create(game)).id
    const roles = await Promise.all([
        channels.playerRole.create(game),
        channels.jurorRole.create(game)
    ])
    game.discordData.playerRole = roles[0].id
    game.discordData.jurorRole = roles[1].id
    const chnls = await Promise.all([
        channels.announcements.create(game),
        channels.actions.create(game),
        channels.jury.create(game),
        channels.board.create(game),
    ])
    game.discordData.announcementsID = chnls[0].id
    game.discordData.actionsID = chnls[1].id
    game.discordData.juryID = chnls[2].id
    game.discordData.boardID = chnls[3].id

    // File structure
    await fs.mkdir(game.path, { recursive: true })
    Promise.all([
        module.exports.writeSettings(game, { assumeDirMade: true}),
        module.exports.writePlayerData(game, { assumeDirMade: true}),
        module.exports.writeDiscordData(game, { assumeDirMade: true})
    ])

    addGame(guild, name, game)
    return game
}

/**
 * Loads in a new game from memory.
 * @param {discord.Guild} guild the guild for this game.
 * @param {string} name the name of the game to load.
 */
 module.exports.loadGame = async function(guild, name) {
    
    /** @type {Game} */
    const game = {
        path: './data/active/' + guild.id + '/' + name,
        guild: guild,
        name: name
    }

    const settings = fs.readFile(game.path + '/settings.json').then(JSON.parse)
        .then(json => game.settings = json)
    const playerdata = fs.readFile(game.path + '/playerdata.json').then(JSON.parse)
        .then(json => game.playerdata = json)
    const discord = fs.readFile(game.path + '/discord.json').then(JSON.parse)
        .then(json => game.discordData = json)

    await Promise.all([settings, playerdata, discord])
    addGame(guild, name, game)
    return game
}

/**
 * @typedef {Object} WriteOptions the options for a call to a Game write
 * function.
 * @property {boolean} [assumeDirMade] if true, the function will assume the
 * folder structure is as it should be.
 */

/**
 * Writes the settings to file.
 * @param {typings.Game} game a game object containing complete settings data.
 * @param {WriteOptions} options
 */
module.exports.writeSettings = async function(game, options) {
    if (!options.assumeDirMade) await fs.mkdir(game.path, { recursive: true })
    return fs.writeFile(game.path + "/settings.json", JSON.stringify(
        game.settings, null, 4))
}

/**
 * Writes the settings to file.
 * @param {Game} game a game object containing complete player data.
 * @param {WriteOptions} options
 */
module.exports.writePlayerData = async function(game, options) {
    if (!options.assumeDirMade) await fs.mkdir(game.path, { recursive: true })
    return fs.writeFile(game.path + "/playerdata.json", JSON.stringify(
        game.playerdata, null, 4))
}

/**
 * Writes the Discord data to file.
 * @param {Game} game a game object containing complete Discord data.
 * @param {WriteOptions} options
 */
module.exports.writeDiscordData = async function(game, options) {
    if (!options.assumeDirMade) await fs.mkdir(game.path, { recursive: true })
    return fs.writeFile(game.path + "/discord.json", JSON.stringify(
        game.discordData, null, 4))
}
