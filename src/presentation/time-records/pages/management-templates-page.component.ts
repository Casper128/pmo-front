import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ManagementTemplateGateway } from '@application/time-records/ports/management-template.gateway';
import {
  AdvancedTemplateFieldKey,
  ManagementAdvancedTemplate,
  REQUIRED_ADVANCED_TEMPLATE_FIELDS,
  isMissingAdvancedTemplateValue,
} from '@domain/time-records/models/management-template.model';
import { UiPageHeaderComponent } from '@presentation/shared/components/ui-page-header/ui-page-header.component';
import { UiSearchInputComponent } from '@presentation/shared/components/ui-search-input/ui-search-input.component';
import {
  UiSelectComponent,
  UiSelectOption,
} from '@presentation/shared/components/ui-select/ui-select.component';
import { UiStateMessageComponent } from '@presentation/shared/components/ui-state-message/ui-state-message.component';
import { ManagementTemplateFormComponent } from '../components/management-template-form/management-template-form.component';

type TemplateFilter = 'all' | 'complete' | 'incomplete';
type TemplateSort = 'recent' | 'name' | 'id';

@Component({
  selector: 'app-management-templates-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    UiPageHeaderComponent,
    UiSearchInputComponent,
    UiSelectComponent,
    UiStateMessageComponent,
    ManagementTemplateFormComponent,
  ],
  templateUrl: './management-templates-page.component.html',
})
export class ManagementTemplatesPageComponent implements OnInit {
  private templates = inject(ManagementTemplateGateway);

  loading = signal(false);
  saving = signal(false);
  message = signal<{ type: 'success' | 'error'; text: string } | null>(null);
  templateList = signal<ManagementAdvancedTemplate[]>([]);
  selectedTemplate = signal<ManagementAdvancedTemplate | null>(null);
  search = signal('');
  client = signal('');
  filter = signal<TemplateFilter>('all');
  sort = signal<TemplateSort>('recent');

  readonly sortOptions: readonly UiSelectOption[] = [
    { value: 'recent', label: 'Actualizadas recientemente' },
    { value: 'name', label: 'Nombre de gestión' },
    { value: 'id', label: 'ID de gestión' },
  ];

  clientOptions = computed<readonly UiSelectOption[]>(() => [
    { value: '', label: 'Todos los clientes' },
    ...Array.from(
      new Set(
        this.templateList()
          .map((template) => String(template.client || '').trim())
          .filter(Boolean),
      ),
    )
      .sort((a, b) => a.localeCompare(b, 'es'))
      .map((value) => ({ value, label: value })),
  ]);

  filteredTemplates = computed(() => {
    const term = this.normalize(this.search());
    const filtered = this.templateList().filter((template) => {
      if (this.filter() === 'complete' && !this.isComplete(template)) return false;
      if (this.filter() === 'incomplete' && this.isComplete(template)) return false;
      if (this.client() && this.normalize(template.client) !== this.normalize(this.client())) {
        return false;
      }
      if (!term) return true;
      return this.templateSearchText(template).includes(term);
    });
    return filtered.sort((a, b) => {
      if (this.sort() === 'name') return a.gestionName.localeCompare(b.gestionName, 'es');
      if (this.sort() === 'id') return a.gestionId.localeCompare(b.gestionId, 'es');
      return String(b.updatedAt || '').localeCompare(String(a.updatedAt || ''));
    });
  });

  completeCount = computed(
    () => this.templateList().filter((template) => this.isComplete(template)).length,
  );
  incompleteCount = computed(() => this.templateList().length - this.completeCount());
  emptyStateTitle = computed(() =>
    this.templateList().length
      ? 'No encontramos plantillas con esos filtros'
      : 'Aún no tienes plantillas por gestión',
  );
  emptyStateDescription = computed(() =>
    this.templateList().length
      ? 'Ajusta la búsqueda, cambia el estado o vuelve a cargar la lista para confirmar si hay datos nuevos.'
      : 'Las plantillas se crean cuando seleccionas una gestión sin configuración al registrar o editar tiempos.',
  );

  ngOnInit(): void {
    this.loadTemplates();
  }

  loadTemplates(): void {
    this.loading.set(true);
    this.templates.list().subscribe({
      next: (templates) => {
        this.templateList.set(templates);
        this.loading.set(false);
        this.message.set(null);
      },
      error: (error) => {
        this.loading.set(false);
        this.message.set({
          type: 'error',
          text: error?.message || 'No fue posible cargar tus plantillas.',
        });
      },
    });
  }

  editTemplate(template: ManagementAdvancedTemplate): void {
    this.selectedTemplate.set({ ...template, values: { ...template.values } });
    this.message.set(null);
  }

  clearTemplateEdit(): void {
    this.selectedTemplate.set(null);
  }

  onSelectedTemplateChange(template: ManagementAdvancedTemplate): void {
    this.selectedTemplate.set(template);
  }

  saveTemplate(): void {
    const draft = this.selectedTemplate();
    if (!draft) return;
    const missing = this.missingRequiredTemplateFields(draft);
    if (draft.completed && missing.length) {
      this.message.set({
        type: 'error',
        text: `Llena los campos obligatorios antes de guardar la plantilla como configurada: ${missing.join(', ')}.`,
      });
      return;
    }
    this.saving.set(true);
    this.templates.save(draft).subscribe({
      next: (saved) => {
        this.saving.set(false);
        this.templateList.update((items) => [
          ...items.filter((item) => item.gestionId !== saved.gestionId),
          saved,
        ]);
        this.selectedTemplate.set(null);
        this.message.set({ type: 'success', text: 'Plantilla actualizada.' });
      },
      error: (error) => {
        this.saving.set(false);
        this.message.set({
          type: 'error',
          text: error?.message || 'No fue posible guardar la plantilla.',
        });
      },
    });
  }

  setFilter(filter: TemplateFilter): void {
    this.filter.set(filter);
  }

  markSelectedTemplate(completed: boolean): void {
    const template = this.selectedTemplate();
    if (!template) return;
    if (completed) {
      const missing = this.missingRequiredTemplateFields(template);
      if (missing.length) {
        this.message.set({
          type: 'error',
          text: `Faltan campos obligatorios: ${missing.join(', ')}.`,
        });
        return;
      }
    }
    this.selectedTemplate.set({ ...template, completed });
    this.message.set(null);
  }

  isComplete(template: ManagementAdvancedTemplate): boolean {
    return template.completed === true;
  }

  templateValue(template: ManagementAdvancedTemplate, key: AdvancedTemplateFieldKey): string {
    return String(template.values[key] || '').trim();
  }

  private missingRequiredTemplateFields(template: ManagementAdvancedTemplate): string[] {
    return REQUIRED_ADVANCED_TEMPLATE_FIELDS.filter((field) =>
      isMissingAdvancedTemplateValue(this.templateValue(template, field.key)),
    ).map((field) => field.label);
  }

  private templateSearchText(template: ManagementAdvancedTemplate): string {
    return this.normalize(
      [
        template.gestionName,
        template.gestionId,
        template.client,
        template.project,
        ...Object.values(template.values || {}),
      ].join(' '),
    );
  }

  private normalize(value: unknown): string {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }
}
