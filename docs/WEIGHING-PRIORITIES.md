# Productos prioritarios para medir

Orden de trabajo para habilitar combinaciones sencillas de la primera venta; no es un ranking de ventas, porque no se consultaron ventas reales. Las 24 filas del catálogo fuente están pendientes de medición. No se supone que dos tonos pesen lo mismo.

| Prioridad | Producto/SKU | Qué medir |
| --- | --- | --- |
| 1 | Voglia All in One Keratin 250 ml — VOGLIA-ALL-IN-ONE-250ML | Una unidad cerrada, con botella/tapa y envase comercial |
| 1 | Voglia Tinte Permanente 90 ml, 1 Negro — VOGLIA-TINTE-1-90ML | Una unidad cerrada, con tubo/tapa y envase comercial |
| 2 | Tinte Voglia 90 ml: 3 Castaño oscuro; 5 Castaño claro; 6 Rubio oscuro; 7 Rubio medio | Medir y registrar cada SKU/tono por separado |
| 3 | Los otros 18 tonos del CSV | Medir cada variante antes de permitir su pago con DHL |

La plantilla PESAJE-PRIORITARIO.csv enumera los 24 SKUs y sus tonos exactos. Los campos medidos quedan vacíos: no se inventó ningún peso ni se tomó 90/250 ml como gramos.

## Datos que necesita la implementación

- variant_id real de Medusa y SKU para asociar la medición a la variante correcta.
- unit_weight_g: peso de una unidad vendible completa, en gramos, incluyendo el envase primario y el empaque comercial que acompaña a esa unidad.
- includes_primary_packaging: confirmar true únicamente si la unidad se pesó completa.
- source y verifiedAt: referencia de la medición (foto/registro/báscula) y fecha real en ISO 8601. No rellenar una fecha como si la medición ya se hubiera realizado.
- Por combinación exacta de variantes y cantidades: tara del empaque de transporte, en gramos, incluyendo caja/sobre, protección, cinta y demás material exterior. No volver a sumar los envases de los productos.
- Largo, ancho y alto EXTERNOS del paquete terminado, en centímetros. Anotar también el peso bruto medido, en gramos, para comprobar la suma de unidades y tara.

EMPAQUES-PARA-PESAR.csv propone tres combinaciones iniciales para comprobar el embalaje, sin afirmar que un determinado tamaño de caja sea suficiente. Se necesitan los IDs reales para convertirlas a las firmas de paquetes que usa la configuración.

El peso volumétrico, divisor, redondeo, cobertura/remoto y vigencia de DHL siguen pendientes. Medir productos no activa por sí solo las tarifas.
