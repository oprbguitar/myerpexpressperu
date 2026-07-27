# Desarrollo local

Requisitos: Node 24, pnpm 10, Docker y Docker Compose.

```bash
Copy-Item .env.example .env
# Edite .env y reemplace secretos y credenciales de semilla
pnpm bootstrap
pnpm dev
```

`bootstrap` instala dependencias, levanta PostgreSQL/MinIO/Mailpit, aplica migraciones y crea la cuenta indicada por `SEED_ADMIN_EMAIL`. La contraseña nunca se imprime. El primer ingreso obliga a cambiarla.

Comandos: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:integration`, `pnpm test:e2e`, `pnpm build`, `pnpm docker:logs`, `pnpm docker:down`.

Un teléfono en la misma red puede abrir `http://IP_DEL_EQUIPO:5273`; permita el puerto solo en la red privada.
