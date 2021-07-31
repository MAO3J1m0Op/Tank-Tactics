const discord = require('discord.js')

const games = require('./games')
const auth = require('./auth.json')

const bot = new discord.Client()
bot.login(auth.token)

/**
 * This promise resolves whenever the bot is ready.
 * @readonly
 */
module.exports.ready = new Promise((resolve, reject) => {
    bot.on('ready', () => { resolve() })
})
module.exports.ready.then(() => console.log(`Logged in as ${bot.user.tag}.`))

// Listening for the create game command anywhere
// TODO: slash commands?
bot.on('message', msg => {
    // Natural language processing :P
    if (msg.content === "Let's play with some tanks!!") {
        
        // Start the game.
        console.log(`Starting game in guild ${msg.guild.name} (ID ${msg.guild.id}).`)
    }
})
