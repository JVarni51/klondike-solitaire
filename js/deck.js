export const SUITS = ['hearts', 'diamonds', 'clubs', 'spades'];
export const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

const SUIT_SYMBOLS = {
  hearts: '\u2665',
  diamonds: '\u2666',
  clubs: '\u2663',
  spades: '\u2660',
};

const RED_SUITS = new Set(['hearts', 'diamonds']);

export function createDeck() {
  const deck = [];
  for (const suit of SUITS) {
    for (let i = 0; i < RANKS.length; i++) {
      deck.push({
        suit,
        rank: RANKS[i],
        value: i + 1,
        color: RED_SUITS.has(suit) ? 'red' : 'black',
        faceUp: false,
        id: `${suit}-${RANKS[i]}`,
      });
    }
  }
  return deck;
}

export function shuffle(deck) {
  const arr = [...deck];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function getSuitSymbol(suit) {
  return SUIT_SYMBOLS[suit];
}

export function isRed(card) {
  return card.color === 'red';
}

export function canStackOnTableau(moving, target) {
  if (!target) return moving.rank === 'K';
  if (isRed(moving) === isRed(target)) return false;
  return moving.value === target.value - 1;
}

export function canPlaceOnFoundation(card, foundation) {
  if (foundation.length === 0) return card.rank === 'A';
  const top = foundation[foundation.length - 1];
  return card.suit === top.suit && card.value === top.value + 1;
}
