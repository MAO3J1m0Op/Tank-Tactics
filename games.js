/*
 * This file handles the file structure of each game of tank tactics.
 */

const fs = require('fs').promises

const bot = require('./bot')
const channels = require('./channels')
const actions = require('./actions')
const settings = require('./settings')
const colors = require('./colors')
const DailyCallback = require('./dailycallback')

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
                        if (err.code === 'ENOTDIR') return
                        console.log(`Error loading game ${name} from guild `
                            + `${guild.name} (ID ${guild.id}).`)
                        console.error(err)
                    })
            }))
            .catch(err => {
                if (err.code !== 'ENOTDIR') throw err
            })
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
    if (!loadedGames[guild.id]) loadedGames[guild.id] = {}
    loadedGames[guild.id][name] = game

    // Parse the time
    const timeStr = settings.get('gameplay.action_grant_time', game)
    const time = /^(\d\d):([0-5]\d)$/i.exec(timeStr)
    const hour = parseInt(time[0])
    const minute = parseInt(time[1])
    game.dailyCallback = new DailyCallback(game, hour, minute)
} 

/**
 * Archives a game: moves it out of the active folder and unloads it from
 * memory.
 * @param {Game} game the game to archive.
 */
module.exports.archiveGame = async function(game) {
    const newPath = './data/archive/' + game.guild.id + '/' + game.name
    unloadGame(game)
    await fs.mkdir(newPath, { recursive: true })
    return fs.rename(game.path, newPath)
}

/**
 * Destroys any persistent elements of the game object and removes the object
 * from the array of loaded games.
 * @param {Game} game the game to unload.
 */
function unloadGame(game) {
    game.dailyCallback.clear()
    const guild = loadedGames[game.guild.id]
    delete guild[game.name]
}

module.exports.unloadAll = function() {
    for (const g in loadedGames) {
        const element = loadedGames[g]
        for (const name in element) {
            unloadGame(element[name])
        }
    }
}

/**
 * How to play message.
 * @param {Game} game the game object for channel mentions.
 */
async function sendHowToPlay(game) {
    const ann = bot.fetchChannel(game, 'announcements')
    const brd = bot.fetchChannel(game, 'board')
    const act = bot.fetchChannel(game, 'actions')
    await ann.send(
        "Welcome to Tank Tactics! Here's how to play.\n\n"
        + "Each tank has 3 lives. Each day, every player will be granted "
        + "an action point, which can be used to move or fire at tanks within"
        + " range. You can also fire action points _to_ tanks. Last tank "
        + "standing wins! Simple!\n"
        + `Once the game starts, you'll see the board on ${brd}. To control your`
        + ` tank, write your commands on ${act}. You can send these at any `
        + "time, but each command requires one action point. Find important "
        + `information here on ${ann}.\n`
        + "If your tank explodes, the game's not over for you just yet. You will "
        + "join the jury! They will convene on the secret "
        + `${bot.fetchChannel(game, 'jury')} channel daily. If three jurors `
        + "vote for you, you'll receive one extra action point!\n"
        + `Hop on over to the ${act} channel and type the message "join" to get `
        + "in on this explosive action!")
    let actionList = '**Full list of game actions:**\n'
    for (const action in actions) {
        /** @type {actions.Action} */
        const element = actions[action];
        actionList += `  \`${element.syntax}\``
        if (element.gmOnly) actionList += '\\*'
        if (!element.costsPoint) actionList += '+'
        actionList += '\n'
    }
    actionList += '\\*Restricted to the Tank Tactics GM\n'
    actionList += '\\+Utility command (does not require an action point)'
    await ann.send(actionList)

    // TODO add action list
    // TODO mention GM
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
            votes: {},
            started: false
        },
        discord: {}
    }

    const channelNames = ['announcements', 'actions', 'jury', 'board']
    const roleNames = ['player', 'juror']

    // Get the channels and the roles
    const channelObjs = channelNames.map(name => channels[name])
    const roleObjs = roleNames.map(name => channels[name + 'Role'])

    // Create the roles
    const roles = await Promise.all(roleObjs.map(role => role.create(game)))
    for (let i = 0; i < roleNames.length; ++i) {
        game.discord[roleNames[i] + 'Role'] = roles[i].id
    }

    // Create the parent channel
    const parent = await channels.parent.create(game)
    game.discord.parentID = parent.id

    // Create the main channels
    const chnls = await Promise.all(channelObjs.map(chnl => chnl.create(game)))
    for (let i = 0; i < channelNames.length; ++i) {
        game.discord[channelNames[i] + 'ID'] = chnls[i].id
    }

    function setPermissions(chnl, channelObj) {

        // Ignore channels without a permissions object
        if (!channelObj.permissions) return

        // Everyone role
        if (channelObj.permissions.everyone) {
            chnl.permissionOverwrites.create(game.guild.roles.everyone,
                channelObj.permissions.everyone)
        }

        // Other roles
        for (let r = 0; r < roleNames.length; ++r) {
            if (channelObj.permissions[roleNames[r]]) {
                chnl.permissionOverwrites.create(roles[r],
                    channelObj.permissions[roleNames[r]])
            }
        }
    }

    // Set permissions for the parent category
    setPermissions(parent, channels.parent)

    // Set permissions for the satellite channels
    for (let i = 0; i < channelNames.length; ++i) {
        setPermissions(chnls[i], channelObjs[i])
    }

    // File structure
    await fs.mkdir(game.path, { recursive: true })
    await Promise.all([
        module.exports.write('settings', game, { assumeDirMade: true}),
        module.exports.write('playerdata', game, { assumeDirMade: true}),
        module.exports.write('discord', game, { assumeDirMade: true})
    ])

    addGame(guild, name, game)

    // Send the how to play announcement
    sendHowToPlay(game)

    return game
}

/**
 * Returns the tank at the given position, or undefined if there isn't one.
 * @param {Game} game the game where the tank will be found.
 * @param {Position} pos the position to search for a tank.
 */
module.exports.tankAt = function(game, pos) {
    for (const p in game.playerdata.alive) {
        const element = game.playerdata.alive[p];
        if (element.position[0] === pos[0] 
            && element.position[1] === pos[1]) return element
    }
}

/**
 * Searches for a player with a color, then returns the player.
 * @param {Game} game the game which will be searched.
 * @param {string} color the color to search for.
 */
module.exports.tankWithColor = function(game, color) {

    color = colors.doubleColor(color)

    for (const p in game.playerdata.alive) {
        const element = game.playerdata.alive[p];
        if (element.color === color) return element
    }
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

    // Validate setting values
    /**
     * Function used for recusrion purposes.
     * @param {*} category
     * @param {string[]} name
     */
    function validateCategory(category, name) {
        const last = name.push(undefined) - 1
        for (const key in category) {
            const setting = category[key]
            name[last] = key

            // Is setting an object (subcategory)
            if (typeof setting === 'object' 
                && setting !== null 
                && !Array.isArray(setting))
            {
                return validateCategory(setting, [...name])
            }

            // Validate the setting
            try {
                settings.verifyValue(settings.get(name, game), name)
            } catch (err) {
                if (!(err instanceof settings.SettingNotFoundError)) throw err
                
                // Swallow setting not found error
                console.log('Ignoring value for nonexistent setting '
                    + settings.properName(name) + '.')
            }
        }        
    }

    const settingsP = fs.readFile(game.path + '/settings.json').then(JSON.parse)
        .then(json => {
            game.settings = json
            validateCategory(json, [])
        })

    const playerdata = fs.readFile(game.path + '/playerdata.json').then(JSON.parse)
        .then(json => game.playerdata = json)
    const discord = fs.readFile(game.path + '/discord.json').then(JSON.parse)
        .then(json => game.discord = json)

    await Promise.all([settingsP, playerdata, discord])
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
 * Writes an attribute of a Game to file.
 * @param {typings.Game} game a game object containing complete settings data.
 * @param {string} attrib the attribute to write.
 * @param {WriteOptions} options
 */
module.exports.write = async function(attrib, game, options) {
    const assumeDirMade = options && options.assumeDirMade
    if (!assumeDirMade) await fs.mkdir(game.path, { recursive: true })
    return fs.writeFile(game.path + '/' + attrib + '.json', JSON.stringify(
        game[attrib], null, 4))
}
