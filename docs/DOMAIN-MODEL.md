# Modelo de dominio

El agregado organizacional parte de `Tenant`, contiene `Company` y sus `Branch`, `Establishment`, `OrganizationalArea` y `CostCenter`. `User` accede explícitamente mediante `user_companies` y `user_branches`; los permisos efectivos son la unión de `Role` y `Permission`.

Los objetos `Ruc`, `Dni`, `EmailAddress`, `PhoneNumber`, `Ubigeo`, `CompanyName`, `Money`, `Percentage`, `DateRange`, `ModuleCode` y `PermissionCode` encapsulan invariantes y errores controlados. `Money` usa unidades menores enteras; PostgreSQL reserva `numeric` para importes futuros.

Las jerarquías organizacionales se validan en dominio y mediante trigger transaccional en PostgreSQL.
