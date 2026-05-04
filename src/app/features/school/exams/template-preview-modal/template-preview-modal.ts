import {
  Component,
  computed,
  ElementRef,
  inject,
  input,
  OnInit,
  output,
  signal,
  ViewChild,
  AfterViewInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { CardTemplate } from '../../../../core/services/exams.service';

// ─────────────────────────────────────────────────────────────────────────────
// DUMMY DATA for realistic previews
// ─────────────────────────────────────────────────────────────────────────────

const DUMMY_TIMETABLE_HTML = `
  <table>
    <thead>
      <tr>
        <th>Subject</th>
        <th>Date</th>
        <th>Time</th>
        <th>Room</th>
        <th>Max Marks</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><strong>Mathematics</strong></td>
        <td>15 Jun 2026</td>
        <td>09:00 – 11:00</td>
        <td>Room 101</td>
        <td style="text-align:center;">100</td>
      </tr>
      <tr>
        <td><strong>Science</strong></td>
        <td>17 Jun 2026</td>
        <td>09:00 – 11:00</td>
        <td>Room 102</td>
        <td style="text-align:center;">100</td>
      </tr>
      <tr>
        <td><strong>English</strong></td>
        <td>19 Jun 2026</td>
        <td>10:00 – 12:00</td>
        <td>Room 103</td>
        <td style="text-align:center;">80</td>
      </tr>
      <tr>
        <td><strong>Social Studies</strong></td>
        <td>21 Jun 2026</td>
        <td>09:00 – 11:00</td>
        <td>Room 104</td>
        <td style="text-align:center;">80</td>
      </tr>
      <tr>
        <td><strong>Hindi</strong></td>
        <td>23 Jun 2026</td>
        <td>09:00 – 11:00</td>
        <td>Room 105</td>
        <td style="text-align:center;">80</td>
      </tr>
    </tbody>
  </table>`;

const DUMMY_MARKS_HTML = `
  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>Subject</th>
        <th style="text-align:center;">Max Marks</th>
        <th style="text-align:center;">Marks Obtained</th>
        <th style="text-align:center;">Grade</th>
        <th>Remarks</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td style="text-align:center;color:#94a3b8;">1</td>
        <td><strong>Mathematics</strong></td>
        <td style="text-align:center;">100</td>
        <td style="text-align:center;font-weight:700;">87</td>
        <td style="text-align:center;">A</td>
        <td style="color:#64748b;font-size:12px;">Excellent work</td>
      </tr>
      <tr>
        <td style="text-align:center;color:#94a3b8;">2</td>
        <td><strong>Science</strong></td>
        <td style="text-align:center;">100</td>
        <td style="text-align:center;font-weight:700;">92</td>
        <td style="text-align:center;">A+</td>
        <td style="color:#64748b;font-size:12px;">Outstanding</td>
      </tr>
      <tr>
        <td style="text-align:center;color:#94a3b8;">3</td>
        <td><strong>English</strong></td>
        <td style="text-align:center;">80</td>
        <td style="text-align:center;font-weight:700;">71</td>
        <td style="text-align:center;">B+</td>
        <td style="color:#64748b;font-size:12px;">Good effort</td>
      </tr>
      <tr>
        <td style="text-align:center;color:#94a3b8;">4</td>
        <td><strong>Social Studies</strong></td>
        <td style="text-align:center;">80</td>
        <td style="text-align:center;font-weight:700;">68</td>
        <td style="text-align:center;">B</td>
        <td style="color:#64748b;font-size:12px;">Satisfactory</td>
      </tr>
      <tr>
        <td style="text-align:center;color:#94a3b8;">5</td>
        <td><strong>Hindi</strong></td>
        <td style="text-align:center;">80</td>
        <td style="text-align:center;font-weight:700;">75</td>
        <td style="text-align:center;">B+</td>
        <td style="color:#64748b;font-size:12px;">Good</td>
      </tr>
    </tbody>
    <tfoot>
      <tr style="font-weight:800;background:#f1f5f9;">
        <td colspan="2" style="font-weight:700;">Total</td>
        <td style="text-align:center;font-weight:800;">440</td>
        <td style="text-align:center;font-weight:800;">393</td>
        <td colspan="2" style="font-weight:800;">89%</td>
      </tr>
    </tfoot>
  </table>`;

const DUMMY_DATA: Record<string, string> = {
  studentName: 'Arjun Sharma',
  rollNumber: 'CS-2026-042',
  className: 'Class 10',
  sectionName: 'A',
  examName: 'Annual Final Examination 2026',
  schoolName: 'Delhi Public School',
  schoolInitial: 'D',
  schoolLogo: '',
  academicYear: '2025–2026',
  currentDate: '1 May 2026',
  currentYear: '2026',
  timetableTable: DUMMY_TIMETABLE_HTML,
  marksTable: DUMMY_MARKS_HTML,
  percentage: '89',
  totalObtained: '393',
  totalMax: '440',
  gradeLabel: 'A',
  passStatus: 'PASS',
  passStatusClass: 'pass',
};

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

@Component({
  selector: 'app-template-preview-modal',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatButtonModule, MatTooltipModule],
  templateUrl: './template-preview-modal.html',
  styleUrl: './template-preview-modal.scss',
})
export class TemplatePreviewModal implements AfterViewInit {
  @ViewChild('previewFrame') previewFrame!: ElementRef<HTMLIFrameElement>;

  // ── Inputs / Outputs ──────────────────────────────────────────────────────
  template = input.required<CardTemplate>();
  cardType = input.required<'ADMIT_CARD' | 'REPORT_CARD'>();
  closed = output<void>();

  // ── State ─────────────────────────────────────────────────────────────────
  iframeReady = signal(false);
  zoom = signal(0.75); // default zoom level
  isFullscreen = signal(false);

  readonly zoomLevels = [0.5, 0.65, 0.75, 0.9, 1.0];

  // ── Lifecycle ─────────────────────────────────────────────────────────────
  // ngAfterViewInit(): void {
  //   this.renderPreview();
  // }

  @ViewChild('canvasRef') canvasRef!: ElementRef<HTMLDivElement>;

  ngAfterViewInit(): void {
    this.applyResponsiveZoom();
    this.renderPreview();
  }
  
  // private applyResponsiveZoom(): void {
  //   // Get the available canvas width (subtract padding: 28px * 2 = 56px)
  //   const canvasEl = this.canvasRef?.nativeElement;
  //   const availableWidth = canvasEl
  //     ? canvasEl.clientWidth - 56
  //     : window.innerWidth - 56;
  
  //   const TEMPLATE_WIDTH = 900;
  
  //   if (availableWidth < TEMPLATE_WIDTH) {
  //     // Pick the largest zoom level that fits
  //     const idealZoom = availableWidth / TEMPLATE_WIDTH;
  //     const best = [...this.zoomLevels]
  //       .reverse()
  //       .find(z => z <= idealZoom) ?? this.zoomLevels[0];
  //     this.zoom.set(best);
  //   }
  // }

  private applyResponsiveZoom(): void {
    const canvasEl = this.canvasRef?.nativeElement;
    const padding = 32; // 16px each side on mobile
    const availableWidth = canvasEl
      ? canvasEl.clientWidth - padding
      : window.innerWidth - padding;
  
    const TEMPLATE_WIDTH = 900;
  
    if (availableWidth < TEMPLATE_WIDTH) {
      // Use exact fit zoom — not snapped to presets
      const exactZoom = availableWidth / TEMPLATE_WIDTH;
      // Clamp to a minimum of 0.25 so it never gets unreadably tiny
      this.zoom.set(Math.max(parseFloat(exactZoom.toFixed(2)), 0.25));
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────
  private renderPreview(): void {
    const html = this.buildPreviewHtml();
    const frame = this.previewFrame?.nativeElement;
    if (!frame) return;

    const doc = frame.contentDocument || frame.contentWindow?.document;
    if (!doc) return;

    doc.open();
    doc.write(html);
    doc.close();

    frame.onload = () => this.iframeReady.set(true);
    this.iframeReady.set(true);
  }

  private buildPreviewHtml(): string {
    let html = this.template().htmlContent;

    // Process {{#if key}}...{{/if}} blocks
    html = html.replace(/\{\{#if (\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g, (_match, key, inner) => {
      return DUMMY_DATA[key] ? inner : '';
    });

    // Process all {{key}} placeholders
    Object.entries(DUMMY_DATA).forEach(([key, value]) => {
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      html = html.replace(regex, value);
    });

    // Clean up any remaining unresolved placeholders
    html = html.replace(/\{\{[^}]+\}\}/g, '—');

    return html;
  }

  // ── Actions ───────────────────────────────────────────────────────────────
  setZoom(level: number): void {
    this.zoom.set(level);
  }

  zoomIn(): void {
    const idx = this.zoomLevels.indexOf(this.zoom());
    if (idx < this.zoomLevels.length - 1) {
      this.zoom.set(this.zoomLevels[idx + 1]);
    }
  }

  zoomOut(): void {
    const idx = this.zoomLevels.indexOf(this.zoom());
    if (idx > 0) {
      this.zoom.set(this.zoomLevels[idx - 1]);
    }
  }

  scalerMargin = computed(() => {
    const canvasEl = this.canvasRef?.nativeElement;
    const canvasWidth = canvasEl ? canvasEl.clientWidth : window.innerWidth;
    const scaledWidth = 900 * this.zoom();
  
    if (scaledWidth <= canvasWidth) {
      return '0 auto'; // centered with auto margin when it fits
    }
  
    // When wider than canvas, add equal side margins so
    // the user can scroll both left AND right symmetrically
    const overflow = scaledWidth - canvasWidth;
    const sideMargin = Math.ceil(overflow / 2) + 16; // 16px breathing room
    return `0 ${sideMargin}px`;
  });

  canZoomIn = computed(() => this.zoom() < Math.max(...this.zoomLevels));
  canZoomOut = computed(() => this.zoom() > Math.min(...this.zoomLevels));

  toggleFullscreen(): void {
    this.isFullscreen.set(!this.isFullscreen());
  }

  print(): void {
    const frame = this.previewFrame?.nativeElement;
    frame?.contentWindow?.print();
  }

  close(): void {
    this.closed.emit();
  }

  // ── Computed ──────────────────────────────────────────────────────────────
  get cardTypeLabel(): string {
    return this.cardType() === 'ADMIT_CARD' ? 'Admit Card' : 'Report Card';
  }

  get zoomPercent(): string {
    return Math.round(this.zoom() * 100) + '%';
  }
}
