/**
 * @callback ChannelCreator
 * @param {Game} game the game to which this channel belongs.
 * @returns {Promise<discord.Channel>} a promise to the created channel object.
 */

/**
 * @callback ChannelCommand
 * @param {discord.Client} bot the bot that read the message.
 * @param {discord.Message} msg the message.
 * @param {Game} game the game to which the command pertains.
*/

/**
 * @typedef {Object} Channel An object handling a game channel.
 * @property {ChannelCreator} create creates the channel.
 * @property {ChannelCommand} commandCallback the callback to be called when
 * a message is received on the channel.
 */

/** @type {{ [name: string]: Channel }} */
module.exports = {
    parent: {
        create: async g => {
            let chnl = await g.guild.channels.create(g.name, {type: "category"})
            g.discordData.parentID = chnl.id
            return chnl
        }
    },
    announcements: {
        create: async g => {
            let chnl = await g.guild.channels.create("announcements", {type: "text"})
            chnl.setParent(g.guild.channels.cache.get(g.discordData.parentID))
            g.discordData.announcementsID = chnl.id
            return chnl
        }
    },
    actions: {
        create: async g => {
            let chnl = await g.guild.channels.create("actions", {type: "text"})
            chnl.setParent(g.guild.channels.cache.get(g.discordData.parentID))
            g.discordData.actionsID = chnl.id
            return chnl
        }
    },
    jury: {
        create: async g => {
            let chnl = await g.guild.channels.create("jury", {type: "text"})
            chnl.setParent(g.guild.channels.cache.get(g.discordData.parentID))
            g.discordData.juryID = chnl.id
            return chnl
        }
    },
    board: {
        create: async g => {
            let chnl = await g.guild.channels.create("board", {type: "text"})
            chnl.setParent(g.guild.channels.cache.get(g.discordData.parentID))
            g.discordData.boardID = chnl.id
            return chnl
        }
    },
    playerRole: {
        create: async g => {
            let role = await g.guild.roles.create({ 
                data: { 
                    name: "Player - " + g.name,
                    color: 'GREEN'
                }
            })
            g.discordData.playerRole = role.id
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
            g.discordData.playerRole = role.id
            return role
        }
    }
}
