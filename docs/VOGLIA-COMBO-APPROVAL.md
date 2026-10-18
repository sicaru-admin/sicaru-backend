# Oferta aprobada de Voglia (18 de octubre de 2026)

La propietaria confirmó para la web el combo de un tubo de tinte Voglia de 90 ml y un peróxido de 140 ml, a **$97 MXN finales con IVA incluido**. Esta aprobación resuelve la decisión comercial de ese combo. No corresponde asignarla automáticamente a una variante que represente únicamente un tubo.

La oferta queda registrada en src/lib/approved-voglia-offer.ts. No es un peso de envío: 90 y 140 ml son contenido declarado. No se infieren gramos ni peso del empaque.

## Antes de aplicar datos
- Identificar la familia/variantes y el inventario requerido de ambos componentes; conservar control de inventario y ventas sin existencias desactivadas. No copiar stock histórico.
- Consultar preferencias fiscales de Medusa y evaluar su alcance; no cambiar la inclusión de IVA para otra moneda, región o SKU sin revisar el impacto y la autorización.
- Aplicar el importe/fiscalidad en Medusa y después comprobar catálogo, línea del carrito, subtotal, IVA incluido y cantidad 2 (productos $194 antes de envío). Un combo de $97 no debe convertirse en $112.52 al agregar impuestos de nuevo.
- Mantener separados los tonos. Este catálogo de revisión no tiene acreditados los dos componentes ni todos los tonos del maestro.

## Auditoría preparada
El loader ejecuta únicamente lecturas cuando SICARU_REVIEW_AUDIT_ON_START=true y coinciden el entorno exacto preview-payments, el proyecto/servicio y los bindings privados previstos de Postgres/Redis. No corre en producción. Si no puede acreditar bindings, no lee datos; si una consulta falla, el informe queda incompleto. No imprime secretos ni datos personales, no cambia precios, impuestos o stock y no llama a pagos.

La activación en Railway se prepara como cambio staged de revisión, nunca como modificación de producción. Requiere aplicar el despliegue pendiente para observar el informe privado antes de definir la migración de datos. El acceso administrativo actual devuelve 401 y OAuth no revela valores de variables. No se ha aplicado aún el precio a Medusa ni se debe simular en el frontend.

DHL permanece desactivado. Los PR #8 y #5 continúan en borrador.
