import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Database, ArrowRight, BarChart3, Shield, Upload, FileSpreadsheet } from "lucide-react"

export default async function HomePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    redirect("/dashboard")
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary text-primary-foreground">
              <Database className="h-5 w-5" />
            </div>
            <span className="font-bold text-xl">DeepMap Census</span>
          </div>
          <div className="flex items-center gap-4">
            <Button asChild variant="ghost">
              <Link href="/auth/login">Iniciar sesión</Link>
            </Button>
            <Button asChild>
              <Link href="/auth/sign-up">Crear cuenta</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="container mx-auto px-4 py-20 text-center">
        <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight mb-6 text-balance">
          Sistema de Gestión Censal
          <span className="block text-primary">Completo y Flexible</span>
        </h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8 text-pretty">
          Crea censos con campos dinámicos, importa datos desde Excel, 
          valida la calidad de tu información y genera reportes profesionales.
        </p>
        <div className="flex items-center justify-center gap-4">
          <Button asChild size="lg">
            <Link href="/auth/sign-up">
              Comenzar gratis
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href="/auth/login">Ver demo</Link>
          </Button>
        </div>
      </section>

      {/* Features */}
      <section className="container mx-auto px-4 py-20">
        <h2 className="text-3xl font-bold text-center mb-12">
          Todo lo que necesitas para gestionar tus censos
        </h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="p-6 rounded-lg border bg-card"
            >
              <div className={`w-12 h-12 rounded-lg ${feature.bgColor} flex items-center justify-center mb-4`}>
                <feature.icon className={`h-6 w-6 ${feature.color}`} />
              </div>
              <h3 className="font-semibold mb-2">{feature.title}</h3>
              <p className="text-sm text-muted-foreground">{feature.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t">
        <div className="container mx-auto px-4 py-8 text-center text-sm text-muted-foreground">
          <p>DeepMap Census - Sistema de Gestión Censal</p>
        </div>
      </footer>
    </div>
  )
}

const features = [
  {
    title: "Campos dinámicos",
    description: "Crea censos con cualquier tipo de campo: texto, números, fechas, selecciones múltiples y más.",
    icon: FileSpreadsheet,
    color: "text-blue-500",
    bgColor: "bg-blue-500/10",
  },
  {
    title: "Importación de datos",
    description: "Importa datos desde Excel, CSV o XML con mapeo automático de columnas.",
    icon: Upload,
    color: "text-emerald-500",
    bgColor: "bg-emerald-500/10",
  },
  {
    title: "Calidad de datos",
    description: "Detecta duplicados, campos vacíos y errores de validación automáticamente.",
    icon: Shield,
    color: "text-amber-500",
    bgColor: "bg-amber-500/10",
  },
  {
    title: "Reportes y análisis",
    description: "Genera reportes visuales y exporta a Excel, CSV o PDF con un clic.",
    icon: BarChart3,
    color: "text-purple-500",
    bgColor: "bg-purple-500/10",
  },
]
