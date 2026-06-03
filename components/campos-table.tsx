"use client"

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { MoreHorizontal, Edit, Trash2, GripVertical, Type, Hash, Calendar, ToggleLeft, List, Mail, Phone, MapPin, AlignLeft } from "lucide-react"
import type { CampoCenso, FieldType } from "@/lib/types"

const fieldTypeIcons: Record<FieldType, typeof Type> = {
  texto: Type,
  numero: Hash,
  decimal: Hash,
  fecha: Calendar,
  booleano: ToggleLeft,
  seleccion_unica: List,
  seleccion_multiple: List,
  email: Mail,
  telefono: Phone,
  direccion: MapPin,
  textarea: AlignLeft,
}

const fieldTypeLabels: Record<FieldType, string> = {
  texto: "Texto",
  numero: "Número entero",
  decimal: "Número decimal",
  fecha: "Fecha",
  booleano: "Sí/No",
  seleccion_unica: "Selección única",
  seleccion_multiple: "Selección múltiple",
  email: "Correo electrónico",
  telefono: "Teléfono",
  direccion: "Dirección",
  textarea: "Texto largo",
}

interface CamposTableProps {
  campos: CampoCenso[]
  censoId: string
}

export function CamposTable({ campos, censoId }: CamposTableProps) {
  if (campos.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">No hay campos configurados</p>
        <p className="text-sm text-muted-foreground">
          Agrega campos para definir la estructura de tu censo
        </p>
      </div>
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-[50px]"></TableHead>
          <TableHead>Etiqueta</TableHead>
          <TableHead>Nombre interno</TableHead>
          <TableHead>Tipo</TableHead>
          <TableHead>Requerido</TableHead>
          <TableHead className="w-[50px]"></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {campos.map((campo) => {
          const Icon = fieldTypeIcons[campo.field_type] || Type
          return (
            <TableRow key={campo.id}>
              <TableCell>
                <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
              </TableCell>
              <TableCell className="font-medium">{campo.label}</TableCell>
              <TableCell className="text-muted-foreground font-mono text-sm">
                {campo.name}
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  <span>{fieldTypeLabels[campo.field_type]}</span>
                </div>
              </TableCell>
              <TableCell>
                {campo.required ? (
                  <Badge variant="default">Sí</Badge>
                ) : (
                  <Badge variant="secondary">No</Badge>
                )}
              </TableCell>
              <TableCell>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon">
                      <MoreHorizontal className="h-4 w-4" />
                      <span className="sr-only">Acciones</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem>
                      <Edit className="mr-2 h-4 w-4" />
                      Editar
                    </DropdownMenuItem>
                    <DropdownMenuItem className="text-destructive">
                      <Trash2 className="mr-2 h-4 w-4" />
                      Eliminar
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}
