const discord = require('discord.js')

const games = require('./games')
const channels = require('./channels')
const auth = require('./auth.json')
const guild_data = require('./guild_data')

const bot = new discord.Client({ intents: [
    discord.Intents.FLAGS.GUILDS, discord.Intents.FLAGS.GUILD_MESSAGES
]})
bot.login(auth.token)

// Command callbacks for messages
bot.on('messageCreate', msg => {

    // Ignore own messages
    if (msg.author === bot.user) return

    // Ignore DMs
    if (!msg.guild) return

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

bot.on('interactionCreate', interaction => {
    if (!interaction.isCommand()) return

    if (interaction.commandName === 'new_game') {

        const name = interaction.options.getString('name')
        // Start the game
        console.log(`Starting game in guild ${interaction.guild}`
            + `(ID ${interaction.guild.id}).`)

        return games.newGame(interaction.guild, name)
            .then(game => {
                interaction.reply(`Started a new game ${name}! Go check it out in `
                    + `${module.exports.fetchChannel(game, 'announcements')}!`)
            })
    }
})

/**
 * @param {Guild} guild the guild the bot has newly joined.
 */
async function onAddedToGuild(guild) {
    const role = await guild_data.makeGMRole(guild)
    guild.systemChannel.send(guild_data.welcomeMessage(role))
}

bot.on('guildCreate', onAddedToGuild)

/**
 * This promise resolves whenever the bot is ready.
 * @readonly
 */
module.exports.ready = new Promise((resolve, reject) => {
    bot.on('ready', async () => {
        
        if (bot.application) {

            /** @type {discord.ApplicationCommandData[]} */
            const cmdData = [
                {
                    name: 'new_game',
                    description: 'Creates a new game of Tank Tactics.',
                    options: [
                        {
                            name: 'name',
                            type: 'STRING',
                            description: 'The name of the game to create.',
                            required: true
                        }
                    ]
                }
            ];

            const commands = await bot.application.commands.set(cmdData)
            console.log('Slash commands registered.')
        }

        resolve() 
    })
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
    let msg
    if (game.discord.boardMsgID) {
        try {
            msg = await board.messages.fetch(game.discord.boardMsgID)
        } catch (err) {
            if (err.code === 10008) msg = undefined
            else throw err
        }
    } else {
        msg = undefined
    }
    if (msg) await board.messages.delete(msg)
    const newMsg = await board.send({ files: [game.path + '/board.png'] })
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

process.on('unhandledRejection', (reason, promise) => {
    console.log('Unhandled Promise Rejection:', reason)
})
process.on('SIGINT', () => {
    games.unloadAll()
    bot.destroy()
    process.stdin.destroy()
})

process.stdin.resume()
process.stdin.addListener('data', data => {
    data = data.toString().trim()
    console.log('Command received: ' + data)
    if (data === 'reload') {
        console.log('Reloading!')
        games.unloadAll()
        games.loadAllActive()
    }
    else if (data.startsWith('rejoin ')) {
        const id = data.slice(7)
        const guild = bot.guilds.cache.get(id)
        onAddedToGuild(guild)
            .then(() => console.log(`Rejoined guild ${guild.name}.`))
    }
})
