# Store API-only · corrección mínima independiente

16 de noviembre de 2026, America/Monterrey. Base productiva y main verificados: `51a6d207f6d420828433898cdb41f34d1a699229`. Rama `codex/store-api-only-guardrails`. No incorpora los cambios de #7 ni modifica #30. **Preparado para revisión, sin autorización de despliegue o altas.**

## Cambios exactos

1. Retirar registro del módulo Meili en medusa-config. Subscriber y loader antiguos quedan como entradas inertes; script manual rechaza ejecución; constructor del cliente rechaza uso accidental antes de importar el SDK. La configuración de variables no puede reactivarlos. No se elimina ni modifica un índice o clave. Reactivar búsqueda exige un cambio de código revisado, no un flag.
Los compose heredados no arrancan Meili por defecto: perfil manual, puerto sólo loopback, sin dependencia del backend ni clave de ejemplo de respaldo. Se conservan volúmenes y datos; no se ejecutó compose. El importador deja de recomendar sync manual y la plantilla de entorno documenta el modo inactivo.

2. /storefront-config exige x-publishable-api-key existente, no revocada y asociada a canales. Una selección sales_channel_id sólo puede restringir esos canales. Relee sin caché clave, enlaces y productos; sólo cuenta status=published y IDs enlazados. Pagina enlaces/productos y deduplica. Devuelve únicamente la clave presentada, nunca una clave elegida de entre todas las existentes. Sin clave: 401; sin canal o selección indebida: 403. Errores de origen no devuelven una cifra anterior/global. Cambio de contrato deliberado: consumidores anónimos deberán aportar su clave pública; no se encontró uso de esta ruta en el frontend productivo.
3. Arranque npm start y start:production dejan de ejecutar db:migrate automáticamente. No se introducen archivos, dependencias, tablas o migraciones. La preparación de esquema queda como operación separada que necesitaría autorización; no se ejecutó.
4. Subscriber de invalidación independiente: product.created/updated/deleted puede notificar al frontend mediante POST HMAC-SHA256, timestamp de 60 s y cuerpo fijo scope=catalog. Sólo está activo si se configura CATALOG_REVALIDATION_SECRET de al menos 32 caracteres. URL permitida: https://www.sicarubeauty.com/api/revalidate; loopback sólo en NODE_ENV=test. Sin redirecciones, timeout 5 s, sin secretos en logs. No se configuró en producción. Un reintento es idempotente; no requiere cola ni servicio adicional.

La invalidación es defensa adicional. La seguridad frente a contenido anterior depende del PR compañero de frontend: renderizado de catálogo y fetch sin caché, más renovación del router en eventos de recuperación. Si no hay secreto, no se envían notificaciones. Esto permite preparar borradores nunca publicados, pero no acredita una integración de invalidación operativa para retiradas.

## Pruebas ejecutadas

- 14/14 resultados TAP de guardias: flags antiguos, subscriber/loader/script/constructor, contador con publicados/drafts/otro canal/sin enlace, múltiples páginas (403 enlaces), deduplicación, clave inválida/revocada/sin canal, selección indebida, error de origen y firma/transporte de invalidación.
- 70/70 pruebas unitarias existentes (dos suites), sin servicios comerciales reales.
- CLI real Medusa 2.13.1 arrancó en aislamiento sin módulo ni motor Meili. Esquema local existente, configuración de módulos estándar + rutas/subscribers afectados; no es un ensayo de todos los proveedores comerciales de producción.
- Siete borradores existentes: listado vacío, consulta por handle vacía, GET por ID 404. /storefront-config sin clave 401; con la clave pública local y canal existente, product_count=0. Conteos de productos, categorías, variantes, precios, inventory_item, niveles, reservas y enlaces de canal sin cambios. No se crearon productos ni se migró. El control positivo publicado del contador usa fixtures en memoria; ese esquema sólo tiene drafts.
- Build backend y Admin correctos; TypeScript completo tras generación y typecheck de alcance correctos; diff sin errores de whitespace.
- CI incluye ahora las nuevas guardias. El ensayo de CLI necesita el esquema aislado ya existente y no se ejecuta sobre producción ni se añade un servicio de base de datos al CI.

El primer build reveló un enlace de canal nullable en tipos generados: corregido y repetido con éxito. No se cambió ninguna dependencia. Evidencia sanitizada en evidencia/.

## Cómo acreditar y cerrar accesos antiguos, todavía sin ejecutarlo

**Estado: PENDIENTE indispensable para la garantía global.** El diagnóstico anterior no acreditó un motor productivo ni permite concluir que no exista un proceso local o consumidor externo. Este PR impide nuevos trabajos Meili de este backend; no cierra un origen viejo por sí mismo.

1. Inventariar en lectura servicios/entornos, dominios, proxies TCP, procesos del contenedor, puerto 7700, montajes y orígenes históricos de frontend/CI/integraciones. Usar acceso operativo existente autorizado; no registrar claves SSH ni revelar cadenas o claves. Inventariar escritores antiguos y jobs/replicas aún con código anterior.
2. Desde cada origen identificado, sólo GET /health y /version sin autenticación; GET /indexes/products/documents?limit=1 sin clave puede revelar exposición, por lo que sólo registrar status y un booleano de presencia, sin guardar documentos. No ejecutar búsquedas POST. Con acceso administrativo de lectura existente: inventariar metadatos de claves, scopes, expiración e índices autorizados; suprimir valores key en salida. Revisar logs de acceso para consumidores y red; una muestra sin tráfico no prueba inexistencia.
3. Preparar el cambio de red exacto: retirar dominio/proxy público o restringirlo mediante control de acceso del proveedor; conservar origen/volumen privado, datos e identificadores. Si se necesita administración, sólo red privada/acceso administrativo controlado. Guardar configuración previa sin secretos. Esta acción necesita autorización expresa; **no se ejecutó**.
4. Aceptación posterior: no se puede recuperar salud/documentos del motor desde internet ni con una clave de búsqueda histórica; desde el acceso privado autorizado sigue disponible y conserva sus datos. El catálogo sigue usando Store API. No revocar claves, borrar documentos ni reconstruir para lograrlo.
5. Recuperación: restaurar sólo una configuración privada/administrativa autorizada. No reabrir acceso público a documentos sin revalidar ni reactivar los escritores antiguos. Rotación/revocación de claves queda como cambio distinto si Dirección lo aprueba después.

Si no puede identificarse y aislarse/certificarse el origen, dejar el control BLOQUEADO, no certificar “Meili apagado”. También hay que confirmar que no queden réplicas viejas escribiendo tras el release.

## Condiciones por etapa

| Condición | Antes de crear los seis drafts nuevos | Antes de publicar o retirar un publicado |
|---|---|---|
| Autorizar y desplegar este PR mínimo; confirmar no módulo, no trabajos y no réplicas antiguas | Indispensable | Indispensable |
| Acreditar ausencia/aislamiento del origen antiguo y escritores externos | Indispensable para garantizar que no existe bypass | Indispensable |
| Verificar SKU/handle en todos los estados, borrados lógicos e historia pública | Indispensable; nunca recrear un publicado previo como si fuera nuevo | Indispensable |
| Alta individual autorizada: draft, sin canales; categoría inactiva/interna; sin precios ni cantidades | Indispensable; el ensayo técnico no concede autorización comercial | Publicación requiere otra autorización |
| Contador con filtro de publicación/canal y lecturas Store API | Indispensable para no reflejar nuevos drafts públicamente | Indispensable |
| PR compañero de caché, invalidación autenticada, retirada HTML/RSC/sitemap | No bloquea drafts verdaderamente nuevos, nunca visibles y sin colisiones históricas | Indispensable para garantizar retirada fresca; validar canal y todas las superficies |
| Fotografías/URLs permanentes | Requieren autorización si se incluyen en el alta; no introducir activos rechazados | Aprobación visual y de publicación independiente |
| Precio realmente aplicado, stock físico y nota V52007133 | No inventar datos; mantener pendientes conforme a la autorización de draft | Resolver y autorizar la información comercial que se vaya a publicar |

No hace falta desplegar #7 completo ni recuperar/reconstruir Meili para crear drafts con esta arquitectura. Ninguna alta está autorizada por este documento. El ensayo anterior de creación conserva su alcance; aquí sólo se leyeron los registros del ensayo.

## Propuesta de despliegue y recuperación · no ejecutada

1. Resolver bypass antiguo y revisar CI, SHA final y comando real. Lectura de Railway del 16/11 confirma origen main, npm ci --include=dev && npm run build, npm run start, una réplica sfo, sin preDeployCommand ni cambios staged en la configuración devuelta. Deployment activo 238078bc-0510-44d1-b8eb-b497c63f67e0. Volver a comprobar justo antes del release; no confundir los archivos railway.* con el comando efectivo.
2. Solicitar autorización del SHA mínimo y ventana. No fusionar/deploy automáticamente por haber aprobado el informe. main dispara integración de Railway y workflow de deploy; una fusión futura puede disparar ambos: elegir UN solo mecanismo y evitar release duplicado. No desactivar/configurar nada ahora.
3. Tras autorización, usar build reproducible del lockfile y npm start sin migración, sin semillas, importadores, sync ni altas. Medir baseline de productos publicados/handles/categorías y revisar logs/colas. El constructor rechazado no debe aparecer en logs: si aparece, queda un consumidor pendiente y se detiene el release.
4. Aceptación: salud y contenido real en fichas/listado/búsqueda/categorías; contador coincide con publicados del canal, sin clave 401, otra clave/canal sin acceso; cero conexión/tareas Meili. No crear un draft productivo como prueba. Monitorear 5xx, latencia, reinicios, subscriber e invalidación configurada o explícitamente pendiente a 10/30/60 minutos. Una réplica implica posible interrupción durante el reinicio.
5. Si falla antes del corte, conservar release anterior. Si falla tras cortar, no ejecutar migraciones inversas ni restaurar PostgreSQL: este PR no cambia esquema. Preferir parche que conserve bloqueo de Meili y ruta Store API. El código anterior reactiva indexación de drafts y el contador global; **no es rollback seguro de seguridad**. No crear nuevos drafts durante incidente. Un rollback de emergencia del runtime requiere al menos aislamiento de red del motor, protección del contador y desactivación de escritores, con autorización del alcance. Mantener el esquema intacto.
6. Caché: desplegar el compañero por autorización separada antes de retiradas/publicaciones. Configurar el mismo secreto sólo en servidor backend/frontend por el canal autorizado, sin valores en PR. Validar firma, rechazo de inválidos y pérdida de entrega. No hacer downgrade a páginas persistidas durante una retirada; si falla, conservar la versión con no-store o una página neutral y corregir. No marcar productos published ni cambiar precios/stock para comprobarlo.

## Límites y pendientes

La búsqueda actual sólo filtra los primeros 100 productos recibidos y las colecciones tienen su propio límite. Paginación exhaustiva queda como mejora posterior; no se incorpora motor nuevo. El contador sí recorre sus páginas para no presentar una cifra truncada. No hay datos verificables para cotizar infraestructura adicional.

Los avisos de vulnerabilidades siguen separados. Ningún cambio toca precios, inventarios, checkout, pagos, imágenes o aprobación visual. PR #7 y #30 siguen independientes y sin fusionar. Los accesos directos al índice continúan pendientes; la corrección está preparada para revisión, no declara GO comercial ni de producción.
