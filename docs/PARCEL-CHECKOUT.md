# Cotización aprobada antes de pagos online

Decisión de esta etapa, 21 de octubre de 2026: solo paquetería con cobertura y costo confirmados antes de iniciar pagos. Cambios sobre `codex/dhl-provisional`, conservando PR #5. No se cambiaron productos/precios comerciales, secretos, bases remotas, migraciones o producción; no se crearon pagos, pedidos, guías ni facturas reales.

## Correcciones

- `config/dhl-provisional.json` sigue deshabilitado y ahora declara aprobación pendiente. Los $214/$270/$118 están separados como referencias no aprobadas, con `ratesMxn=null`.
- La política ya no admite `provisional_manual` como aprobación ni calcula precios fijos codificados. Requiere cuenta, aprobación comercial explícita no provisional y vigente, tarifas con precisión de centavos, IVA incluido, recargos, pesos/empaque y cobertura respaldados.
- La cotización incluye modo comercial, aprobación, cobertura, inclusión fiscal, identidad, huella de carrito/cantidades/dirección y vencimiento. El importe se toma exclusivamente de la política aprobada y se contrasta con la opción elegible de Medusa.
- Los métodos guardados necesitan identidad y huella actuales, mismo importe e inclusión fiscal, cero descuento de envío y total exacto de productos más envío. Las opciones locales de $49/$40, gratuitas, mixtas o guardadas sin evidencia no permiten pagar.
- Se protegen la creación de colecciones y sesiones de pago y los workflows de selección de envío y finalización. Se comprueban contacto, dirección, importes y moneda del carrito/colección/sesión. Se rechaza el proveedor de pago manual.
- Se suspende la excepción histórica de envío de prueba por $214 incluso si queda su opt-in en un entorno anterior. El preparador de esa opción queda sin escrituras; la propuesta de DHL es una plantilla deshabilitada sin precios.
- Los carritos rechazados se conservan; la respuesta es **Envío por cotizar** sin opción pagable. El storefront permite consultar paquetería por WhatsApp.

## IVA y totales fiscales

Medusa v2 maneja importes en MXN, no centavos. Se elimina la división entre 100 de las dos rutas de facturación y de la confirmación de WhatsApp; esta última usa el total guardado del pedido, con envío, descuentos e IVA.

FacturAPI recibe explícitamente `tax_included` según la línea guardada. Antes de crear un cliente externo o CFDI se reconcilian partidas, IVA y total. **La clasificación SAT de paquetería y el tratamiento de descuentos aún requieren revisión:** esos pedidos detienen la emisión en lugar de emitir una factura incompleta. Esto es un pendiente para publicar, no una solución fiscal comercial completa. El entorno aislado también bloquea la emisión manual de facturas.

## Pruebas y límites

- 80 pruebas correctas en once archivos con `npm run test:dhl`, incluidas guardas de rutas/workflows, precios no aprobados, expiración, cobertura, cantidades, dirección, promociones de envío, IVA, importes y emisión fiscal simulada.
- TypeScript correcto y compilación completa de Medusa/backend y Admin correcta. Para ejecutar el CLI sin escribir en el home se usó `XDG_CONFIG_HOME=/workspace/work/medusa-config MEDUSA_TELEMETRY_DISABLED=1 npm run build`. El compilador Admin necesitó acceso de red del proceso para abrir un puerto local de Vite; no se desplegó nada.
- Los importes aprobados de las pruebas son **sintéticos**, distintos de $214/$270/$118. No validan una tarifa real. La configuración incluida no permite cotizar comercialmente.
- Navegador frontend: 36 comprobaciones con UI real y API local sintética; [evidencia y protocolo en el otro repositorio](https://github.com/sicaru-admin/sicaru/blob/codex/dhl-provisional/docs/PARCEL-CHECKOUT.md).
- No se ejecutó una integración con la base de datos de Medusa ni se ensayaron pagos. Mercado Pago `2034 Invalid users involved` continúa pendiente; no se intentó resolver mediante cobros reales.

## Antes de publicar

Validar cuenta/tarifas comerciales, recargos e IVA; cargar evidencia vigente de pesos, empaque y cobertura; contrastar cotización y método persistido contra Medusa aislado. Revisar la oferta y aprobación de precios del tubo Voglia frente al combo, sin ejecutar importadores ni cambiar precios automáticamente. Acordar clasificación fiscal y descuentos. Completar posteriormente el protocolo de pago sandbox con identidades válidas, sin cargos reales. Mantener el PR en borrador y requerir aprobación antes de producción.

Los documentos anteriores de envío provisional y revisión son históricos; esta decisión suspende sus tarifas y la excepción de prueba online.
