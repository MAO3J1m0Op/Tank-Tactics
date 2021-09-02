/** @typedef {import('discord.js').Guild} Guild */

const fs = require('fs').promises

/**
 * @typedef {Object} GuildData metadata for a guild.
 * @property {string} gmID the ID of the Game Master role.
 */

const cache = {}

/**
 * Reads the info associated with the guild from file, or reads from a cache
 * if the guild has been loaded into memory.
 * @param {Guild} guild the guild for which the GuildInfo will be collected.
 * @returns {GuildData}
 */
module.exports.get = async function(guild) {
    fs.mkdir('./data/active', { recursive: true })
    if (!cache[guild.id])
        try {
            cache[guild.id] = 
                JSON.parse(
                    await fs.readFile('./data/active/' + guild.id + '/guild_data.json'))
        } catch (err) {
            if (err.code != 'ENOENT') throw err
            await module.exports.set(guild, {})
        }
    return cache[guild.id]
}

/**
 * Updates data for the guild in the cache and in the file.
 * @param {Guild} guild the guild whose information is being set.
 * @param {GuildInfo} data the data to set to the guild.
 */
module.exports.set = async function(guild, data) {
    fs.mkdir('./data/active', { recursive: true })
    cache[guild.id] = data
    return fs.writeFile('./data/active/' + guild.id + '/guild_data.json',
        JSON.stringify(data, null, 4))
}

/**
 * Makes the GM role for the guild.
 * @param {Guild} guild the guild whose GM role will be created.
 */
module.exports.makeGMRole = async function(guild) {
    const role = await guild.roles.create({ name: 'Tank Tactics GM' })
    const data = await module.exports.get(guild)
    data.gmID = role.id
    module.exports.set(guild, data)
    return role
}

/**
 * Gets the GM role for the guild.
 * @param {Guild} guild the guild whose GM role will be retrieved.
 * @returns the role object of the GM role.
 */
module.exports.getGMRole = async function(guild) {
    return guild.roles.fetch((await module.exports.get(guild)).gmID)
}

/**
 * Creates and returns a welcome message for a guild.
 * @param {Role} role the Guild's GM role.
 */
module.exports.welcomeMessage = function(role) {
    return `Hi all! I have created the ${role} role. `
        + "Go ahead and assign that to a person or some people, which gives them "
        + "the ability to facilitate a game of Tank Tactics!"
}
