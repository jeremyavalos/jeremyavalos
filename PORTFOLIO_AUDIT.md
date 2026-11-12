# Auditoría técnica del portafolio web

## Alcance y método

Esta auditoría describe el código local actual del sitio y del backend en la rama de trabajo `feat/cybernetic-portfolio-refresh`. El portafolio web y el perfil público de GitHub se tratan como superficies diferentes, aunque sus archivos estén dentro del mismo repositorio Git.

Se revisaron las páginas y scripts del frontend, configuración de Vercel, backend Express, panel administrativo, migraciones, pruebas y documentación. Las comprobaciones externas fueron peticiones HTTP GET sin credenciales: el sitio redirigió y respondió `200`, `/health` de Railway respondió `200` y `/admin` respondió `200` mostrando la ruta pública de acceso. Esto no equivale a iniciar sesión ni a verificar datos del dashboard. No se consultó la base de datos de producción, no se ejecutaron migraciones, no se leyeron variables de entorno y no se cambió Railway ni Vercel.

### Criterio de estado

- **Implementado:** existe en el código inspeccionado.
- **Verificado:** comprobado mediante pruebas locales o una petición externa de solo lectura.
- **Incompleto/no verificado:** el código o la configuración sugieren la función, pero no se confirmó su operación integral.
- **Retirado del runtime:** ya no aparece en la experiencia o rutas activas; los datos históricos pueden seguir existiendo.

## 1. Resumen ejecutivo

| Área | Estado observado |
|---|---|
| Sitio público | Implementado como página estática; dominio responde `200` tras redirección. |
| Frontend | HTML, CSS y JavaScript nativos; sin framework ni proceso de build raíz. |
| Proyectos | Siete tarjetas públicas y tres estudios de caso desplegables. |
| Contacto | Enlaces de email y plataformas; formulario de email opcional dentro del diálogo de visitantes recurrentes. |
| Analytics | Captura de eventos, identificador first-party, fingerprint opcional, IP, atribución, dispositivo y ubicación aproximada. |
| Dashboard | Implementado detrás de sesión administrativa; la ruta de login responde, pero no se probó una sesión autenticada. |
| Juegos | Secciones y endpoints retirados del runtime actual. Las migraciones y tablas históricas permanecen intactas. |
| Producción | Solo se hicieron GET de estado. Sin cambios de datos, configuración, despliegue o credenciales. |

## 2. Arquitectura y tecnologías

### Frontend

El frontend es un sitio estático, sin React/Vue/Angular ni bundler en la raíz:

- [`index.html`](./index.html): estructura, contenido, metadatos básicos, URL base de Railway y orden de carga de scripts.
- [`styles.css`](./styles.css): tema oscuro/grafito, layouts, responsive, estados de interacción y estilos con movimiento reducido.
- [`script.js`](./script.js): menú, animaciones de entrada, parallax, analytics, diálogo recurrente, envío de leads y carrusel.
- [`fingerprint.js`](./fingerprint.js): fingerprint determinista de 32 bits a partir de atributos del navegador.
- [`returning-visitor-copy.js`](./returning-visitor-copy.js): variantes del texto de regreso.
- [`cybernetic-liquid.js`](./cybernetic-liquid.js): efecto Canvas 2D para enlaces, botones y controles con interacción.
- [`trading-bot.js`](./trading-bot.js): código auxiliar de la presentación interactiva del caso de Trading Bot.
- [`assets/`](./assets): imágenes, retratos, ilustraciones y material visual de los proyectos.
- [`vercel.json`](./vercel.json): despliegue estático y fallback de rutas a `index.html`.

El archivo de configuración de Vercel establece `outputDirectory: "."`, URLs limpias y una regla general de reescritura a `index.html`. Esto describe la configuración del repositorio, no certifica por sí solo el estado interno del proyecto en la cuenta de Vercel.

### Backend y datos

- [`backend/src/index.js`](./backend/src/index.js): aplicación Express, CORS, sesiones, autenticación, rutas de analytics, leads y administración.
- [`backend/src/db.js`](./backend/src/db.js): pool PostgreSQL y helper transaccional.
- [`backend/src/geolocation.js`](./backend/src/geolocation.js): enriquecimiento IPinfo y caché de geolocalización.
- [`backend/src/userAgent.js`](./backend/src/userAgent.js): clasificación de dispositivo, sistema operativo y navegador basada en User-Agent.
- [`backend/admin/dashboard.js`](./backend/admin/dashboard.js) y [`backend/admin/admin.css`](./backend/admin/admin.css): interfaz administrativa de analytics.
- [`backend/migrations/`](./backend/migrations): historial de esquemas y datos.
- [`backend/test/`](./backend/test): regresiones del backend y pruebas de integración.

El backend usa Node.js 18+, Express y PostgreSQL (`pg`). El servicio público está configurado en el HTML con la URL de Railway. No se inspeccionó el estado de despliegue dentro de Railway ni su base de datos.

## 3. Estructura de la página y contenido

La navegación pública enlaza cuatro áreas:

1. **Work:** carrusel de proyectos.
2. **Capabilities:** desarrollo de apps/web/SaaS, ingeniería, producto y tecnología.
3. **About:** perfil, estudios de Software Engineering y experiencia declarada.
4. **Contact:** email, LinkedIn, GitHub e Instagram.

### Proyectos visibles

El carrusel de [`index.html`](./index.html#L89) declara siete tarjetas:

| Proyecto | Evidencia y límites |
|---|---|
| Trading Bot | Ficha y estudio de arquitectura para un sistema local cuantitativo de mercados de predicción. El sitio aclara que sus ilustraciones/parámetros no son resultados financieros verificados. |
| BinanceBot | Caso técnico de un motor de Binance Spot con señales, controles de riesgo/ejecución y contexto de AI local. La ficha menciona modos PAPER, TESTNET y LIVE, no resultados. |
| TokenTrader | Pipeline de observación de pools de BNB Smart Chain. El estudio dice expresamente que la versión actual no firma transacciones ni ejecuta operaciones. |
| Metanoia | Plataforma de reintegración social. Su enlace público respondió `200` durante una comprobación GET. |
| YATCK K CLUB | Experiencia de reservas de yates con reserva backend según la ficha del sitio. El repositorio público observado contiene además una interfaz web TypeScript/Next.js; no se debe asumir que ese repositorio verifica toda la arquitectura descrita en la ficha. |
| Covenant | Producto móvil de hábitos y disciplina. La ficha enumera React Native, Expo, TypeScript y RevenueCat. El repositorio público contiene código Expo/TypeScript, pero su README sigue siendo la plantilla genérica de Expo. |
| VisorApp | Presentado como concepto/flujo de documentación, UX y análisis de negocio; la tarjeta no ofrece un enlace verificable a una aplicación publicada. |

Hay además tres `<details>` con los casos extendidos `trading-bot`, `binancebot` y `tokentrader`. Las ilustraciones de Trading Bot y BinanceBot están identificadas como ilustrativas/conceptuales, no como capturas de producto o métricas de rendimiento.

## 4. Efectos e interacciones

- Menú responsive con `aria-expanded` y cierre al seleccionar un enlace.
- Aparición de contenido con `IntersectionObserver`; parallax limitado a elementos elegidos.
- Carrusel con scroll nativo, botones anterior/siguiente, estado anunciado con `aria-live` y navegación por teclado.
- Tres estudios técnicos desplegables mediante controles HTML nativos.
- Efecto Cybernetic Liquid mediante Canvas 2D. Se crea el canvas al interactuar, limita el DPR a 1.25, anima solo durante la actividad y libera el tamaño del canvas al retraerse. Los controles principales usan escala completa; los controles secundarios una escala menor.
- El efecto calcula una reacción magnética cercana al cursor, filamentos físicos simplificados, una respuesta táctil breve y respeta `prefers-reduced-motion`. La animación solicita frames con `requestAnimationFrame`; 60 FPS es una meta posible, no una garantía de todos los dispositivos.
- La hoja de estilos también reduce animaciones en `prefers-reduced-motion`.

La implementación es Canvas 2D, no WebGL/shaders. La decisión mantiene el efecto local y sin una dependencia gráfica pesada.

## 5. Contacto y formularios

- El bloque de contacto principal usa `mailto:contact@jeremyavalos.xyz`, LinkedIn, GitHub e Instagram; no es un formulario web convencional.
- El diálogo para visitantes recurrentes incluye un formulario opcional de email con validación HTML básica y máximo de 254 caracteres.
- El formulario envía `email` y `visitor_id` a `POST /api/leads`; el backend valida y guarda el lead. La notificación por email es opcional y depende de la configuración de Resend.
- El endpoint de leads tiene limitación de solicitudes. La entrega efectiva de email a un destinatario no se probó.
- Los enlaces y la ruta de Railway están en el código. No se completó un envío real de lead ni una prueba de clic que dependiera de un cliente de correo instalado.

## 6. API y backend

Rutas públicas observadas en [`backend/src/index.js`](./backend/src/index.js):

| Método y ruta | Propósito |
|---|---|
| `GET /health` | Estado básico del proceso (`200` verificado externamente). |
| `POST /api/analytics/track` | Ingesta de page views e interacciones; devuelve contexto de visita recurrente en page views. |
| `POST /api/leads` | Captura voluntaria de email del diálogo recurrente. |
| `POST /admin/login` | Inicio de sesión administrativo con usuario y hash de contraseña. |
| `GET /admin` | Formulario de login o dashboard, dependiendo de la sesión. La ruta pública respondió `200`; no se autenticó. |
| `POST /admin/logout` | Cierre de sesión con protección CSRF. |

Rutas administrativas protegidas por sesión:

- `GET /api/admin/overview`
- `GET /api/admin/visitors` y `/api/admin/visitors/:visitorId`
- `GET /api/admin/fingerprint/:fp`
- `GET /api/admin/ips` y `/api/admin/ips/:ip`
- `GET /api/admin/tracking` y `/api/admin/tracking/:ref`
- `GET /admin/assets/*` para los recursos del dashboard.

Las rutas de consulta administrativa comprueban `isAdminAuthenticated`. Los parámetros de SQL observados se pasan como valores parametrizados. Las respuestas de `/api/admin` llevan `Cache-Control: no-store`.

## 7. Integración y despliegue

- **Frontend/Vercel:** el repositorio contiene [`vercel.json`](./vercel.json), con configuración de hosting estático. El dominio público respondió `308` y luego `200` al seguir la redirección.
- **Backend/Railway:** [`index.html`](./index.html#L495) define `window.API_BASE` hacia Railway. `GET /health` respondió `200`; esto verifica que la ruta responde, no todas las APIs ni el acceso a la base de datos.
- **PostgreSQL:** configurado mediante `DATABASE_URL` y usado por analytics, leads y sesiones administrativas. No se consultó producción.
- **IPinfo:** geolocalización aproximada opcional mediante IP, almacenada en caché por 30 días. El estado del token/configuración no se comprobó.
- **Email:** el backend puede notificar leads a través de Resend si existe configuración; no se comprobó el envío.
- No se modificaron configuraciones, variables de entorno, credenciales ni despliegues.

## 8. Dashboard administrativo

El dashboard se sirve desde `/admin`; la autenticación usa usuario y hash bcrypt, sesión server-side en PostgreSQL, regeneración de sesión tras login y cookie `httpOnly`, `SameSite=Lax` y `Secure` en producción. El login está limitado a seis intentos por minuto; las APIs generales y los leads tienen sus propios límites.

La interfaz actual muestra exclusivamente:

1. **Overview:** visitantes, visitas, visitas de hoy, IPs observadas y eventos sin visitor ID.
2. **Visitors:** perfiles anónimos, timeline, sesiones agrupadas, páginas, dispositivos, red, IPs y adquisición.
3. **IPs observed:** eventos y visitantes asociados por IP.
4. **Tracking / interactions:** eventos, rutas, fuentes y atribución UTM.

Las sesiones analíticas se derivan de una pausa de 30 minutos entre eventos; no son una medida de duración de sesión enviada explícitamente por el navegador. El esquema también guarda sesiones server-side de administración, que son distintas de esas agrupaciones de visitas.

**Verificación limitada:** la ruta de acceso respondió `200`, pero no se usaron credenciales, no se abrió una sesión administrativa y no se consultaron datos privados. Por ello, la carga de tablas autenticadas, login/logout de producción y lecturas reales de PostgreSQL quedan **no verificadas en esta auditoría**.

## 9. Analytics y privacidad

### Flujo actualmente implementado

1. El navegador genera un UUID v4 aleatorio first-party y lo conserva en cookie por un año.
2. Envía page view con ruta, referrer, parámetros `ref`/UTM, User-Agent y fingerprint opcional.
3. El servidor selecciona una IP y registra su fuente (`cf-connecting-ip`, `x-forwarded-for`, `x-real-ip` o socket), además de clasificar sistema operativo, navegador y tipo/nombre de dispositivo.
4. Si hay token y la IP es pública, se solicita geolocalización aproximada a IPinfo. La caché expira a los 30 días.
5. Se registran vistas de secciones y algunos eventos de interacción; el dashboard puede asociar visitas, IPs, páginas, referencias, eventos y dispositivos.
6. El dashboard agrega países/regiones/ciudades aproximados, datos de ISP/ASN, cambios de IP, campañas y sesiones heurísticas.

El fingerprint de [`fingerprint.js`](./fingerprint.js) es un hash no criptográfico de ocho caracteres hexadecimales derivado de User-Agent, idioma, dimensiones y profundidad de color de pantalla, pixel ratio, zona horaria y concurrencia de hardware. No demuestra identidad, puede colisionar y puede variar.

### Retención y puntos de privacidad

- El backend elimina automáticamente eventos de analytics con más de 90 días al iniciar y una vez al día; también elimina entradas de geolocalización que ya no están referenciadas por eventos.
- Este comportamiento está implementado en [`backend/src/index.js`](./backend/src/index.js#L181). No se ejecutó manualmente ni se alteraron datos en esta auditoría. Los leads tienen tabla separada y no forman parte de esa misma consulta de limpieza.
- La IP sin procesar y su historial se registran por evento; la ubicación es aproximada y derivada de IP. Para resolverla, la IP se envía a IPinfo.
- El sitio inicia tracking desde el cliente sin un control de consentimiento visible en el flujo observado. La cookie de identificador dura un año; los eventos se retienen 90 días.
- El diálogo recurrente puede mostrar al visitante su IP actual, ubicación aproximada, dispositivo, navegador y fechas de visitas.
- No se encontró una página de privacidad integrada en la navegación del sitio. El apartado “Privacy” del README anterior era parte del perfil de GitHub, no una política servida por la página web.

Estos puntos son observaciones técnicas del código, no una conclusión legal. Conviene revisar aviso/consentimiento, retención y divulgación de terceros según la jurisdicción y el uso pretendido.

## 10. Banner de visitantes recurrentes

El diálogo solo se considera después de que el backend reconoce un `page_view` anterior para el visitor ID. La interfaz espera 1.8 segundos y aplica un cooldown local de siete días; también evita mostrarse durante interacciones activas, como un formulario o diálogo. Puede descartarse, permite abrir el formulario de email y registra eventos de exposición/interacción. El usuario puede abrir los detalles técnicos de conexión.

La lógica está en [`script.js`](./script.js#L160) y los textos aleatorios/contextuales en [`returning-visitor-copy.js`](./returning-visitor-copy.js). Está presente en el DOM y el flujo de código; no se ejecutó una sesión real con un visitante previamente identificado en producción.

## 11. Estado de juegos y datos históricos

- No se encontraron secciones, enlaces, textos de juego ni componentes de gameplay en la interfaz pública revisada.
- No se encontraron rutas de juego en el runtime actual de `backend/src` ni componentes de juego en `backend/admin`.
- Los términos `players`, `challenges`, `games` y `moves` siguen presentes en migraciones históricas, incluida [`backend/migrations/init.sql`](./backend/migrations/init.sql). No se borraron tablas, migraciones ni registros.
- Las migraciones se inspeccionaron, pero no se ejecutaron. La base de datos de producción no se consultó.
- Por tanto, los juegos están **retirados de la experiencia/runtime inspeccionados**, mientras que sus estructuras históricas están **preservadas**. El estado físico de esas tablas/datos no se comprobó contra producción.

## 12. Dependencias y mantenimiento

- No hay manifiesto de dependencias ni build del frontend en la raíz. Se usan fuentes externas de Google Fonts.
- El backend tiene dependencias de Express, PostgreSQL, sesiones, bcrypt, Helmet, CORS, rate limiting, CSRF y dotenv, entre otras; versiones y scripts están en [`backend/package.json`](./backend/package.json).
- Las regresiones locales se ejecutan con `npm test --prefix backend`. La suite PostgreSQL de integración está separada y requiere `TEST_DATABASE_URL`.
- Las migraciones permanecen como historial del esquema. No se propone consolidarlas ni editar tablas como parte de esta auditoría.
- No se observó evidencia suficiente para declarar obsoletos los módulos de analytics, administración o el banner. Los componentes de juego eliminados ya no son dependencias del runtime actual.

## 13. Seguridad

### Controles observados

- Helmet, CORS con allowlist, límites de solicitudes, cookie de sesión `httpOnly`, sesión PostgreSQL, bcrypt, regeneración de sesión tras login y comprobación CSRF al cerrar sesión.
- Los endpoints administrativos requieren sesión y sus respuestas evitan caché.
- IPinfo solo recibe direcciones públicas y usa timeout; el fingerprint se valida con formato restringido.

### Riesgos/pendientes de revisión

1. **Secret de sesión por defecto:** el código usa `dev_session_secret` como fallback incluso en el middleware de sesión. En producción genera una advertencia, pero no impide arrancar. La configuración real de Railway no fue inspeccionada; confirmar privadamente que hay un valor fuerte y único. No se consultó ni expuso ningún secreto.
2. **Confianza de IP reenviada:** si `TRUSTED_PROXY_CIDRS` no está configurado, la ruta de compatibilidad usa el primer valor válido de `X-Forwarded-For`. El propio comentario del código advierte que puede ser falsificado si el proxy de ingreso no sobrescribe/sanea el header. Confirmar la política real del proxy de Railway y configurar CIDRs confiables si corresponde.
3. **Datos sensibles en analytics:** IP, referrer, User-Agent, fingerprint y datos geográficos se combinan en una vista administrativa. El acceso autenticado existe en código, pero no se hizo prueba de penetración ni inspección de usuarios/permisos de producción.
4. **Aviso de privacidad:** no se observó una política/consentimiento visible en el sitio, a pesar de que el tracking incluye IP, fingerprint y geolocalización de terceros.

No se ejecutó un análisis de vulnerabilidades ni se intentó acceder a áreas privadas.

## 14. Experiencia móvil, accesibilidad, SEO y rendimiento

- **Responsive:** la hoja de estilos contiene breakpoints de escritorio/tablet/móvil; el carrusel usa scroll nativo y se puede navegar con teclado.
- **Accesibilidad presente:** `lang="en"`, texto alternativo en imágenes principales, etiquetas ARIA en navegación/carrusel/controles, estado del carrusel con `aria-live`, foco visible en varios controles y soporte de `prefers-reduced-motion`.
- **Mejoras posibles:** el enlace administrativo del footer es deliberadamente discreto y tiene `outline:none`; conviene asegurar un indicador de foco visible. Algunos enlaces externos y el diálogo recurrente merecen revisión manual con lector de pantalla y teclado.
- **SEO presente:** título, descripción, favicon y encabezados semánticos.
- **SEO no observado:** etiquetas canonical/Open Graph/Twitter, datos estructurados y sitemap/robots; no se vieron en el repositorio inspeccionado.
- **Rendimiento:** no hay framework pesado ni dependencia de animación. Imágenes del carrusel se cargan de forma diferida en varios casos y el efecto Canvas se activa bajo demanda. No se hizo una auditoría de Lighthouse, medición de memoria, throttling o comparación de FPS.
- **Consola y navegación:** no se ejecutó una sesión de navegador de producción con login o envío real; por ello, no se certifica ausencia universal de errores de consola.

## 15. Pruebas y estado final

| Comprobación | Resultado |
|---|---|
| GET `https://jeremyavalos.xyz` siguiendo redirección | `200` |
| GET Railway `/health` | `200` |
| GET Railway `/admin` sin sesión | `200`; solo confirma disponibilidad de la ruta/login, no la operación del dashboard autenticado |
| Pruebas backend unitarias/regresión | `npm test --prefix backend` pasó. La prueba negativa de CSRF registra el rechazo esperado en stderr; el proceso terminó con código `0`. |
| Pruebas PostgreSQL de integración | No ejecutadas contra producción. Requieren una base desechable indicada por `TEST_DATABASE_URL`. |
| Autenticación real del dashboard, lectura de analytics y leads | No verificados; no se usaron credenciales ni se enviaron datos. |
| Migraciones y persistencia | No ejecutadas ni modificadas. |

### Prioridades recomendadas

1. Verificar de forma privada la configuración de `SESSION_SECRET` y los encabezados/proxies reales, sin compartir valores.
2. Decidir y documentar el aviso/consentimiento de analytics, la geolocalización de terceros y los plazos de retención.
3. Añadir metadatos sociales/canonical y revisar el foco del enlace administrativo.
4. Validar login y dashboard con credenciales autorizadas en un entorno seguro, y ejecutar integración PostgreSQL solo contra una base desechable.
