# SICARÚ · KÜÜL Cure Me Reconstructor System 1 kg · propuesta de corrección administrativa

**ESTADO: PROPUESTO · NO EJECUTADO · SIN CAMBIOS DE PRODUCCIÓN**

Fecha del diagnóstico: 26 noviembre 2026. Este documento solo propone una operación futura en Medusa; **no autoriza ni ejecuta escrituras**.

## Objetivo de negocio
Eliminar la confusión entre mascarilla/reconstructor de **1 kg**, shampoo Cure Me **1 L** y leave-in Cure Me **1 L**, antes de incorporar la fotografía aprobada a la web informativa.

## Identificadores: NO son intercambiables

| Sistema/documento | Dato observado |
|---|---|
| Medusa público (25/11/2026) | Product ID `prod_01KVV3GD5ZFG0NT90YWFXRPZFK` |
| Medusa público | Variant ID `variant_01KVV3GD877SSAGARCPETM9JT5` |
| Medusa público | Título `Küül Cure Me Reconstructor 1L`; variante `1L`; SKU técnico `KUUL-CURE-1L` |
| Base Maestra, hoja `BASE_MAESTRA_PRODUCTOS`, fila 76 | `PRD-1A10D85B307D`, código en hoja `3136871`, `Cure Me Reconstructor System`, **1 kg** |
| Base Maestra, fila 77 | Referencia separada de **245 g**: `PRD-01A70147D6CF` |
| Factura Henkel FA1123765101 (09/06/2026) | `Kuul Cure Me Recons 1 kg`; `NoIdentificacion=7501438366445` |
| Factura Henkel FA1124490778 (28/09/2026) | `Kuul Cure Me Reconstructor System 1 Kg`; `NoIdentificacion=7501438306731` |
| Factura Henkel FA1124762867 (10/11/2026) | `Kuul Cure Me Reconstructor System 1 Kg`; `NoIdentificacion=7501438306731` |
| Factura Henkel (referencias distintas) | Leave-in 1 L: `7501438368500`; shampoo 1 L: `7501438368494` |
| Fotografía real aportada por la propietaria | Tarro **KÜÜL Cure Me Reconstructor System, 1 Kg**, KÜÜLPLEX+ visible en empaque |

**Interpretación limitada:** los XML muestran una transición de `NoIdentificacion` entre junio y septiembre; **no** prueban ni la fecha ni la causa del cambio de fórmula, ni existencia física, ni que esos números sean EAN impresos. La imagen frontal no revela su código de barras.

## Estado de la foto / dependencia frontend
El frontend `sicaru-admin/sicaru`, **PR #57**, mantiene una página de QA `/qa/kuul-cure-me-1kg` con `01-principal.webp` recortado y verificado por Codex en Preview. El PR permanece borrador; la foto no está publicada como galería de la ficha comercial. **No asociar a Medusa una URL que aún no sea pública y estable.**

## Antes de cualquier escritura

1. Recuperar acceso administrativo autorizado o mecanismo seguro de ejecución; sin acceso, **BLOQUEADO**. No emplear SQL directo, claves publicables como Admin ni crear usuarios paralelos para forzar el cambio.
2. Guardar un snapshot autenticado **de solo lectura**, mínimo: `id,title,handle,subtitle,description,thumbnail,images,variants[id,title,sku,barcode,ean,prices,inventory_items],status,sales_channels` del ID indicado.
3. Reconciliar en Admin que la ficha corresponde a **la mascarilla/reconstructor 1 kg** y no a un producto legítimo diferente de 1 L. Si la identidad es dudosa: detenerse.
4. Comprobar código físico del envase actual (foto del reverso o lectura del POS), registrando histórico de Henkel por separado.
5. Obtener autorización específica de Dirección sobre los cambios exactos a título, presentación, *handle* y galería; decidir SKU interno con Compras/Inventario. No deducir que el código de proveedor debe reemplazar el SKU existente.
6. Validar que la nueva imagen sea accesible en producción antes de apuntar a ella y coordinar el despliegue de frontend y la operación Admin sin ventanas inconsistentes.

## Cambios propuestos, no autorizados

| Campo | Actual observado | Propuesta | Condición |
|---|---|---|---|
| `title` | `Küül Cure Me Reconstructor 1L` | `KÜÜL Cure Me Reconstructor System 1 kg` | Identidad 1 kg comprobada y aprobada |
| `variants[0].title` | `1L` | `1 kg` | Identidad y opciones nativas verificadas |
| `subtitle` / `metadata.presentation` | Por inspeccionar en Admin | `1 kg` donde corresponda | No sobreescribir atributos no relacionados |
| `handle` | `kuul-cure-me-reconstructor-1l` | `kuul-cure-me-reconstructor-1kg` | Coordinación SEO + redirección permanente desde URL antigua, tras autorización |
| `thumbnail` / `images` | Por inspeccionar en Admin | Fotografía real del PR #57 | Imagen de producción verificada; preservar relaciones válidas |
| `sku` | `KUUL-CURE-1L` | **Sin propuesta de valor nuevo** | Conciliar primero con POS y base; decisión comercial separada |
| `barcode` / `ean` | No acreditado | **Sin modificación** | Evidencia física |
| precios, inventario, variantes ajenas, pagos, logística | No inspeccionados/ajenos | **SIN CAMBIOS** | Prohibido dentro del alcance |

**Importante:** no cambiar un *handle* sin redirección y prueba de enlaces, sitemap, metadatos, mensajes WhatsApp, búsqueda y favoritos; no asumir que Medusa conserva alias antiguos.

## Procedimiento futuro tras aprobaciones

- Realizar GET Admin autenticado y comparar contra el snapshot antes de aplicar cualquier cambio. Si los datos cambiaron desde la auditoría, cancelar.
- Preparar una operación acotada sobre **el ID exacto**, sin crear otro producto. La actualización de variante, producto y relaciones fotográficas puede requerir operaciones separadas y reversibles; comprobar API/flujo de Medusa 2.13.1 antes de invocar.
- Mantener el SKU y atributos financieros tal como están si no existe conciliación independiente.
- Validar preview/producción con HTML y captura a 320, 390 y 1440 px: título 1 kg, foto correcta, selección, CTA WhatsApp, rutas antiguas con redirección y nuevas con 200; checkout y pagos permanecen bloqueados.
- Guardar valores anteriores y mecanismo de rollback administrativo. Ante fallo, revertir sin alterar inventario ni pedidos.
- Confirmar SHA de despliegue y URL pública después de **autorización específica de publicación**.

## Decisión pendiente

**No se puede ejecutar aún la corrección en Medusa:** sigue pendiente recuperar acceso administrativo y verificar el EAN de la unidad física. Este PR es exclusivamente documental. La aprobación visual de la foto no es autorización automática para modificar producto/variante, precio, SKU, inventario o producción.


## Diagnóstico de acceso Admin (consulta Railway, 26/11/2026)

**Hechos comprobados, solo lectura:**

- Proyecto Railway `passionate-charisma`, entorno `production`, servicio `sicaru-backend` desplegado desde `sicaru-admin/sicaru-backend@main`.
- Último despliegue de backend visible en Railway: **SUCCESS**, 12/11/2026. No hay cambios de infraestructura en espera.
- Dominio del servicio: `https://sicaru-backend-production-8324.up.railway.app`.
- El servicio define los nombres de variables `ENABLE_ADMIN`, `DISABLE_ADMIN`, `ADMIN_CORS`, `AUTH_CORS`, `COOKIE_SECRET` y `JWT_SECRET`. **No se han leído ni impreso valores secretos**.
- El código `medusa-config.ts` define `disableAdmin = DISABLE_ADMIN === "true" || (NODE_ENV === "production" && ENABLE_ADMIN !== "true")`. La existencia de nombres de variables NO prueba su valor efectivo.
- No figuran nombres de variables SMTP, RESEND, SENDGRID ni MAILER entre los nombres listados en Railway. `medusa-config.ts` no registra módulo de notificaciones de correo. **Esto no confirma por sí solo que una ruta de recuperación de contraseña sea imposible**, pero obliga a demostrar entrega antes de utilizarla.
- No se observaron líneas concluyentes de autenticación fallida en los registros de despliegue disponibles. Un despliegue SUCCESS no demuestra que el inicio de sesión sea correcto.

**Ruta segura de diagnóstico SIN restablecer contraseña aún:**
1. Propietaria comprueba desde navegador su acceso a Admin con correo exacto de la cuenta existente, evitando autofill de cuentas antiguas, sin comunicar contraseña a Codex/ChatGPT.
2. Si falla, revisar código HTTP de la solicitud de autenticación y si es 400/401 (credenciales), 403 (permiso/CORS), 429 (rate limit), o 5xx (servidor), sin registrar cookies o tokens. No usar reintentos masivos.
3. Comprobar de forma autorizada la presencia del usuario exacto en el directorio de identidades del Admin, **solo lectura** y minimizando datos personales; distinguir usuario inexistente, cuenta sin permisos y contraseña inválida.
4. Verificar que el proveedor de correo está disponible antes de ofrecer "olvidé mi contraseña"; no exponer tokens de recuperación en logs, PR ni conversación.
5. Si no hay recuperación disponible, preparar mediante Codex un plan de recuperación usando las capacidades oficiales de Medusa 2.13.1 sobre la cuenta existente, con respaldo, autorización explícita y rollback. **No ejecutar comandos de creación de usuarios ni mutaciones en producción durante el diagnóstico.**

**Prohibiciones:** jamás pedir ni copiar credenciales, JWT/COOKIE secrets o contraseñas en chat/PR; no desbloquear Admin alterando `ENABLE_ADMIN`, `DISABLE_ADMIN`, CORS o secretos por ensayo y error; no modificar directamente Postgres ni desplegar scripts de cambio de contraseña sin aprobación.

**Conclusión:** backend operativo según Railway, **acceso Admin no restablecido ni confirmado**; la corrección del producto sigue bloqueada.
