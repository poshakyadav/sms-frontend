import { Pipe, PipeTransform } from '@angular/core';

@Pipe({ name: 'feeRowFilter', standalone: true, pure: false })
export class FeeRowFilterPipe implements PipeTransform {
  transform(rows: any[], source: 'STRUCTURE' | 'ASSIGNMENT'): any[] {
    if (!rows) return [];
    return rows.filter((r) => r.source === source);
  }
}
