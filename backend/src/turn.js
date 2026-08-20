const { Chess } = require('chess.js');

function getTurnState(fen, challengerColorValue) {
  const challengerColor = String(challengerColorValue || '').trim().toLowerCase();
  if (challengerColor !== 'white' && challengerColor !== 'black') {
    throw new Error('invalid challenger color');
  }
  const sideToMove = new Chess(fen).turn() === 'w' ? 'white' : 'black';
  const jeremyColor = challengerColor === 'white' ? 'black' : 'white';
  return {
    sideToMove,
    challengerColor,
    jeremyColor,
    isJeremyTurn: sideToMove === jeremyColor,
    isChallengerTurn: sideToMove === challengerColor
  };
}

module.exports = { getTurnState };
