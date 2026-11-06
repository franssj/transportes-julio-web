/**
 * cotizador.js — formulario de 4 pasos con vista previa del mensaje de WhatsApp.
 * El marcado está definido en el contrato de README.md.
 * Nada del usuario pasa por innerHTML: la vista previa se arma con createElement
 * y createTextNode, y la URL con encodeURIComponent.
 */
(function () {
  'use strict';

  var form = document.getElementById('cotizador-form');
  if (!form) return;

  var WHATSAPP_URL = 'https://wa.me/5491135478407?text=';
  var TOTAL_PASOS = 5;   // el último es Fecha; con guardamuebles se saltea el 4 (Destino)
  var MAX_POR_OBJETO = 99;
  var ESPERA_PREVIEW_MS = 300;

  var SERVICIOS = {
    mudanza: 'Mudanza',
    flete: 'Flete',
    muebles: 'Traslado de muebles',
    comercios: 'Reparto para comercio',
    interior: 'Viaje al interior',
    guardamuebles: 'Guardamuebles o baulera',
    otro: 'Otro'
  };

  // El orden de esta lista es el orden en el que salen en el mensaje.
  var OBJETOS = [
    { id: 'heladera', uno: 'heladera', varios: 'heladeras' },
    { id: 'lavarropas', uno: 'lavarropas', varios: 'lavarropas' },
    { id: 'cama', uno: 'cama', varios: 'camas' },
    { id: 'colchon', uno: 'colchón', varios: 'colchones' },
    { id: 'sillon', uno: 'sillón', varios: 'sillones' },
    { id: 'mesa', uno: 'mesa', varios: 'mesas' },
    { id: 'sillas', uno: 'silla', varios: 'sillas' },
    { id: 'ropero', uno: 'ropero', varios: 'roperos' },
    { id: 'tv', uno: 'TV', varios: 'TV' },
    { id: 'escritorio', uno: 'escritorio', varios: 'escritorios' },
    { id: 'bicicleta', uno: 'bicicleta', varios: 'bicicletas' },
    { id: 'cajas', uno: 'caja', varios: 'cajas' }
  ];

  var PISOS = { pb: 'Planta baja', '1-3': '1° a 3° piso', '4+': '4° piso o más' };
  var TIPOS = { casa: 'Casa', departamento: 'Departamento', ph: 'PH', local: 'Local u oficina', deposito: 'Depósito' };
  var ACCESOS = { escalera: 'Escalera', ascensor: 'Ascensor', montacargas: 'Montacargas', directo: 'Acceso directo' };
  var FLEXIBLE = { si: 'Sí', no: 'No' };
  var TIEMPOS = { 1: '1 mes', '2-3': '2 o 3 meses', '4-6': '4 a 6 meses', 'mas-6': 'Más de 6 meses', definir: 'A definir' };
  var EXTRAS = { embalaje: 'Embalaje de muebles y electrodomésticos', soga: 'Soga por balcón', visita: 'Visita sin cargo para presupuestar' };
  var DIAS_FECHA_CERCANA = 3;

  var btnAtras = document.getElementById('cotizador-prev');
  var btnSiguiente = document.getElementById('cotizador-next');
  var btnEnviar = document.getElementById('cotizador-submit');
  var indicador = document.getElementById('cotizador-progress');
  var textoProgreso = document.getElementById('cotizador-progress-text');
  var nombrePaso = document.getElementById('cotizador-progress-name');
  var notas = document.getElementById('cotizador-notas');
  var camion = null;
  var enviando = false;
  var preview = document.getElementById('cotizador-preview');
  var horaPreview = document.getElementById('cotizador-preview-time');

  var pasoActual = 1;
  var cantidades = {};
  var paradasMedidas = 0;
  var temporizadorPreview = null;
  var ultimoMensaje = null;
  var eraSabado = false;
  var franjaAntesDelSabado = '';

  /* ---------- Utilidades ---------- */

  function campo(id) {
    return document.getElementById(id);
  }

  function radios(nombre) {
    return Array.prototype.slice.call(form.querySelectorAll('input[name="' + nombre + '"]'));
  }

  function valorRadio(nombre) {
    var marcado = form.querySelector('input[name="' + nombre + '"]:checked');
    return marcado ? marcado.value : '';
  }

  function valorCampo(id) {
    var el = campo(id);
    return el ? el.value : '';
  }

  // Deja el texto en una sola línea, sin caracteres de control ni invisibles,
  // y sin surrogates sueltos (harían fallar a encodeURIComponent).
  function limpiarTexto(texto, maximo) {
    var limpio = String(texto)
      .replace(/\p{Cs}/gu, '')
      .replace(/[\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF]/g, '')
      .replace(/[\u0000-\u001F\u007F-\u009F\u2028\u2029]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    return Array.from(limpio).slice(0, maximo).join('').trim();
  }

  function textoDeCampo(id) {
    var el = campo(id);
    if (!el) return '';
    return limpiarTexto(el.value, el.maxLength > 0 ? el.maxLength : 200);
  }

  // Al salir del campo: primera letra en mayúscula. El resto queda como se escribió, y la referencia, entera.
  // En el nombre y la localidad, la de cada palabra, salvo las partículas que no van primeras: "Belén de Escobar".
  var PARTICULAS = ['de', 'del', 'la', 'las', 'los', 'y'];

  function mayusculaInicial(texto) {
    return texto.replace(/^\p{Ll}/u, function (letra) { return letra.toLocaleUpperCase('es-AR'); });
  }

  function corregirPalabras(texto) {
    var primera = true;
    return texto.replace(/\S+/g, function (palabra) {
      var esPrimera = primera;
      primera = false;
      var minuscula = palabra.toLocaleLowerCase('es-AR');
      if (esPrimera || PARTICULAS.indexOf(minuscula) === -1) return mayusculaInicial(palabra);
      // "De" pasa a "de"; lo escrito todo en mayúscula queda como está.
      return palabra === mayusculaInicial(minuscula) ? minuscula : palabra;
    });
  }

  function capitalizar(el) {
    if (/-referencia$/.test(el.id)) return false;
    var corregido = ['cot-nombre', 'cot-origen', 'cot-destino'].indexOf(el.id) !== -1
      ? corregirPalabras(el.value)
      : el.value.replace(/^(\s*)(\p{Ll})/u, function (todo, antes, letra) { return antes + letra.toLocaleUpperCase('es-AR'); });
    if (corregido === el.value) return false;
    el.value = corregido;
    return true;
  }

  function capitalizarTodo() {
    Array.prototype.forEach.call(form.querySelectorAll('input[type="text"], textarea'), capitalizar);
  }

  // Fecha local en YYYY-MM-DD; toISOString daría el día UTC, que de noche ya es mañana.
  function hoyLocal() {
    var ahora = new Date();
    var mes = String(ahora.getMonth() + 1).padStart(2, '0');
    var dia = String(ahora.getDate()).padStart(2, '0');
    return ahora.getFullYear() + '-' + mes + '-' + dia;
  }

  function fechaLocal(iso) {
    var partes = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
    return partes ? new Date(Number(partes[1]), Number(partes[2]) - 1, Number(partes[3])) : null;
  }

  // Día de la semana de la fecha elegida (0 = domingo), o -1 si todavía no hay fecha.
  function diaElegido() {
    var fecha = fechaLocal(valorCampo('cot-fecha'));
    return fecha ? fecha.getDay() : -1;
  }

  // De hoy a los próximos 3 días. Un domingo no cuenta: no se trabaja.
  function esFechaCercana() {
    var iso = valorCampo('cot-fecha');
    var fecha = fechaLocal(iso);
    if (!fecha || iso < hoyLocal() || fecha.getDay() === 0) return false;
    return Math.round((fecha - fechaLocal(hoyLocal())) / 86400000) <= DIAS_FECHA_CERCANA;
  }

  function fechaParaMensaje(iso) {
    var partes = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
    return partes ? partes[3] + '/' + partes[2] + '/' + partes[1] : '';
  }

  function hayObjetos() {
    return OBJETOS.some(function (objeto) {
      return cantidades[objeto.id] > 0;
    });
  }

  /* ---------- Reglas de validación por paso ---------- */

  function reglaObligatorio(idCampo, idError, mensaje) {
    return {
      error: idError,
      campos: function () { return [campo(idCampo)]; },
      revisar: function () { return textoDeCampo(idCampo) ? '' : mensaje; }
    };
  }

  function reglaSelect(idCampo, idError, mensaje) {
    return {
      error: idError,
      campos: function () { return [campo(idCampo)]; },
      revisar: function () { return valorCampo(idCampo) ? '' : mensaje; }
    };
  }

  function reglaRadio(nombre, mensaje) {
    return {
      error: 'error-' + nombre,
      campos: function () { return radios(nombre); },
      revisar: function () { return valorRadio(nombre) ? '' : mensaje; }
    };
  }

  function esGuardado() { return valorRadio('servicio') === 'guardamuebles'; }
  function esInterior() { return valorRadio('servicio') === 'interior'; }
  function conDestino() { return !esGuardado(); }
  function esComercio() { return valorRadio('servicio') === 'comercios'; }

  // Esta regla solo se exige si se cumple la condición.
  function soloSi(condicion, regla) {
    var revisar = regla.revisar;
    regla.revisar = function () { return condicion() ? revisar() : ''; };
    return regla;
  }

  var REGLAS = {
    1: [
      {
        error: 'error-servicio',
        campos: function () { return radios('servicio'); },
        revisar: function () { return valorRadio('servicio') ? '' : 'Seleccioná el servicio que necesitás.'; }
      }
    ],
    2: [
      {
        error: 'error-items',
        campos: function () { return [campo('cot-carga'), campo('cot-mas')]; },
        foco: function () {
          if (esComercio()) return campo('cot-carga');
          return form.querySelector('.counter__btn[data-action="increment"]') || campo('cot-mas');
        },
        revisar: function () {
          if (esComercio()) return textoDeCampo('cot-carga') || textoDeCampo('cot-mas') ? '' : 'Describí la carga que hay que trasladar.';
          return hayObjetos() || textoDeCampo('cot-mas') ? '' : 'Indicá al menos una pertenencia o completá el campo de detalles.';
        }
      }
    ],
    3: [
      reglaObligatorio('cot-origen', 'error-origen', 'Indicá la localidad de origen.'),
      reglaObligatorio('cot-origen-direccion', 'error-origen-direccion', 'Ingresá la calle y la altura.'),
      reglaRadio('origen-tipo', 'Seleccioná el tipo de propiedad de origen.'),
      reglaRadio('origen-piso', 'Seleccioná el piso de origen.'),
      reglaRadio('origen-acceso', 'Seleccioná el tipo de acceso en el origen.'),
      soloSi(esGuardado, reglaRadio('tiempo', 'Indicá por cuántos meses necesitás la baulera.'))
    ],
    4: [
      soloSi(conDestino, reglaObligatorio('cot-destino', 'error-destino', 'Indicá la localidad de destino.')),
      soloSi(conDestino, reglaObligatorio('cot-destino-direccion', 'error-destino-direccion', 'Ingresá la calle y la altura.')),
      soloSi(esInterior, reglaSelect('cot-destino-provincia', 'error-destino-provincia', 'Seleccioná la provincia de destino.')),
      soloSi(conDestino, reglaRadio('destino-tipo', 'Seleccioná el tipo de propiedad de destino.')),
      soloSi(conDestino, reglaRadio('destino-piso', 'Seleccioná el piso de destino.')),
      soloSi(conDestino, reglaRadio('destino-acceso', 'Seleccioná el tipo de acceso en el destino.'))
    ],
    5: [
      {
        error: 'error-fecha',
        campos: function () { return [campo('cot-fecha')]; },
        revisar: function () {
          var fecha = valorCampo('cot-fecha');
          if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return 'Seleccioná una fecha.';
          // En formato YYYY-MM-DD la comparación de texto respeta el orden de las fechas.
          if (fecha < hoyLocal()) return 'La fecha no puede ser anterior al día de hoy.';
          return diaElegido() === 0 ? 'Los domingos no trabajamos. Elegí otro día o consultanos por WhatsApp.' : '';
        }
      }
    ]
  };

  function mostrarResultado(regla, mensaje) {
    var errorEl = campo(regla.error);
    if (errorEl && errorEl.textContent !== mensaje) errorEl.textContent = mensaje;

    regla.campos().forEach(function (el) {
      if (!el) return;
      if (mensaje) el.setAttribute('aria-invalid', 'true');
      else el.removeAttribute('aria-invalid');
    });
  }

  // Devuelve el elemento que tiene que recibir el foco, o null si el paso está bien.
  function validarPaso(paso) {
    var primerFoco = null;
    var hayError = false;

    REGLAS[paso].forEach(function (regla) {
      var mensaje = regla.revisar();
      mostrarResultado(regla, mensaje);
      if (mensaje && !hayError) {
        hayError = true;
        primerFoco = regla.foco ? regla.foco() : regla.campos()[0];
      }
    });

    return hayError ? (primerFoco || form) : null;
  }

  // Actualiza solo los errores que ya están a la vista: no marca campos que la persona todavía no tocó.
  function revisarErroresVisibles() {
    Object.keys(REGLAS).forEach(function (paso) {
      REGLAS[paso].forEach(function (regla) {
        var errorEl = campo(regla.error);
        if (errorEl && errorEl.textContent) mostrarResultado(regla, regla.revisar());
      });
    });
  }

  /* ---------- Navegación entre pasos ---------- */

  function pasosActivos() {
    return esGuardado() ? [1, 2, 3, 5] : [1, 2, 3, 4, 5];
  }

  function renderizarPaso() {
    Array.prototype.forEach.call(form.querySelectorAll('.cotizador-step[data-step]'), function (paso) {
      paso.hidden = Number(paso.getAttribute('data-step')) !== pasoActual;
    });

    var activos = pasosActivos();
    var indice = activos.indexOf(pasoActual);

    if (btnAtras) btnAtras.hidden = indice === 0;
    if (btnSiguiente) btnSiguiente.hidden = pasoActual === TOTAL_PASOS;
    if (btnEnviar) btnEnviar.hidden = pasoActual !== TOTAL_PASOS;
    if (notas) notas.hidden = pasoActual !== TOTAL_PASOS;

    if (indicador) {
      indicador.setAttribute('aria-valuemax', String(activos.length));
      indicador.setAttribute('aria-valuenow', String(indice + 1));
      Array.prototype.forEach.call(indicador.querySelectorAll('[data-stepper]'), function (item) {
        var posicion = activos.indexOf(Number(item.getAttribute('data-stepper')));
        item.hidden = posicion === -1;
        if (posicion === -1) return;
        item.querySelector('.stepper__num').textContent = String(posicion + 1);
        item.classList.toggle('is-current', posicion === indice);
        item.classList.toggle('is-done', posicion < indice);
        if (posicion === indice) {
          item.setAttribute('aria-current', 'step');
          if (nombrePaso) nombrePaso.textContent = item.querySelector('.stepper__name').textContent;
        } else {
          item.removeAttribute('aria-current');
        }
      });
    }
    if (textoProgreso) textoProgreso.textContent = 'Paso ' + (indice + 1) + ' de ' + activos.length;
    if (camion) {
      // Al sumar o sacar una parada, cambian las posiciones del camino.
      if (paradasMedidas !== activos.length) {
        paradasMedidas = activos.length;
        camion.medir();
      }
      camion.irA(indice);
    }
  }

  function sinAnimacion() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function enfocarTituloDelPaso() {
    var titulo = form.querySelector('.cotizador-step[data-step="' + pasoActual + '"] .cotizador-step__title');
    if (!titulo) return;

    titulo.focus({ preventScroll: true });
    // Avisa que este scroll es del formulario, para que el header no se expanda y tape el indicador.
    document.dispatchEvent(new CustomEvent('julio:scroll-programado'));
    // Alinea el indicador de pasos arriba: con 'nearest', en pantallas bajas el título quedaba
    // pegado al borde inferior y los campos fuera de vista. El scroll-padding de CSS salva al header.
    (indicador || titulo).scrollIntoView({ behavior: sinAnimacion() ? 'auto' : 'smooth', block: 'start' });
  }

  function irAlPaso(paso) {
    var clase = paso > pasoActual ? 'entra-derecha' : 'entra-izquierda';
    pasoActual = paso;
    renderizarPaso();
    var visible = form.querySelector('.cotizador-step[data-step="' + pasoActual + '"]');
    if (visible) {
      visible.classList.remove('entra-derecha', 'entra-izquierda');
      visible.classList.add(clase);
    }
    enfocarTituloDelPaso();
  }

  function avanzar() {
    var conError = validarPaso(pasoActual);
    if (conError) {
      conError.focus();
      if (camion) camion.frenar();
      return;
    }
    var activos = pasosActivos();
    var indice = activos.indexOf(pasoActual);
    if (indice < activos.length - 1) irAlPaso(activos[indice + 1]);
  }

  /* ---------- Contadores ---------- */

  function renderizarContador(contador, id) {
    var cantidad = cantidades[id];
    var valor = contador.querySelector('[data-counter-value]');
    var restar = contador.querySelector('[data-action="decrement"]');
    var sumar = contador.querySelector('[data-action="increment"]');

    if (valor) valor.textContent = String(cantidad);
    // aria-disabled y no disabled: un botón disabled perdería el foco de teclado.
    if (restar) restar.setAttribute('aria-disabled', String(cantidad === 0));
    if (sumar) sumar.setAttribute('aria-disabled', String(cantidad === MAX_POR_OBJETO));
  }

  function clicEnContador(boton) {
    var contador = boton.closest('.counter[data-item]');
    if (!contador) return;

    var id = contador.getAttribute('data-item');
    var cambio = boton.getAttribute('data-action') === 'increment' ? 1 : -1;
    var nueva = Math.min(MAX_POR_OBJETO, Math.max(0, (cantidades[id] || 0) + cambio));

    if (nueva === cantidades[id]) return;
    cantidades[id] = nueva;
    renderizarContador(contador, id);
    alCambiar();
  }

  /* ---------- Acceso según el piso ---------- */

  // En planta baja se sugiere el acceso directo, si todavía no se eligió otro; se puede cambiar.
  function sugerirAcceso(lado) {
    if (valorRadio(lado + '-piso') !== 'pb' || valorRadio(lado + '-acceso')) return;
    var directo = form.querySelector('input[name="' + lado + '-acceso"][value="directo"]');
    if (directo) directo.checked = true;
  }

  // Por escalera, con piso 1 o más, se avisa que tiene un costo adicional.
  function avisarEscalera(lado) {
    var aviso = campo('aviso-' + lado + '-escalera');
    var piso = valorRadio(lado + '-piso');
    if (aviso) aviso.hidden = !(valorRadio(lado + '-acceso') === 'escalera' && piso && piso !== 'pb');
  }

  /* ---------- Fecha ---------- */

  // Avisa si es cercana, frena los domingos y deja solo la mañana los sábados.
  function sincronizarFecha() {
    var aviso = campo('aviso-fecha');
    if (aviso) aviso.hidden = !esFechaCercana();

    var sabado = diaElegido() === 6;
    Array.prototype.forEach.call(form.querySelectorAll('[data-no-sabado]'), function (opcion) {
      var entrada = opcion.querySelector('input');
      opcion.classList.toggle('is-off', sabado);
      entrada.disabled = sabado;
      if (sabado) entrada.setAttribute('aria-disabled', 'true');
      else entrada.removeAttribute('aria-disabled');
    });
    var avisoSabado = campo('aviso-sabado');
    if (avisoSabado) avisoSabado.hidden = !sabado;
    if (sabado !== eraSabado) {
      if (sabado) franjaAntesDelSabado = valorRadio('franja');
      var franja = form.querySelector('input[name="franja"][value="' + (sabado ? 'manana' : franjaAntesDelSabado) + '"]');
      if (franja) franja.checked = true;
      eraSabado = sabado;
    }

    if (valorCampo('cot-fecha')) mostrarResultado(REGLAS[5][0], REGLAS[5][0].revisar());
  }

  /* ---------- Campos según el servicio ---------- */

  function sincronizarServicio() {
    Array.prototype.forEach.call(form.querySelectorAll('[data-solo-guardado]'), function (el) { el.hidden = !esGuardado(); });
    Array.prototype.forEach.call(form.querySelectorAll('[data-solo-interior]'), function (el) { el.hidden = !esInterior(); });
    Array.prototype.forEach.call(form.querySelectorAll('[data-solo-comercio]'), function (el) { el.hidden = !esComercio(); });
    Array.prototype.forEach.call(form.querySelectorAll('[data-sin-comercio]'), function (el) { el.hidden = esComercio(); });
  }

  /* ---------- Mensaje de WhatsApp ---------- */

  // Un dato por línea, con el formato "Rótulo: valor". Solo lo completado, sin líneas vacías.
  function lineasDeLugar(etiqueta, lado) {
    var lineas = [];
    function sumar(rotulo, valor) {
      if (valor) lineas.push('*' + rotulo + ':* ' + valor);
    }

    // "Av. San Martín 678, Belén de Escobar (entre Mitre y Sarmiento)"; la referencia, solo si se completó.
    var lugar = [textoDeCampo('cot-' + lado + '-direccion'), textoDeCampo('cot-' + lado)].filter(Boolean).join(', ');
    var referencia = textoDeCampo('cot-' + lado + '-referencia');
    sumar(etiqueta, [lugar, referencia ? '(' + referencia + ')' : ''].filter(Boolean).join(' '));
    if (lado === 'destino' && esInterior()) sumar('Provincia', valorCampo('cot-destino-provincia'));
    sumar('Tipo de propiedad en ' + lado, TIPOS[valorRadio(lado + '-tipo')]);
    sumar('Piso en ' + lado, PISOS[valorRadio(lado + '-piso')]);
    sumar('Acceso en ' + lado, ACCESOS[valorRadio(lado + '-acceso')]);

    return lineas;
  }

  function armarMensaje() {
    var lineas = ['Hola, Transportes Julio. Quisiera solicitar un presupuesto.'];
    function sumar(rotulo, valor) {
      if (valor) lineas.push('*' + rotulo + ':* ' + valor);
    }

    sumar('Nombre', textoDeCampo('cot-nombre'));
    sumar('Servicio', SERVICIOS[valorRadio('servicio')]);

    if (esComercio()) {
      sumar('Carga', textoDeCampo('cot-carga'));
    } else {
      var objetos = OBJETOS.filter(function (objeto) {
        return cantidades[objeto.id] > 0;
      });
      if (objetos.length) lineas.push('*Pertenencias a trasladar:*');
      objetos.forEach(function (objeto) {
        var cantidad = cantidades[objeto.id];
        lineas.push('- ' + cantidad + ' ' + (cantidad === 1 ? objeto.uno : objeto.varios));
      });
    }
    sumar('Otros detalles', textoDeCampo('cot-mas'));

    lineas = lineas.concat(lineasDeLugar('Origen', 'origen'));
    if (conDestino()) lineas = lineas.concat(lineasDeLugar('Destino', 'destino'));
    if (esGuardado()) sumar('Tiempo de guardado', TIEMPOS[valorRadio('tiempo')]);

    sumar('Fecha', fechaParaMensaje(valorCampo('cot-fecha')));
    if (esFechaCercana()) sumar('Urgente', 'sí');
    sumar('Fecha flexible', FLEXIBLE[valorRadio('flexible')]);
    var franja = form.querySelector('input[name="franja"]:checked');
    if (franja) sumar('Horario', limpiarTexto(form.querySelector('label[for="' + franja.id + '"]').textContent, 60));

    var extras = radios('extras').filter(function (casilla) {
      return casilla.checked && EXTRAS[casilla.value];
    }).map(function (casilla) {
      return EXTRAS[casilla.value];
    });
    sumar('Servicios adicionales', extras.join(', '));

    return lineas.join('\n');
  }

  // Convierte el mensaje en nodos: *texto* pasa a <strong> y lo demás queda como texto literal.
  // Un asterisco suelto del usuario no coincide con el patrón y se muestra tal cual.
  function nodosDelMensaje(mensaje) {
    var fragmento = document.createDocumentFragment();
    var patron = /\*([^\s*](?:[^*\n]*[^\s*])?)\*/g;
    var posicion = 0;
    var coincidencia = patron.exec(mensaje);

    while (coincidencia) {
      if (coincidencia.index > posicion) {
        fragmento.appendChild(document.createTextNode(mensaje.slice(posicion, coincidencia.index)));
      }
      var negrita = document.createElement('strong');
      negrita.textContent = coincidencia[1];
      fragmento.appendChild(negrita);
      posicion = patron.lastIndex;
      coincidencia = patron.exec(mensaje);
    }

    if (posicion < mensaje.length) {
      fragmento.appendChild(document.createTextNode(mensaje.slice(posicion)));
    }
    return fragmento;
  }

  function actualizarPreview() {
    clearTimeout(temporizadorPreview);
    if (!preview) return;

    if (horaPreview) {
      var ahora = new Date();
      horaPreview.textContent = String(ahora.getHours()).padStart(2, '0') + ':' + String(ahora.getMinutes()).padStart(2, '0');
    }

    var mensaje = armarMensaje();
    // Sin cambios no se toca el DOM, para no repetir el anuncio de aria-live.
    if (mensaje === ultimoMensaje) return;
    ultimoMensaje = mensaje;
    preview.replaceChildren(nodosDelMensaje(mensaje));
  }

  // Al tipear se espera un momento para no saturar el aria-live de la vista previa.
  function programarPreview() {
    clearTimeout(temporizadorPreview);
    temporizadorPreview = setTimeout(actualizarPreview, ESPERA_PREVIEW_MS);
  }

  function alCambiar() {
    revisarErroresVisibles();
    actualizarPreview();
  }

  /* ---------- Envío ---------- */

  function enviar() {
    if (enviando) return;
    capitalizarTodo();
    var activos = pasosActivos();
    for (var i = 0; i < activos.length; i += 1) {
      var paso = activos[i];
      var conError = validarPaso(paso);
      if (conError) {
        if (paso !== pasoActual) {
          pasoActual = paso;
          renderizarPaso();
        }
        conError.focus();
        if (camion) camion.frenar();
        return;
      }
    }

    var url = WHATSAPP_URL + encodeURIComponent(armarMensaje());
    var abrir = function () {
      enviando = false;
      window.open(url, '_blank', 'noopener,noreferrer');
    };

    // El camión llega al final del camino y recién ahí se abre WhatsApp (700ms como máximo).
    if (!camion) { abrir(); return; }
    enviando = true;
    var ultima = indicador.querySelector('[data-stepper="' + TOTAL_PASOS + '"]');
    if (ultima) ultima.classList.add('is-done');
    camion.irAlFinal().then(abrir);
  }

  /* ---------- Eventos ---------- */

  if (btnAtras) {
    btnAtras.addEventListener('click', function () {
      var activos = pasosActivos();
      var indice = activos.indexOf(pasoActual);
      if (indice > 0) irAlPaso(activos[indice - 1]);
    });
  }

  if (btnSiguiente) btnSiguiente.addEventListener('click', avanzar);

  form.addEventListener('click', function (evento) {
    var boton = evento.target.closest('[data-action]');
    if (boton) clicEnContador(boton);
  });

  form.addEventListener('focusout', function (evento) {
    if (evento.target.matches('input[type="text"], textarea') && capitalizar(evento.target)) alCambiar();
  });

  form.addEventListener('input', function () {
    revisarErroresVisibles();
    programarPreview();
  });

  form.addEventListener('change', function (evento) {
    if (evento.target.name === 'servicio') {
      sincronizarServicio();
      renderizarPaso();
    }
    if (evento.target.name === 'origen-piso') sugerirAcceso('origen');
    if (evento.target.name === 'destino-piso') sugerirAcceso('destino');
    if (evento.target.id === 'cot-fecha') sincronizarFecha();
    avisarEscalera('origen');
    avisarEscalera('destino');
    alCambiar();
  });

  // Enter en un campo de los pasos 1 a 3 avanza; nunca manda el formulario antes de tiempo.
  form.addEventListener('keydown', function (evento) {
    if (evento.key !== 'Enter' || evento.isComposing) return;
    if (evento.target.tagName !== 'INPUT' || pasoActual === TOTAL_PASOS) return;
    evento.preventDefault();
    avanzar();
  });

  form.addEventListener('submit', function (evento) {
    evento.preventDefault();
    if (pasoActual < TOTAL_PASOS) avanzar();
    else enviar();
  });

  /* ---------- Estado inicial ---------- */

  OBJETOS.forEach(function (objeto) {
    cantidades[objeto.id] = 0;
    var contador = form.querySelector('.counter[data-item="' + objeto.id + '"]');
    if (contador) renderizarContador(contador, objeto.id);
  });

  var inputFecha = campo('cot-fecha');
  if (inputFecha) inputFecha.min = hoyLocal();

  // En las páginas de localidad, el origen viene precargado y se puede editar.
  var inputOrigen = campo('cot-origen');
  var origenDeLaPagina = form.getAttribute('data-origen');
  if (inputOrigen && origenDeLaPagina && !inputOrigen.value) {
    inputOrigen.value = limpiarTexto(origenDeLaPagina, inputOrigen.maxLength > 0 ? inputOrigen.maxLength : 60);
  }

  if (window.JulioCamion && indicador) {
    camion = window.JulioCamion.crear({
      contenedor: indicador,
      camion: indicador.querySelector('.stepper__truck'),
      recorrido: indicador.querySelector('.stepper__done'),
      marcas: function () { return Array.prototype.slice.call(indicador.querySelectorAll('.stepper__item:not([hidden]) .stepper__num')); },
      duracion: 700
    });
  }

  /* Barra fija de mobile: solo el CSS de mobile la saca del flujo; sin JS queda debajo del formulario.
     Se ve mientras el formulario ocupa la zona entre la mitad de la pantalla (o el header, si está más
     abajo) y la propia barra. Al bajar se oculta cuando el final del formulario sube de la mitad, porque
     debajo ya se ve otra sección; al subir, apenas el formulario queda por debajo de la barra. */
  // Mobile y tablet: al enfocar un campo de texto, queda en el centro de lo que se ve. Se espera a que
  // abra el teclado. Con el foco puesto por el teclado físico (Tab) el navegador ya hizo lo suyo.
  var conTeclado = window.matchMedia('(max-width: 63.99rem) and (pointer: coarse)');
  var esperaFoco = 0;
  form.addEventListener('focusin', function (evento) {
    if (!conTeclado.matches || !evento.target.matches('input.field__input, textarea, select')) return;
    clearTimeout(esperaFoco);
    esperaFoco = setTimeout(function () {
      evento.target.scrollIntoView({ behavior: sinAnimacion() ? 'auto' : 'smooth', block: 'center' });
    }, 300);
  });

  var navegacion = form.querySelector('.cotizador__nav');
  var cabecera = document.getElementById('site-header');
  var vigiaBarra = null;
  var cuadroBarra = 0;

  function vigilarBarra() {
    var ventana = window.visualViewport;
    var alto = ventana ? ventana.height : window.innerHeight;
    var inferior = ventana ? window.innerHeight - ventana.height - ventana.offsetTop : 0;
    var debajo = parseFloat(window.getComputedStyle(navegacion).bottom) || 0;
    var arriba = Math.max(cabecera ? cabecera.getBoundingClientRect().bottom : 0, alto / 2);
    var abajo = navegacion.offsetHeight + debajo + Math.max(inferior, 0);

    if (vigiaBarra) vigiaBarra.disconnect();
    vigiaBarra = new IntersectionObserver(function (entradas) {
      var visible = entradas[entradas.length - 1].isIntersecting;
      navegacion.classList.toggle('is-fija', visible);
      document.dispatchEvent(new CustomEvent('julio:barra-cotizador', { detail: visible }));
    }, { rootMargin: '-' + Math.round(arriba) + 'px 0px -' + Math.round(abajo) + 'px 0px', threshold: 0 });
    vigiaBarra.observe(form);
  }

  function pedirVigia() {
    window.cancelAnimationFrame(cuadroBarra);
    cuadroBarra = window.requestAnimationFrame(vigilarBarra);
  }

  if (navegacion && 'IntersectionObserver' in window) {
    navegacion.classList.add('cotizador__nav--barra');
    window.requestAnimationFrame(function () { window.requestAnimationFrame(vigilarBarra); });
    window.addEventListener('resize', pedirVigia, { passive: true });
    if (window.visualViewport) window.visualViewport.addEventListener('resize', pedirVigia, { passive: true });
  }
  if (navegacion && window.visualViewport) {
    window.visualViewport.addEventListener('resize', function () {
      navegacion.classList.toggle('is-teclado', window.visualViewport.height < window.innerHeight * 0.75);
    }, { passive: true });
  }

  sincronizarServicio();
  paradasMedidas = pasosActivos().length;
  renderizarPaso();
  actualizarPreview();
})();
