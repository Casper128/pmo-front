import { CircleAlert, CircleCheck, CircleX, Loader2 } from 'lucide-react';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/dialog';
import { Progress } from '@/shared/ui/progress';
import { useDrafts } from '../drafts/drafts-context';
import { isSendActive, type SendPhase } from '../drafts/send-phase';

const TITLES: Record<Exclude<SendPhase, 'idle'>, string> = {
  sending: 'Registrando reportes',
  'saving-logs': 'Confirmando envío',
  completed: 'Envío finalizado',
  'log-error': 'El proceso necesita atención',
  failed: 'El proceso necesita atención',
};

/**
 * Diálogo de progreso y resultados del envío (modal de `sendPhase` de Angular). No se cierra mientras se
 * envía o se confirma el historial, ni con Esc en `log-error` (el historial pendiente no se descarta: solo
 * reintentar); en el resto de fases cerrarlo equivale a `continueAfterSend`.
 */
export function SendProgressDialog() {
  const { sendPhase: phase, sendProgress: progress, retrySendLogs, continueAfterSend } = useDrafts();
  if (phase === 'idle') return null;
  const active = isSendActive(phase);

  return (
    <Dialog open onOpenChange={(open) => !open && !active && phase !== 'log-error' && continueAfterSend()}>
      <DialogContent
        showCloseButton={false}
        className="sm:max-w-md"
        onEscapeKeyDown={(event) => (active || phase === 'log-error') && event.preventDefault()}
        onInteractOutside={(event) => event.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>{TITLES[phase]}</DialogTitle>
          <DialogDescription className="sr-only">Estado del envío de los registros.</DialogDescription>
        </DialogHeader>

        {active ? (
          <div className="flex flex-col gap-4" aria-live="polite">
            <div className="flex items-start gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground">
                <Loader2 aria-hidden="true" className="size-5 animate-spin" />
              </span>
              <div className="min-w-0">
                <p className="font-semibold">
                  {phase === 'sending' ? 'Espera mientras enviamos los registros.' : 'Estamos confirmando el resultado.'}
                </p>
                <p className="text-muted-foreground">Mantén esta ventana abierta hasta finalizar.</p>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2 text-xs font-semibold text-muted-foreground">
                <span>
                  {progress.processed} de {progress.total} registros procesados
                </span>
                <span>{progress.percent}%</span>
              </div>
              <Progress value={progress.percent} aria-label="Progreso del envío" className="h-2.5" />
            </div>
          </div>
        ) : null}

        {phase === 'completed' ? (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col items-center gap-2 text-center">
              <span className="grid size-12 place-items-center rounded-full bg-success/15 text-success">
                <CircleCheck aria-hidden="true" className="size-6" />
              </span>
              <p className="text-base font-semibold">Los registros quedaron enviados.</p>
              <p className="text-muted-foreground">
                {progress.successCount} correctos · {progress.errorCount} con error
              </p>
            </div>
            <ul aria-label="Resultado por registro" className="flex max-h-52 flex-col gap-1.5 overflow-y-auto">
              {progress.results.map((log) => (
                <li key={log.index} className="flex flex-col gap-1 rounded-lg border px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="min-w-0 truncate font-medium">
                      #{log.index + 1} {log.identificador}
                    </span>
                    {log.ok ? (
                      <Badge variant="outline" className="border-success/40 text-success">
                        <CircleCheck aria-hidden="true" />
                        Enviado
                      </Badge>
                    ) : (
                      <Badge variant="destructive">
                        <CircleX aria-hidden="true" />
                        Con error
                      </Badge>
                    )}
                  </div>
                  {!log.ok && log.errorMessage ? (
                    <p className="text-xs break-words text-destructive">{log.errorMessage}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {phase === 'log-error' ? (
          <div className="flex flex-col gap-3">
            <div className="rounded-lg border border-warning/40 bg-warning/10 p-3">
              <p className="flex items-center gap-2 font-semibold">
                <CircleAlert aria-hidden="true" className="size-4 shrink-0" />
                No se pudo confirmar el historial.
              </p>
              <p className="mt-1 text-sm break-words text-muted-foreground">{progress.failureMessage}</p>
            </div>
            <p className="text-muted-foreground">
              Los registros enviados ya se retiraron de borradores; reintenta la confirmación del historial.
            </p>
          </div>
        ) : null}

        {phase === 'failed' ? (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3">
            <p className="flex items-center gap-2 font-semibold">
              <CircleX aria-hidden="true" className="size-4 shrink-0" />
              No fue posible completar el envío.
            </p>
            <p className="mt-1 text-sm break-words text-muted-foreground">{progress.failureMessage}</p>
          </div>
        ) : null}

        {!active ? (
          <DialogFooter>
            {phase === 'completed' ? (
              <Button type="button" className="w-full" onClick={continueAfterSend}>
                Seguir registrando
              </Button>
            ) : phase === 'log-error' ? (
              <Button type="button" className="w-full" onClick={retrySendLogs}>
                Reintentar confirmación
              </Button>
            ) : (
              <Button type="button" variant="secondary" className="w-full" onClick={continueAfterSend}>
                Volver a los registros
              </Button>
            )}
          </DialogFooter>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
