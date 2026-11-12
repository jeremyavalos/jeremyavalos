# Auditoría del perfil público de GitHub

## Alcance y separación de sistemas

El README público del perfil corresponde a [`jeremyavalos/jeremyavalos`](https://github.com/jeremyavalos/jeremyavalos), repositorio público con rama predeterminada `main`. El README del perfil es `README.md` en la raíz y coincide con el README local que se actualizó.

Ese mismo repositorio también contiene el código del portafolio web. Esto no hace que el perfil de GitHub y jeremyavalos.xyz sean el mismo producto: el README es la presentación del perfil; el sitio es una aplicación estática con integración de Railway descrita separadamente en [`PORTFOLIO_AUDIT.md`](./PORTFOLIO_AUDIT.md). Solo se modificó localmente el README del perfil y se añadieron los dos documentos solicitados. No hubo commit, push, merge ni despliegue.

## Estado anterior

El README anterior tenía una presentación personal, badges de Shields.io, varias estadísticas/imágenes dinámicas de terceros, sección de experiencia cuantificada, tecnologías y ocho proyectos destacados:

- Trading Bot, BinanceBot y TokenTrader.
- Metanoia, YATCK K CLUB y Covenant.
- VisorApp y ReparaTech.

También contenía Instagram y una sección “Privacy” sobre analytics del sitio. Esa sección no era una página legal integrada al frontend del portafolio.

### Diferencias y contenido que necesitaba revisión

| Elemento anterior | Evidencia revisada y decisión |
|---|---|
| Trading Bot, BinanceBot y TokenTrader | Están en las tarjetas y estudios de caso actuales del sitio. Se conservaron con descripciones acotadas a lo que muestran esas fichas y sin métricas financieras. |
| Metanoia | La ficha del sitio enlaza un sitio público que respondió `200`. Se conserva como proyecto público. |
| Covenant | La ficha actual enumera React Native, Expo, TypeScript y RevenueCat. El repo público `covenant-clean` contiene código Expo/TypeScript, aunque su README aún es la plantilla genérica de Expo. Se enlaza el repo; se omitió Firebase porque no aparece como stack de la ficha vigente y no se verificó aquí. |
| YATCK K CLUB | El sitio describe una experiencia mobile-first y enumera React Native, Node.js, PostgreSQL y Railway. El repo público enlazado contiene una app web Next.js/TypeScript con componentes de disponibilidad y booking. El nuevo README distingue ambas evidencias y no atribuye al código público el backend descrito por la ficha. |
| VisorApp | El sitio actual lo califica como trabajo de UX/estrategia/análisis y su CTA no apunta a una app verificable. Se omitió de la lista destacada para no presentarlo como producto publicado. |
| ReparaTech | No aparece en el catálogo actual del sitio revisado ni se verificó un repositorio público asociado. Se omitió; no se concluye que el proyecto no exista. |
| Afirmaciones de antigüedad/experiencia | Se quitó la tabla cuantificada de años y actividades no necesarias para la presentación técnica. No se añadieron años ni logros nuevos. |
| Badges de tecnologías y estadísticas | Se retiraron los contadores/imágenes de terceros. La lista nueva se limita a tecnologías mencionadas en las fichas y repositorios seleccionados, con nota de que no todas aplican a cada proyecto. |
| Sección “Privacy” previa | Se eliminó del README de perfil. La documentación de la implementación de analytics y los límites de privacidad están en el informe del portafolio; el README no es una política servida por la web. |

## Repositorios públicos revisados

La visibilidad y existencia se consultaron con GitHub API/CLI. Solo se abrieron archivos y árboles públicos necesarios; no se modificaron repositorios individuales.

| Repositorio público | Evidencia comprobada | Uso en el perfil |
|---|---|---|
| [`jeremyavalos/covenant-clean`](https://github.com/jeremyavalos/covenant-clean) | Árbol público con rutas Expo/TypeScript bajo `app/`, configuración Expo y recursos visuales. El README aún es texto genérico de inicio de Expo. | Enlazado como código público de Covenant; no se afirma que el README del repo esté terminado ni se atribuye un stack adicional. |
| [`jeremyavalos/yatchkclub`](https://github.com/jeremyavalos/yatchkclub) | Árbol público TypeScript con `app/`, componentes de disponibilidad, reserva y navegación, además de configuración Next.js. No se encontró README en la ruta consultada. | Enlazado como repositorio de interfaz web; se separa de la arquitectura backend descrita por el sitio. |
| `habit-api` | El README público describe una API de hábitos y contiene una URL de demo de ejemplo, no una URL verificable. El árbol público presenta una ruta `.env`; **no se abrió ni se copió su contenido**. | Omitido del README nuevo hasta que se revise el archivo de forma privada y se determine si el repo está limpio. Si hubiera credenciales en el historial, revisar/rotar con el proveedor correspondiente. |
| `user-manager-cli` | README y árbol públicos describen un CLI Python de gestión de usuarios con persistencia en archivo. | No se incluyó entre los proyectos principales; no es uno de los casos destacados actualmente en el sitio. |

No se inspeccionaron repositorios privados ni se incluyeron nombres o enlaces de proyectos privados. No se copiaron secretos, contenido de `.env`, métricas privadas ni información financiera.

## Nueva estructura del README

El nuevo [`README.md`](./README.md) tiene una presentación ligera, en inglés y compatible con el renderizador Markdown de GitHub:

1. Encabezado profesional y propuesta de valor.
2. Enlaces visibles al portafolio, LinkedIn y correo.
3. Cuatro áreas de trabajo: full-stack, mobile, backend y automation/trading research.
4. Seis proyectos con descripciones breves y enlaces verificables:
   - Trading Bot, BinanceBot y TokenTrader enlazan a sus estudios públicos del portafolio.
   - Covenant enlaza su repositorio público.
   - YATCK K CLUB enlaza el repositorio de interfaz web, distinguiendo ese código de la arquitectura adicional descrita en el sitio.
   - Metanoia enlaza el sitio público.
5. Una lista compacta de tecnologías observadas, aclarando que no todas aplican a cada proyecto.
6. Contacto profesional al final.

No se añadieron estadísticas de contribuciones, imágenes dinámicas, resultados comerciales, experiencia no comprobada ni afirmaciones de rendimiento. Las descripciones de trading reiteran que los casos de estudio no constituyen resultados financieros verificados y que TokenTrader es de observación, no de ejecución.

## Validación y publicación

- El endpoint público de GitHub confirmó el repositorio del perfil como público y su rama predeterminada `main`.
- El sitio personal respondió `200` tras una redirección y Metanoia respondió `200` en peticiones GET de solo lectura.
- Los cambios se prepararon localmente; no se publicaron ni desplegaron durante la auditoría.
- No se modificaron configuraciones de GitHub, Vercel o Railway ni otros repositorios.
- El README local se valida con `git diff --check`; el código del sitio y el dashboard no se modificaron para esta auditoría.

## Pendientes que requieren decisión del propietario

1. Revisar de forma privada la ruta `.env` visible en el árbol público de `habit-api`; no se consultó su contenido. Si contiene o contuvo credenciales, revocarlas/rotarlas y revisar también el historial según el proveedor.
2. Decidir si el README genérico de Covenant y la falta de README en YATCK deben completarse en sus repositorios individuales. No se realizaron esos cambios.
3. Confirmar si VisorApp y ReparaTech deben figurar en el perfil con una fuente pública actualizada; se omitieron para evitar presentar afirmaciones que no se corroboraron en las superficies revisadas.
