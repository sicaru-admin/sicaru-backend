# Plantilla maestra del catálogo Voglia

Esta plantilla sirve para ordenar y validar la información real del catálogo Voglia antes de cualquier carga en Medusa. No es un archivo de importación automática: primero debe revisarse y aprobarse.

## Reglas generales

- No inventar productos, tonos, precios, SKUs, inventario, imágenes, beneficios ni descripciones.
- Cada fila representa una variante o presentación concreta.
- La marca debe ser siempre `Voglia`.
- La colección debe ser siempre `Voglia`.
- Los productos existentes deben conservar su `existing_product_id`, `existing_variant_id`, `handle`, `sku`, precio e imagen hasta que se apruebe un cambio.
- Una fila solo debe marcarse como `APPROVED` cuando la información provenga de una fuente real verificable.

## Columnas

| Columna | Significado |
| --- | --- |
| `action` | Acción propuesta para esa fila: `UPDATE_EXISTING`, `ADD_VARIANT_TO_EXISTING`, `CREATE_NEW`, `REVIEW_REQUIRED` o `SKIP_DUPLICATE`. |
| `existing_product_id` | ID actual de Medusa cuando la fila corresponde a un producto ya existente. |
| `existing_variant_id` | ID actual de Medusa cuando la fila corresponde a una variante ya existente. |
| `brand` | Marca comercial. Para esta plantilla debe ser `Voglia`. |
| `line` | Línea o familia real del producto, si está confirmada. |
| `product_type` | Tipo de producto: tinte, tratamiento, peróxido, matizador, etc. |
| `title` | Nombre público propuesto del producto. |
| `handle` | URL corta del producto, en minúsculas, sin acentos y con guiones. |
| `description` | Descripción real del producto, tomada de fuente confirmada. |
| `benefits` | Beneficios reales separados por punto y coma, solo si están documentados. |
| `instructions` | Modo de uso real, si existe en etiqueta, catálogo oficial o ficha. |
| `warnings` | Advertencias reales de etiqueta o ficha técnica. |
| `category` | Categoría de tienda propuesta. |
| `collection` | Colección de marca. Para esta plantilla debe ser `Voglia`. |
| `option_name` | Nombre de la opción de variante, por ejemplo `Tono`, `Presentación` o `Volumen`. |
| `variant_title` | Nombre visible de la variante. |
| `tone_code` | Código del tono cuando aplica. |
| `tone_name` | Nombre del tono cuando aplica. |
| `presentation` | Presentación uniforme, por ejemplo `90 ml`, `250 ml`, `500 ml`, `1 L` o `3 oz`. |
| `sku` | SKU único. Formato recomendado: `VOGLIA-[LINEA]-[PRODUCTO]-[VARIANTE]-[PRESENTACION]`. |
| `barcode`, `ean`, `upc` | Códigos comerciales reales. Dejar vacío si no están confirmados. |
| `price_mxn` | Precio en MXN, solo número y sin símbolo `$`. |
| `stock` | Inventario inicial entero. Dejar vacío si todavía no está confirmado. |
| `manage_inventory` | `true` o `false`, según si Medusa controlará inventario. |
| `allow_backorder` | `true` o `false`, según si se permitirá vender sin stock. |
| `thumbnail_file` | Archivo principal de imagen, si ya existe y está confirmado. |
| `image_files` | Archivos adicionales separados por punto y coma. |
| `weight_g`, `length_cm`, `width_cm`, `height_cm` | Peso y dimensiones reales, si están disponibles. |
| `sales_channel` | Canal de venta confirmado. |
| `shipping_profile` | Perfil de envío confirmado. |
| `tags` | Etiquetas separadas por punto y coma. |
| `metadata_source` | Identificador de origen técnico, por ejemplo `catalogo-voglia-2026`. |
| `source_reference` | Fuente real que respalda la fila. |
| `notes` | Observaciones de revisión, duplicados o decisiones pendientes. |
| `review_status` | Estado de revisión: `PENDING`, `REVIEWED`, `APPROVED` o `REJECTED`. |

## Campos obligatorios

Para iniciar una revisión, cada fila debe tener al menos:

- `action`
- `brand`
- `product_type`
- `title`
- `handle`
- `collection`
- `option_name`
- `variant_title`
- `presentation`
- `sku`
- `manage_inventory`
- `allow_backorder`
- `metadata_source`
- `source_reference` o una nota que explique por qué falta
- `review_status`

Para marcar una fila como lista para importación (`review_status = APPROVED`), también deben estar confirmados:

- precio o decisión explícita de no cargar precio;
- stock o decisión explícita de no cargar inventario;
- fuente real;
- categoría;
- si es producto existente o nuevo;
- si debe conservar IDs actuales.

## Campos que no deben inventarse

No completar sin fuente real:

- `price_mxn`
- `stock`
- `barcode`, `ean`, `upc`
- `description`
- `benefits`
- `instructions`
- `warnings`
- `thumbnail_file`
- `image_files`
- dimensiones y peso
- categorías, si no han sido aprobadas

## Producto con una sola variante

Usa una fila. El `option_name` puede ser `Presentación` y `variant_title` debe coincidir con la presentación real.

Ejemplo:

```csv
CREATE_NEW,,,Voglia,Bioliberarsi,Tratamiento,Voglia Producto Ejemplo 250 ml,voglia-producto-ejemplo-250ml,DESCRIPCIÓN REAL,,,,Tratamientos,Voglia,Presentación,250 ml,,,250 ml,VOGLIA-BIOLIBERARSI-EJEMPLO-250ML,,,,PRECIO,STOCK,true,false,archivo.png,,,,,,Online,Default,"tratamiento;voglia",catalogo-voglia-2026,FUENTE REAL,,PENDING
```

## Producto con múltiples tonos

Usa una fila por tono. Todas las filas deben compartir el mismo `existing_product_id` si el producto ya existe, o el mismo `title` y `handle` si se va a crear como producto nuevo con varias variantes.

Campos clave:

- `option_name`: `Tono`
- `variant_title`: código y nombre del tono
- `tone_code`: código exacto
- `tone_name`: nombre exacto
- `sku`: único por tono

## Tintes

Para tintes de 90 ml:

- `product_type`: `Tinte`
- `presentation`: `90 ml`
- `option_name`: `Tono`
- no usar `250ml`; debe escribirse `250 ml` cuando aplique
- conservar el producto existente `prod_01KVV3GD5ZD8R40HF48DRBF37A` hasta decidir si será la familia principal de tonos

## Peróxidos por volumen

Para peróxidos, usa el volumen como variante cuando existan varias opciones.

Ejemplo:

- `option_name`: `Volumen`
- `variant_title`: `10 vol`, `20 vol`, `30 vol` o `40 vol`
- `presentation`: `1 L` si la presentación real es de un litro

## Productos con varias presentaciones

Usa una fila por presentación.

Ejemplo:

- `option_name`: `Presentación`
- `variant_title`: `250 ml`
- `presentation`: `250 ml`
- SKU único por presentación

## Imágenes

- Usar nombres de archivo reales.
- Separar múltiples imágenes con punto y coma en `image_files`.
- No descargar ni inventar imágenes.
- Si falta imagen, dejar `thumbnail_file` y `image_files` vacíos y documentar el pendiente en `notes`.

## Cómo marcar una fila como lista

Una fila puede pasar a `APPROVED` solo cuando:

- el producto o variante no duplica uno existente;
- el SKU está confirmado y es único;
- el handle está confirmado y es único;
- precio y stock están confirmados o documentados como pendientes aceptados;
- la fuente real está escrita en `source_reference`;
- las imágenes están confirmadas o marcadas como pendientes.

## Cómo identificar duplicados

Revisar en este orden:

1. `existing_product_id`
2. `existing_variant_id`
3. `sku`
4. `handle`
5. título normalizado
6. combinación de marca, línea, presentación y tono
7. códigos `barcode`, `ean` o `upc`

Si hay duda, usar `REVIEW_REQUIRED`, no `CREATE_NEW`.

## Cómo conservar productos existentes

- No borrar los productos Voglia ya existentes.
- No cambiar IDs.
- No crear otro producto con el mismo SKU o handle.
- Usar `UPDATE_EXISTING` cuando se complete información de un producto existente.
- Usar `REVIEW_REQUIRED` cuando haya que decidir cómo convertir el producto actual en una familia de variantes.

## Fuentes reales aceptadas

Documentar la fuente en `source_reference`:

- factura;
- catálogo oficial;
- etiqueta;
- fotografía;
- lista de precios;
- confirmación escrita de Sicarú.

## Precio, stock y códigos faltantes

- Si falta precio, dejar `price_mxn` vacío y marcar la fila como `PENDING`.
- Si falta stock, dejar `stock` vacío y documentarlo en `notes`.
- Si falta barcode, EAN o UPC, dejar el campo vacío. No usar valores inventados.

## Ejemplos

### Producto individual

Un tratamiento con una sola presentación debe usar una fila con `option_name = Presentación`.

### Producto con tonos

Un tinte con 20 tonos debe usar 20 filas, una por tono, con el mismo producto base y SKUs distintos.

### Producto con varias presentaciones

Un peróxido en varias concentraciones o tamaños debe usar una fila por variante real, manteniendo el mismo producto base cuando la ficha comercial sea la misma.
