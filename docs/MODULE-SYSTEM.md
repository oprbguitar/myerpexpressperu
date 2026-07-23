# Sistema de módulos

Cada definición contiene código, versión, dependencias, permisos requeridos, estado
inicial e indicador de implementación. Fase 2 añade los módulos operativos sin
reemplazar organización, identidad, autorización, auditoría ni documentos.

```mermaid
flowchart LR
  identity --> authorization --> module-management
  organization --> parties
  organization --> products
  parties --> quotations --> sales-orders --> sales
  products --> pricing
  products --> inventory
  sales --> receivables --> payments --> cash
  parties --> purchases --> payables --> payments
  purchases --> inventory
  sales --> commercial-documents --> sunat-manual
  identity --> audit
  inventory -.fase futura.-> manufacturing
```

La API impide activar módulos no implementados o con dependencias pendientes. Desactivar preservará registros históricos; el worker consulta solo módulos habilitados.
