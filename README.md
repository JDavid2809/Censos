# Sistema Censo

Este es un proyecto desarrollado con [Next.js](https://nextjs.org/), inicializado para gestionar censos y registros, usando [Supabase](https://supabase.com/) como backend (Base de Datos y Autenticación). Utiliza componentes de [shadcn/ui](https://ui.shadcn.com/) y [Tailwind CSS](https://tailwindcss.com/) para los estilos.

## Estructura del proyecto

- `app/`: Contiene la estructura de rutas mediante App Router de Next.js. Incluye vistas como `dashboard`, `auth` (login/registro), y rutas de las APIs.
- `components/`: Contiene los componentes reutilizables de UI (en su mayoría de shadcn/ui en `components/ui`), además de componentes propios de cliente y vistas modulares.
- `lib/`: Contiene las utilidades generales del cliente de Supabase y funciones de ayuda (`utils.ts`).
- `hooks/`: Contiene Custom Hooks usados en el proyecto, tales como `use-mobile.ts` y `use-toast.ts`.

## Prerequisitos

- [Node.js](https://nodejs.org/en/) (versión recomendada LTS)
- Un gestor de paquetes como `pnpm` (que es el usado en el proyecto, visto por `pnpm-lock.yaml`), `npm` o `yarn`.
- Un proyecto en [Supabase](https://supabase.com/) configurado.

## Instalación y Configuración

1. **Instalar dependencias:**

   Con pnpm:
   ```bash
   pnpm install
   ```
   (O usa `npm install` o `yarn install`)

2. **Configuración de variables de entorno:**

   Crea un archivo `.env.local` en la raíz del proyecto (basado en `.env` si existe) y provee las credenciales necesarias de tu instancia de Supabase:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=tu_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_supabase_anon_key
   ```

## Script Disponibles

En el archivo `package.json` encontrarás los siguientes scripts:

- `pnpm dev`: Inicia el servidor de desarrollo local de Next.js.
- `pnpm build`: Crea la versión optimizada de producción de la aplicación.
- `pnpm start`: Inicia el servidor de producción luego de haber hecho el build.
- `pnpm lint`: Corre la herramienta ESLint para asegurar calidad de código en el proyecto.

## Uso

1. Ejecuta el entorno de desarrollo:
   ```bash
   pnpm dev
   ```
2. Abre tu navegador en [http://localhost:3000](http://localhost:3000).
3. Usa la ruta `/auth/login` o `/auth/sign-up` para autenticarte, y `/dashboard` para usar el sistema de administración de censos.

## Stack Tecnológico

- **Framework:** Next.js (App Router)
- **Base de Datos / Backend:** Supabase
- **Estilos:** Tailwind CSS
- **Componentes:** shadcn/ui, Radix UI
- **Funcionalidades extra:** @dnd-kit (drag & drop), react-hook-form (formularios).
