import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CdkDropList } from '@angular/cdk/drag-drop';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { SlotItemComponent } from '../slot-item/slot-item.component';
import { ServiceViewModel, ConflictMap, ServiceSlotViewModel } from '../../models/service.model';

@Component({
  selector: 'app-service-card',
  standalone: true,
  imports: [CommonModule, CdkDropList, MatCardModule, MatButtonModule, SlotItemComponent],
  templateUrl: './service-card.component.html',
  styleUrl: './service-card.component.css'
})
export class ServiceCardComponent {
  @Input() service!: ServiceViewModel;
  @Input() conflictMap: ConflictMap = {};
  @Input() swapping = false;
  @Input() hoverSlotId: string | null = null;
  @Output() editRequested = new EventEmitter<ServiceViewModel>();
  @Output() slotDragMoved = new EventEmitter<{ slot: ServiceSlotViewModel; point: { x: number; y: number } }>();
  @Output() slotDropped = new EventEmitter<{ slot: ServiceSlotViewModel; point: { x: number; y: number } }>();
}
