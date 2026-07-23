# Adaptadores de proveedores

`@erp/contracts` declara autenticación, transacción, auditoría, almacenamiento documental, correo, cola, facturación electrónica, IA, OCR, geocodificación, mapas y firma digital. Los adaptadores se registran mediante inyección de dependencias en la capa de infraestructura.

La implementación incluye autenticación local, PostgreSQL, almacenamiento S3
compatible, proveedor de facturación manual y proveedor mock determinista. No
existe conexión productiva directa con SUNAT ni SDK de OpenAI, OCR o mapas.

`ManualElectronicInvoicingProvider` exige intervención humana.
`MockElectronicInvoicingProvider` sólo se habilita fuera de producción y cubre
aceptación, observaciones, rechazo, timeout y falla temporal. Un adaptador SUNAT
productivo futuro deberá implementar el mismo contrato sin modificar reglas de
dominio.
