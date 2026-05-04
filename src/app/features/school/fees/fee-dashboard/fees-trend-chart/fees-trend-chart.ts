import { Component, ElementRef, Input, OnChanges, OnDestroy, OnInit, SimpleChanges, ViewChild } from '@angular/core';
import { Chart, ChartConfiguration, registerables } from 'chart.js';

// Register all Chart.js components
Chart.register(...registerables);

@Component({
  selector: 'app-fees-trend-chart',
  imports: [],
  templateUrl: './fees-trend-chart.html',
  styleUrl: './fees-trend-chart.scss',
})
export class FeesTrendChart implements OnInit, OnChanges, OnDestroy {
  @Input() trend: { date: string; amount: number }[] = [];

  @ViewChild('chartCanvas') chartCanvas!: ElementRef<HTMLCanvasElement>;

  private chart?: Chart;

  ngOnInit() {
    // Nothing here – we wait for data
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['trend'] && this.trend.length > 0) {
      this.createOrUpdateChart();
    }
  }

  private createOrUpdateChart() {
    const ctx = this.chartCanvas.nativeElement.getContext('2d');
    if (!ctx) return;

    // Destroy old chart if exists
    if (this.chart) {
      this.chart.destroy();
    }

    const labels = this.trend.map(item => item.date);
    const dataPoints = this.trend.map(item => item.amount);

    const config: ChartConfiguration = {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Daily Collection (₹)',
          data: dataPoints,
          borderColor: '#1976d2',
          backgroundColor: 'rgba(25, 118, 210, 0.15)',
          borderWidth: 3,
          tension: 0.4,
          pointRadius: 5,
          pointHoverRadius: 7,
          pointBackgroundColor: '#fff',
          pointBorderWidth: 2,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: true, position: 'top' as const },
          tooltip: {
            mode: 'index',
            intersect: false,
            callbacks: {
              label: (ctx) => `₹${ctx.raw}`
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: { callback: (value) => `₹${value}` }
          },
          x: {
            grid: { color: '#f0f0f0' }
          }
        }
      }
    };

    this.chart = new Chart(ctx, config);
  }

  ngOnDestroy() {
    if (this.chart) {
      this.chart.destroy();
    }
  }
}
