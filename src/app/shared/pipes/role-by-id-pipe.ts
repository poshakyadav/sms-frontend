import { Pipe, PipeTransform } from '@angular/core';

/**
 * Looks up a role by its numeric ID from an array of roles.
 *
 * Usage in template:
 *   @if ((allRoles() | roleById: id); as role) { ... }
 *
 * IMPORTANT: This pipe must be added to the `imports` array of any
 * standalone component that uses it (e.g. UserEditDialog).
 */
@Pipe({
  name: 'roleById',
  standalone: true,
  pure: true,
})
export class RoleByIdPipe implements PipeTransform {
  transform(
    roles: { id: number; name: string }[],
    id: number
  ): { id: number; name: string } | null {
    return roles.find((r) => r.id === id) ?? null;
  }
}
