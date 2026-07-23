# Permisos

| Grupo | Lectura | Escritura |
|---|---|---|
| Organización | `organization.read` | `organization.manage` |
| Sedes | `branches.read` | `branches.manage` |
| Usuarios | `users.read` | `users.create`, `users.update`, `users.deactivate` |
| Roles | `roles.read`, `permissions.read` | `roles.manage` |
| Módulos | `modules.read` | `modules.manage` |
| Auditoría | `audit.read` | solo aplicación |
| Ajustes | `settings.read` | `settings.manage` |
| Documentos | `documents.read` | `documents.upload`, `documents.delete` |

Los roles predeterminados se siembran por instalación; los permisos tienen códigos globales estables. Ocultar un control es solo UX: el guard de API es la autoridad.
