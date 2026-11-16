# Revisión DHL provisional — SICARÚ

Se preparan cambios para los repositorios existentes sicaru y sicaru-backend. No se ha modificado Medusa en producción, publicado código, cobrado un pago ni generado una guía. Las dos copias locales son parciales y conservan la procedencia de sus fuentes; los parches deben aplicarse en clones completos para compilar e integrar.

## Decisiones y cálculo

| Caso de peso facturable, incluido el empaque | Resultado preparado |
| --- | --- |
| Desde 1.000 hasta 2.000 g inclusive | $214 MXN |
| Más de 2.000 hasta 5.000 g inclusive | $270 MXN |
| Zona remota con evidencia vigente para el servicio, origen y CP | +$118 MXN: totales de $332 o $388 |
| Menos de 1 kg o más de 5 kg | Cotización por WhatsApp, sin precio pagable |
| Peso, empaque, cobertura o condición remota sin verificar | Cotización por WhatsApp, sin precio pagable |
| Cuenta, vigencia, IVA, recargos o base de facturación sin confirmar | Cotización por WhatsApp, sin precio pagable |

El envío local de $40 MXN se coordina por WhatsApp y se paga fuera del checkout. El enlace conserva productos, cantidades y variantes. No se modifican precios de productos.

La cuenta negociada exige un mínimo de cuatro envíos al mes, sin compra anticipada de guías. Se debe confirmar el alta y la vigencia de estas tarifas para la primera venta foránea. Estas condiciones no se confunden con un mínimo de cuatro productos por pedido y no activan ningún cobro ni compra de guías.

## Evidencia inspeccionada y límites

- Las 24 filas del CSV aprobado de Voglia tienen weight_g y las tres dimensiones vacíos. Véanse source-weight-audit.json y voglia-weight-audit.csv.
- El CSV declara gramos y centímetros. El importador solo enumera esos encabezados: no asigna weight/length/width/height. Los ml de presentación describen contenido, no masa.
- seed-sicaru.ts no define pesos de los productos; conserva una opción manual Cadereyta a $49 con geo_zona de tipo país México. Eso describe el código inicial, no el estado productivo.
- seed.ts es el catálogo de ejemplo: contiene cuatro pesos de 400 sin evidencia física. No se usan como pesos de SICARÚ.
- Medusa 2.13.1 expone pesos de producto y variante, pero sus tipos numéricos no confirman por sí solos la unidad o si se incluye el envase. No se usa automáticamente el peso del producto cuando falta el de una variante.
- La consulta directa de la instancia productiva falló porque proxy:8080 no es accesible desde el entorno. El conector Railway muestra nombres de variables y no ofrece ejecución administrativa de Medusa o lectura de la base. No hay identidad administrativa configurada en el entorno. No se inspeccionaron ni cambiaron las opciones, zonas, reglas o pesos REALES.

## Diseño preparado

1. config/dhl-provisional.json está desactivado, sin pesos, cobertura, empaques ni IDs inventados.
2. src/lib/dhl-policy.ts calcula solo con datos físicos verificados y evidencia fechada. Todos los pesos se expresan en gramos; las dimensiones externas de transporte, en centímetros.
3. Cada variante necesita el peso de la unidad con su envase primario. Una combinación exacta de variantes y cantidades necesita un empaque de transporte verificado con tara y, cuando corresponda, dimensiones externas. No se supone una caja automática ni se multiplica ml por una densidad ficticia.
4. El contrato debe confirmar si el peso facturable es el real o el máximo entre real y volumétrico. En el segundo caso se requiere el divisor confirmado; no se presupone 5.000 o 6.000. Se usa largo × ancho × alto / divisor en kg, con dimensiones en cm; luego se convierte a gramos. La regla de redondeo también debe confirmarse. Un paquete menor de 1 kg facturable no se convierte automáticamente en una tarifa mínima.
5. La cobertura requiere una entrada exacta por CP con servicio, origen, fecha, vigencia y clasificación remota true/false. Sin entrada, con valor desconocido o evidencia vencida se cotiza por WhatsApp. No se deduce una zona remota por estado ni por prefijo postal.
6. Las cuatro opciones propuestas son servicios DHL cumplidos manualmente con el proveedor existente manual_manual; no representan una conexión a una API de DHL. El precio y los impuestos del servicio elegible que devuelve Medusa deben coincidir con la regla. Medusa sigue comprobando sus perfiles, zonas, reglas y existencias.
7. GET /store/carts/:id/dhl-quote entrega una opción aprobada o una solicitud de cotización, con Cache-Control privado y sin caché. El frontend deja de confiar en la antigua lista pública de IDs.
8. Los hooks del backend impiden añadir una opción diferente o completar un carrito con un método local de $49 conservado. El middleware de sesiones de pago exige un carrito DHL válido y una colección de pago con el mismo total. Una dirección, cantidad, tarifa, impuesto o descuento de envío que cambie el resultado invalida la selección anterior.

## Auditoría administrativa pendiente, de solo lectura

En un clon completo con dependencias y acceso al contenedor Medusa, ejecutar:

```sh
DHL_AUDIT_OUTPUT=/tmp/sicaru-dhl-audit.json npm run audit:dhl
npm run plan:dhl
```

audit:dhl solo consulta productos/variantes, pesos y dimensiones originales, opciones, reglas de envío, precios, reglas de precio, perfiles, zonas y almacenes. El resultado no consulta clientes, pedidos ni credenciales. plan:dhl solo imprime una propuesta; no la aplica. Si alguna consulta no es compatible con la instancia, debe corregirse según el esquema real antes de considerar completa la inspección.

## Preparación de Medusa, sin aplicar

- Obtener del informe los IDs reales de zona de servicio, perfil, almacén y región MXN. Revisar cobertura efectiva, impuestos, promociones y relaciones entre almacén y proveedor.
- Validar el alta DHL y la cotización por escrito: servicio, origen, vigencia, IVA incluido y posibles conceptos adicionales, base volumétrica/divisor y redondeo. Los precios preparados son importes finales de referencia; el código no añade un IVA supuesto.
- Medir y registrar peso de cada variante con envase primario y las combinaciones de empaque de transporte verificadas. No cargar datos de prueba de tests/dhl-fixtures.mjs.
- Obtener una fuente DHL o verificación documentada para cada destino admitido, incluyendo clasificación remota. No generar una zona nacional genérica que aparente cobertura universal.
- Deshabilitar en Medusa la regla enabled_in_store de la opción local anterior y revisar promociones de envío. No basta renombrarla ni sustituir su precio.
- Preparar las cuatro opciones flat de $214/$270/$332/$388, desactivadas inicialmente; asignar solo IDs de zonas/perfiles reales y confirmar su tratamiento fiscal. Registrar los IDs verificados en optionIds.
- Instalar el endpoint, middleware y hooks en el backend existente. Si ya existe middlewares.ts al integrar, combinar rutas y conservar las ajenas.
- Proporcionar el archivo revisado mediante DHL_POLICY_FILE en una ruta que exista en el contenedor compilado. Si el archivo no existe o no se lee, se devuelve cotización manual. El directorio config debe incluirse/montarse expresamente al preparar la distribución.
- Activar enabled solo tras completar pruebas contra Medusa real en un entorno de prueba. La autorización actual no incluye producción.

## Comprobaciones

- Las 10 pruebas anteriores pasaron antes de editar.
- Frontend: npm run test:shipping, 16 pruebas pasadas.
- Backend: npm run test:dhl, 27 pruebas de política y 15 de servidor pasadas.
- Los límites son 999, 1.000, 1.999, 2.000, 2.001, 4.999, 5.000 y 5.001 g. También se prueban peso ausente, empaque, cantidades, volumétrico, cobertura desconocida/vencida, remoto validado, total del pedido y opción local de $49.
- Los límites SDK/Medusa se sustituyen por dobles en memoria. Las pruebas no acceden a pagos, DHL, pedidos reales ni la base de producción.
- Se prueban la propuesta de configuración de solo lectura y la auditoría sin mutaciones.
- Las compilaciones completas se intentaron y están bloqueadas por dependencias ausentes: next: not found y medusa: not found. No se confirmó TypeScript contra todas las dependencias, integración real ni navegador. No hay vista previa ejecutable en este entorno.

## Datos y accesos que faltan

1. Conexión HTTP funcional al backend y acceso de lectura/ejecución administrativa a Medusa para obtener la auditoría real; no enviar contraseñas ni tokens en el chat.
2. Pesos medidos por variante, con unidad g y envase incluido; tara y dimensiones externas de los empaques correspondientes.
3. Documento DHL vigente: servicio, origen, alta, IVA/otros conceptos, redondeo y regla volumétrica/divisor.
4. Fuente de cobertura y zonas remotas por destino con fecha y vigencia.
5. Clones completos y dependencias para construir Next/Medusa y probar en un entorno de revisión, sin cobros reales ni guías.
