const bot = require('./bot')
const settings = require('./settings')

/**
 * The callback invoked daily.
 */
class DailyCallback {
    /**
     * @param {Game} game the game for which this callback is invoked.
     * @param {number} time_hrs the hours of the time where the callback will
     * be invoked.
     * @param {number} time_mins the minutes of the time where the callback will
     * be invoked.
     */
    constructor(game, time_hrs, time_mins) {

        /**
         * @type {Game} the game associated with this callback.
         */
        this.game = game

        // Starts the timeout
        this.reset(time_hrs, time_mins)
    }

    /**
     * @type {boolean} True if the callback is an interval, false if it's a
     * timeout.
     * @private
     */
    _isInterval = null
    /**
     * @type {NodeJS.Timeout} The ID of the callback this object is tasked to
     * keep track of.
     * @private
     */
    _callbackID = null

    /**
     * Resets this callback, cleanly changing the time.
     * @param {number} time_hrs the hour part of the time where this callback
     * will execute.
     * @param {number} time_mins the minute part of the time where this callback
     * will execute.
     */
    reset(time_hrs, time_mins) {

        // Validate the inputs
        if (time_hrs < 0 || time_hrs > 23)
            throw Error(`Invalid hour passed to Daily callback (${time_hrs}).`)
        if (time_mins < 0 || time_mins > 59)
            throw Error(`Invalid minute passed to Daily callback (${time_mins}).`)

        // Clear the previous timeout
        this.clear()
        
        // Get the amount of time until the callback will be invoked.
        let now = new Date()
        let msTillTime = new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate(),
            time_hrs, time_mins, 0, 0) - now

        // The time is the following day
        if (msTillTime < 0) msTillTime += 86400000

        this._isInterval = false
        this._callbackID = setTimeout(() => {
            this.callback()
            this._callbackID = setInterval(() => this.callback(), 86400000)
            this._isInterval = true
        }, msTillTime)
    }

    /**
     * Clears any timeouts or intervals associated with this object.
     */
    clear() {
        if (this._callbackID) {
            if (this._isInterval) clearInterval(this._callbackID)
            else clearTimeout(this._callbackID)
        }
        this._callbackID = null
        this._isInterval = null
    }

    /**
     * The callback to call.
     */
    callback() {
        console.log(`Daily callback called for ${this.game.name}`
            + `in ${this.game.guild.name}.`)
        if (!this.game.playerdata.started) return

        const dailyActions = settings.get('creation.daily_actions', game)

        for (const player in this.game.playerdata.alive)
            this.game.playerdata.alive[player].actions += dailyActions

        bot.fetchChannel(this.game, 'announcements')
            .send(`Daily recap: ${dailyAction} action points have been given `
                + "to everybody.")

        // Jury votes
        const votes = {}
        /** @type {string[]} */
        const votedIn = []

        for (const juror in this.game.playerdata.votes) {
            const vote = this.game.playerdata.votes[juror];

            // Null means already voted in; we don't need to count this vote
            if (votes[vote] === null) return

            // Undefined means no votes yet; let's fix that
            if (votes[vote] === undefined) votes[vote] = 0

            // Count the vote
            ++votes[vote]

            // Vote in if the target passes the vote threshold
            if (votes[vote] > settings.get('gameplay.jury_bonus_minimum', game)) {
                votedIn.push(vote)

                // Mark the user as already voted in
                votes[vote] = null
            }
        }

        // Delete tallies
        this.game.playerdata.votes = {}

        // Message the players
        const playerP = Promise.all(
                votedIn.map(id => this.game.guild.members.fetch(id)))
            .then(arr => arr.map(val => `${val}`).join(', '))

        const msgP = playerP.then(p => {
            if (!p) return 'The jury has convened, but no players were '
                + 'elected to receive additional action points.'
            return 'The jury has convened. The following players will receive '
                + 'an additional action point, as they received '
                + settings.get('gameplay.jury_bonus_minimum', game)
                + ' or more votes:\n' + p
        })
        return msgP.then(msg => bot.fetchChannel('announcements', game).send(msg))
    }
}
module.exports = DailyCallback
