const jimp = require('jimp')
const settings = require('./settings')
const colors = require('./colors')

/**
 * Turns a CSS-style hex code into an integer (alpha channel becomes 1).
 * @param {string} hex the CSS-style hex code to convert to int
 * @returns the color code as an integer.
 */
function hexToInt(hex) {

    // Why do bit math in JavaScript? There's string math!
    // (I'm just lazy)
    if (/^#([a-f\d]{6})$/i.exec(hex)) {
        return parseInt(hex.slice(1) + 'FF', 16)
    }
}

/**
 * Creates a board for a game.
 * @param {Game} game the game for which the board will be created.
 */
module.exports.createBoard = async function(game) {

    const cell_size = settings.get(['board', 'cell_size'], game)
    const border_width = settings.get(['board', 'border_width'], game)
    const border_color = settings.get(['board' ,'border_color'], game)
    const empty_cell_color = settings.get(['board', 'empty_cell_color'], game)

    const borderCount = {
        x: game.playerdata.boardSize[0] + 1,
        y: game.playerdata.boardSize[1] + 1,
    }

    const dims = {
        x: game.playerdata.boardSize[0] * cell_size
        + borderCount.x * border_width,
        y: game.playerdata.boardSize[1] * cell_size
        + borderCount.y * border_width,
    }

    const img = await new jimp(dims.x, dims.y, border_color)

    var color
    for (let x = 0; x < game.playerdata.boardSize[0]; ++x) {
        for (let y = 0; y < game.playerdata.boardSize[1]; ++y) {  

            // Finds a tank at the position
            color = undefined
            for (const player in game.playerdata.alive) {
                const element = game.playerdata.alive[player]
                if (element.position[0] == x && element.position[1] == y) {
                    color = colors[element.color]
                    break
                }
            }
            if (!color) color = empty_cell_color

            fillCellPrivate(img, game, [x, y], color)
        }
    }
    await img.writeAsync(game.path + '/board.png')
}

/**
 * Fills a cell on a game board with a color.
 * @param {Game} game the game whose map will be colored.
 * @param {Position} pos the position to color.
 * @param {string} color the color to use.
 */
module.exports.fillCell = async function(game, pos, color) {
    const img = await jimp.read(game.path + '/board.png')
    fillCellPrivate(img, game, pos, color)
    await img.writeAsync(game.path + '/board.png')
}

/**
 * Fills a cell on an existing image object without exporting the image.
 * @param {jimp} img the Jimp image object.
 * @param {Game} game the game whose map will be updated.
 * @param {Position} pos the position of the cell.
 * @param {string} color the color of the cell.
 */
function fillCellPrivate(img, game, pos, color) {
    const cell_size = settings.get(['board', 'cell_size'], game)
    const border_width = settings.get(['board', 'border_width'], game)
    const colorNum = hexToInt(color)
    return img.scan(
        pos[0] * (border_width + cell_size) + border_width,
        pos[1] * (border_width + cell_size) + border_width,
        cell_size, cell_size, 
        function(x, y, offset)
    {
        this.bitmap.data.writeUInt32BE(colorNum, offset, true)
    })
}

/**
 * Fills a cell on a game board with the game's empty cell color.
 * @param {Game} game the game whose map will be colored.
 * @param {Position} pos the position to empty.
 */
module.exports.emptyCell = function(game, pos) {
    return module.exports.fillCell(game, pos, settings.get(
        ['board', 'empty_cell_color'], game))
}

/**
 * Moves a tank on the board by filling the cell at the original position with
 * the empty cell color and filling the cell at the new position with the tank
 * color.
 * @param {Game} game the game where the tank is moved.
 * @param {Position} pos the original position of the tank.
 * @param {Position} dest the destination where the tank will be moved.
 * @param {string} color the color of the tank.
 */
module.exports.moveTank = async function(game, pos, dest, color) {
    const img = await jimp.read(game.path + '/board.png')
    const empty_cell_color = settings.get(['board', 'empty_cell_color'], game)
    fillCellPrivate(img, game, pos, empty_cell_color)
    fillCellPrivate(img, game, dest, color)
    await img.writeAsync(game.path + '/board.png')
}
