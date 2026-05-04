import {
  Directive,
  inject,
  Input,
  OnInit,
  TemplateRef,
  ViewContainerRef,
  effect,
  Pipe,
  PipeTransform,
} from '@angular/core';
import { AuthService } from '../services/auth.service';

// ── School PBAC directive ─────────────────────────────────────────────────────

/**
 * *hasPermission="'users.create'"
 * *hasPermission="['users.edit', 'users.delete']"
 */
@Directive({ selector: '[hasPermission]', standalone: true })
export class HasPermissionDirective implements OnInit {
  private auth = inject(AuthService);
  private templateRef = inject(TemplateRef<any>);
  private viewContainer = inject(ViewContainerRef);

  private requiredPerms: string[] = [];
  private hasView = false;

  @Input() set hasPermission(perms: string | string[]) {
    this.requiredPerms = Array.isArray(perms) ? perms : [perms];
    this.updateView();
  }

  ngOnInit(): void {
    effect(() => {
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

// ── Super PBAC directive  ← new ───────────────────────────────────────────────

/**
 * *hasSuperPermission="'users.create'"
 * *hasSuperPermission="['schools.manage', 'schools.invite']"
 */
@Directive({ selector: '[hasSuperPermission]', standalone: true })
export class HasSuperPermissionDirective implements OnInit {
  private auth = inject(AuthService);
  private templateRef = inject(TemplateRef<any>);
  private viewContainer = inject(ViewContainerRef);

  private requiredPerms: string[] = [];
  private hasView = false;

  @Input() set hasSuperPermission(perms: string | string[]) {
    this.requiredPerms = Array.isArray(perms) ? perms : [perms];
    this.updateView();
  }

  ngOnInit(): void {
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

// ── Super pipe  ← new ─────────────────────────────────────────────────────────

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
