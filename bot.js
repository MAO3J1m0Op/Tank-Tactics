const discord = require('discord.js')

const games = require('./games')
const channels = require('./channels')
const auth = require('./auth.json')

const bot = new discord.Client()
bot.login(auth.token)

// Command callbacks for messages
bot.on('message', msg => {

    // Ignore own messages
    if (msg.author === bot.user) return

    const guildGames = games.getGames(msg.guild)
    
    for (const name in guildGames) {

        // Compare the IDs of the channels for each game
        for (const chnl in channels) {

            if (guildGames[name].discord[chnl + 'ID'] === msg.channel.id) {

                // Call the callback
                if (!channels[chnl].commandCallback) return
                console.log(`Called callback for ${chnl} in game ${name}.`)
                return channels[chnl].commandCallback(msg, guildGames[name])
            }
        }
    }
})

/**
 * This promise resolves whenever the bot is ready.
 * @readonly
 */
module.exports.ready = new Promise((resolve, reject) => {
    bot.on('ready', () => { resolve() })
})
module.exports.ready
    .then(() => console.log(`Logged in as ${bot.user.tag}.`))
    .then(() => games.loadAllActive())

/**
 * Fetches the object for one of the roles.
 * @param {Game} game the game to fetch the role from.
 * @param {string} roleName the internal name of the role to fetch.
 */
module.exports.fetchRole = function(game, roleName) {
    return game.guild.roles.cache.get(game.discord[roleName + 'Role'])
}

/**
 * Fetches the object for one of the game channels.
 * @param {Game} game the game from which the channel to be fetched will belong.
 * @param {string} channelName the name of the channel to fetch.
 */
module.exports.fetchChannel = function(game, channelName) {
    return bot.channels.cache.get(game.discord[channelName + 'ID'])
}

/**
 * Sends the current instance of the board image to the board channel.
 * @param {Game} game the game whose board will be updated.
 * @returns {Promise<discord.Message>} a promise to the message sent.
 */
module.exports.updateBoard = async function(game) {
    const board = module.exports.fetchChannel(game, 'board')
    const msg = board.messages.cache.get(game.discord.boardMsgID)
    if (msg) await board.messages.delete(msg)
    const newMsg = await board.send('', { files: [game.path + '/board.png'] })
    game.discord.boardMsgID = newMsg.id
    await games.write('discord', game)
    return newMsg
}

/**
 * Fetches a guild.
 * @param {string} guildID the ID of the guild to fetch.
 */
 module.exports.fetchGuild = function(guildID) {
    return bot.guilds.cache.get(guildID)
}

/**
 * Parses a mention and returns the user associated.
 * @param {string} mention the mention in Discord's mention format.
 * @returns the mention if the syntax is valid, otherwise undefined.
 */
module.exports.parseMention = function(mention) {

    if (!mention) return
    if (mention.startsWith('<@') && mention.endsWith('>')) {

		mention = mention.slice(2, -1);

        // Slice out nickname symbol
		if (mention.startsWith('!')) mention = mention.slice(1);

		return bot.users.cache.get(mention);

    // I mean it's implied, but it looks cleaner and finished.
	} else return
}

// Listening for the create game command anywhere
// TODO: slash commands?
bot.on('message', msg => {
    // Natural language processing :P
    const prefix = "Start a new game named "
    if (msg.content.startsWith(prefix)) {

        let name = msg.content.slice(prefix.length)
        
        // Start the game.
        console.log(`Starting game in guild ${msg.guild.name} (ID ${msg.guild.id}).`)

        loadedGames = games.newGame(msg.guild, name)
    }
})

process.on('unhandledRejection', (reason, promise) => {
    console.log('Unhandled Promise Rejection:', reason)
})
process.on('SIGINT', () => {
    bot.destroy()
    process.stdin.destroy()
})

process.stdin.resume()
process.stdin.addListener('data', data => {
    data = data.toString().trim()
    console.log('Command received: ' + data)
    if (data === 'reload') {
        console.log('Reloading!')
        games.loadAllActive()
    }
})
