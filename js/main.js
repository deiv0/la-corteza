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

/* =========================================================
   Carrito, oferta 10 + 1 y pedido por WhatsApp
   ========================================================= */

/* ---- Configuración: cambia aquí los datos del negocio ---- */
const CONFIG = {
  whatsapp: '526312485213',          // 52 + número a 10 dígitos (pruebas: 631-248-52-13)
  promoMeta: 10,                      // por cada 10 piezas compradas, 1 gratis
  diasAnticipacion: 1,                // pedidos con al menos 1 día de anticipación
  puntos: ['Plaza Tec', 'Plaza San Carlos', 'Plaza Cumbres'],
  storageKey: 'lacorteza-carrito',
};

(() => {
  const money = (n) => `$${n.toLocaleString('es-MX')} MXN`;

  // Catálogo leído de las tarjetas del HTML (id, nombre, precio, imagen)
  const catalog = Object.fromEntries($$('.card[data-name]').map((card) => [card.id, {
    id: card.id,
    name: card.dataset.name,
    price: Number(card.dataset.price),
    img: $('img', card).getAttribute('src'),
  }]));

  /* ---------- Estado (se guarda en el navegador) ---------- */
  let state = { items: {}, free: [] };
  try {
    const saved = JSON.parse(localStorage.getItem(CONFIG.storageKey));
    if (saved && saved.items) state = saved;
  } catch (_) { /* sin almacenamiento disponible: el carrito vive en memoria */ }
  // Descarta productos que ya no existan en el catálogo
  Object.keys(state.items).forEach((id) => { if (!catalog[id]) delete state.items[id]; });
  state.free = (state.free || []).filter((id) => catalog[id]);

  const save = () => {
    try { localStorage.setItem(CONFIG.storageKey, JSON.stringify(state)); } catch (_) { /* ignorar */ }
  };

  const pieces = () => Object.values(state.items).reduce((a, b) => a + b, 0);
  const total = () => Object.entries(state.items).reduce((s, [id, q]) => s + catalog[id].price * q, 0);
  const freeEarned = () => Math.floor(pieces() / CONFIG.promoMeta);

  // Ajusta la lista de piezas gratis al número ganado
  const syncFree = () => {
    const earned = freeEarned();
    const first = Object.keys(state.items)[0] || Object.keys(catalog)[0];
    state.free = state.free.slice(0, earned);
    while (state.free.length < earned) state.free.push(first);
  };

  const promoText = () => {
    const resto = CONFIG.promoMeta - (pieces() % CONFIG.promoMeta);
    const earned = freeEarned();
    const ganadas = earned ? `¡Tienes ${earned} pieza${earned > 1 ? 's' : ''} gratis! ` : '';
    return `${ganadas}Te ${resto === 1 ? 'falta 1 pieza' : `faltan ${resto} piezas`} para ${earned ? 'otra' : 'tu pan gratis'}.`;
  };

  /* ---------- Elementos ---------- */
  const el = {
    cart: $('#cart'), list: $('#cartList'), empty: $('#cartEmpty'),
    freeBox: $('#cartFree'), freeList: $('#cartFreeList'),
    bar: $('#cartBar'), promo: $('#cartPromo'),
    pieces: $('#cartPieces'), total: $('#cartTotal'), toCheckout: $('#toCheckout'),
    count: $('#cartCount'), btn: $('#cartBtn'), toast: $('#toast'),
    offerFill: $('#offerFill'), offerMsg: $('#offerMsg'),
    title: $('#cartTitle'), back: $('#cartBack'),
    form: $('#checkoutForm'), error: $('#checkoutError'),
    date: $('#cDate'), points: $('#pickupPoints'),
    sumPieces: $('#sumPieces'), sumTotal: $('#sumTotal'),
    pay: $('#payForm'), payError: $('#payError'), paySubmit: $('#paySubmit'),
    payPieces: $('#payPieces'), payTotal: $('#payTotal'),
    card: $('#pCard'), exp: $('#pExp'), cvv: $('#pCvv'), cardBrand: $('#cardBrand'),
    bankRef: $('#bankRef'), bankAmount: $('#bankAmount'),
    waSend: $('#waSend'),
  };

  // Productos del carrito en formato de Google Analytics 4
  const gaItems = () => Object.entries(state.items).map(([id, q]) => ({
    item_id: id, item_name: catalog[id].name, item_brand: 'La Corteza', price: catalog[id].price, quantity: q,
  }));
  const gaCart = (extra = {}) => ({ currency: 'MXN', value: total(), items: gaItems(), ...extra });

  let toastTimer;
  const notify = (msg) => {
    el.toast.textContent = msg;
    el.toast.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.toast.classList.remove('is-visible'), 2600);
  };

  /* ---------- Pintar el carrito ---------- */
  const render = () => {
    syncFree();
    save();
    const n = pieces();

    el.empty.hidden = n > 0;
    el.list.innerHTML = Object.keys(state.items).map((id) => {
      const p = catalog[id];
      const q = state.items[id];
      return `<li data-id="${id}">
        <img src="${p.img}" alt="">
        <div>
          <p class="cart__name">${p.name}</p>
          <p class="cart__unit">${money(p.price)} c/u</p>
          <div class="qty" role="group" aria-label="Cantidad de ${p.name}">
            <button type="button" data-act="dec" aria-label="Quitar uno">−</button>
            <span>${q}</span>
            <button type="button" data-act="inc" aria-label="Agregar uno">+</button>
          </div>
        </div>
        <div class="cart__right">
          <span class="cart__line">${money(p.price * q)}</span>
          <button type="button" class="cart__remove" data-act="del">Quitar</button>
        </div>
      </li>`;
    }).join('');

    // Selectores de piezas gratis (el cliente elige cuál pan quiere)
    el.freeBox.hidden = state.free.length === 0;
    el.freeList.innerHTML = state.free.map((sel, i) => `
      <label>Pieza gratis ${i + 1}
        <select data-free="${i}">
          ${Object.values(catalog).map((p) => `<option value="${p.id}"${p.id === sel ? ' selected' : ''}>${p.name}</option>`).join('')}
        </select>
      </label>`).join('');

    // Progreso hacia la siguiente pieza gratis
    const enCiclo = n % CONFIG.promoMeta;
    const pct = n === 0 ? 0 : ((enCiclo === 0 ? CONFIG.promoMeta : enCiclo) / CONFIG.promoMeta) * 100;
    el.bar.style.width = `${pct}%`;
    el.offerFill.style.width = `${pct}%`;
    el.promo.textContent = n ? promoText() : `Compra ${CONFIG.promoMeta} piezas y la 11ª es gratis.`;
    el.offerMsg.textContent = n
      ? `Llevas ${n} pieza${n > 1 ? 's' : ''}. ${promoText()}`
      : `Llevas 0 de ${CONFIG.promoMeta} piezas.`;

    const piecesLabel = `${n}${state.free.length ? ` + ${state.free.length} gratis` : ''}`;
    el.pieces.textContent = piecesLabel;
    el.sumPieces.textContent = piecesLabel;
    el.total.textContent = money(total());
    el.sumTotal.textContent = money(total());
    el.payPieces.textContent = piecesLabel;
    el.payTotal.textContent = money(total());
    el.bankAmount.textContent = money(total());
    el.toCheckout.disabled = n === 0;

    el.count.textContent = n;
    el.count.classList.toggle('has-items', n > 0);
    el.btn.setAttribute('aria-label', `Carrito, ${n} productos`);
  };

  /* ---------- Abrir / cerrar y pasos ---------- */
  const steps = $$('.cart__step', el.cart);
  const titles = { items: 'Tu carrito', checkout: 'Datos de recogida', payment: 'Pago', done: 'Pedido confirmado' };
  const prev = { checkout: 'items', payment: 'checkout' };
  let current = 'items';
  const goTo = (step) => {
    current = step;
    steps.forEach((s) => { s.hidden = s.dataset.step !== step; });
    el.title.textContent = titles[step];
    el.back.hidden = !prev[step];
    $('.cart__panel', el.cart).scrollTop = 0;
  };
  const open = (step = 'items') => {
    goTo(step);
    el.cart.classList.add('is-open');
    el.cart.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    $('#cartClose').focus();
  };
  const close = () => {
    el.cart.classList.remove('is-open');
    el.cart.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  };

  el.btn.addEventListener('click', () => {
    open();
    if (pieces()) track('view_cart', gaCart());
  });
  $('#cartClose').addEventListener('click', close);
  el.back.addEventListener('click', () => { if (prev[current]) goTo(prev[current]); });
  el.cart.addEventListener('click', (e) => {
    if (e.target === el.cart || e.target.closest('[data-cart-close]')) close();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && el.cart.classList.contains('is-open')) close();
  });

  /* ---------- Acciones sobre productos ---------- */
  $$('.add-to-cart').forEach((b) => b.addEventListener('click', () => {
    const card = b.closest('.card');
    state.items[card.id] = (state.items[card.id] || 0) + 1;
    render();
    el.count.classList.remove('bump'); void el.count.offsetWidth; el.count.classList.add('bump');
    notify(`Agregaste ${card.dataset.name} · ${promoText()}`);
    const p = catalog[card.id];
    track('add_to_cart', { currency: 'MXN', value: p.price, items: [{ item_id: p.id, item_name: p.name, item_brand: 'La Corteza', price: p.price, quantity: 1 }] });
  }));

  el.list.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-act]');
    if (!btn) return;
    const id = btn.closest('li').dataset.id;
    const p = catalog[id];
    const antes = state.items[id];
    if (btn.dataset.act === 'inc') state.items[id] += 1;
    if (btn.dataset.act === 'dec') state.items[id] -= 1;
    if (btn.dataset.act === 'del' || state.items[id] <= 0) delete state.items[id];
    const diff = (state.items[id] || 0) - antes;
    const item = { item_id: id, item_name: p.name, item_brand: 'La Corteza', price: p.price, quantity: Math.abs(diff) };
    track(diff > 0 ? 'add_to_cart' : 'remove_from_cart', { currency: 'MXN', value: p.price * Math.abs(diff), items: [item] });
    render();
  });

  el.freeList.addEventListener('change', (e) => {
    const sel = e.target.closest('select[data-free]');
    if (sel) { state.free[Number(sel.dataset.free)] = sel.value; save(); }
  });

  /* ---------- Paso 2: datos de recogida ---------- */
  el.points.innerHTML = CONFIG.puntos.map((p) => `
    <label class="choice"><input type="radio" name="punto" value="${p}"> ${p}</label>`).join('');

  // Fecha mínima = hoy + días de anticipación (en hora local)
  const isoLocal = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const minDate = () => {
    const d = new Date();
    d.setDate(d.getDate() + CONFIG.diasAnticipacion);
    return isoLocal(d);
  };

  el.toCheckout.addEventListener('click', () => {
    el.date.min = minDate();
    if (!el.date.value || el.date.value < el.date.min) el.date.value = el.date.min;
    el.error.textContent = '';
    goTo('checkout');
    track('begin_checkout', gaCart());
  });

  const fechaLarga = (iso) => {
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' });
  };

  // Texto que se envía por WhatsApp (los *asteriscos* se ven en negritas)
  const buildMessage = (data) => {
    const lines = ['*Nuevo pedido · La Corteza*', ''];
    Object.entries(state.items).forEach(([id, q]) => {
      lines.push(`• ${q} × ${catalog[id].name} — ${money(catalog[id].price * q)}`);
    });
    if (state.free.length) {
      const porPan = state.free.reduce((acc, id) => ({ ...acc, [id]: (acc[id] || 0) + 1 }), {});
      lines.push('', '*Piezas gratis (10 + 1):*');
      Object.entries(porPan).forEach(([id, q]) => lines.push(`• ${q} × ${catalog[id].name} — $0`));
    }
    lines.push(
      '',
      `*Piezas:* ${pieces()}${state.free.length ? ` + ${state.free.length} gratis` : ''}`,
      `*Total:* ${money(total())}`,
      '',
      `*Nombre:* ${data.nombre}`,
      `*Teléfono:* ${data.telefono}`,
      `*Recoge en:* ${data.punto}`,
      `*Día:* ${fechaLarga(data.fecha)}${data.hora ? ` · ${data.hora} h` : ''}`,
    );
    if (data.notas) lines.push(`*Notas:* ${data.notas}`);
    lines.push('', `*Folio:* ${data.folio}`, `*Pago:* ${data.pagoTexto} (simulación)`);
    return lines.join('\n');
  };

  let pedido = null; // datos de recogida validados (paso 2)
  const nuevoFolio = () => {
    const d = new Date();
    return `LC-${isoLocal(d).slice(2).replace(/-/g, '')}-${String(Math.floor(Math.random() * 9000) + 1000)}`;
  };

  el.form.addEventListener('submit', (e) => {
    e.preventDefault();
    const f = el.form;
    $$('.is-invalid', f).forEach((x) => x.classList.remove('is-invalid'));
    const data = {
      nombre: f.nombre.value.trim(),
      telefono: f.telefono.value.replace(/\D/g, ''),
      punto: (f.querySelector('input[name="punto"]:checked') || {}).value,
      fecha: f.fecha.value,
      hora: f.hora.value,
      notas: f.notas.value.trim(),
    };

    const errors = [];
    if (data.nombre.length < 3) { errors.push('tu nombre'); f.nombre.classList.add('is-invalid'); }
    if (data.telefono.length !== 10) { errors.push('un teléfono de 10 dígitos'); f.telefono.classList.add('is-invalid'); }
    if (!data.punto) errors.push('elegir un punto de recogida');
    if (!data.fecha || data.fecha < minDate()) { errors.push('un día a partir de mañana'); f.fecha.classList.add('is-invalid'); }
    if (!pieces()) errors.push('al menos un pan en el carrito');
    if (errors.length) { el.error.textContent = `Falta: ${errors.join(', ')}.`; return; }

    pedido = { ...data, folio: (pedido && pedido.folio) || nuevoFolio() };
    el.bankRef.textContent = pedido.folio;
    actualizarMetodo();
    goTo('payment');
    track('add_shipping_info', gaCart({ shipping_tier: data.punto }));
  });

  /* ---------- Paso 3: pago (SIMULACIÓN) ----------
     Nada de esto se guarda ni se envía: solo se valida el formato.
     Al integrar Mercado Pago, este paso se sustituye por su checkout. */
  const metodo = () => el.pay.metodo.value;
  const digits = (s) => s.replace(/\D/g, '');

  const marca = (num) => {
    if (/^4/.test(num)) return 'Visa';
    if (/^(5[1-5]|2[2-7])/.test(num)) return 'Mastercard';
    if (/^3[47]/.test(num)) return 'American Express';
    return '';
  };
  const luhn = (num) => {
    let sum = 0;
    [...num].reverse().forEach((ch, i) => {
      let n = Number(ch);
      if (i % 2) { n *= 2; if (n > 9) n -= 9; }
      sum += n;
    });
    return num.length >= 13 && sum % 10 === 0;
  };

  const actualizarMetodo = () => {
    $$('.pay-panel', el.pay).forEach((p) => { p.hidden = p.dataset.panel !== metodo(); });
    el.paySubmit.textContent = metodo() === 'tarjeta' ? `Pagar ${money(total())}` : 'Confirmar transferencia';
    el.payError.textContent = '';
  };
  el.pay.addEventListener('change', (e) => { if (e.target.name === 'metodo') actualizarMetodo(); });

  // Formato mientras se escribe: 4242 4242 4242 4242 y MM/AA
  el.card.addEventListener('input', () => {
    const n = digits(el.card.value).slice(0, 19);
    el.card.value = n.replace(/(\d{4})(?=\d)/g, '$1 ');
    el.cardBrand.textContent = marca(n);
  });
  el.exp.addEventListener('input', () => {
    const n = digits(el.exp.value).slice(0, 4);
    el.exp.value = n.length > 2 ? `${n.slice(0, 2)}/${n.slice(2)}` : n;
  });
  el.cvv.addEventListener('input', () => { el.cvv.value = digits(el.cvv.value).slice(0, 4); });

  $('#fillTestCard').addEventListener('click', () => {
    const y = String((new Date().getFullYear() + 2) % 100).padStart(2, '0');
    el.card.value = '4242 4242 4242 4242';
    el.cardBrand.textContent = 'Visa';
    el.pay.titular.value = pedido ? pedido.nombre : 'Cliente de prueba';
    el.exp.value = `12/${y}`;
    el.cvv.value = '123';
  });

  const validarPago = () => {
    const f = el.pay;
    $$('.is-invalid', f).forEach((x) => x.classList.remove('is-invalid'));
    const errors = [];
    if (metodo() === 'tarjeta') {
      const num = digits(f.tarjeta.value);
      if (!luhn(num)) { errors.push('un número de tarjeta válido'); f.tarjeta.classList.add('is-invalid'); }
      if (f.titular.value.trim().length < 3) { errors.push('el nombre del titular'); f.titular.classList.add('is-invalid'); }
      const [mm, yy] = f.vence.value.split('/').map(Number);
      const now = new Date();
      const vencida = !mm || mm > 12 || !yy || (2000 + yy) * 12 + mm < now.getFullYear() * 12 + now.getMonth() + 1;
      if (vencida) { errors.push('una fecha de vencimiento vigente'); f.vence.classList.add('is-invalid'); }
      const cvvLen = marca(num) === 'American Express' ? 4 : 3;
      if (f.cvv.value.length !== cvvLen) { errors.push(`un CVV de ${cvvLen} dígitos`); f.cvv.classList.add('is-invalid'); }
      return { errors, texto: `Tarjeta ${marca(num) || ''} •••• ${num.slice(-4)} — aprobado`.replace('  ', ' '), tipo: 'Tarjeta' };
    }
    if (!f.banco.value) { errors.push('el banco desde el que transfieres'); f.banco.classList.add('is-invalid'); }
    if (!f.transferido.checked) errors.push('confirmar que ya hiciste la transferencia');
    return { errors, texto: `Transferencia SPEI desde ${f.banco.value} — por verificar`, tipo: 'Transferencia' };
  };

  el.pay.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!pedido || !pieces()) { goTo('checkout'); return; }
    const { errors, texto, tipo } = validarPago();
    if (errors.length) { el.payError.textContent = `Falta: ${errors.join(', ')}.`; return; }

    track('add_payment_info', gaCart({ payment_type: tipo }));
    el.paySubmit.disabled = true;
    el.paySubmit.textContent = 'Procesando…';

    setTimeout(() => { // simula la respuesta del procesador de pagos
      const data = { ...pedido, pagoTexto: texto };
      const esTarjeta = tipo === 'Tarjeta';
      $('#doneTitle').textContent = esTarjeta ? 'Pago aprobado' : 'Transferencia registrada';
      $('#doneText').textContent = esTarjeta
        ? `Recibimos tu pago. Te esperamos en ${pedido.punto} el ${fechaLarga(pedido.fecha)}.`
        : `En cuanto verifiquemos tu transferencia confirmamos tu pedido para recoger en ${pedido.punto} el ${fechaLarga(pedido.fecha)}.`;
      $('#doneFolio').textContent = pedido.folio;
      $('#donePay').textContent = esTarjeta ? texto.split(' — ')[0] : 'Transferencia (por verificar)';
      $('#doneTotal').textContent = money(total());
      el.waSend.href = `https://wa.me/${CONFIG.whatsapp}?text=${encodeURIComponent(buildMessage(data))}`;

      track('purchase', gaCart({ transaction_id: pedido.folio, payment_type: tipo }));

      // Limpia los datos de pago: no se conservan en ningún lado
      el.card.value = ''; el.cvv.value = ''; el.exp.value = ''; el.pay.titular.value = '';
      el.cardBrand.textContent = '';
      el.paySubmit.disabled = false;

      // Pedido cerrado: se vacía el carrito para no pagarlo dos veces
      state = { items: {}, free: [] };
      pedido = null;
      el.form.reset();
      el.pay.reset();
      actualizarMetodo();
      render();
      goTo('done');
    }, 1400);
  });

  $('#cartReset').addEventListener('click', close);

  render();
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
    track('generate_lead', { lead_source: 'newsletter' });
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
