/**
 * Бесконечная горизонтальная карусель.
 * Работает на любом блоке `.carousel` на странице — достаточно разметки вида:
 *
 * <div class="carousel">
 *   <button class="carousel__arrow carousel__arrow--left">...</button>
 *   <div class="carousel__viewport">
 *     <div class="carousel__fade carousel__fade--left"></div>
 *     <div class="carousel__fade carousel__fade--right"></div>
 *     <div class="carousel__track">
 *       ...карточки...
 *     </div>
 *   </div>
 *   <button class="carousel__arrow carousel__arrow--right">...</button>
 * </div>
 *
 * Как работает бесконечность:
 * Реальная позиция `pos` ничем не ограничена — она просто растёт
 * или убывает от любых взаимодействий. Каждый кадр для отрисовки
 * берётся `pos % setWidth`, где setWidth — ширина одного полного
 * круга оригинальных карточек. В DOM карточки склонированы несколько
 * раз подряд, поэтому переход через границу лежит на пиксель-в-пиксель
 * одинаковом контенте и визуально никак не заметен.
 */

(() => {
  'use strict';

  // ---------------------------------------------------------
  // Настройки
  // ---------------------------------------------------------
  const COPIES              = 12;   // сколько раз клонируется исходный набор карточек
  const BASE_SPEED          = 0.4;  // px/кадр — скорость автопрокрутки (вправо)
  const VELOCITY_EASE       = 0.09; // скорость "погони" velocity за targetVelocity
  const WHEEL_SENSITIVITY   = 0.09;
  const WHEEL_MAX_IMPULSE   = 9;
  const WHEEL_IDLE_MS       = 140;  // через сколько мс без колеса скорость возвращается к базовой
  const BUTTON_SPEED        = 5;    // px/кадр при удержании кнопки-стрелки
  const BUTTON_CLICK_NUDGE  = 60;   // px — мгновенный сдвиг при одиночном клике
  const CLICK_THRESHOLD_MS  = 220;  // короче этого — считается кликом, не удержанием
  const DRAG_MAX_VELOCITY   = 42;   // ограничение инерции после отпускания мыши/пальца

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  // ---------------------------------------------------------
  // Инициализация одной карусели
  // ---------------------------------------------------------
  function initCarousel(root) {
    const viewport = root.querySelector('.carousel__viewport');
    const track    = root.querySelector('.carousel__track');
    const btnLeft  = root.querySelector('.carousel__arrow--right');
    const btnRight = root.querySelector('.carousel__arrow--left');

    if (!viewport || !track) return;

    const originalCards = Array.from(track.children);
    const originalCount = originalCards.length;
    if (originalCount === 0) return;

    // клонируем исходные карточки, чтобы лента была намного шире вьюпорта
    for (let copy = 1; copy < COPIES; copy++) {
      for (const card of originalCards) {
        track.appendChild(card.cloneNode(true));
      }
    }

    // ---------------------------------------------------------
    // Состояние движения
    // ---------------------------------------------------------
    let setWidth = 0;
    let mid = Math.floor(COPIES / 2);

    let pos = 0;
    let velocity = BASE_SPEED;
    let targetVelocity = BASE_SPEED;

    let isDragging = false;
    let dragStartX = 0;
    let dragStartPos = 0;
    let lastPointerX = 0;
    let lastPointerT = 0;
    let dragVelocitySample = 0;

    let wheelIdleTimer = null;
    const holdState = { active: false, dir: 0, pressStartT: 0 };

    // ширина одного полного круга — расстояние между первой карточкой
    // и первой карточкой следующей копии (учитывает gap автоматически)
    function measure() {
      const first = track.children[0];
      const nextLap = track.children[originalCount];
      setWidth = nextLap.getBoundingClientRect().left - first.getBoundingClientRect().left;
      mid = Math.floor(COPIES / 2);
    }

    function render() {
      if (!setWidth) return;
      const wrapped = ((pos % setWidth) + setWidth) % setWidth; // всегда в [0, setWidth)
      const translateX = wrapped - setWidth * mid;
      track.style.transform = `translate3d(${translateX}px, 0, 0)`;
    }

    function tick() {
      if (!isDragging) {
        velocity += (targetVelocity - velocity) * VELOCITY_EASE;
        pos += velocity;
      }
      render();
      requestAnimationFrame(tick);
    }

    // ---------------------------------------------------------
    // Колесо мыши: вниз — вправо, вверх — влево, скорость от скорости прокрутки
    // ---------------------------------------------------------
    viewport.addEventListener('wheel', (e) => {
      e.preventDefault();
      const impulse = clamp(e.deltaY * WHEEL_SENSITIVITY, -WHEEL_MAX_IMPULSE, WHEEL_MAX_IMPULSE);
      targetVelocity = BASE_SPEED + impulse;

      clearTimeout(wheelIdleTimer);
      wheelIdleTimer = setTimeout(() => {
        targetVelocity = BASE_SPEED;
      }, WHEEL_IDLE_MS);
    }, { passive: false });

    // ---------------------------------------------------------
    // Кнопки-стрелки: клик — небольшой поворот, удержание — непрерывное вращение
    // ---------------------------------------------------------
    function bindArrow(button, dir) {
      if (!button) return;

      const onPress = (e) => {
        e.preventDefault();
        holdState.active = true;
        holdState.dir = dir;
        holdState.pressStartT = performance.now();
        targetVelocity = BASE_SPEED + BUTTON_SPEED * dir;
        button.setPointerCapture?.(e.pointerId);
      };

      const onRelease = () => {
        if (!holdState.active || holdState.dir !== dir) return;
        const heldFor = performance.now() - holdState.pressStartT;
        holdState.active = false;

        if (heldFor < CLICK_THRESHOLD_MS) {
          pos += BUTTON_CLICK_NUDGE * dir; // гарантированный небольшой поворот на клик
        }
        targetVelocity = BASE_SPEED;
      };

      button.addEventListener('pointerdown', onPress);
      button.addEventListener('pointerup', onRelease);
      button.addEventListener('pointerleave', onRelease);
      button.addEventListener('pointercancel', onRelease);
    }

    bindArrow(btnLeft, -1);
    bindArrow(btnRight, 1);

    // ---------------------------------------------------------
    // Drag / свайп (Pointer Events — мышь, тач и перо одним кодом)
    // ---------------------------------------------------------
    viewport.addEventListener('pointerdown', (e) => {
      if (e.target.closest('.carousel__arrow, .project-link')) return;

      isDragging = true;
      viewport.classList.add('is-dragging');
      viewport.setPointerCapture(e.pointerId);

      dragStartX = e.clientX;
      dragStartPos = pos;
      lastPointerX = e.clientX;
      lastPointerT = performance.now();
      dragVelocitySample = 0;
    });

    viewport.addEventListener('pointermove', (e) => {
      if (!isDragging) return;

      const dx = e.clientX - dragStartX;
      pos = dragStartPos + dx;

      const now = performance.now();
      const dt = now - lastPointerT;
      if (dt > 0) {
        dragVelocitySample = ((e.clientX - lastPointerX) / dt) * 16.67; // px/мс -> px/кадр
      }
      lastPointerX = e.clientX;
      lastPointerT = now;
    });

    function endDrag() {
      if (!isDragging) return;
      isDragging = false;
      viewport.classList.remove('is-dragging');

      velocity = clamp(dragVelocitySample, -DRAG_MAX_VELOCITY, DRAG_MAX_VELOCITY);
      targetVelocity = BASE_SPEED; // дальше velocity сам плавно уедет к базовой скорости
    }

    viewport.addEventListener('pointerup', endDrag);
    viewport.addEventListener('pointercancel', endDrag);
    viewport.addEventListener('pointerleave', () => { if (isDragging) endDrag(); });

    // ---------------------------------------------------------
    // Пересчёт ширины круга при ресайзе (карточки адаптивные)
    // ---------------------------------------------------------
    let resizeTimer = null;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(measure, 120);
    });

    // ---------------------------------------------------------
    // Старт
    // ---------------------------------------------------------
    measure();
    pos = -setWidth * mid; // старт с "середины" ленты — запас в обе стороны сразу
    requestAnimationFrame(tick);
  }

  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.carousel').forEach(initCarousel);
  });
})();