# Revisión local del portafolio

Rama: `review/unlink-studio`. Publicación pendiente de aprobación.

- Colección de cinco proyectos: Yachts Life Master, Tu Agente Seguro, Metanoia, Covenant y Ocean Majesty Cancún. Última tarjeta centrada en escritorio; una columna en móvil.
- Engineering Labs conserva sus tres proyectos como sección independiente.
- Se retiraron la tarjeta solicitada, su caso, metadatos, traducciones exclusivas y dos imágenes. Se actualizaron los documentos actuales para evitar atribuciones públicas obsoletas.
- Navegación secuencial actualizada. La validación detectó enlaces preexistentes a `index.html#about`, sección ausente; los menús de los casos ahora corresponden a las secciones actuales de Portfolio V2.
- Se quitó el rewrite global al index para que las rutas inexistentes respondan con el 404 estático nativo de Vercel. `404.html` incluye noindex y enlace de vuelta.
- Fuentes de backend, dashboard, tracking, autenticación, historial, Cybernetic Liquid, certificaciones y contacto conservadas.

## Evidencia

- `portfolio-desktop.png`, `portfolio-mobile.png`: portada completa.
- `selected-work-1440.png`, `selected-work-390.png`: proyectos.
- `frontend-results.json`: 36 verificaciones de página/tamaño, imágenes, overflow, H1, anclas, teclado, menú, idioma, movimiento reducido y navegación sin JS.
- `public-artifact-results.json`: validación de HTML, metadatos y archivos estáticos preparados; enlaces y fragmentos entre páginas incluidos.
- `public-links-audit.md`: informe privado local, ignorado por Git y excluido de publicación para no reproducir asociaciones personales.

## Reproducción

`python3 review/serve.py` sirve la vista previa con analytics aislado del servicio productivo.
`node review/frontend-qa.cjs` genera capturas y valida interfaces.
`node review/additional-qa.cjs` comprueba el banner de visitantes con datos sintéticos.
`node review/routing-qa.cjs` comprueba URLs retiradas antes del commit (derivadas del diff), errores HTTP y orden de proyectos.
`python3 review/validate-public.py` prepara el frontend estático en `/tmp/portfolio-review-public` y verifica referencias, recursos, enlaces y fuentes protegidas.
`npm test --prefix backend` ejecuta las regresiones existentes. Pasaron dashboard, sesiones, CSRF, autenticación, IP, fingerprint y analytics. Los diagnósticos negativos CSRF y DATABASE_URL ausente son parte de las pruebas locales.

No se ejecutaron migraciones ni operaciones de producción. No se validó una sesión remota ni una base de datos real. El proyecto es HTML/CSS/JS sin compilación; el artefacto es una preparación local de los archivos públicos según las exclusiones existentes. El 404 en Vercel debe confirmarse al publicar; no se realizó build remoto ni despliegue.
