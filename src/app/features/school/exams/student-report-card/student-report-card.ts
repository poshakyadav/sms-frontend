import { CommonModule } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ActivatedRoute, Router } from '@angular/router';
import { ExamsService } from '../../../../core/services/exams.service';
import { ToastService } from '../../../../core/services/toast.service';

type CardState = 'loading' | 'ready' | 'not-published' | 'error';

@Component({
  selector: 'app-student-report-card',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatIconModule, MatProgressSpinnerModule],
  templateUrl: './student-report-card.html',
  styleUrl: './student-report-card.scss',
})
export class StudentReportCard implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private examsService = inject(ExamsService);
  private toast = inject(ToastService);

  examId = Number(this.route.snapshot.queryParamMap.get('examId'));

  htmlContent = signal<string>('');
  state = signal<CardState>('loading');

  ngOnInit(): void {
    if (!this.examId) {
      this.state.set('error');
      return;
    }

    this.examsService.getStudentReportCard(this.examId).subscribe({
      next: (res) => {
        this.htmlContent.set(res.html);
        this.state.set('ready');
      },
      error: (err) => {
        if (err?.error?.notPublished === true) {
          this.state.set('not-published');
        } else {
          this.toast.error(err?.error?.error ?? 'Failed to load report card');
          this.state.set('error');
        }
      },
    });
  }

  print(): void {
    window.print();
  }
  goBack(): void {
    this.router.navigate(['/school/exams/student/my']);
  }
}
