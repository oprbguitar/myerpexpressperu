# Centro de administración

El centro de administración reúne configuración, módulos, características,
perfiles de negocio, proveedores y trazabilidad. Toda ruta exige permiso backend
y, cuando corresponde, un módulo habilitado para la empresa activa.

Los cambios sensibles se auditan. La desactivación de módulos informa impacto y
dependencias antes de ejecutarse. Las plantillas de perfil son un punto de partida
configurable y no encierran permanentemente a la empresa en una actividad.

Las credenciales de proveedores no se devuelven al navegador: la interfaz sólo
muestra si existe una referencia secreta. Proveedores externos en producción
requieren confirmación explícita y ámbito tenant/empresa derivado de la sesión.
