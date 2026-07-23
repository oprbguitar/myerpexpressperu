# Privacidad y gobierno de datos

ERP Express Perú incorpora mecanismos para apoyar privacidad por diseño, pero el
software por sí solo no determina la base jurídica, los plazos, el rol de cada
parte ni el cumplimiento de una organización. La configuración productiva
requiere validación legal peruana del cliente y del caso de uso.

## Clasificación mínima

| Nivel | Ejemplos | Regla por defecto |
|---|---|---|
| Público | Información publicada y aprobada | Puede salir solo a un proveedor y finalidad aprobados, con minimización |
| Interno | Configuración y datos operativos no personales | Acceso por necesidad; proveedor aprobado y finalidad documentada |
| Confidencial | Contactos, DNI/RUC, ubicación, auditoría y documentos de negocio | Redacción y minimización antes de salida; acceso y transferencia registrados |
| Restringido | Salud, biometría, credenciales, secretos y categorías sensibles | No sale a un proveedor genérico; repositorio y permisos separados |

La inferencia por nombre de campo es una defensa auxiliar, no una clasificación
definitiva. Todo nuevo campo, documento, proveedor o finalidad necesita revisión
explícita.

## Principios aplicados

- tenant y empresa proceden de la sesión, nunca del ámbito enviado por el
  navegador;
- se recolecta y expone solo lo necesario para la finalidad autorizada;
- logs y eventos excluyen secretos, diagnósticos, documentos completos y
  prompts sin depurar;
- OCR produce una propuesta separada del original y requiere revisión humana;
- IA no recibe datos médicos por defecto, no toma decisiones laborales/SST y no
  ejecuta acciones consecuenciales;
- proveedores se referencian mediante identificadores opacos; el secreto se
  resuelve únicamente en servidor;
- exportación, corrección, oposición, cancelación y portabilidad deben conservar
  identidad, alcance, decisión, fechas y evidencia, sin exponer datos de terceros.

## Registro de tratamiento y proveedores

Antes de habilitar una finalidad se debe registrar: responsable, propietario
interno, categorías, titulares, finalidad, base jurídica validada, fuente,
destinatarios, proveedor/subencargado, país o región, salvaguardas, retención,
medidas de seguridad y mecanismo de ejercicio de derechos. Una transferencia
queda deshabilitada si falta aprobación de proveedor, finalidad, minimización o
clasificación.

## Eventos y privacidad

El evento de seguridad contiene tipo normalizado, resultado, instante e
identificadores técnicos mínimos. IP se reemplaza por una marca de redacción y
los metadatos se recorren defensivamente. La redacción reduce exposición; no
convierte automáticamente los datos en anónimos.

## Derechos y conservación

Las solicitudes requieren verificación proporcional de identidad y separación
de funciones. La eliminación no es inmediata si existe obligación de
conservación, disputa o legal hold; la respuesta debe explicar el alcance. La
vista previa de retención clasifica candidatos, protegidos e inválidos sin
borrar. Véase `docs/DATA-RETENTION.md`.

## Datos médicos y SST

Diagnóstico, detalle clínico y vigilancia de salud permanecen fuera de vistas y
permisos generales de RR. HH. Las alertas deben usar el mínimo dato. El ERP
apoya el registro y seguimiento, pero no reemplaza al médico ocupacional, al
empleador, al comité/supervisor ni una decisión profesional.

## Referencias normativas

La matriz de requisitos y enlaces oficiales consultados está en
`docs/phase3/LEGAL-REQUIREMENT-MATRIX.md`. Es una guía de ingeniería, no asesoría
legal ni garantía de cumplimiento.
