// Database types for the census system

export type UserRole = 'administrador' | 'capturista' | 'analista' | 'consulta'
export type CensoStatus = 'activo' | 'pausado' | 'finalizado'
export type RegistroStatus = 'completo' | 'incompleto' | 'error'
export type FieldType = 
  | 'texto' 
  | 'numero' 
  | 'decimal' 
  | 'fecha' 
  | 'booleano'
  | 'seleccion_unica' 
  | 'seleccion_multiple' 
  | 'email'
  | 'telefono' 
  | 'direccion' 
  | 'textarea'

export interface Organization {
  id: string
  name: string
  description: string | null
  created_at: string
  updated_at: string
}

export interface Profile {
  id: string
  organization_id: string | null
  first_name: string | null
  last_name: string | null
  role: UserRole
  avatar_url: string | null
  created_at: string
  updated_at: string
}

export interface Censo {
  id: string
  organization_id: string | null
  name: string
  description: string | null
  category: string | null
  status: CensoStatus
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface CampoCenso {
  id: string
  censo_id: string
  name: string
  label: string
  field_type: FieldType
  required: boolean
  default_value: string | null
  options: Record<string, unknown> | null
  validations: Record<string, unknown> | null
  order_index: number
  created_at: string
}

export interface Registro {
  id: string
  censo_id: string
  status: RegistroStatus
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface ValorRegistro {
  id: string
  registro_id: string
  campo_id: string
  value: string | null
  created_at: string
}

export interface Dashboard {
  id: string
  organization_id: string | null
  name: string
  config: Record<string, unknown>
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface Auditoria {
  id: string
  organization_id: string | null
  user_id: string | null
  action: string
  table_name: string | null
  record_id: string | null
  old_data: Record<string, unknown> | null
  new_data: Record<string, unknown> | null
  ip_address: string | null
  created_at: string
}

export interface PlantillaCenso {
  id: string
  organization_id: string | null
  name: string
  description: string | null
  campos: CampoCenso[]
  is_public: boolean
  created_by: string | null
  created_at: string
}

// Extended types with relations
export interface CensoWithCampos extends Censo {
  campos_censo: CampoCenso[]
}

export interface RegistroWithValores extends Registro {
  valores_registro: ValorRegistro[]
}

export interface ProfileWithOrganization extends Profile {
  organizations: Organization | null
}
