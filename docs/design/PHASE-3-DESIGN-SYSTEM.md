# Sistema visual de Fase 3

## Referencias aceptadas

- `phase2-dashboard-concept.png`: estructura de escritorio y navegación.
- `phase2-quick-sale-mobile-concept.png`: formularios y acciones móviles.
- `phase3-admin-control-plane-concept.png`: nueva superficie administrativa.
- `phase3-sst-mobile-concept.png`: nuevo flujo de campo SST.

Fase 3 extiende el producto existente; no introduce otra marca ni un shell distinto.

## Tokens y composición

- Fondo principal: blanco real; fondos secundarios gris frío muy claro.
- Navegación: azul marino profundo; selección azul; acento operativo esmeralda.
- Estados: verde para correcto, ámbar para atención y rojo solo para riesgo/error.
- Bordes finos gris azulado, radios moderados y sombra mínima.
- Escritorio: sidebar persistente, topbar contextual y contenido tabular abierto.
- Móvil: cabecera compacta, una columna, controles táctiles y acciones inferiores.
- Tipografía: sans serif del sistema, títulos de peso 600–700, controles definidos
  explícitamente y tablas compactas legibles.

## Familias de componentes

- Navegación agrupada y filtrada por permiso/módulo.
- Encabezado de página con título, contexto y una acción primaria.
- Indicadores de salud compactos, listas/tablas responsivas y panel de revisión.
- Estados `loading`, `empty`, `error`, `pending`, `disabled` y `restricted`.
- Formularios de una columna en móvil, evidencia mediante cámara y barra de
  acciones estable.
- Avisos legales, de demo y de limitación con texto directo, nunca como claims.

## Copia permitida en primeras superficies

Control Plane:

```text
Centro de administración
Demostración
Configuración y gobierno
Cambios que requieren aprobación
Estado de proveedores
Revisar configuración
```

SST móvil:

```text
Nueva inspección SST
Borrador guardado
Hallazgos
Agregar hallazgo
Guardar borrador
Enviar inspección
```

## Reglas

- No inventar métricas, salud, cumplimiento o conectividad no respaldados.
- No convertir tablas en rejillas de tarjetas.
- No añadir gradientes, ilustraciones o “marketing” al producto operativo.
- Mapas, IA y OCR se cargan en chunks independientes.
- No mostrar diagnóstico, secretos, prompts completos o datos sensibles.
- Verificar fidelidad con capturas al tamaño nativo de cada concepto y registrar
  cualquier desviación intencional.
