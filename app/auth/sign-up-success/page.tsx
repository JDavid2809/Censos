import Link from "next/link"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Mail, Database } from "lucide-react"

export default function SignUpSuccessPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md text-center">
        <CardHeader className="space-y-1">
          <div className="flex justify-center mb-4">
            <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-primary text-primary-foreground">
              <Database className="h-6 w-6" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold">¡Registro exitoso!</CardTitle>
          <CardDescription>
            Tu cuenta ha sido creada correctamente
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex justify-center">
            <div className="flex items-center justify-center w-16 h-16 rounded-full bg-muted">
              <Mail className="h-8 w-8 text-muted-foreground" />
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            Hemos enviado un correo de confirmación a tu dirección de email. 
            Por favor, revisa tu bandeja de entrada y haz clic en el enlace 
            para activar tu cuenta.
          </p>
        </CardContent>
        <CardFooter>
          <Button asChild className="w-full">
            <Link href="/auth/login">Ir a iniciar sesión</Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
