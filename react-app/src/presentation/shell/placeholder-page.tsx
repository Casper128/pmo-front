import { Link } from 'react-router';
import { Construction } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { Card, CardDescription, CardHeader, CardTitle } from '@/shared/ui/card';
import { PageHeader } from '@presentation/shared/components/page-header';
import { DASHBOARD_PATH } from './nav-items';

const pageClassName = 'mx-auto flex w-full max-w-6xl flex-col gap-6 p-4 sm:p-6';

export interface PlaceholderPageProps {
  readonly title: string;
  readonly description: string;
}

/** Ruta cuya página aún no se ha migrado (plan §3.4): mantiene la navegación operativa. */
export function PlaceholderPage({ title, description }: PlaceholderPageProps) {
  return (
    <div className={pageClassName}>
      <PageHeader title={title} description={description} />
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Construction aria-hidden="true" className="size-4 text-muted-foreground" />
            En migración
          </CardTitle>
          <CardDescription>Esta pantalla todavía no está disponible en la versión React.</CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}

export function NotFoundPage() {
  return (
    <div className={pageClassName}>
      <PageHeader title="Página no encontrada" description="La dirección no corresponde a ninguna sección." />
      <div>
        <Button asChild>
          <Link to={DASHBOARD_PATH}>Ir al dashboard</Link>
        </Button>
      </div>
    </div>
  );
}
