"use client"

import { useState } from "react"
import { sileo } from "sileo"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, ArrowLeft, Save } from "lucide-react"
import type { Censo, CensoStatus } from "@/lib/types"

const categories = [
  "Población",
  "Economía",
  "Salud",
  "Educación",
  "Vivienda",
  "Agricultura",
  "Medio ambiente",
  "Otro",
]

interface EditarCensoClientProps {
  censo: Censo
}

export function EditarCensoClient({ censo }: EditarCensoClientProps) {
  const [name, setName] = useState(censo.name)
  const [description, setDescription] = useState(censo.description || "")
  const [category, setCategory] = useState(censo.category || "")
  const [status, setStatus] = useState<CensoStatus>(censo.status)
  const [error, setErrorState] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  function setError(msg: string | null) {
    setErrorState(msg)
    if (msg) sileo.error({ title: "Error", description: msg })
  }
  const router = useRouter()
  const supabase = createClient()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    if (!name.trim()) {
      setError("El nombre del censo es requerido")
      setLoading(false)
      return
    }

    const { error: updateError } = await supabase
      .from("censos")
      .update({
        name: name.trim(),
        description: description.trim() || null,
        category: category || null,
        status,
      })
      .eq("id", censo.id)

    if (updateError) {
      setError(updateError.message)
      setLoading(false)
      return
    }

    router.push(`/dashboard/censos/${censo.id}`)
    router.refresh()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button asChild variant="ghost" size="icon">
          <Link href={`/dashboard/censos/${censo.id}`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Editar censo</h1>
          <p className="text-muted-foreground">
            Modifica la información del censo
          </p>
        </div>
      </div>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Información del censo</CardTitle>
          <CardDescription>
            Actualiza los datos del censo. Los cambios se aplican inmediatamente.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="name">Nombre del censo *</Label>
              <Input
                id="name"
                placeholder="Ej: Censo de población 2024"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Descripción</Label>
              <Textarea
                id="description"
                placeholder="Describe el propósito del censo..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={loading}
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="category">Categoría</Label>
                <Select value={category} onValueChange={setCategory} disabled={loading}>
                  <SelectTrigger id="category">
                    <SelectValue placeholder="Selecciona una categoría" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="status">Estado</Label>
                <Select value={status} onValueChange={(v) => setStatus(v as CensoStatus)} disabled={loading}>
                  <SelectTrigger id="status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="activo">Activo</SelectItem>
                    <SelectItem value="pausado">Pausado</SelectItem>
                    <SelectItem value="finalizado">Finalizado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex gap-4">
              <Button type="submit" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <Save className="mr-2 h-4 w-4" />
                Guardar cambios
              </Button>
              <Button type="button" variant="outline" asChild>
                <Link href={`/dashboard/censos/${censo.id}`}>Cancelar</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
