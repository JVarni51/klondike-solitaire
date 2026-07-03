import { getSuitSymbol } from './deck.js';

export class GameUI {
  constructor(game) {
    this.game = game;
    this.dragState = null;
    this.selectedSource = null;

    this.elements = {
      stock: document.getElementById('stock'),
      waste: document.getElementById('waste'),
      timer: document.getElementById('timer'),
      moves: document.getElementById('moves'),
      winOverlay: document.getElementById('win-overlay'),
      winStats: document.getElementById('win-stats'),
    };

    this.foundationEls = [...document.querySelectorAll('.foundation')];
    this.tableauEls = [...document.querySelectorAll('.tableau-pile')];

    this.bindEvents();
    game.onChange = () => this.render();
    this.render();
  }

  bindEvents() {
    document.getElementById('btn-new-game').addEventListener('click', () => {
      this.game.reset();
      this.hideWin();
    });

    document.getElementById('btn-play-again').addEventListener('click', () => {
      this.game.reset();
      this.hideWin();
    });

    document.getElementById('btn-hint').addEventListener('click', () => this.showHint());

    document.getElementById('draw-one').addEventListener('change', (e) => {
      this.game.drawCount = e.target.checked ? 1 : 3;
    });

    this.elements.stock.addEventListener('click', () => {
      this.game.drawFromStock();
    });

    document.addEventListener('pointermove', (e) => this.onPointerMove(e));
    document.addEventListener('pointerup', (e) => this.onPointerUp(e));
    document.addEventListener('pointercancel', (e) => this.onPointerUp(e));
  }

  formatTime(seconds) {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }

  createCardElement(card, source, cardIndex) {
    const el = document.createElement('div');
    el.className = `card ${card.faceUp ? 'face-up' : 'face-down'} ${card.faceUp ? card.color : ''}`;
    el.dataset.cardId = card.id;
    el.dataset.sourceType = source.type;
    if (source.index !== undefined) el.dataset.sourceIndex = source.index;
    el.dataset.cardIndex = cardIndex;

    if (card.faceUp) {
      const symbol = getSuitSymbol(card.suit);
      el.innerHTML = `
        <div class="card-corner-top">
          <span class="card-rank">${card.rank}</span>
          <span class="card-suit">${symbol}</span>
        </div>
        <div class="card-center">${symbol}</div>
        <div class="card-corner-bottom">
          <span class="card-rank">${card.rank}</span>
          <span class="card-suit">${symbol}</span>
        </div>
      `;
    }

    if (card.faceUp) {
      el.addEventListener('pointerdown', (e) => this.onCardPointerDown(e, source, cardIndex));
      el.addEventListener('dblclick', () => this.onCardDoubleClick(source, cardIndex));
    }

    return el;
  }

  onCardPointerDown(e, source, cardIndex) {
    if (e.button !== 0) return;
    const stack = this.game.getMovableStack(source, cardIndex);
    if (stack.length === 0) return;

    e.preventDefault();
    const cardEls = [];
    const startRect = e.currentTarget.getBoundingClientRect();

    if (source.type === 'tableau') {
      const pile = this.game.tableau[source.index];
      for (let i = cardIndex; i < pile.length; i++) {
        const c = document.querySelector(
          `[data-source-type="tableau"][data-source-index="${source.index}"][data-card-index="${i}"]`
        );
        if (c) cardEls.push(c);
      }
    } else {
      cardEls.push(e.currentTarget);
    }

    cardEls.forEach((el) => el.classList.add('dragging'));

    this.dragState = {
      source: { ...source, cardIndex },
      stack,
      cardEls,
      offsetX: e.clientX - startRect.left,
      offsetY: e.clientY - startRect.top,
      startX: e.clientX,
      startY: e.clientY,
    };

    e.currentTarget.setPointerCapture(e.pointerId);
  }

  onPointerMove(e) {
    if (!this.dragState) return;
    const { cardEls, offsetX, offsetY } = this.dragState;
    const baseX = e.clientX - offsetX;
    const baseY = e.clientY - offsetY;

    cardEls.forEach((el, i) => {
      el.style.left = `${baseX}px`;
      el.style.top = `${baseY + i * this.getCardOffset()}px`;
      el.style.position = 'fixed';
      el.style.zIndex = 1000 + i;
    });
  }

  onPointerUp(e) {
    if (!this.dragState) return;

    const { source, cardEls } = this.dragState;
    cardEls.forEach((el) => {
      el.classList.remove('dragging');
      el.style.position = '';
      el.style.left = '';
      el.style.top = '';
      el.style.zIndex = '';
    });

    const target = this.findDropTarget(e.clientX, e.clientY);
    if (target) {
      this.game.moveStack(source, target);
    }

    this.dragState = null;
    this.render();
  }

  onCardDoubleClick(source, cardIndex) {
    this.game.autoMoveToFoundation({ ...source, cardIndex });
  }

  getCardOffset() {
    return parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--card-offset')) || 24;
  }

  findDropTarget(x, y) {
    const piles = [
      ...this.tableauEls.map((el, index) => ({ el, type: 'tableau', index })),
      ...this.foundationEls.map((el, index) => ({ el, type: 'foundation', index })),
    ];

    for (const pile of piles) {
      const rect = pile.el.getBoundingClientRect();
      const expanded = {
        left: rect.left - 10,
        right: rect.right + 10,
        top: rect.top - 10,
        bottom: rect.bottom + 200,
      };
      if (x >= expanded.left && x <= expanded.right && y >= expanded.top && y <= expanded.bottom) {
        return { type: pile.type, index: pile.index };
      }
    }
    return null;
  }

  showHint() {
    const hint = this.game.findHint();
    if (!hint) return;

    document.querySelectorAll('.hint-pulse').forEach((el) => el.classList.remove('hint-pulse'));

    if (hint.source.type === 'stock') {
      this.elements.stock.classList.add('hint-pulse');
      setTimeout(() => this.elements.stock.classList.remove('hint-pulse'), 2000);
      return;
    }

    const selector = this.buildCardSelector(hint.source);
    const el = document.querySelector(selector);
    if (el) {
      el.classList.add('hint-pulse');
      setTimeout(() => el.classList.remove('hint-pulse'), 2000);
    }
  }

  buildCardSelector(source) {
    if (source.type === 'waste') {
      return '[data-source-type="waste"]';
    }
    return `[data-source-type="${source.type}"][data-source-index="${source.index}"][data-card-index="${source.cardIndex}"]`;
  }

  render() {
    const g = this.game;

    this.elements.moves.textContent = g.moves;
    this.elements.timer.textContent = this.formatTime(g.getElapsedSeconds());

    this.renderPile(this.elements.stock, g.stock, { type: 'stock' }, false);
    this.renderPile(this.elements.waste, g.waste, { type: 'waste' }, true);

    this.foundationEls.forEach((el, i) => {
      this.renderPile(el, g.foundations[i], { type: 'foundation', index: i }, true);
    });

    this.tableauEls.forEach((el, i) => {
      this.renderTableau(el, g.tableau[i], i);
    });

    if (g.isWon()) {
      this.showWin();
    }
  }

  renderPile(container, cards, source, interactive) {
    container.innerHTML = '';
    container.classList.toggle('empty', cards.length === 0);

    const visible = source.type === 'waste' ? cards.slice(-3) : cards;

    visible.forEach((card, i) => {
      const actualIndex = source.type === 'waste' ? cards.length - visible.length + i : i;
      const isTopCard = source.type === 'waste' ? actualIndex === cards.length - 1 : i === cards.length - 1;
      const cardEl = this.createCardElement(card, source, actualIndex);
      cardEl.style.top = '0';

      if (source.type === 'stock') {
        cardEl.style.pointerEvents = 'none';
      } else if (source.type === 'foundation') {
        if (!isTopCard) cardEl.style.display = 'none';
      } else if (source.type === 'waste' && !isTopCard) {
        cardEl.style.pointerEvents = 'none';
      }

      container.appendChild(cardEl);
    });
  }

  renderTableau(container, cards, pileIndex) {
    container.innerHTML = '';
    container.classList.toggle('empty', cards.length === 0);
    const offset = this.getCardOffset();

    cards.forEach((card, i) => {
      const cardEl = this.createCardElement(card, { type: 'tableau', index: pileIndex }, i);
      cardEl.style.top = `${i * offset}px`;
      container.appendChild(cardEl);
    });
  }

  showWin() {
    const secs = this.game.getElapsedSeconds();
    this.elements.winStats.textContent =
      `Completed in ${this.formatTime(secs)} with ${this.game.moves} moves.`;
    this.elements.winOverlay.classList.remove('hidden');
  }

  hideWin() {
    this.elements.winOverlay.classList.add('hidden');
  }
}
