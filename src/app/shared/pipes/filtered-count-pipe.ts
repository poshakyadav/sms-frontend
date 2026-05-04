import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'filteredCount',
  standalone: true,
  pure: true,
})
export class FilteredCountPipe implements PipeTransform {
  transform(items: { status: string }[], status: string): number {
    return items.filter((i) => i.status === status).length;
  }
}
