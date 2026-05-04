import { Component, ViewChild } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SuperHeader } from '../../components/super-header/super-header';
import { SuperSidebar } from '../../components/super-sidebar/super-sidebar';

@Component({
  selector: 'app-super-layout',
  standalone: true,
  imports: [RouterOutlet, SuperHeader, SuperSidebar],
  templateUrl: './super-layout.html',
  styleUrl: './super-layout.scss',
})
export class SuperLayout {
  @ViewChild(SuperSidebar) sidebar!: SuperSidebar;

  openMobileSidebar(): void {
    this.sidebar?.toggleMobile();
  }
}