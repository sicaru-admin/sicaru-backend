# Envío exclusivo de pruebas — SICARÚ

Esta opción manual de Medusa permite revisar el checkout sin declarar pesos ni cobertura DHL y sin una entrega real.

## Activación exacta

Solo Railway preview-payments, entorno `a04c43a9-03ec-44ff-8486-f64524c1cc8f`, proyecto `7b251006-cebd-48b3-a7a5-97b6c65d6baf`, servicio `50beb418-f34d-467d-b1f2-111c725c807d`.
Variable explícita: `SICARU_REVIEW_SHIPPING=review-shipping-214-v1`.
Se mantienen el arranque/auditoría existentes; se crea la opción durante el arranque protegido. No cambia precios de productos, preferencias fiscales ni inventario.

Requiere bindings privados de la base y Redis, sandbox Mercado Pago, ambas claves TEST y acceso real GET a métodos activos de tarjeta. Una ausencia o error cierra la excepción.

Nombre público: **Envío de prueba · Sin entrega real**.
Proveedor manual `manual_manual`, precio fijo **$214 MXN, IVA incluido**. Tipo `sicaru_review_no_delivery` y datos `sicaru_review_shipping: review-shipping-214-v1`, `no_real_delivery: true`.

Se crea un conjunto/zona de cumplimiento identificados como PRUEBA para el enrutamiento técnico de México. No representa cobertura comercial ni utiliza DHL. No crea guías ni solicitudes de entrega. La opción y el vínculo se crean solo si no existen; conflictos/duplicados bloquean la configuración y no se sobrescriben.

## Restricciones del servidor

- Solo los SKU de combo de revisión `SICARU-TEST-COMBO-VOGLIA-1` y `SICARU-TEST-COMBO-VOGLIA-3`, con el handle y metadata del fixture aprobado.
- Cada línea conserva $97 IVA incluido. No se cambia ningún precio. Se comprueban el subtotal de Medusa y la ausencia de descuentos.
- Cada variante debe requerir exactamente un tubo de su tono y un peróxido 20 vol 140 ml, ambos con identificación de inventario ficticio de prueba. El control de existencias y las validaciones nativas de Medusa siguen activos.
- Región y canal exactos; ubicación/canal/proveedor manual confirmados al preparar la opción.
- Dirección de prueba en México y formato postal de cinco dígitos; contacto/dirección completos antes del pago. No se valida ni promete cobertura de un transportista.
- Una sola opción seleccionada, identificador/importe/IVA correctos, envío $214, carrito y colección de pago con importes coincidentes.
- Solo Mercado Pago en la ruta protegida de creación de sesión de pago.
- Antes de completar, una sola sesión vigente, importe/currency coherentes y GET real del pago en Mercado Pago. Se exige `live_mode=false`, MXN y monto idéntico al carrito. Pago pendiente o rechazado no confirma un pedido.
- Las validaciones DHL existentes se mantienen. Fuera del entorno, sin activación, o con artículos ajenos a prueba, esta excepción no permite pagar. Tampoco admite el método local anterior de $49.

## Importes esperados

| Productos | Envío de prueba | Total |
|---|---|---|
| 1 combo: $97 | $214 | **$311** |
| 3 combos: $291 | $214 | **$505** |

Estos importes pasan pruebas automatizadas. No constituyen evidencia de cobro real ni de un pedido de prueba desplegado.

## Revisión después del despliegue autorizado

1. Comprobar SHA, log `SICARU_REVIEW_SHIPPING`, opción manual y activación solo en el entorno indicado.
2. En la Preview de `codex/dhl-provisional`, un combo → dirección sintética → elegir el nombre exacto → confirmar productos $97, envío $214 y botón Pagar $311.
3. Repetir con tres combos y total $505; comprobar el importe enviado al proveedor y guardado en el pedido, no solo el texto de pantalla.
4. Usar tarjetas/datos publicados de prueba de Mercado Pago para aprobado, rechazado y pendiente. No introducir tarjetas reales. La selección de resultado en la tarjeta es un mecanismo sandbox del proveedor, no una respuesta simulada de SICARÚ.
5. Comprobar rechazo y reintento, doble toque y recarga: identificadores únicos de pago/pedido, misma compra sin duplicación y confirmación solo con pedido real.
6. Consultar pedidos en administración del backend aislado; comparar productos/tonos, dirección sintética, envío, moneda y total con el pago.
7. Revisar inventario y reservas de los tubos de prueba y del peróxido compartido. Una compra de n combos debe comprometer n tubos de sus tonos y n peróxidos, una sola vez. No reponer stock automáticamente ni usar existencias anteriores como fuente.
8. Registrar por separado qué se comprobó en navegador, por API, en pruebas sintéticas y qué permanece bloqueado. Sin una sesión administrativa de revisión no se declara consultado el pedido.
9. Desactivar `SICARU_REVIEW_SHIPPING` y redesplegar únicamente revisión cuando termine esta revisión. La opción almacenada no puede pasar los controles de selección/pago al retirar la activación.

## Límites

No se activa ni contrata DHL, no hay pesos/dimensiones/cobertura inventados y no se compran guías. No se modifican producción ni precios. Los PR #8 y #5 permanecen en borrador. Los pagos y pedidos de prueba de extremo a extremo requieren aplicar este despliegue antes de verificarse.

## Automatismos externos

Los suscriptores de WhatsApp, de facturación y los trabajos de recordatorio retornan antes de resolver esos servicios en el entorno exacto de revisión, incluso después de retirar la activación de envío. Esto evita mensajes y facturas de prueba fuera del sistema aislado. No cambia su comportamiento en otros entornos. Las pruebas ejecutan esos manejadores con un contenedor que falla si intenta resolver cualquier servicio.
