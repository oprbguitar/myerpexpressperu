# Alcance worker

- Jobs idempotentes, acotados y correlacionados; usar `FOR UPDATE SKIP LOCKED` cuando corresponda.
- Consultar módulos habilitados antes de ejecutar jobs o llamar proveedores.
- Reintentar solo operaciones seguras; no registrar payloads sensibles.
- Reinicio demo debe verificar entorno, fingerprint y tenant demo antes de mutar datos.
