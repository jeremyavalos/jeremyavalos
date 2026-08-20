const assert = require('assert');
const { Chess } = require('chess.js');
const { getTurnState } = require('../src/turn');

const whiteToMove = new Chess().fen();
const afterWhiteMove = new Chess();
afterWhiteMove.move('d4');
const blackToMove = afterWhiteMove.fen();

assert.deepStrictEqual(getTurnState(whiteToMove, 'white'), {
  sideToMove: 'white', challengerColor: 'white', jeremyColor: 'black',
  isJeremyTurn: false, isChallengerTurn: true
});
assert.deepStrictEqual(getTurnState(blackToMove, 'white'), {
  sideToMove: 'black', challengerColor: 'white', jeremyColor: 'black',
  isJeremyTurn: true, isChallengerTurn: false
});
assert.deepStrictEqual(getTurnState(whiteToMove, 'black'), {
  sideToMove: 'white', challengerColor: 'black', jeremyColor: 'white',
  isJeremyTurn: true, isChallengerTurn: false
});
assert.deepStrictEqual(getTurnState(blackToMove, 'black'), {
  sideToMove: 'black', challengerColor: 'black', jeremyColor: 'white',
  isJeremyTurn: false, isChallengerTurn: true
});

const jeremex1 = new Chess();
jeremex1.move('d4');
jeremex1.move('e5');
const example = getTurnState(jeremex1.fen(), 'white');
assert.strictEqual(example.sideToMove, 'white');
assert.strictEqual(example.isChallengerTurn, true);

console.log('Canonical turn-state regression cases passed');
