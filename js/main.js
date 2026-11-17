/* =========================================================
   La Corteza · Interacciones base
   ========================================================= */

const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

/* ---------- Barra de anuncios rotativa ---------- */
(() => {
  const items = $$('.announce__item');
  if (items.length < 2) return;
  let i = 0;
  setInterval(() => {
    const current = items[i];
    current.classList.remove('is-active');
    current.classList.add('is-leaving');
    setTimeout(() => current.classList.remove('is-leaving'), 500);
    i = (i + 1) % items.length;
    items[i].classList.add('is-active');
  }, 4000);
})();

/* ---------- Encabezado con sombra al hacer scroll ---------- */
(() => {
  const header = $('#header');
  const onScroll = () => header.classList.toggle('is-scrolled', window.scrollY > 10);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
})();

/* ---------- Menú móvil ---------- */
(() => {
  const drawer = $('#drawer');
  const openBtn = $('#menuOpen');
  const toggle = (open) => {
    drawer.classList.toggle('is-open', open);
    drawer.setAttribute('aria-hidden', String(!open));
    openBtn.setAttribute('aria-expanded', String(open));
    document.body.style.overflow = open ? 'hidden' : '';
  };
  openBtn.addEventListener('click', () => toggle(true));
  $('#menuClose').addEventListener('click', () => toggle(false));
  drawer.addEventListener('click', (e) => {
    if (e.target === drawer || e.target.closest('nav a')) toggle(false);
  });
  document.addEventListener('keydown', (e) => e.key === 'Escape' && toggle(false));
})();

/* ---------- Buscador ---------- */
(() => {
  const panel = $('#search');
  const input = $('#searchInput');
  const results = $('#searchResults');
  // Índice simple a partir de las tarjetas del catálogo
  // Normaliza para que "arandano" encuentre "Arándano"
  const norm = (t) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const products = $$('.card[data-name]').map((card) => ({
    id: card.id,
    name: card.dataset.name,
    price: card.dataset.price,
    text: norm(card.textContent),
  }));

  const render = (q) => {
    const term = norm(q.trim());
    if (!term) { results.innerHTML = ''; return; }
    const found = products.filter((p) => p.text.includes(term));
    results.innerHTML = found.length
      ? found.map((p) => `<li><a href="#${p.id}">${p.name} — <small>$${p.price} MXN</small></a></li>`).join('')
      : '<li class="empty">Sin resultados. Prueba con “arándano”, “cacao” o “semillas”.</li>';
  };

  const close = () => { panel.hidden = true; input.value = ''; render(''); };
  $('#searchOpen').addEventListener('click', () => {
    panel.hidden = !panel.hidden;
    if (!panel.hidden) input.focus();
  });
  $('#searchClose').addEventListener('click', close);
  input.addEventListener('input', () => render(input.value));
  input.addEventListener('keydown', (e) => e.key === 'Escape' && close());
  results.addEventListener('click', (e) => e.target.closest('a') && close());
})();

/* ---------- Carrusel de productos ---------- */
(() => {
  const rail = $('#rail');
  const prev = $('[data-rail="prev"]');
  const next = $('[data-rail="next"]');
  const step = () => rail.querySelector('.card').offsetWidth + 24;
  const update = () => {
    prev.disabled = rail.scrollLeft <= 4;
    next.disabled = rail.scrollLeft + rail.clientWidth >= rail.scrollWidth - 4;
  };
  prev.addEventListener('click', () => rail.scrollBy({ left: -step() }));
  next.addEventListener('click', () => rail.scrollBy({ left: step() }));
  rail.addEventListener('scroll', update, { passive: true });
  window.addEventListener('resize', update);
  update();
})();

/* ---------- Ir a un producto (menú, buscador, pie) ---------- */
// Desplaza el carrusel horizontal hasta la tarjeta y la resalta un momento
document.addEventListener('click', (e) => {
  const link = e.target.closest('a[href^="#p-"]');
  if (!link) return;
  const card = $(link.getAttribute('href'));
  if (!card) return;
  const rail = $('#rail');
  setTimeout(() => {
    rail.scrollTo({ left: card.offsetLeft - rail.offsetLeft, behavior: 'smooth' });
    card.classList.add('is-highlight');
    setTimeout(() => card.classList.remove('is-highlight'), 1800);
  }, 350);
});

/* ---------- Carrito + oferta 10 + 1 ---------- */
const PROMO_META = 10; // piezas necesarias para la pieza gratis

(() => {
  const count = $('#cartCount');
  const btn = $('#cartBtn');
  const toast = $('#toast');
  const fill = $('#offerFill');
  const offerMsg = $('#offerMsg');
  let total = 0;
  let timer;

  const notify = (msg) => {
    toast.textContent = msg;
    toast.classList.add('is-visible');
    clearTimeout(timer);
    timer = setTimeout(() => toast.classList.remove('is-visible'), 2600);
  };

  // Mensaje según cuántas piezas lleva el cliente
  const promoText = () => {
    if (total >= PROMO_META) return '¡Listo! Tu pieza número 11 va por nuestra cuenta.';
    const faltan = PROMO_META - total;
    return `Te ${faltan === 1 ? 'falta 1 pieza' : `faltan ${faltan} piezas`} para tu pan gratis.`;
  };

  const updateOffer = () => {
    fill.style.width = `${Math.min(total / PROMO_META, 1) * 100}%`;
    offerMsg.textContent = total
      ? `Llevas ${Math.min(total, PROMO_META)} de ${PROMO_META} piezas. ${promoText()}`
      : `Llevas 0 de ${PROMO_META} piezas.`;
  };

  $$('.add-to-cart').forEach((b) => b.addEventListener('click', () => {
    const name = b.closest('.card').dataset.name;
    total += 1;
    count.textContent = total;
    count.classList.add('has-items');
    count.classList.remove('bump'); void count.offsetWidth; count.classList.add('bump');
    btn.setAttribute('aria-label', `Carrito, ${total} productos`);
    updateOffer();
    notify(`Agregaste ${name} · ${promoText()}`);
  }));

  btn.addEventListener('click', () => notify(
    total ? `Tienes ${total} pieza(s) en el carrito · ${promoText()}`
          : `Tu carrito está vacío · Compra ${PROMO_META} piezas y la 11ª es gratis`
  ));

  updateOffer();
})();

/* ---------- Newsletter (validación simple) ---------- */
(() => {
  const form = $('#newsletterForm');
  const input = $('#nlEmail');
  const msg = $('#nlMsg');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!input.checkValidity()) { msg.textContent = 'Escribe un correo válido.'; return; }
    msg.textContent = '¡Gracias! Pronto recibirás nuestras promociones.';
    form.reset();
  });
})();

/* ---------- Animación de aparición al hacer scroll ---------- */
(() => {
  const targets = $$('.section__head, .card, .story__text, .offer__inner, .newsletter__inner');
  if (!('IntersectionObserver' in window)) return;
  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); }
    });
  }, { threshold: 0.12 });
  targets.forEach((el) => { el.classList.add('reveal'); io.observe(el); });
})();

/* ---------- Año actual en el footer ---------- */
$('#year').textContent = new Date().getFullYear();
