const bot = require('./bot')
const games = require('./games')
const colors = require('./colors')
const settings = require('./settings')
const board = require('./board')

/**
 * @typedef {Object} Action Object that encompasses an action for #actions.
 * @property {ActionFunction} beforeStart the function to invoke if the command
 * is called before the game starts, or null if this command is not to be invoked
 * before the game starts.
 * @property {ActionFunction} afterStart the function to invoke if the command
 * is called during the game, or null if this command is not to be invoked during
 * the game.
 * @property {string} syntax a string representing the syntax of the action.
 * @property {boolean} playersOnly true if this command is restricted to players.
 * @property {boolean} gmOnly true if this command is restricted to the game GM.
 * @property {boolean} costsPoint does this command cost an action point.
 */

/**
 * @callback ActionFunction A function that is invoked for the action.
 * @param {discord.Message} msg the message sent invoking the action.
 * @param {Game} game the game in which the action was sent.
 * @returns {Promise<string>} a promise to a message which will be sent as a
 * reply to the invoking message.
 */

/** 
 * @type {Action} Joins the game.
 */
module.exports.join = {
    syntax: 'join as <color | primary_color/secondary_color>',
    gmOnly: false,
    costsPoint: false,
    playersOnly: false,
    /**
     * @type {ActionFunction}
     * @param {string} color the color to assign to the player.
     */
    beforeStart: async function(msg, game, color) {
        
        // Players that have already joined cannot join again
        if (game.playerdata.alive[msg.author.id])
            return "You've been welcomed...I guess you wanna hear it twice?"

        let properColor
        // Choose the color
        if (color) {

            // Turns one color into two identical colors
            properColor = color.includes('/')
                ? color : color + '/' + color

            // Ensures the selected color is valid
            if (!colors.allColors.includes(properColor)) {
                return "The color you've picked is not on file. Try another."
            }

            // Ensures the selected color is unused
            if (!colors.unusedColors(game).includes(properColor)) {
                return "The color you've chosen is already used."
            }
        } else {

            // Random unused color
            properColor = colors.randomUnused(game)

            // No colors?
            if (!properColor) {
                return "There's no more colors to give ya!"
            }
        }
        
        // Adds user to role
        const role = game.guild.roles.cache.get(game.discord.playerRole)
        await msg.guild.members.cache.get(msg.author.id).roles.add(role)

        // Sets up their player data entry
        game.playerdata.alive[msg.author.id] = { 
            color: properColor,
            id: msg.author.id,
            position: null
        }
        await games.write('playerdata', game)

        // Reply
        await bot.fetchChannel(game, 'announcements')
            .send(`Welcome ${msg.author}, operator of the `
                + `${color ? color : properColor} tank, to the game!`)

        const gameSize = Object.keys(game.playerdata.alive).length
        // Start the game if the game is full
        const max = settings.get('creation.player_maximum', game)
        if (max && max >= gameSize) {
            await bot.fetchChannel(game, 'announcements')
                .send("The game is now full.")
            
            // Check if the player minimum is above the maximum
            if (gameSize < settings.get('creation.player_minimum', game)) {
                await bot.fetchChannel(game, 'announcements')
                    .send("So some fool decided to set the game's player max "
                        + "below the player minimum. I'm starting the game "
                        + "anyway.")
            }

            module.exports.start.beforeStart(null, game)
        }

        return 'Welcome to the game!'
    },
    afterStart: async function(msg, game) {
        return 'Sorry, but the game has already started.'
    }
}

/** 
 * @type {Action} Starts the game.
 */
module.exports.start = {
    syntax: 'start',
    gmOnly: true,
    costsPoint: false,
    playersOnly: false,
    afterStart: null,
    beforeStart: async function(msg, game) {

        // Player count
        const playerCount = Object.keys(game.playerdata.alive).length

        // Check if the game is large enough
        if (playerCount < settings.get('creation.player_minimum', game)) {
            return "The game is not yet large enough to start."
        }

        // Get the dimensions of the board

        // Each player will have a NxN area to themselves where they will spawn
        // Below figures out how many of these areas we will need

        const x = Math.ceil(Math.sqrt(playerCount))
        const unscaledDims = {
            x: x,
            y: Math.ceil(playerCount / x)
        }

        // Scale by N, where N is the size of a tank's "personal space"
        const N = settings.get('creation.personal_space_size', game)
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
                player.health = settings.get('creation.initial_health', game)
                player.actions = settings.get('creation.initial_actions', game)
            }
            ++i
        }

        // Write positions
        game.playerdata.started = true
        await games.write('playerdata', game)

        // Make the board
        await board.createBoard(game)
            .then(() => bot.updateBoard(game))

        // Declares the game started
        await bot.fetchChannel(game, 'announcements')
            .send("The game has started!")
    }
}

/**
 * @type {Action} Quits the game.
 */
module.exports.quit = {
    syntax: 'quit',
    gmOnly: false,
    costsPoint: false,
    playersOnly: true,
    beforeStart: async function(msg, game) {
        delete game.playerdata.alive[msg.author.id]
        await games.write('playerdata', game)
        await game.guild.member(msg.author.id)
            .roles.remove(bot.fetchRole(game, 'player'))
        await bot.fetchChannel(game, 'announcements')
            .send(`${msg.author} has quit.`)
        return 'Sorry to see you go!'
    },
    afterStart: async function(msg, game) {
        // Delete the tank
        const boardP = board.emptyCell(game, 
            game.playerdata.alive[msg.author.id].position)
        .then(() => bot.updateBoard(game))

        // Assign roles
        const roleP = Promise.all([
            game.guild.member(msg.author).roles.remove(bot.fetchRole(game, 'player')),
            game.guild.member(msg.author).roles.add(bot.fetchRole(game, 'juror'))
        ])

        // Manage playerdata
        delete game.playerdata.alive[msg.author.id]
        const writeP = games.write('playerdata', game)

        await Promise.all([roleP, writeP, boardP])
        await bot.fetchChannel(game, 'announcements')
            .send(`The tank of ${msg.author} has exploded. You may see them lurking`
                + ` as a member of ${bot.fetchRole(game, 'juror')}.`)
        return 'Sorry to see you go!'
    }
}

/**
 * @type {Action} Redraws the board.
 */
module.exports.redraw = {
    syntax: 'redraw',
    gmOnly: true,
    costsPoint: false,
    beforeStart: null,
    afterStart: function(msg, game) {
        return board.createBoard(game)
            .then(() => bot.updateBoard(game))
            .then(() => 'The board has been redrawn.')
    }
}

/**
 * @type {Action} Fires a shot at a player.
 */
module.exports.fire = {
    syntax: 'fire <"at"|"to"> <player>',
    gmOnly: false,
    costsPoint: true,
    beforeStart: null,
    /**
    * @type {ActionFunction}
    * @param {boolean} intent true if the intent was to attack (at), false if the
    * intent was to share action points (to).
    * @param {discord.User} target the user targeted by the fire.
    */
    afterStart: async function(msg, game, intent, target) {

        if (target.id == msg.author.id)
            return 'What are you doing shooting yourself?'

        // Check if target is on the board
        if (!game.playerdata.alive[target.id])
            return "You can't do that! They're not playing! No civilian fire!"

        // Check if the player is in range
        const userinfo = game.playerdata.alive[msg.author.id]
        const targetinfo = game.playerdata.alive[target.id]
        const range = settings.get('gameplay.fire_range', game)

        if (Math.abs(userinfo.position[0] - targetinfo.position[0]) > range
            || Math.abs(userinfo.position[1] - targetinfo.position[1]) > range)
        {
            return `You can't do that! ${target} is not in range.`
        }

        --userinfo.actions

        if (intent) {
            --targetinfo.health
            if (!targetinfo.health) {

                // Do a hack where msg.author is overwritten to be the player
                // destroyed. This is for code reusability I promise.
                msg.author = target

                await module.exports.quit.afterStart(msg, game)
                    .then(() => games.write('playerdata', game))
                return`You fired the fatal shot at ${target}.`
            }
            await games.write('playerdata', game)
            return `You fired a shot at ${target}. Their tank now has `
                + `${targetinfo.health} health.`
        } else {
            ++targetinfo.actions
            await games.write('playerdata', game)
            return `You fired an action point to ${target}.`
        }
    }
}

/**
 * @type {Action} DM's a player their action point count.
 */
module.exports.actions = {
    syntax: 'actions',
    gmOnly: false,
    costsPoint: false,
    playersOnly: true,
    beforeStart: null,
    afterStart: async function(msg, game) {
        const playerdata = game.playerdata.alive[msg.author.id]
        try {
            await msg.author.send(`You have ${playerdata.actions} action points to spare.`)
            return "Check your DM's!"
        } catch (err) {
            console.error(err)
            return "I wasn't able to DM you."
        }
    }
}

/**
 * @type {Action} Moves the player's tank in the specified direction.
 */
module.exports.move = {
    syntax: 'move <"up"|"down"|"left"|"right">',
    gmOnly: false,
    costsPoint: true,
    playersOnly: true,
    beforeStart: null,
    /**
     * @type {ActionFunction}
     * @param {'up' | 'down' | 'left' | 'right'} direction the direction the
     * player wishes to move.
     */
    afterStart: async function(msg, game, direction) {
        const player = game.playerdata.alive[msg.author.id]
        const dest = [...player.position]
        
        switch (direction) {
            case 'up': 
                --dest[1]
                if (dest[1] < game.playerdata.boardMin[1]) {
                    return "You can't do that! There's an edge there."
                }
                break
            case 'down':
                ++dest[1]
                if (dest[1] >= game.playerdata.boardMin[1] + game.playerdata.boardSize[1]) {
                    return "You can't do that! There's an edge there."
                }
                break
            case 'left':
                --dest[0]
                if (dest[0] < game.playerdata.boardMin[0]) {
                    return "You can't do that! There's an edge there."
                }
                break
            case 'right':
                ++dest[0]
                if (dest[0] >= game.playerdata.boardMin[0] + game.playerdata.boardSize[0]) {
                    return "You can't do that! There's an edge there."
                }
                break
        }
        if (games.tankAt(game, dest)) {
            return "You can't do that! There's a tank there."
        }

        const boardp = board.moveTank(game, player.position, dest, colors[player.color])
            .then(() => bot.updateBoard(game))
        --player.actions
        player.position = dest
        const filep = games.write('playerdata', game)

        await Promise.all([boardp, filep])
        return 'Your tank has moved.'
    }
}

/**
 * @type {Action} Gets info about a particular setting.
 */
module.exports.settingGet = {
    syntax: 'setting get <setting>',
    gmOnly: false,
    costsPoint: false,
    playersOnly: false,
    beforeStart: getSettingAction,
    afterStart: getSettingAction
}

/**
 * @type {ActionFunction}
 * @param {string[]} settingName the setting to get.
 */
async function getSettingAction(msg, game, settingName) {
    let content
    try {
        content = settings.infoMessage(settingName, game)
    } catch (err) {
        if (!(err instanceof settings.SettingNotFoundError)) throw err
        return err.message
    }
    return content
}

/**
 * @type {Action} Sets the value of settings.
 */
module.exports.settingSet = {
    syntax: 'setting set <setting> <value>',
    gmOnly: true,
    costsPoint: false,
    playersOnly: false,
    beforeStart: setSettingAction,
    afterStart: setSettingAction
}

/**
 * @type {ActionFunction}
 * @param {string[]} settingName the setting to get.
 * @param {string} value the value for the new setting. 
 */
async function setSettingAction(msg, game, settingName, value) {
    let parsed
    try {
        parsed = settings.parse(value, settingName)
    } catch (err) {
        if (!(err instanceof settings.SettingError)) throw err
        if (err instanceof settings.SettingNotFoundError) return err.message
        return "That value doesn't work for that setting.\n```" + err.message + '```'
    }
    settings.set(game, settingName, value)
    await games.write('settings', game)
    return 'Successfully updated the value of ' + settings.properName(settingName)
}
