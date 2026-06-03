"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Loader2,
  Database,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Copy,
  Check,
  RefreshCw,
  FolderSync,
  Play
} from "lucide-react"

interface TableStatus {
  name: string
  exists: boolean | null
  count: number | null
  errorMsg: string | null
}

export default function ConfiguracionPage() {
  const [checking, setChecking] = useState(false)
  const [copied, setCopied] = useState(false)
  const [copiedTrigger, setCopiedTrigger] = useState(false)
  const [seeding, setSeeding] = useState(false)
  const [seedResult, setSeedResult] = useState<string | null>(null)
  
  // Connection status
  const [connectionSuccess, setConnectionSuccess] = useState<boolean | null>(null)
  const [connectionError, setConnectionError] = useState<string | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  // Tables status
  const [tables, setTables] = useState<TableStatus[]>([
    { name: "organizations", exists: null, count: null, errorMsg: null },
    { name: "profiles", exists: null, count: null, errorMsg: null },
    { name: "censos", exists: null, count: null, errorMsg: null },
    { name: "campos_censo", exists: null, count: null, errorMsg: null },
    { name: "registros", exists: null, count: null, errorMsg: null },
    { name: "valores_registro", exists: null, count: null, errorMsg: null },
    { name: "auditoria", exists: null, count: null, errorMsg: null },
    { name: "plantillas_censo", exists: null, count: null, errorMsg: null },
  ])

  const supabase = createClient()

  async function checkDatabase() {
    setChecking(true)
    setConnectionError(null)
    setConnectionSuccess(null)
    setSeedResult(null)

    // Reset table status
    setTables(prev => prev.map(t => ({ ...t, exists: null, count: null, errorMsg: null })))

    try {
      // First, attempt a simple API call to check credentials
      // Let's test with a table query. If it's a credentials error, it will fail on all tables.
      let successfulConnection = false
      let credsError: string | null = null

      const updatedTables = await Promise.all(
        tables.map(async (table) => {
          try {
            const { count, error } = await supabase
              .from(table.name)
              .select("*", { count: "exact", head: true })

            if (error) {
              // 42P01 is PostgreSQL code for "relation does not exist" (table is missing)
              if (error.code === "42P01") {
                successfulConnection = true // The DB responded, meaning URL/Key is valid but schema is missing
                return { ...table, exists: false, count: null, errorMsg: "La tabla no existe en la base de datos." }
              } else {
                credsError = error.message
                return { ...table, exists: false, count: null, errorMsg: error.message }
              }
            } else {
              successfulConnection = true
              return { ...table, exists: true, count: count ?? 0, errorMsg: null }
            }
          } catch (err: any) {
            credsError = err?.message || "Error de red o conexión"
            return { ...table, exists: false, count: null, errorMsg: err?.message || "Excepción de conexión" }
          }
        })
      )

      setTables(updatedTables)

      if (successfulConnection) {
        setConnectionSuccess(true)
      } else {
        setConnectionSuccess(false)
        setConnectionError(credsError || "No se pudo establecer conexión con Supabase. Verifica tu URL y API Key.")
      }
    } catch (err: any) {
      setConnectionSuccess(false)
      setConnectionError(err?.message || "Error al conectar con Supabase.")
    } finally {
      setChecking(false)
    }
  }

  useEffect(() => {
    checkDatabase()
    async function getUserId() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) setCurrentUserId(user.id)
      } catch (e) {}
    }
    getUserId()
  }, [])

  function copyToClipboard(text: string, type: "sql" | "trigger") {
    navigator.clipboard.writeText(text)
    if (type === "sql") {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } else {
      setCopiedTrigger(true)
      setTimeout(() => setCopiedTrigger(false), 2000)
    }
  }

  async function handleSeedDemoData() {
    setSeeding(true)
    setSeedResult(null)

    try {
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        setSeedResult("❌ Debes haber iniciado sesión para insertar datos de prueba.")
        setSeeding(false)
        return
      }

      // Fetch user profile to get organization_id
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("organization_id")
        .eq("id", user.id)
        .single()

      if (profileError || !profile?.organization_id) {
        setSeedResult(`❌ No se pudo obtener la organización de tu perfil. Tu ID de usuario es: ${user.id}. Ejecuta el script de vinculación rápida en Supabase para solucionarlo.`)
        setSeeding(false)
        return
      }

      // 1. Insert Censo
      const { data: censo, error: censoError } = await supabase
        .from("censos")
        .insert({
          name: "Censo de Prueba - Ejemplo Población",
          description: "Censo autogenerado para verificar el correcto funcionamiento de la base de datos.",
          category: "Población",
          organization_id: profile.organization_id,
          created_by: user.id,
          status: "activo"
        })
        .select()
        .single()

      if (censoError || !censo) {
        throw new Error(`Error al crear el censo: ${censoError?.message}`)
      }

      // 2. Insert Campos
      const campos = [
        { censo_id: censo.id, name: "nombre", label: "Nombre Completo", field_type: "texto", required: true, order_index: 0 },
        { censo_id: censo.id, name: "edad", label: "Edad", field_type: "numero", required: true, order_index: 1 },
        { censo_id: censo.id, name: "correo", label: "Correo Electrónico", field_type: "email", required: true, order_index: 2 },
        { censo_id: censo.id, name: "activo", label: "¿Es residente permanente?", field_type: "booleano", required: false, default_value: "true", order_index: 3 }
      ]

      const { data: camposInsertados, error: camposError } = await supabase
        .from("campos_censo")
        .insert(campos)
        .select()

      if (camposError || !camposInsertados) {
        throw new Error(`Error al crear los campos: ${camposError?.message}`)
      }

      // 3. Insert Registros
      const registroData = {
        censo_id: censo.id,
        status: "completo",
        created_by: user.id
      }

      const { data: registro, error: registroError } = await supabase
        .from("registros")
        .insert(registroData)
        .select()
        .single()

      if (registroError || !registro) {
        throw new Error(`Error al crear el registro: ${registroError?.message}`)
      }

      // 4. Insert Valores del Registro
      const campoNombre = camposInsertados.find(c => c.name === "nombre")
      const campoEdad = camposInsertados.find(c => c.name === "edad")
      const campoCorreo = camposInsertados.find(c => c.name === "correo")
      const campoActivo = camposInsertados.find(c => c.name === "activo")

      const valores = [
        { registro_id: registro.id, campo_id: campoNombre.id, value: "Juan Pérez Pérez" },
        { registro_id: registro.id, campo_id: campoEdad.id, value: "35" },
        { registro_id: registro.id, campo_id: campoCorreo.id, value: "juan.perez@example.com" },
        { registro_id: registro.id, campo_id: campoActivo.id, value: "true" }
      ]

      const { error: valoresError } = await supabase
        .from("valores_registro")
        .insert(valores)

      if (valoresError) {
        throw new Error(`Error al insertar los valores: ${valoresError.message}`)
      }

      setSeedResult("✅ Datos de prueba insertados con éxito. Se creó el censo 'Censo de Prueba - Ejemplo Población' con 1 registro completo.")
      checkDatabase() // Refresh counts
    } catch (err: any) {
      setSeedResult(`❌ Falló la inserción: ${err.message}`)
    } finally {
      setSeeding(false)
    }
  }

  // Count existing tables
  const existingTablesCount = tables.filter(t => t.exists === true).length
  const missingTablesCount = tables.filter(t => t.exists === false).length
  const progressPercent = Math.round((existingTablesCount / tables.length) * 100)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Configuración del Sistema</h1>
        <p className="text-muted-foreground">
          Verifica el estado de conexión de tu base de datos y monta el esquema de Supabase.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Connection status card */}
        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle className="text-lg">Estado de Conexión</CardTitle>
            <CardDescription>Conectividad con la API de Supabase</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center p-6 text-center">
            {checking ? (
              <div className="space-y-2 py-4">
                <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto" />
                <p className="text-sm text-muted-foreground">Verificando conexión...</p>
              </div>
            ) : connectionSuccess ? (
              <div className="space-y-3">
                <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto" />
                <div>
                  <Badge variant="default" className="bg-green-600 hover:bg-green-600">CONECTADO</Badge>
                  <p className="text-xs text-muted-foreground mt-2 break-all max-w-[200px] mx-auto">
                    API lista para recibir datos
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <XCircle className="h-16 w-16 text-destructive mx-auto" />
                <div>
                  <Badge variant="destructive">DESCONECTADO</Badge>
                  <p className="text-xs text-destructive mt-2 max-w-[220px] mx-auto">
                    {connectionError || "Verifica tu archivo .env"}
                  </p>
                </div>
              </div>
            )}
          </CardContent>
          <CardFooter className="bg-muted/40 p-4 border-t rounded-b-lg">
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={checkDatabase}
              disabled={checking}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Recomprobar
            </Button>
          </CardFooter>
        </Card>

        {/* Database schema status card */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg">Tablas en Supabase</CardTitle>
            <CardDescription>
              Esquema de tablas requerido para el Sistema de Censos
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-semibold">
                <span>Tablas creadas ({existingTablesCount} de {tables.length})</span>
                <span>{progressPercent}%</span>
              </div>
              <Progress value={progressPercent} className="h-2" />
            </div>

            <div className="grid gap-2 grid-cols-2 md:grid-cols-3">
              {tables.map(table => (
                <div key={table.name} className="flex items-center gap-2 p-2 border rounded-lg bg-card text-xs">
                  {table.exists === null ? (
                    <Loader2 className="h-4.5 w-4.5 animate-spin text-muted-foreground" />
                  ) : table.exists ? (
                    <CheckCircle2 className="h-4.5 w-4.5 text-green-500 shrink-0" />
                  ) : (
                    <XCircle className="h-4.5 w-4.5 text-red-500 shrink-0" />
                  )}
                  <div className="min-w-0">
                    <p className="font-semibold truncate">{table.name}</p>
                    {table.exists && <p className="text-[10px] text-muted-foreground">{table.count} registros</p>}
                    {!table.exists && <p className="text-[10px] text-red-500 font-medium">No creada</p>}
                  </div>
                </div>
              ))}
            </div>

            {missingTablesCount > 0 && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Tablas Faltantes</AlertTitle>
                <AlertDescription>
                  Faltan {missingTablesCount} tablas por crear en Supabase. Dirígete a la pestaña <strong>Esquema SQL</strong>, copia el código e inicialízalas en tu consola de Supabase.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tabs for SQL editor and seeding */}
      <Tabs defaultValue="db-status">
        <TabsList className="grid w-full grid-cols-3 max-w-md">
          <TabsTrigger value="db-status">Instrucciones</TabsTrigger>
          <TabsTrigger value="sql-editor">Esquema SQL</TabsTrigger>
          <TabsTrigger value="demo-data">Datos de Prueba</TabsTrigger>
        </TabsList>

        {/* Tab: Instructions */}
        <TabsContent value="db-status" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>¿Cómo inicializar tu base de datos?</CardTitle>
              <CardDescription>Guía paso a paso para configurar Supabase</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm leading-relaxed">
              <ol className="list-decimal list-inside space-y-3">
                <li>
                  Inicia sesión en tu consola de <a href="https://supabase.com" target="_blank" rel="noreferrer" className="text-primary underline">Supabase</a>.
                </li>
                <li>
                  Selecciona tu proyecto <strong>ifhxfmyqrewlgbnlhhzq</strong>.
                </li>
                <li>
                  En el menú de la izquierda, haz clic en el icono de <strong>SQL Editor</strong> (Editor SQL).
                </li>
                <li>
                  Haz clic en <strong>New Query</strong> (Nueva consulta).
                </li>
                <li>
                  Ve a la pestaña <strong>Esquema SQL</strong> de esta página, copia todo el código y pégalo en el editor de Supabase.
                </li>
                <li>
                  Haz clic en el botón <strong>Run</strong> (Ejecutar) en Supabase.
                </li>
                <li>
                  Regresa aquí y haz clic en <strong>Recomprobar</strong> para verificar que todas las tablas salgan en verde.
                </li>
              </ol>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: SQL Script */}
        <TabsContent value="sql-editor" className="mt-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Tablas y relaciones</CardTitle>
                  <CardDescription>Copia y ejecuta este script en Supabase</CardDescription>
                </div>
                <Button size="sm" onClick={() => copyToClipboard(SQL_SCHEMA, "sql")}>
                  {copied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
                  {copied ? "Copiado" : "Copiar SQL"}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <pre className="p-4 bg-muted rounded-lg text-xs overflow-x-auto max-h-[350px] font-mono leading-relaxed text-muted-foreground select-all">
                {SQL_SCHEMA}
              </pre>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Demo Data */}
        <TabsContent value="demo-data" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Insertar datos de demostración</CardTitle>
              <CardDescription>
                Genera datos ficticios para comprobar el funcionamiento completo de gráficos y tablas al instante.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {seedResult && (
                <Alert className={seedResult.includes("❌") ? "bg-red-500/10 text-red-500 border-red-500/30" : "bg-green-500/10 text-green-700 border-green-500/30"}>
                  <AlertDescription>{seedResult}</AlertDescription>
                </Alert>
              )}
              <div className="text-sm space-y-4">
                <p>
                  Esta acción creará un censo llamado <strong>Censo de Prueba - Ejemplo Población</strong> con cuatro campos dinámicos (Nombre, Edad, Correo y Residencia) e insertará un registro completado.
                </p>

                {seedResult && seedResult.includes("❌") && currentUserId && (
                  <div className="p-4 bg-muted border rounded-lg space-y-3">
                    <p className="text-xs font-semibold text-foreground">
                      🔧 Reparación Rápida para tu Usuario Existente:
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Dado que creaste tu usuario antes de instalar el trigger, no tienes perfil. Copia este SQL y ejecútalo en el SQL Editor de Supabase para vincular tu cuenta actual:
                    </p>
                    <pre className="p-2.5 bg-background rounded border text-[11px] font-mono overflow-x-auto leading-relaxed select-all">
{`DO $$
DECLARE
    new_org_id UUID;
    v_user_id UUID := '${currentUserId}'::uuid;
BEGIN
    -- 1. Crear organización por defecto si no existe
    INSERT INTO public.organizations (name)
    VALUES ('Mi Organización')
    RETURNING id INTO new_org_id;

    -- 2. Crear o actualizar perfil como administrador
    INSERT INTO public.profiles (id, organization_id, first_name, last_name, role)
    VALUES (v_user_id, new_org_id, 'Admin', 'Usuario', 'administrador'::user_role)
    ON CONFLICT (id) DO UPDATE 
    SET organization_id = new_org_id, role = 'administrador'::user_role;
END$$;`}
                    </pre>
                  </div>
                )}

                <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5 shrink-0" />
                  <p className="text-xs text-yellow-800">
                    <strong>Aviso importante:</strong> Para ejecutar esta acción, primero debes haber creado las tablas e iniciado sesión en el sistema desde el Login con un usuario registrado para obtener el ID de tu organización.
                  </p>
                </div>
              </div>
            </CardContent>
            <CardFooter className="bg-muted/40 p-4 border-t rounded-b-lg">
              <Button
                onClick={handleSeedDemoData}
                disabled={seeding || missingTablesCount > 0}
                className="w-full md:w-auto"
              >
                {seeding ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Play className="mr-2 h-4 w-4" />
                )}
                Insertar datos de prueba
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

const SQL_SCHEMA = `-- 1. Habilitar la extensión uuid-ossp
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Crear Tabla de Organizaciones
CREATE TABLE IF NOT EXISTS public.organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Habilitar el tipo enum para roles de usuario
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
        CREATE TYPE user_role AS ENUM ('administrador', 'capturista', 'analista', 'consulta');
    END IF;
END$$;

-- 4. Crear Tabla de Perfiles (Usuarios vinculados a auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
    first_name TEXT,
    last_name TEXT,
    role user_role DEFAULT 'capturista'::user_role NOT NULL,
    avatar_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. Habilitar el tipo enum para estado del censo
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'censo_status') THEN
        CREATE TYPE censo_status AS ENUM ('activo', 'pausado', 'finalizado');
    END IF;
END$$;

-- 6. Crear Tabla de Censos
CREATE TABLE IF NOT EXISTS public.censos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    category TEXT,
    status censo_status DEFAULT 'activo'::censo_status NOT NULL,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 7. Habilitar el tipo de campo del censo
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'field_type') THEN
        CREATE TYPE field_type AS ENUM (
            'texto', 'numero', 'decimal', 'fecha', 'booleano', 
            'seleccion_unica', 'seleccion_multiple', 'email', 
            'telefono', 'direccion', 'textarea'
        );
    END IF;
END$$;

-- 8. Crear Tabla de Campos de Censo
CREATE TABLE IF NOT EXISTS public.campos_censo (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    censo_id UUID REFERENCES public.censos(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    label TEXT NOT NULL,
    field_type field_type NOT NULL,
    required BOOLEAN DEFAULT false NOT NULL,
    default_value TEXT,
    options JSONB,
    validations JSONB,
    order_index INTEGER DEFAULT 0 NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 9. Habilitar el tipo de estado del registro
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'registro_status') THEN
        CREATE TYPE registro_status AS ENUM ('completo', 'incompleto', 'error');
    END IF;
END$$;

-- 10. Crear Tabla de Registros
CREATE TABLE IF NOT EXISTS public.registros (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    censo_id UUID REFERENCES public.censos(id) ON DELETE CASCADE NOT NULL,
    status registro_status DEFAULT 'completo'::registro_status NOT NULL,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 11. Crear Tabla de Valores de Registro
CREATE TABLE IF NOT EXISTS public.valores_registro (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    registro_id UUID REFERENCES public.registros(id) ON DELETE CASCADE NOT NULL,
    campo_id UUID REFERENCES public.campos_censo(id) ON DELETE CASCADE NOT NULL,
    value TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE (registro_id, campo_id)
);

-- 12. Crear Tabla de Auditoría
CREATE TABLE IF NOT EXISTS public.auditoria (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    table_name TEXT,
    record_id TEXT,
    old_data JSONB,
    new_data JSONB,
    ip_address TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 13. Trigger automático en Postgres para la creación de perfiles y organizaciones al registrarse
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    new_org_id UUID;
    org_name TEXT;
BEGIN
    -- Obtener el nombre de la organización
    org_name := COALESCE(new.raw_user_meta_data->>'organization_name', 'Mi Organización');
    
    -- Insertar organización
    INSERT INTO public.organizations (name)
    VALUES (org_name)
    RETURNING id INTO new_org_id;

    -- Insertar perfil
    INSERT INTO public.profiles (id, organization_id, first_name, last_name, role)
    VALUES (
        new.id,
        new_org_id,
        new.raw_user_meta_data->>'first_name',
        new.raw_user_meta_data->>'last_name',
        'administrador'::user_role
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Eliminar trigger si existe antes de crearlo
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
`
