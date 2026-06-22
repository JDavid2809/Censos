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
import { Switch } from "@/components/ui/switch"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

import { ArrowLeft, Loader2, Save } from "lucide-react"
import type { CampoCenso, FieldType } from "@/lib/types"

interface CapturarRegistroClientProps {
  censoId: string
  censoName: string
  campos: CampoCenso[]
}

export function CapturarRegistroClient({ censoId, censoName, campos }: CapturarRegistroClientProps) {
  const [values, setValues] = useState<Record<string, string | string[]>>({})
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  function handleChange(campoId: string, value: string | string[]) {
    setValues({ ...values, [campoId]: value })
  }

  function handleMultiSelectChange(campoId: string, option: string, checked: boolean) {
    const current = (values[campoId] as string[]) || []
    if (checked) {
      handleChange(campoId, [...current, option])
    } else {
      handleChange(campoId, current.filter(v => v !== option))
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    // Validate required fields
    const missingRequired = campos
      .filter(c => c.required)
      .filter(c => {
        const val = values[c.id]
        if (Array.isArray(val)) return val.length === 0
        return !val || val.trim() === ""
      })

    if (missingRequired.length > 0) {
      sileo.error({ title: "Campos requeridos", description: `Faltan campos por llenar: ${missingRequired.map(c => c.label).join(", ")}` })
      setLoading(false)
      return
    }

    let userId = null
    try {
      const { data: { user } } = await supabase.auth.getUser()
      userId = user?.id
    } catch (e) {
      console.warn("Error getting user with getUser:", e)
      try {
        const { data: { session } } = await supabase.auth.getSession()
        userId = session?.user?.id
      } catch (sessionErr) {
        console.error("Failed to get session fallback:", sessionErr)
      }
    }

    // Create registro
    const { data: registro, error: registroError } = await supabase
      .from("registros")
      .insert({
        censo_id: censoId,
        status: "completo",
        created_by: userId,
      })
      .select()
      .single()

    if (registroError) {
      sileo.error({ title: "Error al crear", description: registroError.message })
      setLoading(false)
      return
    }

    // Insert valores
    const valoresData = campos
      .filter(c => values[c.id])
      .map(c => ({
        registro_id: registro.id,
        campo_id: c.id,
        value: Array.isArray(values[c.id]) ? (values[c.id] as string[]).join(", ") : (values[c.id] as string),
      }))

    if (valoresData.length > 0) {
      const { error: valoresError } = await supabase
        .from("valores_registro")
        .insert(valoresData)

      if (valoresError) {
        sileo.error({ title: "Error al guardar valores", description: valoresError.message })
        setLoading(false)
        return
      }
    }

    setLoading(false)
    sileo.success({ title: "Éxito", description: "Registro guardado exitosamente." })
    setValues({})
    // Scroll to top to show success message
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button asChild variant="ghost" size="icon">
          <Link href={`/dashboard/censos/${censoId}`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Nuevo registro</h1>
          <p className="text-muted-foreground">{censoName}</p>
        </div>
      </div>

      {campos.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground mb-4">
              Este censo no tiene campos configurados
            </p>
            <Button asChild>
              <Link href={`/dashboard/censos/${censoId}/configurar`}>
                Configurar campos
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
            <form onSubmit={handleSubmit}>
              <Card className="shadow-lg border-primary/10">
                <CardHeader className="bg-muted/30 border-b pb-6">
                  <CardTitle className="text-xl text-primary">Datos del registro</CardTitle>
                  <CardDescription>
                    Complete los campos del formulario. Los campos marcados con asterisco (*) son obligatorios.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-8 pt-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-8">
                    {campos.map((campo) => (
                      <DynamicField
                        key={campo.id}
                        campo={campo}
                        value={values[campo.id]}
                        onChange={(v) => handleChange(campo.id, v)}
                        onMultiChange={(o, c) => handleMultiSelectChange(campo.id, o, c)}
                        disabled={loading}
                      />
                    ))}
                  </div>

                  <div className="flex gap-4 pt-4 border-t mt-8">
                    <Button type="submit" disabled={loading} className="w-full sm:w-auto font-medium">
                      {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      <Save className="mr-2 h-4 w-4" />
                      Guardar registro
                    </Button>
                    <Button type="button" variant="outline" asChild className="w-full sm:w-auto">
                      <Link href={`/dashboard/censos/${censoId}`}>Cancelar</Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </form>
        </>
      )}
    </div>
  )
}

interface DynamicFieldProps {
  campo: CampoCenso
  value: string | string[] | undefined
  onChange: (value: string | string[]) => void
  onMultiChange: (option: string, checked: boolean) => void
  disabled: boolean
}

function DynamicField({ campo, value, onChange, onMultiChange, disabled }: DynamicFieldProps) {
  const options = (campo.options as { options?: string[] })?.options || []

  const renderField = () => {
    switch (campo.field_type as FieldType) {
      case "texto":
      case "email":
      case "telefono":
        return (
          <Input
            type={campo.field_type === "email" ? "email" : campo.field_type === "telefono" ? "tel" : "text"}
            value={(value as string) || ""}
            onChange={(e) => onChange(e.target.value)}
            placeholder={`Ingrese ${campo.label.toLowerCase()}`}
            disabled={disabled}
          />
        )

      case "numero":
        return (
          <Input
            type="number"
            value={(value as string) || ""}
            onChange={(e) => onChange(e.target.value)}
            placeholder="0"
            disabled={disabled}
          />
        )

      case "decimal":
        return (
          <Input
            type="number"
            step="0.01"
            value={(value as string) || ""}
            onChange={(e) => onChange(e.target.value)}
            placeholder="0.00"
            disabled={disabled}
          />
        )

      case "fecha":
        return (
          <Input
            type="date"
            value={(value as string) || ""}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
          />
        )

      case "booleano":
        return (
          <div className="flex items-center gap-2">
            <Switch
              checked={(value as string) === "true"}
              onCheckedChange={(checked) => onChange(checked ? "true" : "false")}
              disabled={disabled}
            />
            <span className="text-sm text-muted-foreground">
              {(value as string) === "true" ? "Sí" : "No"}
            </span>
          </div>
        )

      case "textarea":
      case "direccion":
        return (
          <Textarea
            value={(value as string) || ""}
            onChange={(e) => onChange(e.target.value)}
            placeholder={`Ingrese ${campo.label.toLowerCase()}`}
            disabled={disabled}
            rows={3}
          />
        )

      case "seleccion_unica":
        return (
          <Select
            value={(value as string) || ""}
            onValueChange={onChange}
            disabled={disabled}
          >
            <SelectTrigger>
              <SelectValue placeholder="Seleccione una opción" />
            </SelectTrigger>
            <SelectContent>
              {options.map((opt) => (
                <SelectItem key={opt} value={opt}>
                  {opt}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )

      case "seleccion_multiple":
        return (
          <div className="space-y-2">
            {options.map((opt) => (
              <div key={opt} className="flex items-center gap-2">
                <Checkbox
                  id={`${campo.id}-${opt}`}
                  checked={((value as string[]) || []).includes(opt)}
                  onCheckedChange={(checked) => onMultiChange(opt, !!checked)}
                  disabled={disabled}
                />
                <Label htmlFor={`${campo.id}-${opt}`} className="text-sm font-normal">
                  {opt}
                </Label>
              </div>
            ))}
          </div>
        )

      default:
        return (
          <Input
            value={(value as string) || ""}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
          />
        )
    }
  }

  const isWide = campo.field_type === "textarea" || campo.field_type === "direccion" || campo.field_type === "seleccion_multiple"

  return (
    <div className={`space-y-3 ${isWide ? "md:col-span-2 lg:col-span-3" : ""}`}>
      <Label htmlFor={campo.id} className="text-sm font-semibold text-foreground/90">
        {campo.label}
        {campo.required && <span className="text-destructive ml-1">*</span>}
      </Label>
      {renderField()}
      {campo.default_value && !value && (
        <p className="text-xs text-muted-foreground/80 font-medium">
          Valor por defecto: {campo.default_value}
        </p>
      )}
    </div>
  )
}
