/* =========================================================
   Google Analytics 4 · La Corteza
   ---------------------------------------------------------
   1. Crea una propiedad en https://analytics.google.com
      (Administrar → Crear → Propiedad → Flujo de datos "Web").
   2. Copia el "ID de medición" (empieza con G-) y pégalo abajo.
   Mientras el ID esté vacío no se carga nada de Google: los
   eventos solo se muestran en la consola (nivel "Verbose").
   ========================================================= */
const GA_MEASUREMENT_ID = 'G-6W2TNZ89QP';

window.dataLayer = window.dataLayer || [];
function gtag() { window.dataLayer.push(arguments); }

if (GA_MEASUREMENT_ID) {
  const s = document.createElement('script');
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
  document.head.appendChild(s);
  gtag('js', new Date());
  gtag('config', GA_MEASUREMENT_ID);
}

/* Envía un evento. Nunca mandes nombre, teléfono ni correo del cliente. */
window.track = (name, params = {}) => {
  if (GA_MEASUREMENT_ID) gtag('event', name, params);
  else console.debug('[analytics]', name, params);
};
