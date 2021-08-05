const bot = require('./bot')
const games = require('./games')
const colors = require('./colors')
const settings = require('./settings')

/**
 * 
 * @param {discord.Message} msg 
 * @param {Game} game 
 * @param {string} color the player color
 */
module.exports.join = async function(msg, game, color) {
    if (game.playerdata.started)
        return msg.reply("Sorry, but the game has already started.")

    // Players that have already joined cannot join again
    if (game.playerdata.alive[msg.author.id])
        return msg.reply("You've been welcomed...I guess you wanna hear "
            + "it twice?")

    // Choose the color
    if (color) {

        // Ensures the selected color is valid
        if (!colors.allColors.includes(color)) {
            return msg.reply("The color you've picked is not on file."
                + " Try another.")
        }

        // Ensures the selected color is unused
        if (!colors.unusedColors(game).includes(color)) {
            return msg.reply("The color you've chosen is already used.")
        }
    } else {

        // Random unused color
        color = colors.randomUnused(game)

        // No colors?
        if (!color) {
            return msg.reply("There's no more colors to give ya!")
        }
    }
    
    // Adds user to role
    const role = game.guild.roles.cache.get(game.discord.playerRole)
    await msg.guild.members.cache.get(msg.author.id).roles.add(role)

    // Sets up their player data entry
    game.playerdata.alive[msg.author.id] = { 
        color: color,
        actions: 0,
        health: 3,
        id: msg.author.id,
        position: null
    }
    await games.write('playerdata', game)

    // Reply
    return Promise.all([
        msg.reply("Welcome to the game!"),
        bot.fetchChannel(game, 'announcements')
            .send(`Welcome ${msg.author} to the game!`)
    ])
}

/**
 * Starts a game!
 * @param {discord.Message} msg 
 * @param {Game} game 
 */
module.exports.start = async function(msg, game) {

    // Get the dimensions of the board

    // Each player will have a NxN area to themselves where they will spawn
    // Below figures out how many of these areas we will need

    // Player count
    const playerCount = Object.keys(game.playerdata.alive).length

    // Find largest factor of playerCount
    const sqrt = Math.floor(Math.sqrt(playerCount))
    let factor
    for (let fTest = sqrt; fTest >= 1; --fTest) {
        if (playerCount % fTest == 0) {
            factor = fTest
            break
        }
    }

    // Now we have our dimensions
    const unscaledDims = {
        x: Math.ceil(playerCount / factor),
        y: factor
    }

    // Scale by N, where N is the size of a tank's "personal space"
    const N = 5
    const dims = {
        x: unscaledDims.x * N,
        y: unscaledDims.y * N
    }

    // Input board dimensions into the game
    game.playerdata.boardMin = [0, 0]
    game.playerdata.boardSize = [dims.x, dims.y]

    // Determine start positions for each player
    let i = 0
    for (const name in game.playerdata.alive) {
        if (Object.hasOwnProperty.call(game.playerdata.alive, name)) {
            const player = game.playerdata.alive[name];
            
            // Get personal space position
            const yBaseUnscaled = Math.floor(i / unscaledDims.x)
            const xBase = (i - yBaseUnscaled * unscaledDims.x) * N
            const yBase = yBaseUnscaled * N

            // Generate 2 random numbers: x and y
            const xOffset = Math.floor(Math.random() * N)
            const yOffset = Math.floor(Math.random() * N)

            player.position = [xBase + xOffset, yBase + yOffset]
        }
        ++i
    }

    // Write positions
    await games.write('playerdata', game)

    // Declares the game started
    game.playerdata.started = true
    bot.fetchChannel(game, 'announcements')
        .send("The game has started!")
}

/**
 * 
 * @param {discord.Message} msg 
 * @param {Game} game 
 * @param {boolean} intent true if the intent was to attack (at), false if the
 * intent was to share action points (to).
 * @param {discord.User} target the user targeted by the fire.
 */
module.exports.fire = async function(msg, game, intent, target) {

}

/**
 * Moves the player's tank in the specified direction.
 * @param {discord.Message} msg 
 * @param {Game} game 
 * @param {'up' | 'down' | 'left' | 'right'} direction the direction the player
 * wishes to move.
 */
module.exports.move = async function(msg, game, direction) {

}

/**
 * Updates or gets the value of a setting.
 * @param {discord.Message} msg 
 * @param {Game} game 
 * @param {boolean} getOrSet true if setting, false if getting.
 * @param {string[]} settingName the setting to get.
 * @param {string} [value] the new value of the setting (if setting).
 */
module.exports.setting = async function(msg, game, getOrSet, settingName, value)
{
    // Get
    if (!getOrSet) {
        let content
        try {
            content = settings.infoMessage(settingName, game)
        } catch (err) {
            if (!(err instanceof settings.SettingNotFoundError)) throw err
            return msg.reply(err.message)
        }
        return msg.reply(content)
    }

    // Set
    let parsed
    try {
        parsed = settings.parse(value, settingName)
    } catch (err) {
        if (!(err instanceof settings.SettingError)) throw err
        if (err instanceof settings.SettingNotFoundError)
            return msg.reply(err.message)
        return msg.reply("That value doesn't work for that setting.\n```"
            + err.message + '```')
    }
    settings.set(game, settingName, value)
    await games.write('settings', game)
    return msg.reply('Successfully updated the value of '
        + settings.properName(settingName))
}
