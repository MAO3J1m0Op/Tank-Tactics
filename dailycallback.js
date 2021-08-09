const bot = require('./bot')

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
        for (const player in this.game.playerdata.alive)
            ++this.game.playerdata.alive[player].actions;

        bot.fetchChannel(this.game, 'announcements')
            .send("Action points have been given to everybody!")
    }
}
module.exports = DailyCallback
