import {
  Directive,
  effect,
  inject,
  Input,
  Pipe,
  PipeTransform,
  TemplateRef,
  ViewContainerRef,
} from '@angular/core';
import { AuthService } from '../services/auth.service';

// ── School PBAC directive ─────────────────────────────────────────────────────

/**
 * *hasPermission="'users.create'"
 * *hasPermission="['users.edit', 'users.delete']"
 */
@Directive({ selector: '[hasPermission]', standalone: true })
export class HasPermissionDirective {
  private auth = inject(AuthService);
  private templateRef = inject(TemplateRef<any>);
  private viewContainer = inject(ViewContainerRef);

  private requiredPerms: string[] = [];
  private hasView = false;

  @Input() set hasPermission(perms: string | string[]) {
    this.requiredPerms = Array.isArray(perms) ? perms : [perms];
    this.updateView();
  }

  constructor() {
    // effect() requires an injection context — constructor is the correct place.
    // The effect re-runs whenever auth.permissions() signal changes (e.g. after
    // a token refresh that updates the permissions list), keeping the view in sync.
    effect(() => {
      // Reading the signal registers this effect as a dependent.
      // The return value is intentionally discarded; we only need the side-effect.
      void this.auth.permissions();
      this.updateView();
    });
  }

  private updateView(): void {
    const allowed = this.auth.hasAnyPermission(this.requiredPerms);
    if (allowed && !this.hasView) {
      this.viewContainer.createEmbeddedView(this.templateRef);
      this.hasView = true;
    } else if (!allowed && this.hasView) {
      this.viewContainer.clear();
      this.hasView = false;
    }
  }
}

// ── Super PBAC directive ──────────────────────────────────────────────────────

/**
 * *hasSuperPermission="'users.create'"
 * *hasSuperPermission="['schools.manage', 'schools.invite']"
 */
@Directive({ selector: '[hasSuperPermission]', standalone: true })
export class HasSuperPermissionDirective {
  private auth = inject(AuthService);
  private templateRef = inject(TemplateRef<any>);
  private viewContainer = inject(ViewContainerRef);

  private requiredPerms: string[] = [];
  private hasView = false;

  @Input() set hasSuperPermission(perms: string | string[]) {
    this.requiredPerms = Array.isArray(perms) ? perms : [perms];
    this.updateView();
  }

  constructor() {
    effect(() => {
      void this.auth.superPermissions();
      this.updateView();
    });
  }

  private updateView(): void {
    const allowed = this.auth.hasAnySuperPermission(this.requiredPerms);
    if (allowed && !this.hasView) {
      this.viewContainer.createEmbeddedView(this.templateRef);
      this.hasView = true;
    } else if (!allowed && this.hasView) {
      this.viewContainer.clear();
      this.hasView = false;
    }
  }
}

// ── School pipe ───────────────────────────────────────────────────────────────

@Pipe({ name: 'hasPermission', standalone: true, pure: false })
export class HasPermissionPipe implements PipeTransform {
  private auth = inject(AuthService);
  transform(perms: string | string[]): boolean {
    return this.auth.hasAnyPermission(Array.isArray(perms) ? perms : [perms]);
  }
}

// ── Super pipe ────────────────────────────────────────────────────────────────

/**
 * [disabled]="!('users.create' | hasSuperPermission)"
 * [class.hidden]="!(['schools.manage'] | hasSuperPermission)"
 */
@Pipe({ name: 'hasSuperPermission', standalone: true, pure: false })
export class HasSuperPermissionPipe implements PipeTransform {
  private auth = inject(AuthService);
  transform(perms: string | string[]): boolean {
    return this.auth.hasAnySuperPermission(Array.isArray(perms) ? perms : [perms]);
  }
}