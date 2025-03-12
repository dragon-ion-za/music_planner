import { Component } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import {MatTableModule} from '@angular/material/table';

export interface ServiceMusicPlan {
  date: Date;
  serviceType: string;
  orchestra1: string;
  orchestra2: string;
  orchestra3: string;
  orchestra4: string;
  orchestra5: string;
  choir1: string;
  choir2: string;
  choir3: string;
  choir4: string;
  congregationBS: string;
  congregationOH: string;
  congregationRP: string;
  congregationCM1: string;
  congregationCM2: string;
}

interface HTMLInputEvent extends Event {
  target: HTMLInputElement & EventTarget;
}

@Component({
  selector: 'app-schedule',
  standalone: true,
  imports: [MatTableModule, MatButtonModule],
  templateUrl: './schedule.component.html',
  styleUrl: './schedule.component.css'
})
export class ScheduleComponent {
  displayedColumns: string[] = ['date', 'serviceType', 'orchestra1', 'orchestra2', 'orchestra3', 'orchestra4', 'orchestra5', 'choir1', 'choir2', 'choir3', 'choir4', 'congregationBS', 'congregationOH', 'congregationRP', 'congregationCM1', 'congregationCM2'];
  dataSource: ServiceMusicPlan[] = [];

  fileContent: string | ArrayBuffer = '';

  public handleFileInput(e: Event): void {
    const fileEvent = e as HTMLInputEvent;
    let file: any = fileEvent.target.files![0];
    let fileReader: FileReader = new FileReader();
    let self = this;
    fileReader.onloadend = function(x) {
      self.fileContent = fileReader.result ?? "N/A";
      self.dataSource = JSON.parse(self.fileContent as string);
    }
    fileReader.readAsText(file);
  }

  public saveSchedule() : void {
    var a = document.createElement('a');
    a.setAttribute('href', 'data:text/plain;charset=utf-u,'+encodeURIComponent(JSON.stringify(this.dataSource)));
    a.setAttribute('download', 'nac_schedule_new.json');
    a.click()
  }
}
