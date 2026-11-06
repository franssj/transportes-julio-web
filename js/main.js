/* =====================================================================
   main.js: comportamiento general (home y páginas de localidad).
   Header, menú, página actual, anclas, sección activa, animaciones, parallax,
   horarios, año, preselección de servicio y WhatsApp fijo.
   Cada parte tolera que su elemento no exista.
   ===================================================================== */
(() => {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  /* HORARIOS: todos los textos visibles se cambian acá, en un solo lugar. Cada página los toma con
     data-horario. El horario del local también figura en openingHoursSpecification, en el JSON-LD de cada HTML. */
  const HORARIOS = {
    whatsapp: 'WhatsApp las 24 horas',
    local: 'Lunes a viernes de 7:30 a 19 h · Sábados de 7:30 a 13 h',
    semana: '7:30 a 19 h',
    sabado: '7:30 a 13 h',
    domingo: 'Cerrado',
    corto: 'Lun. a vie. 7:30 a 19 h · Sáb. 7:30 a 13 h',
  };
  // Los mismos horarios, en minutos desde las 0 h: alimentan el "Abierto ahora". 0 es domingo.
  const HORARIO_LOCAL = { 1: [450, 1140], 2: [450, 1140], 3: [450, 1140], 4: [450, 1140], 5: [450, 1140], 6: [450, 780] };
  $$('[data-horario]').forEach(el => { el.textContent = HORARIOS[el.dataset.horario]; });

  const ZONA_HORARIA = 'America/Argentina/Buenos_Aires';
  const hayObserver = 'IntersectionObserver' in window;
  const sinMovimiento = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let marcaFijada = false;   // mientras dura un scroll iniciado por un link

  /* ---------- Header y WhatsApp según el scroll ----------
     Al bajar, el header se mete y deja visible solo la fila de links (en pantallas sin menú completo);
     al subir, vuelve entero. El botón de WhatsApp se contrae después de 120px. */
  const header = $('#site-header');
  const filaLinks = $('.site-row');
  const flotante = $('#whatsapp-float');
  let ultimoY = window.scrollY;

  const compactar = si => { if (header) header.classList.toggle('is-compact', si); };

  if (header) {
    const alScrollear = () => {
      const y = window.scrollY;
      const scrolleado = y > 8;
      header.classList.toggle('is-scrolled', scrolleado);
      if (flotante) flotante.classList.toggle('is-compact', y > 120);

      if (marcaFijada) { ultimoY = y; return; }
      if (y <= 80) { compactar(false); ultimoY = y; return; }
      if (Math.abs(y - ultimoY) < 6) return;
      compactar(y > ultimoY);
      ultimoY = y;
    };
    compactar(window.scrollY > 80);
    alScrollear();
    window.addEventListener('scroll', alScrollear, { passive: true });
  }

  /* ---------- Links a la página actual ---------- */
  const rutaNormal = ruta => ruta.replace(/index\.html$/, '').replace(/\/?$/, '/');
  const rutaActual = rutaNormal(window.location.pathname);
  const esMismaPagina = link => link.origin === window.location.origin && rutaNormal(link.pathname) === rutaActual;

  $$('a[href]').forEach(link => {
    if (link.hash || link.getAttribute('href').charAt(0) === '#') return;
    if (esMismaPagina(link)) link.setAttribute('aria-current', 'page');
  });

  /* ---------- Links internos: foco ---------- */
  // El scroll lo hace el navegador (con scroll-behavior de CSS); acá solo se mueve el foco.
  const enfocar = destino => {
    if (!destino.matches('a[href], button, input, select, textarea, [tabindex]')) destino.setAttribute('tabindex', '-1');
    destino.focus({ preventScroll: true });
  };

  document.addEventListener('click', e => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const link = e.target.closest ? e.target.closest('a[href]') : null;
    if (!link) return;

    // Un link que abre otra pestaña se queda con el foco: al volver, el navegador le dibuja el
    // contorno aunque se haya usado el mouse. Con teclado (detail 0) el foco se conserva.
    if (link.target === '_blank' && e.detail > 0) link.blur();

    // Los links a otra página (como "../#zonas") navegan normalmente.
    if (!esMismaPagina(link) || link.hash.length < 2) return;
    const destino = document.getElementById(link.hash.slice(1));
    if (!destino) return;
    enfocar(destino);
    marcarDesdeLink(destino.id);
  });

  /* ---------- Altura real del header y sección activa ----------
     --header-h define dónde cae el encabezado de cada sección al navegar (ver scroll-margin-top
     en el CSS) y la línea de referencia para saber qué sección está activa.
     La línea amarilla usa posiciones ya medidas: durante el scroll no se lee el layout. */
  const raiz = document.documentElement;
  const linea = $('#site-nav-indicator');
  const secciones = $$('.section__header[id], #cierre');
  const linksDeSeccion = $$('.site-nav__link, .site-row__link').filter(l => l.hash.length > 1 && esMismaPagina(l));
  const posicionesLinks = new Map();
  const ANCHO_BASE_LINEA = 100;    // el mismo valor que width en .site-nav__indicator
  const HISTERESIS = 48;           // margen para que no salte entre dos secciones en el límite
  const yaCruzadas = new Set();
  let vigias = [];
  let idActiva = '';
  let esperaMarca = 0;
  let maximoFila = 0;
  let cuadroLinea = 0;

  const medirLinks = () => {
    if (!linea) return;
    const base = linea.parentElement.getBoundingClientRect();
    posicionesLinks.clear();
    linksDeSeccion.filter(l => l.classList.contains('site-nav__link')).forEach(link => {
      const caja = link.getBoundingClientRect();
      posicionesLinks.set(link.hash.slice(1), { x: caja.left - base.left, ancho: caja.width });
    });
  };

  // Fila de links: marca si quedan más links hacia la derecha.
  const revisarBordesFila = () => {
    if (filaLinks) filaLinks.classList.toggle('has-more-end', filaLinks.scrollLeft < maximoFila - 4);
  };

  const medirFila = () => {
    if (!filaLinks) return;
    maximoFila = filaLinks.scrollWidth - filaLinks.clientWidth;
    revisarBordesFila();
  };

  // Lleva el link activo al centro de la fila, sin mover la página.
  const centrarEnFila = () => {
    if (!filaLinks || maximoFila <= 0) return;
    const link = linksDeSeccion.find(l => l.classList.contains('site-row__link') && l.hash.slice(1) === idActiva);
    if (link) link.scrollIntoView({ behavior: sinMovimiento ? 'auto' : 'smooth', block: 'nearest', inline: 'center' });
  };

  if (filaLinks) filaLinks.addEventListener('scroll', revisarBordesFila, { passive: true });

  const pintarLinea = animar => {
    if (!linea) return;
    const destino = posicionesLinks.get(idActiva);
    if (!destino) { linea.classList.remove('is-visible'); return; }

    const sinDeslizar = !animar || !linea.classList.contains('is-visible');
    linea.classList.toggle('sin-transicion', sinDeslizar);
    linea.style.transform = `translateX(${destino.x}px) scaleX(${destino.ancho / ANCHO_BASE_LINEA})`;
    linea.classList.add('is-visible');
    if (sinDeslizar) window.requestAnimationFrame(() => linea.classList.remove('sin-transicion'));
  };

  // Solo actúa si cambió la sección activa, y la línea se mueve dentro de un cuadro.
  const marcarActiva = id => {
    if (id === idActiva) return;
    idActiva = id;
    linksDeSeccion.forEach(link => {
      if (link.hash.slice(1) === id) link.setAttribute('aria-current', 'true');
      else link.removeAttribute('aria-current');
    });
    window.cancelAnimationFrame(cuadroLinea);
    cuadroLinea = window.requestAnimationFrame(() => {
      pintarLinea(true);
      centrarEnFila();
    });
  };

  const revisarActiva = () => {
    if (marcaFijada) return;
    const actual = secciones.filter(s => yaCruzadas.has(s)).pop();
    marcarActiva(actual ? actual.id : '');
  };

  // Al tocar un link queda marcado; el vigía vuelve a mandar recién cuando termina ese scroll.
  const soltarMarca = () => {
    if (!marcaFijada) return;
    clearTimeout(esperaMarca);
    marcaFijada = false;
    ultimoY = window.scrollY;
    if (ultimoY <= 80) compactar(false);
    revisarActiva();
  };

  // Mientras dura el viaje el header queda compacto: es la altura con la que se calcula dónde cae cada sección.
  const fijarHeader = () => {
    marcaFijada = true;
    compactar(true);
    clearTimeout(esperaMarca);
    esperaMarca = setTimeout(soltarMarca, 400);
  };

  function marcarDesdeLink(id) {
    fijarHeader();
    marcarActiva(id);
  }

  // El cotizador avisa cuando se desplaza solo, al cambiar de paso.
  document.addEventListener('julio:scroll-programado', fijarHeader);

  // Con Atrás y Adelante, o escribiendo el ancla en la dirección, tampoco se abre en el viaje.
  window.addEventListener('hashchange', fijarHeader);

  window.addEventListener('scroll', () => {
    if (!marcaFijada) return;
    clearTimeout(esperaMarca);
    esperaMarca = setTimeout(soltarMarca, 150);
  }, { passive: true });
  window.addEventListener('scrollend', soltarMarca, { passive: true });

  // Referencia: la franja justo debajo del header. Una sección se activa al cruzar la línea, y deja de
  // estarlo recién al volver HISTERESIS px más abajo. El margen superior enorme hace que todo lo que ya
  // pasó siga contando, así que un scroll rápido no se saltea ninguna sección.
  const crearVigias = (alto, ventana) => {
    if (!hayObserver || !secciones.length) return;
    vigias.forEach(v => v.disconnect());
    yaCruzadas.clear();
    const referencia = Math.round(alto + 40);
    const margen = y => `100000px 0px ${y - ventana}px 0px`;
    const alEntrar = new IntersectionObserver(entradas => {
      entradas.forEach(e => { if (e.isIntersecting) yaCruzadas.add(e.target); });
      revisarActiva();
    }, { rootMargin: margen(referencia) });
    const alSalir = new IntersectionObserver(entradas => {
      entradas.forEach(e => { if (!e.isIntersecting) yaCruzadas.delete(e.target); });
      revisarActiva();
    }, { rootMargin: margen(referencia + HISTERESIS) });
    vigias = [alEntrar, alSalir];
    secciones.forEach(s => { alEntrar.observe(s); alSalir.observe(s); });
  };

  /* ---------- Medidas ----------
     Todo lo que depende del layout se mide acá: al cargar, al cambiar el tamaño y cuando cargan
     las fuentes. El scroll trabaja solo con estos valores guardados. */
  const alMedir = [];
  let altoMedido = -1;
  let ventanaMedida = -1;
  let medicionPedida = false;

  const medirTodo = () => {
    medicionPedida = false;
    if (header) {
      // Las secciones se ubican según el header ya scrolleado: con fila de links, solo esa fila;
      // en desktop, 68px (--header-compacto). Así no depende de dónde arranque el scroll.
      const completo = header.getBoundingClientRect().height;
      const interior = $('.site-header__inner', header).getBoundingClientRect().height;
      const compacto = parseFloat(window.getComputedStyle(raiz).getPropertyValue('--header-compacto')) || 0;
      const alto = completo - interior + compacto;
      const ventana = window.innerHeight;
      if (alto !== altoMedido || ventana !== ventanaMedida) {
        altoMedido = alto;
        ventanaMedida = ventana;
        raiz.style.setProperty('--header-h', `${alto}px`);
        crearVigias(alto, ventana);
      }
    }
    medirLinks();
    medirFila();
    pintarLinea(false);
    alMedir.forEach(medir => medir());
  };

  const pedirMedicion = () => {
    if (medicionPedida) return;
    medicionPedida = true;
    window.requestAnimationFrame(medirTodo);
  };

  // Al llegar desde otra página: la posición se ajusta cuando ya cargaron fuentes e imágenes.
  if (window.location.hash.length > 1) {
    window.addEventListener('load', () => {
      const destino = document.getElementById(window.location.hash.slice(1));
      if (!destino) return;
      const ubicar = () => {
        fijarHeader();   // este ajuste puede ser hacia arriba: no tiene que volver a abrir el header
        destino.scrollIntoView({ behavior: 'instant', block: 'start' });
      };
      if (document.fonts) document.fonts.ready.then(ubicar);
      else ubicar();
    });
  }

  /* ---------- Animaciones de entrada ----------
     Se animan una sola vez. Solo se oculta lo que está debajo del pliegue al cargar: lo que
     ya se ve nunca parpadea, y sin JS, sin IntersectionObserver o con reduced-motion todo queda visible. */
  if (hayObserver && !sinMovimiento) {
    // En un carrusel de mobile, las tarjetas de costado no se ocultan.
    const esMobile = window.matchMedia('(max-width: 47.99rem)').matches;
    $$('[data-stagger]').forEach(grupo => {
      if (esMobile && grupo.hasAttribute('data-carrusel')) return;
      [...grupo.children].forEach((hijo, i) => {
        hijo.classList.add('reveal');
        hijo.style.setProperty('--i', String(Math.min(i, 5)));
      });
    });

    const reveal = new IntersectionObserver(entradas => entradas.forEach(e => {
      if (!e.isIntersecting) return;
      e.target.classList.remove('is-pending');
      reveal.unobserve(e.target);
    }), { rootMargin: '0px 0px -15% 0px' });

    $$('.reveal, .reveal--left, .reveal--right, .reveal--scale').forEach(el => {
      if (el.getBoundingClientRect().top < window.innerHeight) return;
      el.classList.add('is-pending');
      reveal.observe(el);
      // Terminada la entrada, sin demoras heredadas: :active tiene que responder enseguida.
      el.addEventListener('transitionend', () => {
        if (!el.classList.contains('is-pending')) el.classList.remove('reveal');
      }, { once: true });
    });
  }

  /* ---------- Parallax de fotos, solo en desktop ----------
     Mueve las fotos con transform y rAF, y solo las que están a la vista. El CSS extiende
     cada foto lo necesario para que no aparezcan huecos: 30% arriba el hero, 20% las franjas. */
  const fotosParallax = $$('[data-parallax]');
  const esDesktop = window.matchMedia('(min-width: 64rem)');
  if (fotosParallax.length && hayObserver && !sinMovimiento) {
    const visibles = new Set();
    const cajas = new Map();
    let pendiente = false;

    const mover = () => {
      pendiente = false;
      const centroVentana = ventanaMedida / 2;
      const scroll = window.scrollY;
      visibles.forEach(foto => {
        const caja = cajas.get(foto);
        if (!caja) return;
        const esHero = foto.dataset.parallax === 'hero';
        const maximo = caja.alto * (esHero ? 0.3 : 0.2);
        const y = (centroVentana - (caja.arriba - scroll + caja.alto / 2)) * 0.3;
        foto.style.transform = `translate3d(0, ${Math.max(esHero ? 0 : -maximo, Math.min(maximo, y))}px, 0)`;
      });
    };

    const pedirCuadro = () => {
      if (pendiente || !esDesktop.matches) return;
      pendiente = true;
      window.requestAnimationFrame(mover);
    };

    alMedir.push(() => {
      if (!esDesktop.matches) {
        fotosParallax.forEach(foto => { foto.style.transform = ''; });
        return;
      }
      fotosParallax.forEach(foto => {
        const caja = foto.closest('section').getBoundingClientRect();
        cajas.set(foto, { arriba: caja.top + window.scrollY, alto: caja.height });
      });
      pedirCuadro();
    });

    const vigia = new IntersectionObserver(entradas => {
      entradas.forEach(e => {
        const foto = e.target.querySelector('[data-parallax]');
        if (e.isIntersecting) visibles.add(foto);
        else visibles.delete(foto);
      });
      pedirCuadro();
    });
    fotosParallax.forEach(foto => vigia.observe(foto.closest('section')));

    window.addEventListener('scroll', pedirCuadro, { passive: true });
  }

  /* ---------- Cómo trabajamos: el camión avanza cuando la persona toca ----------
     Cada paso es un botón. El camión espera en el paso 1, y cada descripción se revela cuando el
     camión frena en su parada; una vez revelada, queda. Sin JS se ven todos los pasos encendidos,
     y con reduced-motion todas las descripciones, sin pulso ni indicios.
     En mobile se ve un paso por vez: se desliza con el dedo y el camino chico acompaña. */
  const ruta = $('#ruta');
  if (ruta && window.JulioCamion) {
    const pasosRuta = $$('.step', ruta);
    const botonesRuta = pasosRuta.map(paso => $('.step__btn', paso));
    const numerosRuta = pasosRuta.map(paso => $('.step__number', paso));
    const puntosRuta = $$('.route__dot', ruta);
    const filaPasos = $('.route__steps', ruta);
    const estadoRuta = $('#ruta-estado');
    const controles = $('#ruta-controles');
    const avisoRuta = $('#ruta-aviso');
    const siguiente = controles ? $('[data-ruta="siguiente"]', controles) : null;
    const textoSiguiente = siguiente ? $('[data-ruta-texto]', siguiente) : null;
    const enFila = window.matchMedia('(min-width: 48rem)');
    const ultimoPaso = pasosRuta.length - 1;
    const camion = window.JulioCamion.crear({
      contenedor: ruta,
      camion: $('.route__truck', ruta),
      recorrido: $('.route__done', ruta),
      marcas: () => (enFila.matches ? numerosRuta : puntosRuta),
      duracion: () => (enFila.matches ? 900 : 450),
      anclaFrente: true,
    });
    let activo = 0;
    let volverAlInicio = false;
    let yaInteractuo = false;
    let filaProgramada = false;
    let esperaFila = 0;
    let anchoPaso = 0;
    let cuadroFila = 0;
    let esperaSoltar = 0;

    const encender = i => {
      pasosRuta.forEach((paso, n) => {
        paso.classList.toggle('is-active', n === i);
        paso.classList.toggle('is-done', n < i);
        paso.classList.toggle('is-next', n === i + 1);
      });
      puntosRuta.forEach((punto, n) => {
        punto.classList.toggle('is-on', n <= i);
        punto.classList.toggle('is-next', n === i + 1);
      });
    };

    // El camión frenó: se revela la descripción y el pulso pasa a la parada siguiente.
    const alLlegar = i => {
      encender(i);
      pasosRuta[i].classList.add('is-revealed');
      volverAlInicio = i === ultimoPaso;
      if (textoSiguiente) textoSiguiente.textContent = volverAlInicio ? 'Volver a empezar' : 'Siguiente';
    };

    // Mobile: lleva la tarjeta del paso a la vista, sin mover la página.
    const mostrarTarjeta = i => {
      if (enFila.matches) return;
      filaProgramada = true;
      clearTimeout(esperaFila);
      esperaFila = setTimeout(() => { filaProgramada = false; }, 800);
      filaPasos.scrollTo({ left: pasosRuta[i].offsetLeft - pasosRuta[0].offsetLeft, behavior: sinMovimiento ? 'auto' : 'smooth' });
    };

    const irAlPasoRuta = (i, moverTarjeta = true) => {
      activo = i;
      botonesRuta.forEach((boton, n) => boton.setAttribute('aria-pressed', String(n === i)));
      if (controles) $('[data-ruta="anterior"]', controles).setAttribute('aria-disabled', String(i === 0));
      if (moverTarjeta) mostrarTarjeta(i);
      return camion.irA(i).then(() => { if (activo === i) alLlegar(i); });
    };

    const marcarInteraccion = () => {
      yaInteractuo = true;
      ruta.classList.add('route--tocada');
      if (avisoRuta) avisoRuta.classList.remove('is-visible');
    };

    const elegir = (i, moverTarjeta = true) => {
      marcarInteraccion();
      if (i < 0 || i > ultimoPaso || i === activo) return;
      irAlPasoRuta(i, moverTarjeta);
      if (estadoRuta) estadoRuta.textContent = `Paso ${i + 1}: ${$('.step__title', pasosRuta[i]).textContent}`;
    };

    ruta.classList.add('route--live');
    if (!sinMovimiento) ruta.classList.add('route--interactive');
    alLlegar(0);
    irAlPasoRuta(0, false);

    pasosRuta.forEach((paso, i) => paso.addEventListener('click', () => elegir(i)));

    // Tab avanza igual que el toque. Con el mouse, el foco no es visible y lo resuelve el clic.
    botonesRuta.forEach((boton, i) => boton.addEventListener('focus', () => {
      if (boton.matches(':focus-visible')) elegir(i);
    }));

    ruta.addEventListener('keydown', e => {
      const actual = botonesRuta.indexOf(e.target);
      if (actual === -1 || (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight')) return;
      const nuevo = actual + (e.key === 'ArrowRight' ? 1 : -1);
      if (nuevo < 0 || nuevo > ultimoPaso) return;
      e.preventDefault();
      botonesRuta[nuevo].focus();
      elegir(nuevo);
    });

    if (controles) {
      controles.hidden = false;
      $('[data-ruta="anterior"]', controles).addEventListener('click', () => elegir(activo - 1));
      siguiente.addEventListener('click', () => elegir(volverAlInicio ? 0 : activo + 1));
    }

    // Mobile: mientras el dedo arrastra la tarjeta, el camión avanza en proporción.
    // Al soltar, se acomoda en la parada del paso visible.
    alMedir.push(() => {
      anchoPaso = pasosRuta.length > 1 ? pasosRuta[1].offsetLeft - pasosRuta[0].offsetLeft : 0;
    });

    const soltarFila = () => {
      const visible = Math.round(filaPasos.scrollLeft / anchoPaso);
      if (visible !== activo) elegir(visible, false);
      else camion.irA(activo).then(() => { if (activo === visible) alLlegar(visible); });
    };

    filaPasos.addEventListener('scroll', () => {
      if (enFila.matches || filaProgramada || !anchoPaso) return;
      marcarInteraccion();
      window.cancelAnimationFrame(cuadroFila);
      cuadroFila = window.requestAnimationFrame(() => camion.seguir(filaPasos.scrollLeft / anchoPaso));
      clearTimeout(esperaSoltar);
      esperaSoltar = setTimeout(soltarFila, 120);
    }, { passive: true });

    // El indicio aparece al entrar la sección en pantalla, si todavía no hubo ningún toque.
    if (avisoRuta && !sinMovimiento) {
      avisoRuta.hidden = false;
      const mostrarAviso = () => { if (!yaInteractuo) avisoRuta.classList.add('is-visible'); };
      if (hayObserver) {
        const vigiaAviso = new IntersectionObserver(entradas => {
          if (!entradas[entradas.length - 1].isIntersecting) return;
          vigiaAviso.disconnect();
          mostrarAviso();
        }, { threshold: 0.25 });
        vigiaAviso.observe(ruta);
      } else {
        mostrarAviso();
      }
    }
  }

  /* ---------- Por qué elegirnos: los números cuentan desde 0, una sola vez ----------
     Sin JS o con reduced-motion queda el valor final del HTML. */
  const contadores = $$('[data-contar]');
  if (contadores.length && hayObserver && !sinMovimiento) {
    const DURACION_CUENTA = 800;

    // Reemplaza el texto en cada cuadro. Hasta entrar en pantalla queda el valor final del HTML.
    const contar = () => {
      const inicio = window.performance.now();
      const cuadro = ahora => {
        const t = Math.min(Math.max(ahora - inicio, 0) / DURACION_CUENTA, 1);
        const avance = 1 - (1 - t) ** 3;   // ease-out
        contadores.forEach(el => { el.textContent = String(Math.round(Number(el.dataset.contar) * avance)); });
        if (t < 1) window.requestAnimationFrame(cuadro);
      };
      contadores.forEach(el => { el.textContent = '0'; });
      window.requestAnimationFrame(cuadro);
    };

    const vigiaCuenta = new IntersectionObserver(entradas => {
      if (!entradas[entradas.length - 1].isIntersecting) return;
      vigiaCuenta.disconnect();
      contar();
    }, { rootMargin: '0px 0px -15% 0px' });
    vigiaCuenta.observe(contadores[0].closest('.why__list'));
  }

  /* ---------- Carruseles: una barra fina avanza con el scroll ---------- */
  $$('[data-carrusel]').forEach(carrusel => {
    const barra = carrusel.nextElementSibling;
    const relleno = barra ? $('span', barra) : null;
    if (!relleno) return;
    barra.hidden = false;
    let cuadro = 0;
    let anchoTotal = 1;
    let anchoVisible = 1;
    const pintar = () => { relleno.style.transform = `scaleX(${Math.min((anchoVisible + carrusel.scrollLeft) / anchoTotal, 1)})`; };
    alMedir.push(() => {
      anchoTotal = carrusel.scrollWidth || 1;
      anchoVisible = carrusel.clientWidth;
      pintar();
    });
    carrusel.addEventListener('scroll', () => {
      window.cancelAnimationFrame(cuadro);
      cuadro = window.requestAnimationFrame(pintar);
    }, { passive: true });
  });

  /* ---------- Progreso de lectura ---------- */
  const barraLectura = $('#barra-lectura');
  if (barraLectura && !sinMovimiento) {
    let recorrido = 1;
    let cuadro = 0;
    const pintar = () => { barraLectura.style.transform = `scaleX(${Math.min(window.scrollY / recorrido, 1)})`; };
    alMedir.push(() => {
      recorrido = Math.max(raiz.scrollHeight - window.innerHeight, 1);
      pintar();
    });
    window.addEventListener('scroll', () => {
      window.cancelAnimationFrame(cuadro);
      cuadro = window.requestAnimationFrame(pintar);
    }, { passive: true });
  }

  /* ---------- Preguntas: en mobile, las 5 primeras a la vista ---------- */
  const botonPreguntas = $('.faq__mas');
  if (botonPreguntas) {
    const listaPreguntas = botonPreguntas.previousElementSibling;
    listaPreguntas.classList.add('faq--plegada');
    botonPreguntas.hidden = false;
    botonPreguntas.addEventListener('click', () => {
      const primera = $('.faq__item--extra summary', listaPreguntas);
      listaPreguntas.classList.remove('faq--plegada');
      botonPreguntas.hidden = true;
      if (primera) primera.focus();
    });
  }

  /* ---------- Abierto ahora o cerrado, en la hora de Buenos Aires ---------- */
  const estadoLocal = $('#estado-local');
  if (estadoLocal) {
    try {
      const partes = new Intl.DateTimeFormat('en-US', { timeZone: ZONA_HORARIA, weekday: 'short', hour: 'numeric', minute: 'numeric', hourCycle: 'h23' }).formatToParts(new Date());
      const parte = tipo => partes.find(p => p.type === tipo).value;
      const dia = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(parte('weekday'));
      const minutos = Number(parte('hour')) * 60 + Number(parte('minute'));
      const turno = HORARIO_LOCAL[dia];
      const abierto = Boolean(turno) && minutos >= turno[0] && minutos < turno[1];
      estadoLocal.textContent = abierto ? 'Abierto ahora' : 'Cerrado';
      estadoLocal.classList.toggle('is-abierto', abierto);
      estadoLocal.hidden = false;
    } catch (error) {
      // Sin soporte de zonas horarias no se muestra: mejor nada que un dato equivocado.
    }
  }

  /* ---------- Día de hoy en la tabla de horarios ---------- */
  // Día de la semana en Argentina (0 = domingo), sin importar la zona del dispositivo.
  const diaDeHoy = () => {
    const dias = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    try {
      const nombre = new Intl.DateTimeFormat('en-US', { timeZone: ZONA_HORARIA, weekday: 'short' }).format(new Date());
      if (nombre in dias) return dias[nombre];
    } catch (error) {
      // Sin soporte de zonas horarias se usa el día del dispositivo.
    }
    return new Date().getDay();
  };

  const filaHoy = $(`#horarios tr[data-dia="${diaDeHoy()}"]`);
  if (filaHoy) {
    filaHoy.classList.add('is-today');
    filaHoy.setAttribute('aria-current', 'date');
    const celda = $('th, td', filaHoy);
    if (celda) {
      const badge = document.createElement('span');
      badge.className = 'hours-table__badge';
      badge.textContent = 'Hoy';
      celda.append(' ', badge);
    }
  }

  /* ---------- Año del footer ---------- */
  const anio = $('#footer-year');
  if (anio) anio.textContent = String(new Date().getFullYear());

  /* ---------- WhatsApp fijo: se oculta con el cotizador en pantalla y con el teclado del celular abierto ---------- */
  const cotizador = $('.cotizador');
  // En mobile manda la barra fija del cotizador: la píldora vuelve apenas la barra se oculta.
  if (flotante && cotizador && hayObserver) {
    const conBarra = window.matchMedia('(max-width: 47.99rem)');
    let seccionVisible = false;
    let barraVisible = false;
    const revisarFlotante = () => flotante.classList.toggle('is-hidden', conBarra.matches ? barraVisible : seccionVisible);
    new IntersectionObserver(entradas => {
      seccionVisible = entradas[entradas.length - 1].isIntersecting;
      revisarFlotante();
    }).observe(cotizador);
    document.addEventListener('julio:barra-cotizador', e => {
      barraVisible = e.detail;
      revisarFlotante();
    });
    conBarra.addEventListener('change', revisarFlotante);
  }
  if (flotante && window.visualViewport) {
    const revisarTeclado = () => {
      flotante.classList.toggle('is-keyboard', window.visualViewport.height < window.innerHeight * 0.75);
    };
    window.visualViewport.addEventListener('resize', revisarTeclado, { passive: true });
  }

  /* ---------- Foco del mapa ----------
     Con Tab el foco entra al iframe de Google, de otro origen, y :focus-within puede no
     enterarse. La ventana sí pierde el foco: en ese momento se marca el contenedor. */
  const mapa = $('.location__map');
  const iframeMapa = mapa ? $('iframe', mapa) || (mapa.matches('iframe') ? mapa : null) : null;
  if (iframeMapa) {
    const marco = iframeMapa === mapa ? mapa.parentElement : mapa;
    window.addEventListener('blur', () => {
      // Con el mouse sobre el mapa no se marca: el contorno es solo para teclado.
      if (document.activeElement === iframeMapa && !marco.matches(':hover')) marco.classList.add('is-focused');
    });
    window.addEventListener('focus', () => marco.classList.remove('is-focused'));
  }

  /* ---------- Primera medición y cuándo repetirla ---------- */
  medirTodo();
  window.addEventListener('resize', pedirMedicion, { passive: true });
  window.addEventListener('load', pedirMedicion);
  if (document.fonts) document.fonts.ready.then(pedirMedicion);
  if ('ResizeObserver' in window) {
    const observador = new ResizeObserver(pedirMedicion);
    if (header) observador.observe(header);
    observador.observe(document.body);
  }
})();
