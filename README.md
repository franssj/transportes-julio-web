# FLETES Y MUDANZAS JULIO — sitio web

HTML, CSS y JavaScript vanilla. Sin build, sin dependencias, sin backend.

## 1. Organización

```
index.html                     Home (Escobar y Tigre)
mudanzas-escobar/index.html    Página de Escobar
mudanzas-tigre/index.html      Página de Tigre
privacidad/index.html          Política de privacidad
css/styles.css                 Todos los estilos (índice al principio del archivo)
js/camion.js                   Lógica del camión, compartida por los dos caminos. Se carga primero
js/main.js                     Header, fila de links, animaciones, parallax, ruta, horarios, WhatsApp fijo
js/cotizador.js                Formulario de 5 pasos y mensaje de WhatsApp
assets/img/                    Fotos y logo: se reemplazan pisando el archivo
assets/fonts/                  Inter 300, 400, 500, 600 y 700 en woff2, con su licencia (SIL OFL, en OFL.txt)
robots.txt, sitemap.xml        Con [[URL_WEB]]
PENDIENTES.md                  Lo que falta confirmar o conseguir
```

**Secciones del home:** header, hero, `#nosotros` y `#por-que-elegirnos` (un solo bloque oscuro), `#servicios` (tarjetas y adicionales), `#vehiculos`, `#como-trabajamos`, `#resenas`, `#cotizador`, `#zonas`, `#preguntas`, `#contacto`, `#cierre`, footer, WhatsApp fijo.

**Secciones de cada localidad:** header, hero, `#servicios`, `#zona` (tarjeta oscura con foto de fondo, que incluye `#localidades`), `#resenas`, `#cotizador`, `#preguntas`, `#cierre`, footer, WhatsApp fijo.

**Navegación:** el `id` de cada sección va en su encabezado (`.section__header`), no en la `<section>`. Una sola regla lo ubica: `scroll-margin-top: var(--nav-offset)`, que es la altura del header más 32px. `main.js` la mide con ResizeObserver y la guarda en `--header-h`; es siempre la altura del header ya scrolleado: 68px en desktop; debajo de 1024px, solo la fila de links (48px en tablet, 44px en mobile).

**Header desde 1024px:** dentro del contenedor de 1200px, sobre carbón sólido. Logo a la izquierda; links y botón en píldora a la derecha. Mide 84px y baja a 68px al scrollear. **Tablet, de 768 a 1023px:** fila de logo y botón, fila de links. **Mobile:** fila de logo, teléfono y WhatsApp, fila de links deslizable. Debajo de 1024px, al bajar se oculta la fila del logo; al subir vuelve. El menú tiene 5 links, los mismos en los 3 tamaños. Para sumar uno, hay que agregarlo en `.site-nav` y en `.site-row`: el indicador de sección activa lo toma solo.

## 2. Reglas del proyecto

- **CSP por `<meta>`:** `default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-src https://www.google.com; object-src 'none'; base-uri 'self'; form-action 'self'`. Nada de `style=`, `on*=`, `<style>` ni scripts inline (salvo el JSON-LD), ni `innerHTML` o `eval`. Cambiar estilos desde JS: por clases o `el.style`.
- **Marca:** Transportes Julio, con "Fletes y mudanzas" como bajada. En el JSON-LD, `alternateName` conserva "Fletes y Mudanzas Julio", como figura en Google.
- **Llamados a la acción, lista cerrada:** "Solicitar presupuesto" en el header desde 768px, el hero y el cierre (en amarillo, `.btn--primary`); "Consultar por WhatsApp" en el hero; el cotizador; WhatsApp flotante. "Cómo llegar" (`.btn--dark`) no pide presupuesto y se mantiene. Las tarjetas y las fotos no son links: el servicio se elige en el paso 1 del cotizador, y las zonas llevan un link de texto a su página. No sumar otros.
- **Mobile:** el home tiene que medir 8 pantallas de 667px o menos en 375px de ancho. Servicios, Vehículos y Opiniones son carruseles con barra de progreso, y Opiniones también en tablet. En "Cómo trabajamos" las descripciones se ven siempre y el camión sigue al dedo. Las secciones oscuras se apilan como hojas, con radio de 28px. Las clases `.solo-mobile` y `.solo-grande` alternan los textos cortos y largos.
- **Horarios:** se cambian en un solo lugar, la constante `HORARIOS` de `main.js`. Cada página los toma con `data-horario`; `openingHoursSpecification`, en el JSON-LD, lleva el horario del local.
- **WhatsApp fijo:** círculo de 60px desde 768px; debajo, píldora que se contrae a círculo después de 120px. Se oculta mientras se ve el cotizador y con el teclado del celular abierto.
- **Animaciones:** clases `.reveal`, `.reveal--left`, `.reveal--right` y `.reveal--scale`; `data-stagger` en el padre anima a los hijos con 90ms de diferencia. `main.js` agrega `.is-pending` solo a lo que está debajo del pliegue, así que sin JS o con reduced-motion todo queda visible. Solo `transform` y `opacity`. Parallax solo desde 1024px, con `data-parallax`.
- **Medidas:** lo que lee el layout (línea del menú, fila de links, parallax) se calcula en `medirTodo()` de `main.js`: al cargar, en resize, con las fuentes y si cambia el alto de la página. El camión mide por su cuenta, en `camion.js`. Durante el scroll solo se usan valores guardados.
- **Camión:** `window.JulioCamion.crear()` es la única lógica, para "Cómo trabajamos" y el cotizador. Desde 768px, en "Cómo trabajamos" cada paso es un botón y cada descripción se revela cuando el camión frena. Sin JS se ven los 4 pasos encendidos, y con reduced-motion todas las descripciones, sin pulso ni indicios.
- **Prohibido:** brillo que sigue al cursor, glows, degradados animados, efectos de brillo en botones. Los contadores animados, también, salvo el "8" y el "64" de "Por qué elegirnos".
- **Colores:** base carbón `#121316`. El amarillo `#F5C400` va en el botón "Solicitar presupuesto", las palabras clave sobre fondo oscuro, los puntos de las etiquetas, los números de "Cómo trabajamos" y de "Por qué elegirnos", el indicador del header, la barra de lectura, los tramos recorridos, los tildes, la franja de marca y las selecciones del cotizador. Nunca como texto sobre blanco.
- **Franja de marca:** las diagonales del cartel del local, 6px, solo arriba del footer.
- **Datos:** no se inventan. Lo que falta va como `[[PENDIENTE]]` o `[CONFIRMAR]` visible (`<mark class="pendiente">`) y se anota en `PENDIENTES.md`.

## 3. Cotizador

Los campos `id`, `name` y `data-*` los usa `js/cotizador.js`: no renombrarlos.

- **Barra fija de mobile:** "Atrás" y "Siguiente" se ven mientras el formulario ocupa la zona entre la mitad de la pantalla y la barra. La píldora de WhatsApp vuelve apenas la barra se oculta.
- **Paso 1:** tarjetas con icono: Mudanza, Flete, Traslado de muebles, Reparto para comercio, Viaje al interior, Guardamuebles o baulera, Otro.
- **Paso 2:** contadores y "¿Algo más?". Con reparto para comercio, un campo para describir la carga reemplaza a los contadores.
- **Paso 3, "¿Desde dónde?", y paso 4, "¿Hasta dónde?":** localidad, dirección, entre calles o referencia (opcional), tipo de propiedad, piso (control segmentado) y acceso. Por escalera, con piso 1 o más, avisa que tiene un costo adicional. Con piso PB se sugiere el acceso directo, que se puede cambiar. Con viaje al interior, el destino suma la provincia. Con guardamuebles se saltea el paso 4, y el 3 suma "¿Por cuántos meses?": el indicador muestra 4 paradas. En las localidades, `data-origen` precarga el origen.
- **Paso 5:** fecha, franja, "¿La fecha es flexible?", servicios adicionales y nombre. La fecha no acepta días pasados ni domingos. En los próximos 3 días avisa y suma "Urgente: sí" al mensaje. Los sábados, "Tarde" e "Indistinto" quedan deshabilitadas, con un aviso.
- **Mayúsculas:** los campos de texto arrancan con mayúscula en el celular (`autocapitalize`), y al salir del campo el JS corrige la primera letra. En el nombre, la de cada palabra, salvo "de", "del", "la", "las", "los" e "y" cuando no van primeras. La referencia queda tal cual se escribió.
- **Mensaje:** un dato por línea, solo lo completado, sin líneas vacías.
- **Vista previa:** forma de chat de WhatsApp, con negritas reales armadas con nodos del DOM. El mensaje enviado a `wa.me` lleva asteriscos y va con `encodeURIComponent`.

## 4. Fotos y logo

Cada imagen es un solo archivo y se reemplaza **pisándolo con el mismo nombre** en `assets/img/`. No hay que tocar el HTML. Si la medida nueva es distinta, conviene actualizar `width` y `height` en las páginas que la usan.

| Archivo | Medida | Peso máximo |
|---|---|---|
| `hero.webp`, `hero-escobar.webp` | 1600×900 | 300 KB |
| `hero-tigre.webp` | 1600×900 | 300 KB |
| `veh-mercedes-1114.webp`, `veh-mercedes-playo.webp`, `veh-hino.webp`, `veh-dfm.webp`, `veh-ford-trailer.webp`, `veh-chevrolet.webp` | 1200×750 | 200 KB |
| `servicio-interior.webp`, `servicio-guardamuebles.webp` | 1200×900 | 200 KB |
| `servicio-mudanza.webp`, `servicio-flete.webp`, `servicio-muebles.webp`, `servicio-comercios.webp` | 1200×900 | 200 KB |
| `banda-cierre.webp` | 1920×800 | 200 KB |
| `local-fachada.webp` | 1200×900 | 200 KB |
| `og-image.jpg` | 1200×630 | 200 KB |

1. Recortá la foto a la medida de la tabla.
2. Difuminá las patentes de los vehículos y las caras de terceros.
3. Convertila a `.webp` (`og-image` va en `.jpg`) y comprimila hasta el peso máximo. [Squoosh](https://squoosh.app) sirve para las dos cosas y procesa las imágenes en tu navegador.
4. Pisá el archivo en `assets/img/`.
5. Revisá que el `alt` describa lo que se ve en la foto real.

**Favicon:** `assets/img/favicon/`, con rutas absolutas en el `<head>` y en `site.webmanifest`. El sitio tiene que publicarse en la raíz del dominio; en una subcarpeta, esas rutas fallan.

**Logo:** header, `assets/img/logo-header.png` (56px de alto en desktop, 46px al scrollear, 48px en tablet, 40px en mobile); footer, `assets/img/logo.png` (56px de alto). Se reemplazan pisando el archivo y tienen que leerse sobre carbón (`#121316`).

**Redacción:** como máximo una "y" por oración, una idea por oración de 8 a 20 palabras, sin repetir la misma palabra en oraciones seguidas, voseo profesional, sin adjetivos vacíos ni exclamaciones. Las opiniones de clientes son textuales y no se tocan.

## 5. Sumar una localidad

1. Copiá una carpeta, por ejemplo `mudanzas-tigre`, con el nombre nuevo.
2. Cambiá textos, `title`, `description`, canonical, Open Graph, JSON-LD (`areaServed`) y `data-origen`. Escribí contenido propio: no copies y cambies solo el nombre.
3. Sumá un `<article class="zone-block">` en `#zonas` del home.
4. Sumá los links en el menú mobile y el footer de todas las páginas.
5. Sumá la URL en `sitemap.xml`.

Header y footer son idénticos en las localidades. El home tiene el mismo marcado y solo cambian las rutas relativas, porque sin build step no se puede evitar.

## 6. Cómo probarla

Con la extensión Live Server de VS Code, abrí la carpeta del proyecto y elegí *Open with Live Server* sobre `index.html`. Con el puerto por defecto:

- Home: `http://127.0.0.1:5500/`
- Escobar: `http://127.0.0.1:5500/mudanzas-escobar/`
- Tigre: `http://127.0.0.1:5500/mudanzas-tigre/`

Live Server inyecta un `<script>` en línea para recargar la página sola, y la CSP debería bloquearlo. Por eso puede aparecer un error de CSP en la consola y hay que recargar con F5 después de cada cambio. No afecta al sitio publicado. Esto surge del código de la extensión; no se ejecutó la extensión para comprobarlo.

## 7. Headers de seguridad para producción

La CSP por `<meta>` no admite `frame-ancestors`. Al publicar, configurá estos headers en el hosting:

```
Strict-Transport-Security: max-age=31536000; includeSubDomains
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=()
Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-src https://www.google.com; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'
```

Activá HSTS recién cuando HTTPS funcione en el dominio y en todos sus subdominios.

## 8. Estado de las pruebas

**Revisado en esta versión**, en Chrome headless: las 3 páginas abren sin errores de consola ni violaciones de CSP, y sin scroll horizontal a 320, 768 y 1440px. También se midió la posición del encabezado al navegar desde el menú y desde otra página, y el indicador de sección activa.

**No hay una auditoría completa de esta versión**, porque se pidió sin QA. Sin confirmar: Lighthouse, contraste medido sobre fotos reales, recorrido con teclado, envío completo del cotizador en la versión final, anchos intermedios, Safari, Firefox, Samsung Internet y dispositivos reales.

## 9. Antes de publicar

- Pedir a Julio el link directo para dejar una opinión, desde su Perfil de Empresa: hoy "Dejanos tu opinión" abre la ficha.
- Evaluar si se actualiza el nombre de la ficha de Google, que figura como "Fletes y Mudanzas Julio".
- La nota (4,5) y las opiniones (64) están escritas a mano: si cambian en Google, actualizarlas en hero, Por qué elegirnos (incluido `data-contar`), Opiniones y JSON-LD.
- Revisar que no se lean patentes ni caras de terceros en las fotos.
- Probar en un iPhone y en un Android reales, y enviar un pedido de prueba por WhatsApp.
- Dar de alta el sitio y el `sitemap.xml` en Google Search Console.
