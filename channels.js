const bot = require('./bot')
const actions = require('./actions')
const games = require('./games')

/**
 * @callback ChannelCreator
 * @param {Game} game the game to which this channel belongs.
 * @returns {Promise<discord.Channel>} a promise to the created channel object.
 */

/**
 * @callback ChannelCommand
 * @param {discord.Message} msg the message.
 * @param {Game} game the game to which the command pertains.
*/

/**
 * @typedef {Object} Channel An object handling a game channel.
 * @property {ChannelCreator} create creates the channel.
 * @property {ChannelCommand} commandCallback the callback to be called when
 * a message is received on the channel.
 * @property {ChannelPermissions} permissions the permissions assigned to the
 * two roles upon creation.
 */

/** 
 * @typedef {Object} ChannelPermissions An object containing the permission
 * overwrites for a channel.
 * @property {discord.PermissionOverwriteOptions} everyone the permission
 * overwrites for anyone without a role.
 * @property {discord.PermissionOverwriteOptions} player the permission
 * overwrites for the player role.
 * @property {discord.PermissionOverwriteOptions} juror the permission
 * overwrites for the juror role.
 */

/**
 * Generates a create function for a channel with the specified name.
 * @param {string} name the name of the channel to create.
 * @returns {(game: Game) => Promise<discord.TextChannel>} the create function.
 */
function createFactory(name) {
    return async g => {
        let chnl = await g.guild.channels.create(name, {type: 'GUILD_TEXT'})
        chnl.setParent(g.guild.channels.cache.get(g.discord.parentID))
        g.discord[name + 'ID'] = chnl.id
        return chnl
    }
}

/** @type {{ [name: string]: Channel }} */
module.exports = {
    parent: {
        create: async g => {
            let chnl = await g.guild.channels.create(g.name, {type: 'GUILD_CATEGORY'})
            g.discord.parentID = chnl.id
            return chnl
        }
    },
    announcements: {
        create: createFactory('announcements')
    },
    actions: {
        create: createFactory('actions'),
        commandCallback: async (msg, game) => {

            const cmd = msg.content.toLowerCase().split(' ')
            /** @type {actions.Action} */
            let action
            /** @type {any[]} */
            let args = []

            // Jump table gets the command and the arguments
            switch (cmd[0]) {
                case 'join':
                    action = actions.join
                    args = [cmd[1] === 'as' && cmd[2] ? cmd[2] : null]
                    break
                case 'actions':
                    action = actions.actions
                    break
                case 'end':
                    action = actions.end
                    break
                case 'start':
                    action = actions.start
                    break
                case 'redraw':
                    action = actions.redraw
                    break
                case 'quit':
                    action = actions.quit
                    break
                case 'fire':
                    switch (cmd[1]) {
                        case 'at':
                            args = [true]
                            break
                        case 'to':
                            args = [false]
                            break
                        default:
                            return msg.reply('For the fire command, use `fire at '
                            + '<player>` to attack a player, and `fire to '
                            + '<player>` to give an action point to a player.')
                    }
                    const target = bot.parseMention(cmd[2])
                    if (!target) {
                        return msg.reply('Your target must be a mentioned player.')
                    }
                    action = actions.fire
                    args.push(target)
                    break
                case 'move':
                    switch (cmd[1]) {
                        case 'up':
                        case 'down':
                        case 'left':
                        case 'right':
                            args = [cmd[1]]
                            break
                        default:
                            return msg.reply("You can't do that! Please specify "
                                + 'a valid direction (up/down/left/right).')
                    }
                    action = actions.move
                    break
                case 'setting':
                    switch (cmd[1]) {
                        case 'get':
                            args = [cmd[2] ? cmd[2].split('.') : []]
                            action = actions.settingGet
                            break
                        case 'set':
                            args = [cmd[2] ? cmd[2].split('.') : [], cmd[3]]
                            action = actions.settingSet
                            break
                        default:
                            return msg.reply('You must "get" or "set" a setting.')
                    }
                    break
                default: return
            }

            // TODO: verify the GM role

            // Pick the action to execute
            let func
            if (game.playerdata.started) {
                if (!action.afterStart) return
                func = action.afterStart
            } else {
                if (!action.beforeStart) return
                func = action.beforeStart
            }

            // Ensure the player is playing
            if (action.playersOnly && !game.playerdata.alive[msg.author.id])
                return msg.reply("You can't do that! You're not playing.")
            
            // Action point check
            if (action.costsPoint) {
                if (!game.playerdata.alive[msg.author.id].actions)
                    return msg.reply("You can't do that! You don't have an "
                        + "action point to spare.")
            }

            // Now, execute the function
            return func(msg, game, ...args)
                .then(response => { if (response) return msg.reply(response) })
        }
    },
    jury: {
        create: createFactory('jury'),
        commandCallback: async (msg, game) => {

            if (!game.playerdata.started) return

            // Ensure the message is tagged as a spoiler
            if (!msg.content.startsWith('||') || !msg.content.endsWith('||'))
                return

            // Cut out the spoiler tag
            /** @type {string} */
            const content = msg.content.slice(2, -2)

            // Is the content a vote?
            if (!content.startsWith('vote ')) return

            // Additional information attached to the reply.
            let desc = ''

            const target = content.slice(5)

            // Get the tank with the color
            const tank = games.tankWithColor(game, target)

            if (tank) {
                desc = game.playerdata.votes[msg.author.id]
                    ? 'Your vote has been updated.'
                    : 'Your vote has been cast.'
                game.playerdata.votes[msg.author.id] = tank.id
                await games.write('playerdata', game)
            } else {
                desc = "Your vote was not cast; no player has that color."
            }

            // Respond to the message
            await msg.reply(desc + '\nYour message has been deleted to keep '
                + 'your vote anonymous.')
            return msg.delete()
        }
    },
    board: {
        create: createFactory('board')
    },
    playerRole: {
        create: async g => {
            let role = await g.guild.roles.create({ 
                name: "Player - " + g.name,
                color: 'GREEN'
            })
            g.discord.playerRole = role.id
            return role
        }
    },
    jurorRole: {
        create: async g => {
            let role = await g.guild.roles.create({ 
                name: "Juror - " + g.name,
                color: 'GOLD'
            })
            g.discord.playerRole = role.id
            return role
        }
    }
}
