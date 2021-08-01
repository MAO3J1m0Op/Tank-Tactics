const bot = require('./bot')
const games = require('./games')

/**
 * 
 * @param {discord.Message} msg 
 * @param {Game} game 
 * @param {string} color the player color
 */
module.exports.join = async function(msg, game, color) {
    if (game.playerdata.started)
        return msg.reply("Sorry, but the game has already started.")
    
    // Adds user to role
    const role = game.guild.roles.cache.get(game.discord.playerRole)
    await msg.guild.members.cache.get(msg.author.id).roles.add(role)

    // Sets up their player data entry
    game.playerdata.alive[msg.author.id] = null
    await games.write('playerdata', game)

    // Reply
    return Promise.all([
        msg.reply("Welcome to the game!"),
        bot.fetchChannel(game, 'announcements')
            .send(`Welcome ${msg.author} to the game!`)
    ])
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
