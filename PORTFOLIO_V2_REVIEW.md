# Portfolio 2.0 — revisión visual

## Entrega
Rama local `review/portfolio-v2`. Vista previa: http://127.0.0.1:4180/ . Si el servidor no está activo: `python3 review/serve.py` desde la raíz.

No se hizo push ni despliegue. La publicación queda pendiente de aprobación visual del propietario.

## Cambios
- Nueva jerarquía editorial en inglés: propuesta profesional directa, retrato real, colección de proyectos y contacto.
- Orden solicitado: Yachts Life Master, Tu Agente Seguro, Metanoia (producto propio).
- Tarjetas con capturas auténticas, categoría, texto breve, máximo cuatro tecnologías y enlace a su caso individual.
- Siete páginas de casos: problema, contribución, funciones, tecnologías, estado y notas técnicas secundarias. Los cuatro proyectos web incluyen escritorio y navegador móvil.
- Engineering Labs separado: Polymarket, BinanceBot y TokenTrader con diagramas vectoriales derivados de módulos reales. No se activaron bots ni se inventaron terminales, operaciones o rentabilidades.
- Metanoia distingue landing y app nativa. Integraciones no verificadas en producción no se presentan como operativas.
- Cybernetic Liquid conservado. Navegación nativa, foco visible, enlace para saltar al contenido, movimiento reducido, imágenes WebP y lazy loading.
- Metadatos descriptivos, canonical y Open Graph por caso.

## Evidencia y verificación
- `review/portfolio-desktop.png` y `review/portfolio-mobile.png`: portada completa.
- `review/selected-work-1440.png` y `review/selected-work-390.png`: colección destacada.
- `review/project-*-desktop.png` y `review/project-*-mobile.png`: siete casos.
- `review/frontend-results.json`: 32 combinaciones de página y tamaño; sin imágenes rotas ni desbordamiento. También pasaron teclado, menú, enlaces, notas técnicas, movimiento reducido y navegación sin JavaScript.
- Suite existente de backend: todas las regresiones pasaron, incluidos dashboard, autenticación, sesiones, CSRF, IP, fingerprint y banner.
- Comparación con Git: sin diferencias en backend/, script.js, fingerprint.js, returning-visitor-copy.js, cybernetic-liquid.js, trading-bot.js ni styles.css.
- Las capturas originales de los sitios públicos y la documentación de la vista previa permanecen en `review/`. No se modificó ningún repositorio original.

- Prueba adicional de navegador: banner de visitantes abierto y descartado con historial sintético en escritorio y móvil; sin conexiones productivas.
- Diagnóstico local sin throttling: LCP 664 ms / CLS 0.0027 en móvil y LCP 428 ms / CLS 0.0014 en escritorio. Valores de una ejecución local, no métricas de campo. Detalles en `review/local-metrics.json`.

## Límites
Las capturas prueban las interfaces públicas, no el funcionamiento completo de sus servicios remotos. No se probaron reservas reales, entrega de correos, pagos, operaciones financieras ni una sesión administrativa en producción. Las mediciones locales son diagnósticas y no certifican Core Web Vitals de campo.

El servidor de revisión sustituye únicamente en la respuesta HTML la URL de analytics por un stub local. La configuración productiva guardada permanece intacta. Los informes y archivos de revisión están excluidos de cualquier futuro artefacto de frontend mediante `.vercelignore`.
