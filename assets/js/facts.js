/* ------------------------------------------------------------------
   Facts from the cosmos.

   All the facts are written in index.html. This shuffles them once
   per visit (so a returning visitor sees different ones first), shows
   three at a time, and turns a card over to its answer when it is
   clicked or tapped. "More facts" deals the next three.
   Without JavaScript every card simply shows its answer.
------------------------------------------------------------------- */
(function () {
  'use strict';

  var section = document.getElementById('facts');
  if (!section) return;
  var grid = section.querySelector('.fact-grid');
  var moreBtn = section.querySelector('.facts-more');
  var cards = Array.prototype.slice.call(grid.querySelectorAll('.fact'));
  if (!cards.length) return;
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  var HAND = 3;
  section.classList.add('facts-js');

  // A fresh order each visit; the page shows the cards in this order
  var order = cards.slice();
  for (var i = order.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1)), t = order[i];
    order[i] = order[j]; order[j] = t;
  }
  order.forEach(function (c) { grid.appendChild(c); });

  // Only the face that is showing can be reached with the keyboard or a screen reader
  function setFlipped(card, on, moveFocus) {
    var front = card.querySelector('.fact-front'), back = card.querySelector('.fact-back');
    card.classList.toggle('flipped', on);
    front.inert = on; back.inert = !on;
    front.querySelector('.fact-btn').setAttribute('aria-expanded', String(on));
    if (moveFocus) (on ? back : front).querySelector('.fact-btn').focus({ preventScroll: true });
  }
  cards.forEach(function (card) {
    setFlipped(card, false);
    card.addEventListener('click', function (e) {
      if (e.target.closest('a')) return;                       // the source link opens normally
      var viaKeyboard = !!e.target.closest('.fact-btn') && e.detail === 0;
      setFlipped(card, !card.classList.contains('flipped'), viaKeyboard);
    });
  });

  // Deal a hand: the next three facts in the shuffled order
  var at = 0, hand = [];
  function nextHand() {
    var list = [];
    for (var k = 0; k < HAND; k++) list.push(order[(at + k) % order.length]);
    at = (at + HAND) % order.length;
    return list;
  }
  function show(list, animate) {
    cards.forEach(function (c) {
      c.hidden = list.indexOf(c) < 0;
      c.classList.remove('dealing-in', 'dealing-out');
    });
    list.forEach(function (c, k) {
      setFlipped(c, false);
      if (animate) { c.style.setProperty('--d', k * 70 + 'ms'); void c.offsetWidth; c.classList.add('dealing-in'); }
    });
    hand = list;
  }
  show(nextHand(), false);

  if (moreBtn) {
    moreBtn.hidden = false;
    var busy = false;
    moreBtn.addEventListener('click', function () {
      if (busy) return;
      var incoming = nextHand();
      if (reduceMotion.matches) { show(incoming, false); return; }
      // The old cards slip away one after another, then the new ones turn in
      busy = true;
      hand.forEach(function (c, k) { c.style.setProperty('--d', k * 40 + 'ms'); c.classList.add('dealing-out'); });
      setTimeout(function () { show(incoming, true); busy = false; }, 320 + hand.length * 40);
    });
  }
})();
