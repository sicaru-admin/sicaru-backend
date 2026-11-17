# Cierre de condiciones · backend #8

16/11/2026, America/Monterrey. **NO GO para liberar #8: falta exclusivamente la comprobación de lectura dentro del contenedor productivo para cerrar el descarte de proceso/índice local.** El cambio para evitar doble release y la recuperación segura están preparados en este PR. No se modificó Railway ni se ejecutó un release.

| Condición | Evidencia actual | Decisión técnica / acción |
|---|---|---|
| Superficies públicas conocidas | Un proyecto accesible, tres entornos; todos contienen sólo Medusa, PostgreSQL y Redis. Ningún servicio Meili. Los tres backends carecen de host Meili configurado; fallback localhost:7700. Sin proxies TCP en backends. GET /version, /indexes y /indexes/products/documents?limit=0: 404 en los tres dominios de backend; cuerpos cancelados, sin leer documentos. | GO para las superficies inventariadas: no se encontró un origen público Meili que aislar. No retirar dominios de Medusa: rompería las fichas. No se afirma inexistencia de un servidor fuera del inventario accesible. |
| Proceso/índice dentro de producción | No hay clave SSH registrada ni identidad privada local disponible; no se abrió sesión, registró clave, instaló herramienta ni configuró secretos. Falta inspeccionar listeners/procesos/montajes del contenedor. | **NO GO de cierre completo.** Operador con acceso existente debe aportar la lectura indicada abajo. No asumir que un módulo cliente prueba existencia o ausencia de motor. |
| Escritores identificados | Producción: subscriber antiguo activo; #8 lo deja inerte, elimina módulo y bloquea script/cliente. Staging: sync desactivado. Preview-payments: subscriber antiguo con localhost, no host remoto. DATABASE_URL de los tres usa nombre privado con alcance de entorno; no hay cron de servicio ni variables de programación. | GO respecto al código/orígenes configurados inventariados. No se atribuye identidad de bases sólo porque el hostname/fingerprint coincida: Railway resuelve DNS privado por entorno. El descarte de procesos externos al código de producción queda unido al control de contenedor. |
| Un solo mecanismo de release | Railway: integración Git → main, npm ci --include=dev && npm run build, npm run start, una réplica sfo; sin preDeployCommand en configuración devuelta. Además existía GitHub Actions push main → railway up. | GO al aplicar el diff de #8: se elimina deploy-backend.yml. Railway queda como único disparador; CI de PR conserva pruebas/build/tipos. No cambian los ajustes live. Nueva guardia impide reintroducir ese workflow. |
| Doce publicados actuales | Store API: count=12, doce status=published, checksum de IDs guardado. Las doce fichas responden 200 con H1 igual al título público y sin noindex. Se excluyen plantillas 404 serializadas de Next del análisis semántico. | GO de compatibilidad: #8 no cambia Store API, sus middlewares, productos, canales, precios ni stock. Tras release autorizado, repetir conjunto exacto/handles y checksum; no sólo contar doce. Una réplica no garantiza cero pausa en reinicio. |
| Recuperación segura | RECUPERACION_SEGURA.patch comprobado con git apply --check y probado en memoria: contador 503/no-store, sin acceder a datos. Se conserva módulo retirado y escritor/loader/script/cliente bloqueados. 15/15 guardias, sin migración. | GO de preparación. No regresar a 51a6d20 como rollback rutinario: reactivaría indexación antigua/contador global. Preferir parche sobre fuente aprobada que conserve las guardias. |

## Lectura exacta pendiente, sin nuevas credenciales

Desde acceso operativo YA habilitado, en el contenedor productivo de Medusa y su única instancia:

1. Enumerar nombre de procesos, PID y ejecutable (por ejemplo ps -eo pid,comm), puertos/listeners con PID y puntos de montaje. No volcar argumentos completos, /proc/*/environ, archivos .env ni claves.
2. Si hay listener 7700 u otro proceso Meili: consultar sólo /health y /version localmente, registrar status/versión y su directorio/montaje; no listar documentos ni exponer claves. Comprobar si su puerto tiene proxy/dominio/forward adicional fuera del inventario actual.
3. Identificar sólo presencia, ruta y persistencia de archivos del motor, sin contenido de documentos. Si no hay proceso/listener/archivos ni lanzamiento adicional, cerrar el bloqueo con ese resultado y el SHA/deployment inspeccionado. Si existe un índice efímero dentro del contenedor, **no reemplazarlo sin decidir cómo preservar sus datos**; un release puede descartarlo aunque no invoque una API de borrado.

Se solicitó un acceso o salida saneada de un operador; no se suplió con una clave nueva. Este es el dato que falta, no una petición para repetir la auditoría de PostgreSQL o las pruebas de creación.

## Aislamiento mínimo condicionado, preparado y no ejecutado

No hay dominio/proxy Meili identificado que pueda retirarse con seguridad hoy. No tocar dominios Medusa ni proxies PostgreSQL/Redis. Si la lectura pendiente descubre un origen público real: registrar su service/environment/domain/proxy ID, mantener servicio, volumen y datos; preparar únicamente retiro del mapeo público o regla de denegación del proveedor, conservando acceso privado administrativo. Dirección deberá autorizar ese objeto exacto. No revocar claves ni vaciar/reconstruir el índice. Aceptación: origen inaccesible desde internet, datos intactos por acceso privado, doce productos disponibles por Store API. Recuperación sólo a acceso privado autorizado, nunca reabrir documentos sin revalidación.

## Secuencia de release y recuperación, no ejecutada

- Completar la lectura del contenedor y cerrar el bloqueo; revisar diff/SHA y CI. Guardar baseline de doce IDs/handles, runtime/start command y despliegue previo, sin valores secretos.
- Dirección autoriza expresamente un release. Una eventual fusión de este diff elimina el workflow de deploy y deja que **sólo Railway Git main** construya/despliegue. No ejecutar railway up adicional ni workflow manual. No configurar secretos de invalidación en esta etapa si no están autorizados.
- Arrancar con npm start de #8, sin db:migrate, semillas o importadores. Validar SHA, salud y el conjunto de doce publicados y fichas; contador por canal, rechazo sin clave, ausencia de intentos Meili y ausencia de workers con código anterior. Monitorear errores/latencia/reinicios a 10/30/60 min. No crear productos como prueba.
- Si falla antes del corte, conservar instancia previa y suspender altas. Si falla después, reconstruir desde la fuente aprobada manteniendo las guardias. Para un fallo exclusivo del contador, el parche de recuperación preparado lo lleva a 503/no-store, sin afectar /store/products; probar y autorizar ese artefacto antes de liberarlo. No aplicar el parche durante esta revisión. Para un fallo del subscriber opcional de invalidación, mantener sin configurar su integración hasta repararlo; la caché fresca del compañero no depende de entrega.
- No usar rollback automático al código productivo antiguo tras crear drafts: su script y subscriber son inseguros. No ejecutar down/restore ni corregir datos comerciales. Si no puede recuperarse conservando las guardias, detener la liberación y mantener bloqueadas las altas; no aceptar un rollback que reabra indexación.

## Evidencia y límites

- docs/store-api-only/evidencia/superficies-railway.json: dominios/proxies/configuración de los tres backends, sin secretos.
- docs/store-api-only/evidencia/continuidad-y-origenes.json: doce publicados/fichas, huella de IDs, respuestas HTTP de rutas Meili; sin contenido de índices ni credenciales.
- docs/store-api-only/evidencia/guards.log: 15/15 guardias, incluida recuperación.

El checksum de endpoint privado igual entre entornos no se usa para afirmar que comparten PostgreSQL. No se hicieron nuevas conexiones SQL a producción. No se crearon productos, se configuraron secretos o se publicaron imágenes. PR #7/#30 y autorizaciones comerciales permanecen independientes.
