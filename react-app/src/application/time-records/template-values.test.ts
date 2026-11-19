import { describe, expect, it } from 'vitest';
import { makeDraft } from '@/test/fakes/drafts-fixtures';
import { applyTemplateValues } from './template-values';

describe('applyTemplateValues', () => {
  it('ignora tipoHora y valores vacíos', () => {
    const applied = applyTemplateValues(makeDraft(), { tipoHora: 'Fábrica', causa: 'Error', lenguaje: '  ' });
    expect(applied.tipoHora).toBe('Laboral');
    expect(applied.causa).toBe('Error');
    expect(applied.lenguaje).toBeUndefined();
  });

  it('conserva funcional y ricef no vacíos del registro, y completa los vacíos', () => {
    const kept = applyTemplateValues(
      { ...makeDraft(), funcional: 'Ana', ricef: 'R-1' },
      { funcional: 'Otro', ricef: 'R-2' },
    );
    expect(kept).toMatchObject({ funcional: 'Ana', ricef: 'R-1' });
    const filled = applyTemplateValues({ ...makeDraft(), funcional: ' ' }, { funcional: 'Otro', ricef: 'R-2' });
    expect(filled).toMatchObject({ funcional: 'Otro', ricef: 'R-2' });
  });
});
