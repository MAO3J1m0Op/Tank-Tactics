const colors = {
    red: '#FF0000',
    lime: '#00FF00',
    blue: '#0000FF',
    yellow: '#FFFF00',
    magenta: '#FF00FF',
    cyan: '#00FFFF',
    green: '#006400',
    orange: '#FF7700',
    brown: '#964B00',
    silver: '#C0C0C0',
    grey: '#808080',
    teal: '#008080',
    purple: '#800080',
    gold: '#FFD700'
}

module.exports = colors

const colorCount = Object.keys(colors).length
allColors = new Array(colorCount * colorCount)
// Make the allColors array
let i = 0
for (const a in colors) {
    for (const b in colors) {
        allColors[i] = a + '/' + b
        ++i
    }
}

/** @type {string[]} */
module.exports.allColors = allColors

/**
 * Gets all the unused colors for this game.
 * @param {Game} game the game.
 */
module.exports.unusedColors = function(game) {

    const unusedColors = [...module.exports.allColors]

    for (const key in game.playerdata.alive) {

        // Delete colors for each player
        const player = game.playerdata.alive[key]
        const index = unusedColors.indexOf(player.color);
        if (index > -1) unusedColors.splice(index, 1);
    }

    return unusedColors
}

/**
 * Selects a random color that has not yet been used by the game,
 * or undefined if there is no unused color.
 * @param {Game} game the game for which this color is selected.
 */
module.exports.randomUnused = function(game) {
    const colors = module.exports.unusedColors(game)
    if (!colors) return
    return colors[Math.floor(Math.random() * colors.length)]
}
