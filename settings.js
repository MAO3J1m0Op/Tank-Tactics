const defaults = require('./settings_default.json')

/**
 * Gets a setting object associated with the setting name. If the setting
 * name points to a category, the category will be returned. If the setting
 * name points to nothing, undefined will be returned. An empty array will
 * yield the entire settings hierarchy in object form.
 * @param {string[]} settingName the full name of the setting.
 * @returns {Setting}
 */
function getSetting(settingName) {
    if (!settingName) return defaults
    let accumulator = defaults

    // Recursively searches for a setting
    for (let i = 0; i < settingName.length; ++i) {
        accumulator = accumulator.settings[settingName[i]]
        // Check to return before undefined dereferencing occurs
        if (!accumulator) break
    }
    return accumulator
}
module.exports.getSetting = getSetting

/**
 * Returns the string representation of a setting name.
 * @param {string[]} settingName the name of the setting.
 */
function properName(settingName) {
    return settingName.join('.')
}
module.exports.properName = properName

/**
 * Checks if value is within the passed bounds.
 * @param {[low: number, high: number]} bounds the bounds to check.
 * @param {number} value the value to compare.
 */
function boundsCheck(bounds, value) {
    if (!bounds) return true
    return (!bounds[0] || bounds[0] <= value) 
        && (!bounds[1] || value <= bounds[1])
}

/**
 * Generates a message giving information about the setting/category.
 * @param {string[]} settingName the name of the setting and all containing
 * categories.
 * @param {Game} game the game to pull setting values from.
 * @returns a string meant to be passed to a Discord send function.
 */
module.exports.infoMessage = function(settingName, game) {

    // TODO FIX
    const setting = getSetting(settingName)
    if (!setting) throw new SettingNotFoundError(settingName)

    let msg = settingName.length == 0
        ? '_Settings Root_'
        : '`' + properName(settingName) + '`'
    msg += ':\n'
    // Category
    if (setting.settings) {
        msg += `${setting.description}\n**Settings:**\n`
        for (const name in setting.settings) {
            if (Object.hasOwnProperty.call(setting.settings, name)) {
                const element = setting.settings[name]
                const type = element.settings ? 'category' : element.type
                const fullName = [...settingName]
                fullName.push(name)
                msg += `  \`${properName(fullName)}\` (${type})\n`
            }
        }
    // Regular setting
    } else { 
        msg += `${setting.description}\n**Type Expected:** ${setting.type}\n`   
        if (setting.bounds) {
            msg += '**Bounds:** '
            if (!setting.bounds[0]) {
                msg += `${setting.bounds[1]} or less\n`
            } else if (!setting.bounds[1]) {
                msg += `${setting.bounds[0]} or greater\n`
            }
        }
        msg += `**Current value:** ${get(settingName, game)}\n`
        msg += `**Default value:** ${setting.default}\n`
        if (setting.allow_null) msg += "_This setting allows null values._"
    }
    return msg
}

/**
 * Gets a setting value from a game. If a value for the setting does not
 * exist, the setting's default value will be returned. If the setting does
 * not exist or is a category, undefined will be returned.
 * @param {string[]} settingName the name of the setting.
 * @param {Game} game the game to pull the setting value from.
 */
function get(settingName, game) {
    let value = game.settings
    for (let i = 0; i < settingName.length; ++i) {
        value = value[settingName[i]]
        // Check to return before undefined dereferencing occurs
        if (!value) break
    }

    // If there is no setting value stored
    if (!value) {
        const setting = getSetting(settingName)
        value = setting && setting.default ? setting.default : undefined
    }
    return value
}
module.exports.get = get

/**
 * Verifies if a value works for the passed setting. If it works, the value
 * will be returned. Otherwise, an exception will be thrown.
 * @param {*} value the value to check.
 * @param {string[]} settingName the full name of the setting.
 */
module.exports.verifyValue = function(value, settingName) {
    
    // Get the setting
    const setting = getSetting(settingName)
    if (!setting) throw new SettingNotFoundError(settingName)
    // Ensure the setting isn't a category
    if (!setting.settings) 

    // Null check
    if (!value && !setting.allow_null) 
        throw SettingValueError.nullError(settingName)

    // Type check
    if (!types[setting.type].fromFile(value))
        throw SettingValueError.wrongType(settingName, setting.type, value)
    
    // Bounds check
    if (!boundsCheck(setting.bounds, value))
        throw new SettingBoundsError(settingName, setting.bounds, value)
    return value
}

/**
 * Sets the value of a setting to a given value. No validations will be
 * done, so the value passed must be previously validated.
 * @param {Game} game the game whose value will be set.
 * @param {string[]} settingName the name of the setting to set.
 * @param {*} value the value to assign to the setting.
 */
module.exports.set = function(game, settingName, value) {
    let obj = game.settings

    // Ensure the setting exists
    if (!getSetting(settingName))
        throw new SettingNotFoundError(settingName)

    for (let i = 0; i < settingName.length; ++i) {

        // Set object when the last index is reached
        if (i + 1 == settingName.length) {
            obj[settingName[i]] = value
            break
        }

        // If there's no object, make a new one
        if (!obj[settingName[i]]) {
            obj[settingName[i]] = {}
        }

        // Search down otherwise
        obj = obj[settingName[i]]
    }
}

/**
 * Parses a string into a value for the requested setting.
 * @param {string} value the value to check against the setting.
 * @param {string[]} settingName the name of the setting.
 * @returns the value parsed.
 */
module.exports.parse = function(value, settingName) {
    const setting = getSetting(settingName)
    if (!setting || setting.settings)
        throw new SettingNotFoundError(settingName)

    // Null check
    if (value === 'null' || !value) {
        if (setting.allow_null) return null
        else throw SettingValueError.nullError(settingName)
    }

    // Type check
    let parsed 
    try {
        parsed = types[setting.type].fromStr(value)
    } catch (err) {
        throw err === undefined
            ? SettingValueError.wrongType(settingName, setting.type, value)
            : err
    }

    if (!boundsCheck(setting.bounds, parsed))
        throw SettingValueError.outOfBounds(settingName, setting.bounds, parsed)
    return parsed
}

/**
 * @typedef {Object} TypeVerifier an object containing functions that verify
 * a passed argument for the type.
 * @property {(value: any) => boolean} fromFile verifies a value already parsed
 * by a JSON parser. Returns true if the value is valid, false otherwise.
 * @property {(value: string) => any} fromStr parses and verifies a value from
 * a string. Throws undefined if the value is invalid.
 */

/** @type {{ [type: string]: TypeVerifier }} */
const types = {
    int: {
        fromFile: function(value) {
            if (typeof value !== 'number') return false
    
            if (isNaN(value)) return false
            let x = parseFloat(value)
            return (x | 0) === x
        },
        fromStr: function(value) {
            const parsed = parseInt(value)
            if (isNaN(parsed)) throw undefined
            else return parsed
        }
    },
    color: {
        fromFile: function(value) {
            if (typeof value !== 'string') return false
            return value.match(/^#[0-9a-f]{6}/i)
        },
        fromStr: function(value) {
            if (value.match(/^#[0-9a-f]{6}/i)) return value
            else throw undefined
        }
    },
    time: {
        verify: function(value) {
            if (typeof value !== 'string') return false
            const match = /^([0-2]?\d):([0-5]\d)$/i.exec(value)
            if (match) {
                const hours = parseInt(match[0])
                if (hours >= 24) return false
                return true
            }
            return false
        },
        fromFile: function(value) {
            return this.verify(value)
        },
        fromStr: function(value) {
            const val = this.verify(value)
            if (val) return value
            else throw undefined
        }
    }
}

/**
 * Base class for errors pertaining to settings.
 */
class SettingError extends Error {
    constructor(message) { super(message) }
}
module.exports.SettingError = SettingError

class SettingNotFoundError extends SettingError {
    constructor(settingName) {
        super(`Setting ${properName(settingName)} does not exist.`)
    }
}
module.exports.SettingNotFoundError = SettingNotFoundError

/**
 * Base class for exceptions involving a bad value for a setting.
 */
class SettingValueError extends SettingError {
    constructor(message) { super(message) }
}
/**
 * Constructs a SettingValueError indicating the type was incorrect.
 * @param {string[]} settingName the name of the setting.
 * @param {string} type the expected type.
 * @param {*} value the value received.
 */
SettingValueError.wrongType = function(settingName, type, value) {
    return new SettingValueError(
        `Invalid type for setting ${properName(settingName)}. Expected type ${type}, `
                + `got value "${value}".`)
}
/**
 * Constructs a SettingValueError indicating null was passed to a setting
 * not expecting it.
 * @param {string[]} settingName the name of the setting.
 */
SettingValueError.nullError = function(settingName) {
    return new SettingValueError(`Setting ${properName(settingName)} does not allow null.`)
}
/**
 * Constructs a SettingValueError indicating an out-of-bounds value.
 * @param {string[]} settingName the name of the setting.
 * @param {[low: number, high: number]} bounds the bounds that were exceeded.
 * @param {number} value the value that exceeded the bounds.
 */
SettingValueError.outOfBounds = function(settingName, bounds, value) {
    let msg = `Value for setting ${properName(settingName)} is out of bounds. `
    if (!bounds[0]) {
        msg += `Expected value less than ${bounds[1]}`
    } else if (!bounds[1]) {
        msg += `Expected value greater than ${bounds[0]}`
    }
    else msg += `Expected value between ${bounds[0]} and ${bounds[1]}`
    return new SettingValueError(msg + `, got ${value}.`)
}
module.exports.SettingValueError = SettingValueError
