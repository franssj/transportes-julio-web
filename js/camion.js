/* =====================================================================
   camion.js: la lógica del camión, compartida por "Cómo trabajamos"
   (main.js) y el indicador de pasos del cotizador (cotizador.js).
   Se carga antes que ellos. Es lo único del sitio que expone un global.
   Mueve el camión solo con transform; las ruedas giran por CSS mientras
   el camión tiene la clase is-moving (is-reversing, marcha atrás).
   ===================================================================== */
(() => {
  'use strict';

  const CURVA = 'cubic-bezier(.65, 0, .35, 1)';
  const FRENADO_MS = 100;   // ida y vuelta: 200ms en total
  const FRENADO_PX = 4;
  const FRENTE = 112 / 116;   // dónde termina el dibujo del camión, sobre su ancho

  const sinMovimiento = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  window.JulioCamion = {
    /* contenedor: elemento que contiene el camino, siempre horizontal.
       marcas: elementos de cada parada, o una función que los devuelve si cambian según el ancho.
       duracion: milisegundos de cada tramo, o una función que los devuelve si cambian según el ancho.
       anclaFrente: el frente queda sobre la parada; si no se indica, el centro del camión. */
    crear({ contenedor, camion, recorrido, marcas, duracion, anclaFrente = false }) {
      let paradas = [];
      let largo = 1;
      let mitad = 0;
      let indice = 0;
      let alFinal = false;
      let posicion = 0;
      let moviendo = false;
      let medirAlTerminar = false;
      let espera = 0;
      let terminar = null;

      const aplicar = (pos, ms, curva = CURVA) => {
        const transicion = ms ? `transform ${ms}ms ${curva}` : 'none';
        camion.style.transition = transicion;
        recorrido.style.transition = transicion;
        camion.style.transform = `translate3d(${pos - mitad}px, 0, 0)`;
        recorrido.style.transform = `scaleX(${pos / largo})`;
      };

      const destino = () => (alFinal ? largo - mitad : paradas[indice]);

      const medir = () => {
        if (moviendo) { medirAlTerminar = true; return; }
        const caja = contenedor.getBoundingClientRect();
        if (!caja.width) return;
        const lista = typeof marcas === 'function' ? marcas() : marcas;
        paradas = lista.map(marca => {
          const m = marca.getBoundingClientRect();
          return m.left + m.width / 2 - caja.left;
        });
        largo = caja.width;
        mitad = camion.offsetWidth * (anclaFrente ? FRENTE : 0.5);
        posicion = destino();
        aplicar(posicion, 0);
      };

      const llegar = () => {
        clearTimeout(espera);
        moviendo = false;
        camion.classList.remove('is-moving', 'is-reversing');
        const avisar = terminar;
        terminar = null;
        if (medirAlTerminar) { medirAlTerminar = false; medir(); }
        if (avisar) avisar();
      };

      // Devuelve una promesa que se cumple cuando el camión llega (o si otro viaje lo reemplaza).
      const viajar = (hasta, ms) => new Promise(resolver => {
        if (terminar) { const anterior = terminar; terminar = null; anterior(); }
        if (hasta === posicion || sinMovimiento() || !paradas.length) {
          clearTimeout(espera);
          moviendo = false;
          camion.classList.remove('is-moving', 'is-reversing');
          posicion = hasta;
          aplicar(hasta, 0);
          resolver();
          return;
        }
        camion.classList.toggle('is-reversing', hasta < posicion);
        camion.classList.add('is-moving');
        moviendo = true;
        posicion = hasta;
        aplicar(hasta, ms);
        terminar = resolver;
        clearTimeout(espera);
        espera = setTimeout(llegar, ms);
      });

      medir();
      window.addEventListener('resize', medir, { passive: true });
      window.addEventListener('load', medir);
      if (document.fonts) document.fonts.ready.then(medir);
      if ('ResizeObserver' in window) new ResizeObserver(medir).observe(contenedor);

      return {
        irA(i) {
          indice = i;
          alFinal = false;
          return viajar(paradas[i], typeof duracion === 'function' ? duracion() : duracion);
        },
        irAlFinal() {
          alFinal = true;
          return viajar(largo - mitad, typeof duracion === 'function' ? duracion() : duracion);
        },
        // Acompaña un desplazamiento en tiempo real: 1.5 es la mitad del camino entre la parada 1 y la 2.
        seguir(fraccion) {
          if (sinMovimiento() || !paradas.length) return;
          if (terminar) { const anterior = terminar; terminar = null; anterior(); }
          clearTimeout(espera);
          moviendo = false;
          const f = Math.min(Math.max(fraccion, 0), paradas.length - 1);
          const a = Math.floor(f);
          const b = Math.min(a + 1, paradas.length - 1);
          posicion = paradas[a] + (paradas[b] - paradas[a]) * (f - a);
          camion.classList.add('is-moving');
          aplicar(posicion, 0);
        },
        // No avanza: se mueve un poquito para adelante y vuelve.
        frenar() {
          if (moviendo || sinMovimiento() || !paradas.length) return;
          aplicar(posicion + FRENADO_PX, FRENADO_MS, 'ease-out');
          clearTimeout(espera);
          espera = setTimeout(() => aplicar(posicion, FRENADO_MS, 'ease-in'), FRENADO_MS);
        },
      };
    },
  };
})();
