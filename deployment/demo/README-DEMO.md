# ERP Express Perú — demostración portable

Versión del paquete: `0.3.0`.

Este paquete levanta una demostración local y aislada de ERP Express Perú. Todos
los nombres, documentos, correos, teléfonos, operaciones y montos son sintéticos.
No ingrese datos reales, personales, médicos, financieros, fiscales ni secretos.

## Aviso permanente

La demostración:

- no es apta para producción;
- no garantiza cumplimiento legal o tributario;
- no garantiza exactitud de IA, OCR ni disponibilidad;
- no constituye certificación u homologación SUNAT;
- usa facturación electrónica mock, OCR mock, geocodificación manual y correo
  deshabilitado;
- inicia con IA externa deshabilitada;
- no contiene credenciales: el comando de inicio genera secretos locales en
  `.env.demo`, archivo excluido del ZIP.

## Servicios

- Web/PWA: `http://localhost:18080/`
- Página de entrada: `http://localhost:18080/demo/`
- API: `http://localhost:18081/api/v1`
- PostgreSQL: red interna Docker, sin puerto publicado.
- MinIO: `http://localhost:19000/`; consola `http://localhost:19001/`.
- Worker: red interna Docker.

Los puertos se pueden cambiar en `.env.demo` antes de iniciar.

## Escenarios

- **A — Servicios profesionales:** CRM, cotización, proyecto, tiempo, gasto,
  facturación manual/mock y cobranza.
- **B — Pyme comercial:** clientes, proveedores, productos, almacén, venta,
  compra, caja y saldos.
- **C — Contratista:** referencia contractual ficticia, proyecto, personal, SST,
  activos, mantenimiento y documentos mock.

## Roles

Se crean identidades ficticias para:

- Demo Administrator
- Demo Manager
- Demo Sales User
- Demo Cash User
- Demo Project Manager
- Demo HR User
- Demo SST User
- Demo Auditor

El inicio muestra el correo del administrador y la contraseña generada localmente.
Los demás correos siguen el patrón `<rol>@demo.erp-express.test` y usan la misma
contraseña local únicamente para facilitar la evaluación aislada.

## Reset seguro

El reset no recrea ni apunta a una base externa. Antes de modificar datos verifica:

1. `APP_ENVIRONMENT=demo`;
2. `DEMO_RESET_ENABLED=true`;
3. UUID de tenant reservado;
4. código de tenant con prefijo `demo-`;
5. nombre exacto de base `erp_express_demo`;
6. fingerprint coincidente entre configuración y perfil persistido;
7. perfil demo activo con reset habilitado;
8. trigger PostgreSQL con settings locales equivalentes.

El reset elimina exclusivamente registros del tenant demo en la base dedicada,
restaura la semilla determinista y registra `DemoResetJob` y
`DemoResetHistory`. El almacenamiento demo usa un bucket dedicado.

## Evidencia del paquete

- `metadata/sbom.cdx.json`: SBOM CycloneDX 1.6.
- `metadata/licenses.json`: inventario de licencias desde manifests instalados.
- `metadata/version-manifest.json`: versión, imágenes, providers y escenarios.
- `checksums.sha256`: integridad de cada archivo incluido.
- archivo `.zip.sha256`: checksum del ZIP.

Lea [QUICKSTART.md](QUICKSTART.md) para iniciar, comprobar, resetear y detener.

