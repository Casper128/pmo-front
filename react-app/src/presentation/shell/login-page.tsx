import { zodResolver } from '@hookform/resolvers/zod';
import { LoaderCircle } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Alert, AlertDescription } from '@/shared/ui/alert';
import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/card';
import { Field, FieldGroup, FieldLabel } from '@/shared/ui/field';
import { Input } from '@/shared/ui/input';

/** Mismo mensaje que Angular cuando falta email o contraseña. */
export const MISSING_CREDENTIALS_MESSAGE = 'Ingresa email y contraseña';

const loginSchema = z.object({
  email: z.string().trim().min(1, MISSING_CREDENTIALS_MESSAGE),
  password: z.string().min(1, MISSING_CREDENTIALS_MESSAGE),
});

export type LoginValues = z.infer<typeof loginSchema>;

export interface LoginPageProps {
  readonly submitting: boolean;
  /** Error del último intento (respuesta del servidor). */
  readonly error: string;
  readonly onSubmit: (values: LoginValues) => void;
}

export function LoginPage({ submitting, error, onSubmit }: LoginPageProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });
  const message = errors.email?.message ?? errors.password?.message ?? error;

  return (
    <main className="grid min-h-svh place-items-center bg-muted/40 px-4 py-8">
      <Card className="w-full max-w-md">
        <CardHeader className="gap-4">
          <div className="flex items-center gap-3">
            <span
              aria-hidden="true"
              className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary text-sm font-bold text-primary-foreground"
            >
              PM
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold">PMO</p>
              <CardTitle>
                <h1 className="text-2xl font-semibold tracking-tight">Registro de tiempos</h1>
              </CardTitle>
            </div>
          </div>
          <CardDescription>Reporta tiempos, revisa avances y administra la operación.</CardDescription>
        </CardHeader>
        <CardContent>
          <form noValidate onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6">
            {message ? (
              <Alert variant="destructive">
                <AlertDescription>{message}</AlertDescription>
              </Alert>
            ) : null}
            <FieldGroup>
              <Field data-invalid={!!errors.email}>
                <FieldLabel htmlFor="login-email">Email</FieldLabel>
                <Input
                  id="login-email"
                  type="email"
                  autoComplete="username"
                  required
                  aria-invalid={!!errors.email}
                  {...register('email')}
                />
              </Field>
              <Field data-invalid={!!errors.password}>
                <FieldLabel htmlFor="login-password">Contraseña</FieldLabel>
                <Input
                  id="login-password"
                  type="password"
                  autoComplete="current-password"
                  required
                  aria-invalid={!!errors.password}
                  {...register('password')}
                />
              </Field>
            </FieldGroup>
            <Button type="submit" size="lg" className="w-full" disabled={submitting}>
              {submitting ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : null}
              Ingresar
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
