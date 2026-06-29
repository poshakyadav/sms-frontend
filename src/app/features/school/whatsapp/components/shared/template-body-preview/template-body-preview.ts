// template-body-preview.ts
import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-template-body-preview',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="wa-preview">
      <!-- WhatsApp-style header -->
      <div class="wa-preview__header">
        <div class="wa-preview__avatar">
          <i class="ti ti-school" aria-hidden="true"></i>
        </div>
        <div class="wa-preview__header-info">
          <span class="wa-preview__name">Your School</span>
          <span class="wa-preview__subtitle">WhatsApp Business</span>
        </div>
      </div>

      <!-- Message bubble -->
      <div class="wa-preview__body">
        <div class="wa-preview__bubble">
          <pre class="wa-preview__text">{{ renderedText }}</pre>
          <div class="wa-preview__meta">
            <span class="wa-preview__time">{{ currentTime }}</span>
            <i class="ti ti-checks wa-preview__ticks" aria-hidden="true"></i>
          </div>
        </div>
      </div>

      <!-- Template label -->
      <div class="wa-preview__footer">
        <i class="ti ti-tag" aria-hidden="true"></i>
        <span>Template: {{ templateName }}</span>
      </div>
    </div>
  `,
  styleUrls: ['./template-body-preview.scss'],
})
export class TemplateBodyPreview implements OnChanges {
  @Input() bodyText = '';
  @Input() variables: string[] = [];
  @Input() values: Record<string, string> = {};
  @Input() templateName = '';

  renderedText = '';
  currentTime = '';

  ngOnChanges(changes: SimpleChanges): void {
    this.render();
    this.currentTime = new Date().toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  private render(): void {
    if (!this.bodyText) {
      this.renderedText = '';
      return;
    }

    let result = this.bodyText;
    this.variables.forEach((varName, idx) => {
      const placeholder = `{{${idx + 1}}}`;
      const value = this.values[varName];
      const display =
        value !== undefined && value.trim() !== '' ? value : `[${varName.replace(/_/g, ' ')}]`;
      result = result.replace(placeholder, display);
    });
    this.renderedText = result;
  }
}
