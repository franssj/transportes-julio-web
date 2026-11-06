# Pendientes para publicar la web

## Lanzamiento

**Primer paso: salir del modo revisión.** Hoy ninguna página se indexa mientras Julio revisa. Al publicar con el dominio final, hacer estos cambios juntos:

- Sacar `X-Robots-Tag: noindex, nofollow` de `_headers`, junto con su comentario.
- Sacar `<meta name="robots" content="noindex">` de `privacidad/index.html`.
- Volver a sumar `[[URL_WEB]]/privacidad/` a `sitemap.xml`.

**HSTS:** sumar `includeSubDomains` en `_headers` cuando el dominio final esté conectado con HTTPS en todos sus subdominios.

## Política de privacidad

| Marca visible | Dónde está | Qué se necesita |
|---|---|---|
| `[[NOMBRE_TITULAR]]` | `privacidad/index.html`: Responsable | Nombre del titular de la empresa |
| `[[CUIT]]` | `privacidad/index.html`: Responsable | CUIT del titular |
| `[[FECHA_PUBLICACION]]` | `privacidad/index.html`: debajo del título | Fecha de publicación de la política |

## Dominio y URL final: `[[URL_WEB]]`

Reemplazar `[[URL_WEB]]` por la dirección definitiva, sin barra final, buscando en todo el proyecto.

| Archivo | Dónde |
|---|---|
| `index.html`, `mudanzas-escobar/index.html`, `mudanzas-tigre/index.html` | `canonical`, `og:url`, `og:image`, `twitter:image` y JSON-LD |
| `robots.txt` | Línea `Sitemap` |
| `sitemap.xml` | `<loc>` de las 3 URLs, más la de Privacidad al sumarla |
