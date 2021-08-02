const bot = require('./bot')
const actions = require('./actions')

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
 */

/**
 * Generates a create function for a channel with the specified name.
 * @param {string} name the name of the channel to create.
 * @returns {(game: Game) => Promise<discord.TextChannel>} the create function.
 */
function createFactory(name) {
    return async g => {
        let chnl = await g.guild.channels.create(name, {type: "text"})
        chnl.setParent(g.guild.channels.cache.get(g.discord.parentID))
        g.discord[name + 'ID'] = chnl.id
        return chnl
    }
}

/** @type {{ [name: string]: Channel }} */
module.exports = {
    parent: {
        create: async g => {
            let chnl = await g.guild.channels.create(g.name, {type: "category"})
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

            if (msg.content === 'join') {
                const cmd = msg.content.split(' ')

                // Is there a color?
                return actions.join(msg, game, 
                    cmd[1] === 'as' && cmd[2] ? cmd[2] : null)
            }

            else if (msg.content === 'start') {
                return actions.start(msg, game)
            }
            
            else if (msg.content === 'quit') {
                return msg.reply('Sorry to see you go! Your tank has been '
                    + 'destroyed; you are now a member of the jury.')
            }
            
            else if (msg.content.startsWith('fire')) {
                const cmd = msg.content.split(' ')
                let intent
                if (msg.content[1] === 'at') {
                    // fire at a person
                    intent = true
                } else if (msg.content[1] === 'to') {
                    // fire action point to a person
                    intent = false
                } else {
                    return msg.reply('For the fire command, use "fire at '
                        + '<player>" to attack a player, and "fire to '
                        + '<player" to give an action point to a player.')
                }

                const target = bot.parseMention(msg.content[2])
                if (!target) {
                    return msg.reply('Your target must be a mentioned player.')
                }

                return actions.fire(msg, game, intent, target)

            } else if (msg.content.startsWith('move')) {
                const dir = msg.content.split(' ')[1]
                switch (dir) {
                    case 'up':
                    case 'down':
                    case 'left':
                    case 'right':
                        return actions.move(msg, game, dir)
                    default:
                        return msg.reply("You can't do that! Please specify "
                            + 'a valid direction (up/down/left/right).')
                }
            }
        }
    },
    jury: {
        create: createFactory('jury')
    },
    board: {
        create: createFactory('board')
    },
    playerRole: {
        create: async g => {
            let role = await g.guild.roles.create({ 
                data: { 
                    name: "Player - " + g.name,
                    color: 'GREEN'
                }
            })
            g.discord.playerRole = role.id
            return role
        }
    },
    jurorRole: {
        create: async g => {
            let role = await g.guild.roles.create({ 
                data: { 
                    name: "Juror - " + g.name,
                    color: 'GOLD'
                }
            })
            g.discord.playerRole = role.id
            return role
        }
    }
}
