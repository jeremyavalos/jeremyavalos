(() => {
  const STORAGE_KEY = "portfolioLanguage";
  const translations = {
    "Skip to content": "Saltar al contenido",
    MENU: "MENÚ",
    "01 LABS": "01 LABS",
    "02 WORK": "02 PROYECTOS",
    "03 STACK": "03 STACK",
    "04 CERTIFICATIONS": "04 CERTIFICACIONES",
    "05 CONTACT": "05 CONTACTO",
    "01 WORK": "01 PROYECTOS",
    "02 CAPABILITIES": "02 CAPACIDADES",
    "03 ABOUT": "03 PERFIL",
    "04 CONTACT": "04 CONTACTO",
    "INDEPENDENT DEVELOPER / MÉXICO": "DESARROLLADOR INDEPENDIENTE / MÉXICO",
    "From idea": "De la idea",
    to: "a la",
    "interface.": "interfaz.",
    "And beyond.": "Y mucho más.",
    "Full-stack development. Product thinking.": "Desarrollo full-stack. Visión de producto.",
    "I build commercial websites, mobile products and the systems behind them.": "Creo sitios web comerciales, productos móviles y los sistemas que los hacen funcionar.",
    STATUS: "ESTADO",
    "OPEN TO WORK": "DISPONIBLE PARA NUEVOS PROYECTOS",
    LOCATION: "UBICACIÓN",
    "MÉXICO": "MÉXICO",
    FOCUS: "ENFOQUE",
    "WEB · MOBILE · APIs · AUTOMATION": "WEB · MÓVIL · APIs · AUTOMATIZACIÓN",
    "LET’S BUILD SOMETHING": "CONSTRUYAMOS ALGO",
    "VIEW WORK": "VER PROYECTOS",
    Email: "Correo",
    "THE HUMAN BEHIND THE CODE": "LA PERSONA DETRÁS DEL CÓDIGO",
    "01 / ENGINEERING LABS": "01 / LABORATORIOS DE INGENIERÍA",
    Engineering: "Laboratorios de",
    "Labs.": "ingeniería.",
    "Research, automation and systems.": "Investigación, automatización y sistemas.",
    "A closer look beneath the interface.": "Una mirada a lo que sucede detrás de la interfaz.",
    "Engineering Labs": "Laboratorios de ingeniería",
    "From market discovery to explainable decisions: a modular prediction-market research system.": "Un sistema modular para investigar mercados de predicción, desde el descubrimiento de oportunidades hasta la toma de decisiones justificables.",
    "A Binance Spot engine built around market signals, risk checks and traceable decisions.": "Un motor de Binance Spot basado en señales de mercado, controles de riesgo y decisiones trazables.",
    "An observation-only pipeline for discovering new pools and screening on-chain risks.": "Un sistema de monitoreo que descubre nuevos pools y evalúa riesgos on-chain sin ejecutar operaciones.",
    "Explore project": "Explorar proyecto",
    "02 / SELECTED WORK": "02 / PROYECTOS SELECCIONADOS",
    "Built for the": "Creado para el",
    "real world.": "mundo real.",
    "Client work and independent products.": "Trabajo para clientes y productos independientes.",
    "From the first impression to the final detail.": "Desde la primera impresión hasta el último detalle.",
    "Client Work": "Trabajo para clientes",
    "Client Work · Created for a client": "Trabajo para cliente · Creado para un cliente",
    "Own Brand": "Marca propia",
    "Own Product": "Producto propio",
    "A Caribbean yacht charter experience, from discovering the fleet to requesting a private trip.": "Una experiencia de alquiler de yates en el Caribe, desde descubrir la flota hasta solicitar un viaje privado.",
    "A clear, personal introduction to insurance advice, with a direct route to a conversation.": "Una presentación clara y cercana de la asesoría en seguros, con una vía directa para iniciar una conversación.",
    "A digital studio experience created for a client, with interactive demos and a guided project enquiry.": "Una experiencia de estudio digital creada para un cliente, con demos interactivas y un proceso claro para solicitar un proyecto.",
    "A mobile product and public resource site designed to make legal information and support easier to find.": "Una aplicación móvil y un sitio público que facilitan el acceso a información legal y recursos de apoyo.",
    "A mobile product for building consistent habits through clear routines, progress tracking and personal accountability.": "Un producto móvil para crear hábitos constantes mediante rutinas claras, seguimiento del progreso y responsabilidad personal.",
    "A mobile-first yacht platform for exploring the fleet, checking availability and sending structured reservation requests.": "Una plataforma móvil para explorar la flota, consultar disponibilidad y enviar solicitudes de reservación con toda la información necesaria.",
    "03 / CAPABILITIES": "03 / CAPACIDADES",
    "Across the stack.": "En todas las capas.",
    "CAPABILITY / 01": "CAPACIDAD / 01",
    "CAPABILITY / 02": "CAPACIDAD / 02",
    "CAPABILITY / 03": "CAPACIDAD / 03",
    "CAPABILITY / 04": "CAPACIDAD / 04",
    BUILD: "DESARROLLO",
    ENGINEERING: "INGENIERÍA",
    PRODUCT: "PRODUCTO",
    TECHNOLOGY: "TECNOLOGÍA",
    "Mobile Apps": "Aplicaciones móviles",
    Websites: "Sitios web",
    "Product Design": "Diseño de producto",
    "Business Analysis": "Análisis de negocio",
    "Technical Consulting": "Consultoría técnica",
    "Digital Solutions": "Soluciones digitales",
    "04 / CONTINUOUS LEARNING": "04 / APRENDIZAJE CONTINUO",
    "Certifications &": "Certificaciones y",
    "achievements.": "logros.",
    "Course completions.": "Cursos completados.",
    "Foundations I keep building on.": "Conocimientos que sigo fortaleciendo.",
    "FIVE ACADEMIC MILESTONES": "CINCO LOGROS ACADÉMICOS",
    "Course completion": "Curso finalizado",
    "Statement of achievement": "Constancia de logro académico",
    "Data Analytics Essentials": "Data Analytics Essentials",
    "Introduction to Cybersecurity": "Introduction to Cybersecurity",
    "Python Essentials 1": "Python Essentials 1",
    "Python Essentials 2": "Python Essentials 2",
    "April 12, 2026": "12 de abril de 2026",
    "November 12, 2026": "12 de noviembre de 2026",
    "May 22, 2026": "22 de mayo de 2026",
    "Open original PDF": "Abrir PDF original",
    "SCROLL TO EXPLORE ↔": "DESLIZA PARA EXPLORAR ↔",
    "View verified credentials on Credly": "Ver credenciales verificadas en Credly",
    "ACADEMIC ACHIEVEMENT": "LOGRO ACADÉMICO",
    "Zoom in": "Ampliar",
    "Fit to screen": "Ajustar a la pantalla",
    "Open original PDF ↗": "Abrir PDF original ↗",
    "05 / CONTACT": "05 / CONTACTO",
    "Let’s build what’s next.": "Construyamos lo que sigue.",
    "Freelance projects, product collaborations and technology opportunities.": "Proyectos freelance, colaboraciones de producto y oportunidades tecnológicas.",
    EMAIL: "CORREO",
    INSTAGRAM: "INSTAGRAM",
    LINKEDIN: "LINKEDIN",
    THREADS: "THREADS",
    CREDLY: "CREDLY",
    "Verified credentials ↗": "Credenciales verificadas ↗",
    "← ALL WORK": "← VOLVER A PROYECTOS",
    "← ALL LABS": "← VOLVER A LABORATORIOS",
    "Own Product / Mobile": "Producto propio / Móvil",
    "Own Product / Full-stack platform": "Producto propio / Plataforma full-stack",
    "Own Product / Own Products / Mobile & web": "Producto propio / Móvil y web",
    "Own Brand / Own Products / Independent digital studio": "Marca propia / Estudio digital independiente",
    "Client Work / Insurance · Advisor website": "Proyecto para cliente / Seguros · Sitio de asesoría",
    "Client Work / Tourism · Reservation experience": "Proyecto para cliente / Turismo · Experiencia de reservación",
    "Client Work / Created for a client / Insurance · Advisor website": "Proyecto para cliente / Seguros · Sitio de asesoría",
    "Client Work / Created for a client / Tourism · Reservation experience": "Proyecto para cliente / Turismo · Experiencia de reservación",
    "Client Work / Created for a client / Digital studio": "Proyecto para cliente / Estudio digital",
    "Client Work / Created for a client / Full-stack platform": "Proyecto para cliente / Plataforma full-stack",
    "Engineering Labs / Automation · Execution controls": "Laboratorios de ingeniería / Automatización · Controles de ejecución",
    "Engineering Labs / On-chain research · Data pipelines": "Laboratorios de ingeniería / Investigación on-chain · Flujos de datos",
    "Engineering Labs / Market research · Decision systems": "Laboratorios de ingeniería / Investigación de mercados · Sistemas de decisión",
    "Mobile product · Public source repository": "Producto móvil · Repositorio público",
    "YATCK K CLUB · Public web repository": "YATCK K CLUB · Repositorio web público",
    "Public website · Independent brand": "Sitio público · Marca independiente",
    "Public landing · Mobile product in development": "Sitio público · Aplicación móvil en desarrollo",
    "Public preview · Service website": "Vista previa pública · Sitio de servicios",
    "Public website · Ongoing development": "Sitio público · Desarrollo en curso",
    "Created for a client · Public website": "Creado para un cliente · Sitio público",
    "Experimental engine · Private implementation": "Motor experimental · Implementación privada",
    "Experimental research · Private implementation": "Investigación experimental · Implementación privada",
    "Observation-only research · Private implementation": "Investigación sin ejecución · Implementación privada",
    "View public repository ↗": "Ver repositorio público ↗",
    "Visit website ↗": "Visitar sitio ↗",
    "Explore the other labs ↗": "Explorar los otros labs ↗",
    "Real application screens showing onboarding, daily habits and progress.": "Pantallas reales de la aplicación: configuración inicial, hábitos diarios y seguimiento del progreso.",
    "Real YATCK K CLUB screens showing yacht discovery, catalog and availability.": "Pantallas reales de YATCK K CLUB con exploración de la flota, catálogo y disponibilidad.",
    "Captured from the published studio website. Businesses inside the demos use sample data.": "Capturas del sitio publicado del estudio. Los negocios de las demos usan datos de muestra.",
    "Real captures of the public web landing, not screenshots of the native app.": "Capturas reales del sitio público, no de la aplicación nativa.",
    "Captured from the provided public Vercel preview. No contact forms were submitted.": "Capturas de la vista previa pública en Vercel. No se enviaron formularios de contacto.",
    "Captured from the published website. The local reservation and language implementation may be ahead of the public version.": "Capturas del sitio publicado. La implementación local de reservaciones e idiomas puede estar más avanzada que la versión pública.",
    "Editorial interpretation based on the inspected system architecture. No live orders, balances or operational logs are displayed.": "Interpretación editorial basada en la arquitectura inspeccionada. No se muestran órdenes activas, saldos ni registros operativos.",
    "Editorial interpretation based on the inspected observation pipeline. No token addresses, private records or invented trading results.": "Interpretación editorial basada en el flujo de observación inspeccionado. No se muestran direcciones de tokens, registros privados ni resultados de trading inventados.",
    "Editorial interpretation based on the inspected system architecture. It is not a runtime screenshot or a performance report.": "Interpretación editorial basada en la arquitectura inspeccionada. No es una captura en ejecución ni un informe de rendimiento.",
    "01 / THE PROBLEM": "01 / EL PROBLEMA",
    "02 / MY CONTRIBUTION": "02 / MI CONTRIBUCIÓN",
    "03 / THE EXPERIENCE": "03 / LA EXPERIENCIA",
    "A reason to build.": "El punto de partida.",
    "What I developed.": "Lo que desarrollé.",
    "Considered at every step.": "Pensado en cada etapa.",
    "Inside the system.": "Dentro del sistema.",
    "Habit systems often become complicated or difficult to sustain. The product brings routines, accountability and progress into one calm mobile experience.": "Muchas herramientas para crear hábitos terminan siendo complicadas o difíciles de mantener. Covenant reúne rutinas, seguimiento y progreso en una experiencia móvil clara y tranquila.",
    "I designed and developed the Expo / React Native application, including onboarding, habit management, progress and subscription flows.": "Diseñé y desarrollé la aplicación con Expo y React Native, desde la configuración inicial hasta la gestión de hábitos, el seguimiento del progreso y las suscripciones.",
    "Start with intention": "Comenzar con intención",
    "Guided onboarding helps people define their motivation before creating a routine.": "La configuración inicial ayuda a cada persona a definir su motivación antes de crear una rutina.",
    "Build daily consistency": "Crear constancia diaria",
    "A focused habits view keeps daily actions clear and easy to review.": "Una vista enfocada en los hábitos mantiene claras las acciones diarias y facilita revisarlas.",
    "See progress over time": "Ver el progreso con el tiempo",
    "Progress views turn completed routines into visible feedback without crowding the experience.": "Las vistas de progreso convierten las rutinas completadas en información visual sin saturar la experiencia.",
    "Native mobile interface": "Interfaz móvil nativa",
    "Yacht reservations often begin in chat without enough structured information. The platform gives customers a clear path from fleet discovery to a detailed reservation request.": "Las reservaciones de yates suelen comenzar por chat y con información incompleta. La plataforma guía al cliente desde la exploración de la flota hasta una solicitud detallada.",
    "I designed and developed the mobile-first experience, yacht catalog, availability flow and reservation architecture, backed by an API and persistent data model.": "Diseñé y desarrollé la experiencia móvil, el catálogo de yates, la consulta de disponibilidad y la arquitectura de reservaciones, conectados a una API y una base de datos.",
    "Explore the fleet": "Explorar la flota",
    "Customers can browse yachts and compare the details that matter before making contact.": "Los clientes pueden explorar yates y comparar los detalles importantes antes de ponerse en contacto.",
    "Choose a date": "Elegir una fecha",
    "An availability calendar brings the preferred date into the reservation flow.": "El calendario permite elegir una fecha disponible como parte de la solicitud de reservación.",
    "Send a complete request": "Enviar una solicitud completa",
    "The booking experience captures trip details so the team can follow up with useful context.": "El proceso de reservación recopila los detalles del viaje para que el equipo pueda dar seguimiento con la información necesaria.",
    "A local business owner should be able to picture a useful website before navigating a technical brief.": "El dueño de un negocio local debería poder visualizar su sitio antes de tener que definir requisitos técnicos.",
    "I created the studio’s bilingual digital experience, interactive business demos and structured enquiry flow, connecting the frontend to a dedicated request service.": "Creé la experiencia bilingüe del estudio, las demos interactivas y un proceso guiado para solicitar proyectos, conectado a un servicio propio en el backend.",
    "Explore by business type": "Explorar por tipo de negocio",
    "Six interactive demos show different ways to present a shop, service or local business.": "Seis demos interactivas muestran distintas formas de presentar una tienda, servicio o negocio local.",
    "Shape an enquiry": "Definir un proyecto",
    "A guided flow helps a visitor communicate what their business needs.": "Un proceso guiado ayuda a cada visitante a explicar con claridad lo que necesita su negocio.",
    "Switch languages": "Cambiar de idioma",
    "Spanish and English content make the studio accessible to different audiences.": "El contenido en español e inglés hace que el estudio sea accesible para públicos distintos.",
    "Finding legal information and support can be overwhelming. The product brings resources into a more approachable experience.": "Encontrar información legal y apoyo puede ser abrumador. El producto reúne recursos en una experiencia más accesible.",
    "I developed the Expo / React Native application and a separate public web landing that introduces the product and its resources.": "Desarrollé la aplicación con Expo y React Native y, por separado, un sitio público que presenta el producto y sus recursos.",
    "Find useful information": "Encontrar información útil",
    "Legal information and support resources are organised for easier discovery.": "La información legal y los recursos de apoyo están organizados para encontrarlos con facilidad.",
    "Explore on mobile": "Explorar desde el móvil",
    "The native application uses Expo and React Native with a dedicated navigation structure.": "La aplicación nativa usa Expo y React Native con una estructura de navegación dedicada.",
    "Learn about the product": "Conocer el producto",
    "The public website explains the initiative and provides access to supporting resources.": "El sitio público explica la iniciativa y facilita el acceso a recursos de apoyo.",
    "Insurance and long-term planning involve unfamiliar choices. Visitors need to understand the advisor’s offer and know how to ask for guidance.": "Los seguros y la planificación a largo plazo implican decisiones poco familiares. Los visitantes necesitan entender la propuesta del asesor y saber cómo pedir orientación.",
    "I developed a responsive advisor website with dedicated service content, an introduction to the advisor and contextual contact paths.": "Desarrollé un sitio web responsivo para el asesor, con información clara sobre sus servicios, una presentación personal y opciones de contacto según el contexto.",
    "Understand the services": "Entender los servicios",
    "Dedicated content makes retirement planning and medical coverage easier to explore.": "El contenido especializado facilita explorar la planificación para el retiro y la cobertura médica.",
    "Meet the advisor": "Conocer al asesor",
    "A personal introduction and real photography give the experience a human point of reference.": "La presentación personal y las fotografías reales hacen que la experiencia se sienta cercana y confiable.",
    "Start with a conversation": "Comenzar con una conversación",
    "Contextual WhatsApp links help visitors ask about the service they are viewing.": "Los enlaces contextuales de WhatsApp ayudan a preguntar por el servicio que se está consultando.",
    "Choosing a private yacht should feel as effortless as the trip itself. Guests need a clear view of the fleet and a simple way to explain what they are looking for.": "Elegir un yate privado debería sentirse tan sencillo como el viaje. Los clientes necesitan una vista clara de la flota y una forma simple de explicar lo que buscan.",
    "I developed a responsive charter website and the reservation-request workflow, connecting a visual fleet catalogue with a separate API and persistent booking data.": "Desarrollé un sitio responsivo para reservar yates y el flujo de solicitudes, conectando el catálogo visual de la flota con una API independiente y una base de datos.",
    "Discover the fleet": "Descubrir la flota",
    "Explore vessels, photographs and capacity information before choosing a trip.": "Explora embarcaciones, fotografías y capacidad antes de elegir un viaje.",
    "Request a private trip": "Solicitar un viaje privado",
    "Share trip details through a guided request instead of a complicated checkout.": "Comparte los detalles del viaje mediante una solicitud guiada en lugar de un proceso de pago complicado.",
    "Browse in your language": "Navegar en tu idioma",
    "The local implementation supports Spanish, English and Portuguese with remembered language preferences.": "La implementación local admite español, inglés y portugués, y recuerda el idioma elegido.",
    "An automated strategy needs more than a signal. It needs explicit boundaries for entry, execution health and position management.": "Una estrategia automatizada necesita más que una señal. Requiere límites explícitos para la entrada, la calidad de ejecución y la gestión de posiciones.",
    "I developed a modular Spot engine that connects market intelligence, strategy routing, risk checks, execution and decision journals.": "Desarrollé un motor Spot modular que integra análisis de mercado, selección de estrategias, controles de riesgo, ejecución y un historial de decisiones.",
    "Read the market": "Leer el mercado",
    "Technical, momentum, volume and volatility modules contribute context.": "Los módulos técnicos, de momentum, volumen y volatilidad aportan contexto.",
    "Apply execution controls": "Aplicar controles de ejecución",
    "Risk and execution-health checks can block new entries.": "Los controles de riesgo y calidad de ejecución pueden bloquear nuevas entradas.",
    "Keep a decision trail": "Mantener un historial de decisiones",
    "Dedicated journals separate signals, execution, trades and local AI context.": "Los registros separan las señales, la ejecución, las operaciones y el contexto aportado por la IA local.",
    "New token pools produce scattered signals. Research needs a repeatable way to collect evidence and revisit what happened later.": "Los nuevos pools de tokens generan señales dispersas. La investigación necesita un método repetible para reunir evidencia y revisar después lo ocurrido.",
    "I developed an asynchronous pipeline that discovers PancakeSwap pools, checks provider and liquidity data, scores candidates and tracks subsequent outcomes.": "Desarrollé un flujo asíncrono que descubre pools de PancakeSwap, valida las fuentes de datos y la liquidez, califica candidatos y da seguimiento a sus resultados.",
    "Discover new pools": "Descubrir nuevos pools",
    "The scanner observes PancakeSwap pool creation events on BNB Smart Chain.": "El escáner observa eventos de creación de pools de PancakeSwap en BNB Smart Chain.",
    "Screen the evidence": "Evaluar la evidencia",
    "The analysis pipeline combines liquidity, provider availability and contract-risk checks.": "El flujo de análisis combina liquidez, disponibilidad de proveedores y controles de riesgo del contrato.",
    "Track later outcomes": "Seguir resultados posteriores",
    "SQLite persistence connects candidates, analysis and later observations.": "La persistencia en SQLite conecta candidatos, análisis y observaciones posteriores.",
    "Market data is noisy. A candidate needs to be checked for price, liquidity and risk before it becomes a decision.": "Los datos de mercado contienen ruido. Un candidato debe evaluarse por precio, liquidez y riesgo antes de convertirse en una decisión.",
    "I developed modular market discovery, probability and edge analysis, execution controls and evaluation tooling in a TypeScript system.": "Desarrollé módulos de descubrimiento de mercados, análisis de probabilidad y ventaja, controles de ejecución y herramientas de evaluación en TypeScript.",
    "Discover and classify": "Descubrir y clasificar",
    "Markets are discovered and routed to supported strategy types.": "Los mercados se descubren y dirigen a los tipos de estrategia compatibles.",
    "Check before acting": "Comprobar antes de actuar",
    "Probability, executable prices and liquidity are evaluated before execution controls.": "La probabilidad, los precios ejecutables y la liquidez se evalúan antes de los controles de ejecución.",
    "Review decisions": "Revisar decisiones",
    "Persistence and evaluation modules support investigation of system behaviour.": "Los módulos de persistencia y evaluación permiten investigar el comportamiento del sistema.",
    "Mobile browser · 390 × 844": "Navegador móvil · 390 × 844",
    "Engineering notes": "Notas de ingeniería",
    "The application is built with Expo and React Native. RevenueCat is used for the subscription flow. The screens shown here are captures from the product; no usage or performance claims are implied.": "La aplicación está desarrollada con Expo y React Native, y utiliza RevenueCat para gestionar las suscripciones. Las imágenes son capturas reales del producto; no representan cifras de uso ni resultados de rendimiento.",
    "The customer experience was designed around React Native and Expo, with a TypeScript interface and a Node.js reservation architecture. The linked public repository represents the web interface; the screenshots here show the mobile-first product experience.": "La experiencia del cliente se diseñó con React Native y Expo, una interfaz en TypeScript y una arquitectura de reservaciones en Node.js. El repositorio público enlazado corresponde a la interfaz web; las capturas muestran la experiencia móvil del producto.",
    "The sample businesses are clearly demonstration content, not client commissions. Request processing and notifications live behind the server interface instead of exposing provider credentials in the browser.": "Los negocios de muestra son contenido de demostración, no trabajos para clientes. El procesamiento de solicitudes y las notificaciones ocurren en el servidor para no exponer credenciales en el navegador.",
    "The public landing and the mobile application are different surfaces. The screenshots here show the website on desktop and mobile browsers, not native app screens. Authentication, payments and connected document storage are not claimed.": "El sitio público y la aplicación móvil son productos distintos. Estas capturas corresponden al sitio en navegadores de escritorio y móvil, no a la aplicación nativa. El caso no presenta funciones de autenticación, pagos ni almacenamiento de documentos.",
    "Contact links leave the visitor in control of sending a message. A separate server-side lead integration exists in the code; production form delivery is not asserted here.": "Los enlaces de contacto permiten que el visitante decida si envía el mensaje. El código incluye una integración independiente para registrar prospectos en el servidor; este caso no presenta el envío del formulario como una función activa en producción.",
    "The web experience and reservation API are separate services. A request starts a conversation with the operator; the current local flow does not assume an instant payment or a confirmed booking.": "La experiencia web y la API de reservaciones son servicios independientes. Una solicitud inicia una conversación con el operador; el flujo local actual no presupone un pago inmediato ni una reserva confirmada.",
    "Local AI provides context alongside explicit strategy and risk rules. PAPER, TESTNET and LIVE modes exist in the implementation; this case study does not assert an active operating mode or financial results.": "La IA local aporta contexto, mientras que las reglas de estrategia y riesgo establecen límites explícitos. La implementación contempla los modos PAPER, TESTNET y LIVE; este caso no indica cuál está activo ni presenta resultados financieros.",
    "Scanning and outcome tracking run concurrently. Missing provider data is handled explicitly. The inspected build is observation-only: it does not sign transactions or execute trades.": "El escaneo y el seguimiento de resultados se ejecutan en paralelo. La falta de datos del proveedor se gestiona de forma explícita. La versión inspeccionada solo observa: no firma transacciones ni ejecuta operaciones.",
    "Discovery, strategy analysis and execution are separate responsibilities. The diagram summarises these boundaries without exposing source code, private operations or account information.": "El descubrimiento, el análisis de estrategias y la ejecución son responsabilidades separadas. El diagrama resume estos límites sin exponer código fuente, operaciones privadas ni información de cuentas.",
    "HAVE SOMETHING IN MIND?": "¿TIENES ALGO EN MENTE?",
    "Let’s make it real.": "Hagámoslo realidad.",
    "START A CONVERSATION ↗": "INICIAR UNA CONVERSACIÓN ↗",
    "NEXT PROJECT": "SIGUIENTE PROYECTO",
    "FAMILIAR SIGNAL DETECTED": "VISITANTE RECURRENTE DETECTADO",
    "WELCOME BACK": "QUÉ BUENO VERTE DE NUEVO",
    "Looks like curiosity won.": "Parece que ganó la curiosidad.",
    "Looks like you've been here before.": "Parece que ya habías estado aquí.",
    "WELCOME BACK.": "QUÉ BUENO VERTE DE NUEVO.",
    "Your connection isn't giving me much of a location this time.": "Esta vez tu conexión no revela mucha información de ubicación.",
    "Your network tells a more interesting story.": "Tu red cuenta una historia más interesante.",
    "Either way, the important part is:": "En cualquier caso, lo importante es:",
    "you came back.": "volviste.",
    "Maybe there's something here worth building together.": "Quizá haya algo aquí que valga la pena construir juntos.",
    "LAST SEEN": "ÚLTIMA VISITA",
    "BACK ONLINE": "DE NUEVO EN LÍNEA",
    "CONNECTION DETAILS": "DETALLES DE CONEXIÓN",
    DEVICE: "DISPOSITIVO",
    BROWSER: "NAVEGADOR",
    "FIRST SEEN": "PRIMERA VISITA",
    "START A PROJECT": "INICIAR UN PROYECTO",
    "LEAVE YOUR EMAIL": "DEJAR TU CORREO",
    "KEEP EXPLORING": "SEGUIR EXPLORANDO",
    "YOUR EMAIL": "TU CORREO",
    SEND: "ENVIAR",
    "SENDING…": "ENVIANDO…",
    "Got it. I'll be in touch.": "Listo. Me pondré en contacto.",
    "SIGNAL LOST — PLEASE TRY AGAIN.": "SEÑAL PERDIDA — INTÉNTALO DE NUEVO.",
    Unavailable: "No disponible",
    "Current session": "Sesión actual",
    approximate: "aproximada",
    "Back again? I respect the commitment.": "¿De vuelta? Eso es constancia.",
    "Second visit? Now we're getting somewhere.": "¿Segunda visita? Ahora sí avanzamos.",
    "But the important part is: you came back.": "Pero lo importante es que volviste.",
    "At least that's what your current IP says.": "Al menos eso indica tu IP actual.",
    "Primary navigation": "Navegación principal",
    "Keep exploring and close": "Seguir explorando y cerrar",
    "Open full-size project image": "Abrir imagen del proyecto a tamaño completo",
    "Technologies": "Tecnologías",
  };

  const originalText = new WeakMap();
  const originalAttributes = new WeakMap();
  const translatedAttributes = ["aria-label", "alt", "title", "placeholder", "content"];
  let language = "en";
  let applying = false;

  const normalized = (value) => value.replace(/\s+/g, " ").trim();

  function translatedValue(key) {
    if (translations[key]) return translations[key];
    const cityHeadline = key.match(/^(.+) THIS TIME\?$/);
    if (cityHeadline) return `¿${cityHeadline[1]} ESTA VEZ?`;
    const cityLead = key.match(/^Looks like (.+) from here\.$/);
    if (cityLead) return `Desde aquí parece ser ${cityLead[1]}.`;
    if (key.endsWith(" · approximate")) return key.replace(" · approximate", " · aproximada");
    if (key.endsWith(" — original certificate issued to Daniel Ramon Jeremy Avalos Esquivel")) {
      return key.replace(" — original certificate issued to", " — certificado original emitido a nombre de");
    }
    return null;
  }

  function translateTextNode(node) {
    if (!originalText.has(node)) originalText.set(node, node.nodeValue);
    const source = originalText.get(node);
    const key = normalized(source);
    const value = translatedValue(key);
    if (language === "es" && value) {
      const leading = source.match(/^\s*/)?.[0] || "";
      const trailing = source.match(/\s*$/)?.[0] || "";
      node.nodeValue = `${leading}${value}${trailing}`;
    } else if (language === "en") {
      node.nodeValue = source;
    }
  }

  function translateElement(element) {
    if (!originalAttributes.has(element)) originalAttributes.set(element, {});
    const originals = originalAttributes.get(element);
    translatedAttributes.forEach((attribute) => {
      if (!element.hasAttribute(attribute)) return;
      if (!(attribute in originals)) originals[attribute] = element.getAttribute(attribute);
      const source = originals[attribute];
      const value = translatedValue(normalized(source));
      element.setAttribute(attribute, language === "es" && value ? value : source);
    });
  }

  function translateTree(root = document) {
    applying = true;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach((node) => {
      if (!node.parentElement?.closest("script, style, code")) translateTextNode(node);
    });
    if (root.nodeType === Node.ELEMENT_NODE) translateElement(root);
    root.querySelectorAll?.("[aria-label], [alt], [title], [placeholder], meta[content]").forEach(translateElement);
    document.documentElement.lang = language;
    document.documentElement.dataset.language = language;
    document.querySelectorAll("[data-language-option]").forEach((button) => {
      const active = button.dataset.languageOption === language;
      button.setAttribute("aria-pressed", String(active));
      button.classList.toggle("is-active", active);
    });
    applying = false;
  }

  function setLanguage(nextLanguage, persist = true) {
    language = nextLanguage === "es" ? "es" : "en";
    if (persist) {
      try { localStorage.setItem(STORAGE_KEY, language); } catch (_) {}
    }
    translateTree();
    window.dispatchEvent(new CustomEvent("portfolio-language-change", { detail: { language } }));
  }

  function buildSwitcher() {
    const header = document.querySelector(".site-header");
    const nav = header?.querySelector(".nav-links");
    if (!header || !nav || header.querySelector(".language-switcher")) return;
    const switcher = document.createElement("div");
    switcher.className = "language-switcher mono";
    switcher.setAttribute("role", "group");
    switcher.setAttribute("aria-label", "Language / Idioma");
    switcher.innerHTML = `
      <button type="button" data-language-option="en" aria-pressed="true">EN</button>
      <span aria-hidden="true">/</span>
      <button type="button" data-language-option="es" aria-pressed="false">ES</button>`;
    switcher.addEventListener("click", (event) => {
      const button = event.target.closest("[data-language-option]");
      if (button) setLanguage(button.dataset.languageOption);
    });
    header.insertBefore(switcher, nav);
  }

  function init() {
    buildSwitcher();
    try { language = localStorage.getItem(STORAGE_KEY) === "es" ? "es" : "en"; } catch (_) {}
    translateTree();
    const observer = new MutationObserver((mutations) => {
      if (applying) return;
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.TEXT_NODE) translateTextNode(node);
          if (node.nodeType === Node.ELEMENT_NODE) translateTree(node);
        });
      });
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
