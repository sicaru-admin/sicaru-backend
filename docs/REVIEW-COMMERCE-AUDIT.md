# Auditoría de compra en preview-payments

Esta revisión conserva DHL desactivado y no cambia precios, impuestos, existencias, reservas, credenciales ni producción.

## Evidencia fiscal de Store API (18 de octubre)
El SKU VOGLIA-TINTE-90ML devuelve calculated_amount=85 e is_calculated_price_tax_inclusive=false. La línea del carrito conserva unit_price=85 e is_tax_inclusive=false; IVA 16%, tax_total=13.60, item_total=98.60. La suma viene del backend; no es un redondeo del cliente. El catálogo aislado tiene nueve productos/nueve variantes; solo un producto tiene un recurso de fotografía en el catálogo, mientras que el maestro histórico con tonos y combos no acredita el catálogo aislado actual ni sus existencias.

Pendiente de decisión: precio final aprobado, con IVA, del tubo individual. No asignar $97 del maestro ni confundirlo con un combo. Antes de corregir la inclusión fiscal se deben consultar las preferencias existentes y su alcance por moneda/región, revisar qué otros SKU afectarían y conservar los precios comerciales aprobados. No eliminar el IVA ni cambiar únicamente el número mostrado en la pantalla.

## Auditoría administrativa de solo lectura
Desde el repositorio completo y un proceso que ya esté vinculado exclusivamente a preview-payments:

```sh
npx medusa exec ./src/scripts/audit-review-commerce.ts
```

No usar credenciales de producción ni copiarlas a otra máquina. El comando exige proyecto, entorno y servicio de revisión exactos y bindings de Postgres/Redis con los hosts privados previstos. Se niega a iniciar si falta alguno. Es una comprobación de bindings, no una certificación del origen histórico de cada registro.

El informe no imprime secretos, correo/teléfono de clientes ni contraseñas: contiene variantes, relación con inventario, ubicaciones/canales, existencias/reservas calculadas por Medusa, preferencias fiscales, tasas e indicadores booleanos del modo de prueba de Mercado Pago. Si una sección no puede leerse, figura en unavailable y no debe considerarse verificada. No realiza solicitudes de pago ni modifica datos. Se compila y sus guardas se prueban sin conectarse a datos reales.

## Bloqueos actuales
OAuth de Railway devuelve nombres de variables, sin valores. /admin/inventory-items devuelve 401. El backend activo sigue en 68a3d94; el diagnóstico de seguridad de pago preparado en 4560720 no está desplegado (/store/review-readiness da 404). Este nuevo comando tampoco se ha ejecutado contra Railway.

Faltan tarifa, modalidad, cobertura y plazo de paquetería aprobados; no puede iniciarse una compra de prueba pasando por alto ese bloqueo. Tras confirmar credenciales de prueba e inventario aislado, se comprobarán aprobación, rechazo, pendiente, reintento, creación única del pedido y consulta administrativa con datos de prueba. Las pruebas de helpers y compilación no acreditan ese recorrido.
