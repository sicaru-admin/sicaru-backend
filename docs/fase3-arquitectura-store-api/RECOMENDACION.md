# Fase 3 · Store API frente a Meilisearch

Fecha de revisión: 15 de noviembre de 2026 (America/Monterrey). **Recomendación: A, conservar Medusa Store API como único origen público del catálogo y desactivar explícitamente la sincronización Meili, sujeto a autorización posterior.** No es una afirmación de que el motor productivo ya esté apagado. No se cambió producción. Continúa el NO GO de despliegue de #7.

## Evidencia y alcance

Vercel volvió a confirmar www.sicarubeauty.com → deployment `dpl_HrRagHXABHoHSP1oaSS7BTs141P3`, READY, SHA `d8f030ff4e1e9dcdbbd0e08c015884694c5bc693`. Se auditó ese commit, no se confundió el PR frontend #30 con producción. Backend de referencia: `51a6d207f6d420828433898cdb41f34d1a699229`; rama revisada #7: `codex/exclude-drafts-from-search`, base ensayada `1b4933fd04d88df40ec38878905585bf09a0da6a` más el diff de esta revisión.

El inventario y las limitaciones de acceso de Meili siguen siendo las documentadas en el diagnóstico anterior: fallback localhost:7700, sin servicio/volumen Meili identificado. No se inventa una versión, instancia ni factura. No se repitió la auditoría de identidad PostgreSQL/backend. Las referencias al código de Medusa se contrastaron con los paquetes instalados 2.13.1; caché con las guías locales de Next del proyecto.

## 1. Rutas reales y llamadas

| Entrada pública | Flujo del commit productivo | Dependencia Meili |
|---|---|---|
| Lupa/NavBar | SearchButton enfoca HeaderSearch; formulario GET /productos?q=... | Ninguna |
| /productos y query q | getProducts({limit:100}) → SDK store.product.list → GET /store/products; ProductosContent/matchesProductQuery filtra en cliente los productos recibidos | Ninguna |
| /productos/[handle], metadatos y relacionados | getProductByHandle → GET /store/products?handle=...; relacionados mediante getProducts | Ninguna |
| /categorias/[handle] | GET /store/product-categories?handle[]=...; después GET /store/products?category_id[]=... | Ninguna |
| /marcas/[handle] | Colección por Store API y GET /store/products?collection_id[]=... | Ninguna |
| Inicio | FeaturedProducts → getProducts({limit:8}); no InstantSearch | Ninguna |
| /sitemap.xml | Dinámico; productos, categorías y colecciones desde Store API | Ninguna |

getProducts incorpora región MX y precios calculados/inventario solicitados al SDK: son lecturas. catalogRequest impone timeout de 5 s, no añade caché ni fallback Meili. El límite de 100 en búsqueda y 50 en colección impide prometer búsqueda exhaustiva al crecer el catálogo. Requiere paginación/consulta de servidor más adelante; no obliga a introducir Meili.

GET actuales: inicio, catálogo, búsqueda Fantasy, ficha existente, sitemap y sw.js respondieron 200. No se ejecutaron POST públicos ni invalidaciones. Ver evidencia/publico.json.

## 2. Inventario completo de dependencias encontradas en el código

| Pieza | Producción/base | Rama #7 corregida | Puede permanecer inactiva |
|---|---|---|---|
| medusa-config.ts, módulo meilisearch y SDK 0.55 | Registro del servicio cliente; constructor no hace solicitudes al índice | Se conserva | Sí; no retirar el módulo mientras existan resoluciones sin guardia |
| src/subscribers/meilisearch-sync.ts | product.created/updated/deleted; omite trabajo con DISABLE_MEILISEARCH_SYNC=true; en caso contrario puede indexar drafts y fallar si no existe motor | Relectura publicada y eliminación de drafts, con lock | Sí, mediante flag; no afecta las lecturas Store API |
| src/loaders/meilisearch-sync.ts | Archivo raíz no descubierto automáticamente por bootstrap v2 | Helper de reconciliación reutilizado por hook registrado | Sí; no es una dependencia de Store API |
| src/modules/meilisearch/loaders/startup.ts y service.__hooks.onApplicationStart | No existen en producción | Nuevo loader explícito: registra callback; hook lo llama una vez por instancia | Sí; requiere opt-in y comando API real para reconstruir |
| src/scripts/sync-meilisearch.ts; npm run meilisearch:sync | Script manual antiguo NO respeta el flag de desactivación | PR #7 sí rechaza ejecución cuando está desactivado | Sí, no ejecutarlo; no asumir que cambiar un flag protege el script antiguo |
| src/lib/public-search.ts | No existe en producción | Construcción de documento, lock, sync/rebuild y revalidación | Sí; sólo sus consumidores Meili lo invocan |
| GET /store/catalog-search | No existe en producción | Endpoint independiente, no-store, publicación/canal revalidados; ahora 503 si desactivado | Sí; frontend actual no lo llama |
| src/lib/meilisearch.ts, SearchModal/InstantSearch y ProductFilters | Código legado, sin montaje en el flujo público auditado | Frontend sin cambios | Sí; no exponer host/clave ni reactivarlos por accidente |
| scripts/import-voglia-catalog.ts | Declara sync omitido y pide ejecución manual posterior | Sin cambios | Sí; importador no necesita escribir en Meili |
| docker-compose.yml y docker-compose.production.yml | Definiciones de motor/volumen para despliegues alternativos; no demuestran servicios activos en Railway | Sin cambios | No levantar compose para aplicar A; no es necesario para Railway actual |

No se encontraron otros jobs, workflow hooks, endpoints, subscribers o importaciones que invocaran Meili en los árboles auditados. Facturapi sólo lo menciona como patrón de importación. No se puede descartar un consumidor externo, clave histórica o proceso no inventariado sin acceso de lectura al motor: sigue pendiente, no se presenta una búsqueda en código como inventario universal de infraestructura.

## 3. Corrección del loader y pruebas reales

Cambios exclusivamente en rama #7:

- Registro explícito de `loaders: [registerSearchStartup]` en el módulo.
- El loader registra una función sin I/O; el hook onApplicationStart del servicio la ejecuta una sola vez por instancia. Usa el contenedor global de framework, no intenta resolver query desde el contenedor local del módulo.
- Reconstrucción únicamente con DISABLE_MEILISEARCH_SYNC distinto de true, MEILISEARCH_RECONCILE_ON_START=true y CLI cuyo argv[2] sea start o develop. Sin opt-in no reconstruye. Ningún script de producción fue cambiado para activarlo.
- Los comandos db:migrate, db:migrate:scripts y exec no activan esa reconstrucción aun heredando opt-in. Verificación de guardias sin ejecutar esos comandos ni migraciones.
- /store/catalog-search responde 503 sin resolver el índice si está desactivado; mantiene no-store y validación previa de contexto de tienda.

Ensayo ejecutado con el **CLI real medusa start**, Medusa 2.13.1, esquema local ya migrado `sicaru_fantasy_isolated_v2`, PostgreSQL existente en 127.0.0.1:55439 y binario Meili existente en loopback 57743 con directorio temporal. Fixture derivado por SWC del código corregido; configuración aislada de módulos estándar + módulo Meili, no el despliegue completo con todos los proveedores comerciales. Entorno del hijo construido por lista permitida, sin variables ni archivos .env de producción. No se ejecutó npm start, porque contiene db:migrate.

| Comprobación | Resultado final |
|---|---|
| Arranque real con sync desactivado y motor ausente | Salud 200; Store API responde, sin reconstrucción ni error Meili |
| Siete drafts locales ya existentes | Listado, q, handle, ID, intento status=draft y filtro de categoría sin resultados draft; GET por ID de producto/variante 404; listado de variantes por SKU vacío |
| Categoría local inactiva/interna | No aparece en listado Store API |
| Motor habilitado con opt-in: arranque y reinicio real de Medusa | Una reconciliación por instancia; documentos recuperados sólo published |
| Arranque sin opt-in | Número de tareas Meili sin cambios |
| Registro y guardias de comandos | Comprobados; no se ejecutaron migraciones/exec |
| Endpoint desactivado con contexto válido simulado | 503 y no-store; cero resolución de servicios |
| Conteos antes/después | Sin nuevos productos, categorías, variantes, precios, inventory_item, inventory_level, reservas ni enlaces de canal |
| Suite nueva | 14/14 resultados TAP, incluidos contenedores de pruebas |
| Regresiones previas afectadas | 16/16, repetidas porque cambió el registro/hook y la desactivación del endpoint |
| Build local backend y Admin | Correcto; sin arrancar producción ni ejecutar migraciones |
| Typecheck de alcance y whitespace | tsc -p tsconfig.search.json y git diff --check correctos |

Los siete productos existentes son draft y no tienen enlaces de canal: el ensayo HTTP no contiene un control published en ese esquema ni puede probar un cambio published→draft sin escrituras. La suite previa sí ensaya esa transición con documentos sintéticos y query simulado. No se crearon productos para ampliar este ensayo. El test anterior de helper no se presenta como sustituto del nuevo test de CLI.

Una ejecución ampliada inicial tuvo un bloqueo de anidación del arnés node:test; se detuvo sólo el proceso local, se corrigió y se repitió con timeouts HTTP. No fue un fallo de Medusa ni de producción. Los intentos de build bloqueados por permisos del sandbox se separan del resultado final del build.

## 4. Seguridad: drafts, categorías, URL y caché

**Comprobado en Store API 2.13.1:** middlewares de GET /store/products y /store/products/:id fuerzan status=published y validan canales. La ruta de categorías fuerza is_active=true e is_internal=false; el filtro category_id exige categoría activa/pública. Las rutas /store/product-variants también fuerzan product.status=published. Esto no depende de Meili. El frontend resuelve handles por esa misma API, no por consulta administrativa. Crear por primera vez drafts sin canales y categoría interna/inactiva no genera fichas desde estas lecturas.

**Hallazgo adicional de metadatos:** `src/api/storefront-config/route.ts` consulta todos los productos sin filtrar status y devuelve product_count (no nombres/IDs de draft), junto con una clave publishable. No es consumidor de Meili ni origen de las fichas, pero su contador incluye borradores. Revisar si debe ser administrativo o contar sólo publicados antes de afirmar que ninguna respuesta pública refleja borradores. No se alteró esa ruta fuera del alcance del arreglo del loader.

**Límite de garantía:** no se certifica que ningún contenido draft pueda verse por cualquier caché o expansión arbitraria de relaciones. El ensayo cubre las consultas reales del sitio y las rutas indicadas. Expansiones de relaciones no usadas (p.ej. products/category_children con fields custom), consumidores externos y todas las variantes de claves requieren revisión adicional antes de prometer una frontera pública universal.

**Caché: condición pendiente para retirada inmediata de publicados.** Fichas declaran revalidate=300 y generateStaticParams; categorías/marcas revalidate=1800. En producción se observó una ficha `x-vercel-cache: STALE`, Age 340; inicio HIT. /productos y su query respondieron private/no-store y MISS. La cabecera no-store del cliente no prueba ausencia de una copia renderizada en Vercel. Un producto antes publicado puede seguir apareciendo en una página vieja aunque Store API ya lo excluya. No se provocó esa transición en producción.

Hay POST /api/revalidate protegido por secreto, pero no se encontró subscriber/webhook automático de publicación que lo invoque. No se usó ni se comprobó el secreto. El sw.js público actual elimina caches y se desregistra; el código Serwist legado mantiene estrategias de caché, sin activación en next.config actual. Un navegador desconectado o ya abierto no permite garantía absoluta de retractación de datos que recibió antes.

Antes de garantizar retirada inmediata: elegir lecturas/renderizado dinámicos sin persistencia para contenido sensible o invalidación autenticada de todas las rutas afectadas (ficha, listados, inicio, marca, categoría, metadatos y sitemap), y ensayar published→draft con HTML/RSC/CDN/router/caché de navegador en aislamiento. No se hizo un cambio frontend dentro de esta tarea ni se purgó producción. Este pendiente afecta A y B por igual. Para los seis drafts nuevos, nunca publicados, no hay una página publicada previa que retirar; verificar ausencia de colisiones y URLs históricas inmediatamente antes del alta.

Desactivar sync no borra un índice antiguo ni revoca una clave. Si existe un motor accesible directamente, un draft filtrado puede seguir allí. El alta de drafts debe esperar a confirmar que sync está desactivado y que no hay bypass público, o aplicar un cambio mínimo revisado que cierre esas rutas. No ejecutar el script antiguo como parte del lote.

## 5. Comparación para Dirección

| Aspecto | A · Store API y Meili inactivo | B · Operar Meili con controles |
|---|---|---|
| Necesidad actual | Cubre el flujo público observado | No se encontró función pública actual que lo requiera |
| Dependencias | Medusa/PG y frontend existentes; configuración explícita de desactivación | Además motor identificado, disco persistente, claves, red, tareas, reconciliación, backup y restauración |
| Complejidad | Menor; completar paginación cuando crezca el catálogo | Mayor; añade estado derivado y coherencia asíncrona |
| Seguridad draft | Store API aplica publicación/canal; hay que cerrar bypass viejo y caché | Store API debe seguir revalidando; un filtro Meili aislado no basta; mismas obligaciones de caché |
| Operación | No mantener ni reconstruir índice para servir catálogo | Rebuild actual in-place puede vaciar/parcializar; hook corre una vez por proceso, varias réplicas pueden reconstruir secuencialmente por lock; falta política de coordinador/swap |
| Recuperación | Recuperar backend y lecturas Store API; no depende de snapshot Meili | Además snapshot/dump compatible o reconstrucción desde Medusa, restauración probada, aceptación antes de exponer |
| Ventajas de búsqueda | Coincidencias actuales y filtros; limitación de primeros 100 recibidos | Ranking, tolerancia a errores, sinónimos y facetas si se implementan y validan |
| Costos | No exige un servicio de búsqueda adicional; no hay tarifa verificada para cuantificar ahorro | CPU/RAM/disco, respaldo y operación adicionales; no hay factura/plan verificable para asignar importes |

## 6. Seis borradores Fantasy Nails sin depender del despliegue #7

**Viable en arquitectura A, con condiciones, no autorizado ahora.** Crear drafts y categoría interna/inactiva es una operación administrativa de Medusa independiente del motor de búsqueda. El ensayo anterior de workflows sigue siendo la evidencia estructural; no se repitió la creación de productos.

Antes del lote futuro: aprobar explícitamente A y su configuración mínima, confirmar DISABLE_MEILISEARCH_SYNC=true en el código productivo que sí lo respeta (subscriber), impedir script manual antiguo y accesos públicos directos al índice; confirmar todos los consumidores reales. Si se quiere desactivación exhaustiva por código sin desplegar #7 completo, preparar un cambio mínimo separado que proteja script y resoluciones y pruebe arranque sin módulo. No se afirma que ese cambio ya esté aplicado.

Reconciliar nuevamente SKU/handle en todos los estados y borrados lógicos; no duplicar registros. Con autorización individual, categoría is_active=false/is_internal=true; cada producto draft, sales_channels=[], imágenes sólo con autorización independiente, prices=[], manage_inventory=true/allow_backorder=false, sin niveles/cantidades/reservas. Los registros estructurales que genere el workflow deberán coincidir con el ensayo aprobado. Confirmar después por lectura administrativa y Store API la invisibilidad por SKU/handle/ID y categoría.

Siguen pendientes autorización formal fotográfica/publicación de URLs, precios realmente aplicados, existencias físicas, cotejo directo de V52007133 y autorización comercial de cada cambio. Este informe no autoriza suplantar esos datos ni habilitar checkout/pagos. Publicar productos después será otra autorización e incluirá SEO, WhatsApp oficial y caché; Meta también es independiente.

## 7. Aceptación y recuperación propuestas, sin ejecutar

1. Aprobar opción arquitectónica y cambio mínimo exacto; preservar SHA/config previa sin valores secretos. No fusionar #7 por necesidad de dar de alta drafts.
2. Para A: comprobar por lectura flag y bypass, sin invocar scripts; ausencia de intentos Meili/subscriber y colas de errores; catálogo/fichas/categorías/búsqueda mantienen productos publicados y contenido, no sólo HTTP 200. Continuar monitoreo de Medusa/PG.
3. Aceptar pruebas aisladas de drafts nuevos y retirada de un publicado, incluidas rutas/relaciones realmente usadas y caché. La retirada inmediata permanece pendiente; no se declara resuelta.
4. Si falla configuración A, conservar Store API como flujo público, investigar sin vaciar índices; restaurar sólo configuración previamente aprobada que no reactive indexación de drafts. Una vuelta a sync=true con código antiguo no es rollback seguro.
5. Para B: resolver identidad/persistencia/keys/backups, política de un único rebuild y recuperación de índice parcial; luego nueva autorización de despliegue y, aparte, cualquier cambio frontend. El hook corregido no hace atómica la reconstrucción ni bloquea necesariamente readiness hasta terminar: la prueba espera la confirmación explícita de reconciliación además del health.

**Decisión solicitada posteriormente:** A es la alternativa recomendada para estabilidad y mantenimiento actuales. B se justifica sólo por requisitos de búsqueda que Store API/paginación no satisfagan y por un presupuesto operativo verificado. Ninguna de las dos elimina por sí sola el pendiente de caché o acredita ausencia de consumidores externos.
