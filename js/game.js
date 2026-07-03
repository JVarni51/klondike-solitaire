import {
  createDeck,
  shuffle,
  canStackOnTableau,
  canPlaceOnFoundation,
} from './deck.js';

export class SolitaireGame {
  constructor() {
    this.drawCount = 1;
    this.moves = 0;
    this.startTime = null;
    this.timerInterval = null;
    this.onChange = null;
    this.reset();
  }

  reset() {
    this.stock = [];
    this.waste = [];
    this.foundations = [[], [], [], []];
    this.tableau = [[], [], [], [], [], [], []];
    this.moves = 0;
    this.stopTimer();
    this.startTime = null;
    this.deal();
    this.emit();
  }

  deal() {
    const deck = shuffle(createDeck());
    let index = 0;

    for (let col = 0; col < 7; col++) {
      for (let row = 0; row <= col; row++) {
        const card = deck[index++];
        card.faceUp = row === col;
        this.tableau[col].push(card);
      }
    }

    this.stock = deck.slice(index).map((c) => ({ ...c, faceUp: false }));
    this.waste = [];
    this.foundations = [[], [], [], []];
    this.startTimer();
  }

  startTimer() {
    this.startTime = Date.now();
    this.stopTimer();
    this.timerInterval = setInterval(() => this.emit(), 1000);
  }

  stopTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  getElapsedSeconds() {
    if (!this.startTime) return 0;
    return Math.floor((Date.now() - this.startTime) / 1000);
  }

  emit() {
    if (this.onChange) this.onChange(this);
  }

  drawFromStock() {
    if (this.stock.length > 0) {
      const count = Math.min(this.drawCount, this.stock.length);
      for (let i = 0; i < count; i++) {
        const card = this.stock.pop();
        card.faceUp = true;
        this.waste.push(card);
      }
      this.moves++;
      this.emit();
      return true;
    }

    if (this.waste.length > 0) {
      while (this.waste.length > 0) {
        const card = this.waste.pop();
        card.faceUp = false;
        this.stock.push(card);
      }
      this.moves++;
      this.emit();
      return true;
    }

    return false;
  }

  getMovableStack(source, index) {
    if (source.type === 'waste') {
      if (this.waste.length === 0) return [];
      return [this.waste[this.waste.length - 1]];
    }

    if (source.type === 'tableau') {
      const pile = this.tableau[source.index];
      if (index < 0 || index >= pile.length) return [];
      const card = pile[index];
      if (!card.faceUp) return [];

      const stack = pile.slice(index);
      for (let i = 0; i < stack.length - 1; i++) {
        const a = stack[i];
        const b = stack[i + 1];
        if (!canStackOnTableau(b, a)) return [];
      }
      return stack;
    }

    if (source.type === 'foundation') {
      const pile = this.foundations[source.index];
      if (pile.length === 0) return [];
      return [pile[pile.length - 1]];
    }

    return [];
  }

  removeStack(source, count) {
    if (source.type === 'waste') {
      this.waste.pop();
    } else if (source.type === 'tableau') {
      this.tableau[source.index].splice(-count, count);
      const pile = this.tableau[source.index];
      if (pile.length > 0 && !pile[pile.length - 1].faceUp) {
        pile[pile.length - 1].faceUp = true;
      }
    } else if (source.type === 'foundation') {
      this.foundations[source.index].pop();
    }
  }

  canDrop(stack, target) {
    if (stack.length === 0) return false;
    const card = stack[0];

    if (target.type === 'tableau') {
      const pile = this.tableau[target.index];
      const top = pile.length > 0 ? pile[pile.length - 1] : null;
      if (card.rank !== 'K' && pile.length === 0) return false;
      return canStackOnTableau(card, top);
    }

    if (target.type === 'foundation') {
      if (stack.length !== 1) return false;
      return canPlaceOnFoundation(card, this.foundations[target.index]);
    }

    return false;
  }

  moveStack(source, target) {
    const stack = this.getMovableStack(source, source.cardIndex ?? 0);
    if (stack.length === 0) return false;
    if (!this.canDrop(stack, target)) return false;

    this.removeStack(source, stack.length);

    if (target.type === 'tableau') {
      this.tableau[target.index].push(...stack);
    } else if (target.type === 'foundation') {
      this.foundations[target.index].push(stack[0]);
    }

    this.moves++;
    this.emit();

    if (this.isWon()) {
      this.stopTimer();
    }

    return true;
  }

  autoMoveToFoundation(source) {
    const stack = this.getMovableStack(source, source.cardIndex ?? 0);
    if (stack.length !== 1) return false;

    for (let i = 0; i < 4; i++) {
      if (this.canDrop(stack, { type: 'foundation', index: i })) {
        return this.moveStack(source, { type: 'foundation', index: i });
      }
    }
    return false;
  }

  findHint() {
    const sources = [];

    if (this.waste.length > 0) {
      sources.push({ type: 'waste', cardIndex: 0 });
    }

    for (let i = 0; i < 7; i++) {
      const pile = this.tableau[i];
      for (let j = pile.length - 1; j >= 0; j--) {
        if (pile[j].faceUp) {
          sources.push({ type: 'tableau', index: i, cardIndex: j });
          break;
        }
      }
    }

    for (const source of sources) {
      for (let f = 0; f < 4; f++) {
        const stack = this.getMovableStack(source, source.cardIndex ?? 0);
        if (stack.length === 1 && this.canDrop(stack, { type: 'foundation', index: f })) {
          return { source, target: { type: 'foundation', index: f } };
        }
      }
    }

    for (const source of sources) {
      const stack = this.getMovableStack(source, source.cardIndex ?? 0);
      if (stack.length === 0) continue;
      for (let t = 0; t < 7; t++) {
        if (source.type === 'tableau' && source.index === t) continue;
        if (this.canDrop(stack, { type: 'tableau', index: t })) {
          return { source, target: { type: 'tableau', index: t } };
        }
      }
    }

    if (this.stock.length > 0 || this.waste.length > 0) {
      return { source: { type: 'stock' }, target: null };
    }

    return null;
  }

  isWon() {
    return this.foundations.every((f) => f.length === 13);
  }
}
