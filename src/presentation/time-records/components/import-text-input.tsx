import { ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/shared/ui/alert';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/shared/ui/collapsible';
import { Field, FieldDescription, FieldLabel } from '@/shared/ui/field';
import { Textarea } from '@/shared/ui/textarea';
import { useContainer } from '@presentation/providers/container-context';
import { useDrafts } from '../drafts/drafts-context';
import { readTextDraft, writeTextDraft } from '../drafts/text-draft-storage';

const PLACEHOLDER = [
  '26/05/2026',
  '7:30AM-9:00AM | Descripción de la actividad | Funcional opcional | RICEF opcional',
  '-10:30AM | Continúa desde 9:00AM',
  '1:00PM-2:00PM | Reinicia después de almuerzo',
].join('\n');

const HINT =
  'Agrega | Funcional | RICEF cuando quieras sobrescribirlos; si no los escribes se usarán los de la asignación.';

/**
 * Textarea de importación (equivale a `ImportTextInputComponent`). Parsea con el dominio y agrega los
 * registros a los borradores del shell. Guarda su propio borrador en `pmo_text_time_draft`.
 */
export function ImportTextInput() {
  const { domainService: domain } = useContainer();
  const { addRecords, sendLocked } = useDrafts();
  const [rawText, setRawText] = useState(readTextDraft);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [message, setMessage] = useState('');

  const change = (value: string) => {
    setRawText(value);
    setParseErrors([]);
    setMessage('');
    writeTextDraft(value);
  };

  const processText = () => {
    setMessage('');
    const errors = domain.validateImportText(rawText);
    if (errors.length) {
      setParseErrors(errors);
      return;
    }
    const parsed = domain.parseText(rawText);
    if (!parsed.length) {
      setParseErrors(['No se encontraron registros validos para agregar a la vista previa.']);
      return;
    }
    // Con el envío bloqueado no se agrega nada y el texto se conserva (Angular lo descartaba en silencio).
    if (!addRecords(parsed)) return;
    setRawText('');
    setParseErrors([]);
    setMessage('Borrador agregado a la vista previa.');
    writeTextDraft('');
  };

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle className="flex flex-wrap items-center gap-x-3 gap-y-1">
          Pegar tiempos
          <Badge variant="outline" className="font-normal">
            Borrador guardado
          </Badge>
        </CardTitle>
        <CardDescription>Inserta el texto y completa los selects en la vista previa antes de enviar.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <Collapsible className="rounded-lg border bg-muted/40">
          <CollapsibleTrigger className="group flex w-full items-center justify-between gap-2 px-3 py-2.5 text-sm font-medium outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
            Ver ejemplo de formato
            <ChevronDown aria-hidden="true" className="size-4 transition-transform group-data-[state=open]:rotate-180" />
          </CollapsibleTrigger>
          <CollapsibleContent className="px-3 pb-3">
            <div className="overflow-x-auto rounded-md border bg-card p-3 font-mono text-xs leading-relaxed">
              <p className="font-semibold">26/05/2026</p>
              <p>7:30AM-9:00AM | Desarrollo de ajuste FI | Funcional opcional | RICEF opcional</p>
              <p>-10:30AM | Revisión con usuario</p>
              <p>1:00PM-2:00PM | Retomar después de almuerzo</p>
              <p>-3:30PM | Pruebas y cierre</p>
            </div>
          </CollapsibleContent>
        </Collapsible>

        <Field>
          <FieldLabel htmlFor="import-raw-text">Pega aquí tus registros de tiempo</FieldLabel>
          <Textarea
            id="import-raw-text"
            rows={6}
            className="font-mono text-xs"
            placeholder={PLACEHOLDER}
            aria-describedby="import-raw-text-hint"
            value={rawText}
            onChange={(event) => change(event.target.value)}
          />
          <FieldDescription id="import-raw-text-hint">{HINT}</FieldDescription>
        </Field>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" disabled={!rawText} onClick={() => change('')}>
            Limpiar
          </Button>
          <Button type="button" disabled={sendLocked} onClick={processText}>
            Procesar tiempos
          </Button>
        </div>
        {sendLocked ? (
          <p className="text-xs text-muted-foreground" role="status">
            Hay un envío en curso o pendiente de confirmar: podrás agregar tiempos cuando termine.
          </p>
        ) : null}

        {parseErrors.length > 0 ? (
          <Alert variant="destructive">
            <AlertTitle>Revisa antes de continuar:</AlertTitle>
            <AlertDescription>
              <ul className="list-disc pl-5">
                {parseErrors.map((error) => (
                  <li key={error}>{error}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        ) : null}

        {message ? (
          <Alert role="status" aria-live="polite">
            <AlertDescription>{message}</AlertDescription>
          </Alert>
        ) : null}
      </CardContent>
    </Card>
  );
}
