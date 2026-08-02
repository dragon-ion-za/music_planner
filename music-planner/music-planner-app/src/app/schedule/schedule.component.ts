import { Component } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDividerModule } from '@angular/material/divider';
import { MatGridListModule } from '@angular/material/grid-list';
import { FormsModule } from '@angular/forms';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { DateAdapter, MAT_DATE_FORMATS, MAT_DATE_LOCALE } from '@angular/material/core';
import { MomentDateAdapter } from '@angular/material-moment-adapter';
import moment from 'moment';
import repertoireData from '../../assets/repertoire.json';

export interface ServiceMusicPlan {
  date: Date;
  serviceType: string;
  songs: Song[];
}

export interface RepertoireSong {
  number: string;
  translation: string;
}

export class Song {
  type: string = '';
  number: string = '';
  translatedNumber: string = '';
  conflicts: ConflictDetail[] = [];
  quarterConflicts: ConflictDetail[] = [];
  yearConflicts: ConflictDetail[] = [];
}

export interface ConflictDetail {
  date: Date;
  type: string;
}

interface HTMLInputEvent extends Event {
  target: HTMLInputElement & EventTarget;
}

export const MY_FORMATS = {
  parse: { dateInput: 'LL' },
  display: {
    dateInput: 'YYYY-MM-DD',
    monthYearLabel: 'YYYY',
    dateA11yLabel: 'LL',
    monthYearA11yLabel: 'YYYY',
  },
};

@Component({
  selector: 'app-schedule',
  standalone: true,
  imports: [MatInputModule, MatButtonModule, MatDividerModule, MatGridListModule, MatFormFieldModule, FormsModule, MatTooltipModule, MatDatepickerModule],
  templateUrl: './schedule.component.html',
  styleUrl: './schedule.component.css',
  providers: [
    { provide: DateAdapter, useClass: MomentDateAdapter, deps: [MAT_DATE_LOCALE] },
    { provide: MAT_DATE_FORMATS, useValue: MY_FORMATS },
  ]
})
export class ScheduleComponent {
  dataSource: ServiceMusicPlan[] = [];
  repertoireSongs: RepertoireSong[] = repertoireData.songs;
  fileContent: string | ArrayBuffer = '';

  public handleFileInput(e: Event): void {
    const fileEvent = e as HTMLInputEvent;
    const file: any = fileEvent.target.files![0];
    const fileReader: FileReader = new FileReader();
    const self = this;
    fileReader.onloadend = function() {
      self.fileContent = fileReader.result ?? 'N/A';
      self.dataSource = JSON.parse(self.fileContent as string, self.reviveDate);
      self.dataSource.forEach(x => { if (x.serviceType === '') x.serviceType = self.determineServiceType(x.date); });
      self.dataSource = self.dataSource.sort((x, y) => x.date > y.date ? 1 : x.date == y.date ? 0 : -1);
      const startDate = self.dataSource[0].date;
      const endDate = self.dataSource[self.dataSource.length - 1].date;
      self.calculateConflicts(startDate, endDate);
    };
    fileReader.readAsText(file);
  }

  public applyTranslations() {
    this.dataSource.forEach(x => {
      x.songs.forEach(y => {
        if (y.number.toLocaleLowerCase() !== 'n/a') {
          const translation = this.repertoireSongs.filter(z => z.number.toLocaleLowerCase() == y.number.toLocaleLowerCase())[0];
          y.translatedNumber = translation !== undefined && translation.translation !== ''
            ? translation.translation.toLocaleLowerCase()
            : y.number.toLocaleLowerCase();
        }
      });
    });
  }

  public determineServiceType(serviceDate: Date): string {
    return moment(serviceDate).day() === 0 ? 'Sunday Service' : 'Midweek Service';
  }

  public checkForConflicts(e: Event, serviceDate: Date) {
    const endDate = new Date(serviceDate);
    endDate.setMonth(endDate.getMonth() + 12);
    const startDate = new Date(serviceDate);
    startDate.setMonth(startDate.getMonth() - 12);
    this.calculateConflicts(startDate, endDate);
  }

  private calculateConflicts(startDate: Date, endDate: Date) {
    this.applyTranslations();
    const filteredSchedule = this.dataSource.filter(x => x.date >= startDate && x.date <= endDate);
    const mappedSongs: any[] = filteredSchedule
      .map(x => x.songs.map(y => ({ date: x.date, number: y.number.trim(), translatedNumber: y.translatedNumber.trim(), type: y.type })))
      .flatMap(x => x);

    filteredSchedule.forEach(x => {
      x.songs.forEach(y => {
        y.conflicts = [];
        y.quarterConflicts = [];
        y.yearConflicts = [];
        if (y.number.trim() !== '' && y.number.trim() !== 'N/A') {
          mappedSongs
            .filter(z => z.translatedNumber.trim() == y.translatedNumber.trim() && (z.date != x.date || (z.date == x.date && z.type != y.type)))
            .forEach(z => {
              const dateDiff = x.date.valueOf() - z.date.valueOf();
              const diffDays = Math.ceil(dateDiff / (1000 * 3600 * 24));
              if (diffDays > 90 || diffDays < -90) {
                y.yearConflicts.push({ date: z.date, type: z.type });
              } else if (diffDays > 56 || diffDays < -56) {
                y.quarterConflicts.push({ date: z.date, type: z.type });
              } else {
                y.conflicts.push({ date: z.date, type: z.type });
              }
            });
        }
      });
    });
  }

  public saveSchedule(): void {
    const a = document.createElement('a');
    a.setAttribute('href', 'data:text/plain;charset=utf-u,' + encodeURIComponent(JSON.stringify(this.dataSource)));
    a.setAttribute('download', 'nac_schedule_new.json');
    a.click();
  }

  public reviveDate(key: string, value: any) {
    const isoDateRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
    return typeof value === 'string' && isoDateRegex.test(value) ? new Date(value) : value;
  }

  public buildConflictsTooltip(conflicts: ConflictDetail[]): string {
    return conflicts.map(x => `${moment(x.date).format('YYYY-MM-DD')} - ${x.type}`).join('\n');
  }

  public addDate(): void {
    this.dataSource.push({
      date: new Date(),
      serviceType: '',
      songs: [
        { type: 'orchestra1',      number: 'N/A', translatedNumber: 'N/A', conflicts: [], quarterConflicts: [], yearConflicts: [] },
        { type: 'orchestra2',      number: 'N/A', translatedNumber: 'N/A', conflicts: [], quarterConflicts: [], yearConflicts: [] },
        { type: 'orchestra3',      number: 'N/A', translatedNumber: 'N/A', conflicts: [], quarterConflicts: [], yearConflicts: [] },
        { type: 'orchestra4',      number: 'N/A', translatedNumber: 'N/A', conflicts: [], quarterConflicts: [], yearConflicts: [] },
        { type: 'orchestra5',      number: 'N/A', translatedNumber: 'N/A', conflicts: [], quarterConflicts: [], yearConflicts: [] },
        { type: 'choir1',          number: 'N/A', translatedNumber: 'N/A', conflicts: [], quarterConflicts: [], yearConflicts: [] },
        { type: 'choir2',          number: 'N/A', translatedNumber: 'N/A', conflicts: [], quarterConflicts: [], yearConflicts: [] },
        { type: 'choir3',          number: 'N/A', translatedNumber: 'N/A', conflicts: [], quarterConflicts: [], yearConflicts: [] },
        { type: 'choir4',          number: 'N/A', translatedNumber: 'N/A', conflicts: [], quarterConflicts: [], yearConflicts: [] },
        { type: 'congregationBS',  number: 'N/A', translatedNumber: 'N/A', conflicts: [], quarterConflicts: [], yearConflicts: [] },
        { type: 'congregationOH',  number: 'N/A', translatedNumber: 'N/A', conflicts: [], quarterConflicts: [], yearConflicts: [] },
        { type: 'congregationRP',  number: 'N/A', translatedNumber: 'N/A', conflicts: [], quarterConflicts: [], yearConflicts: [] },
        { type: 'congregationCM1', number: 'N/A', translatedNumber: 'N/A', conflicts: [], quarterConflicts: [], yearConflicts: [] },
        { type: 'congregationCM2', number: 'N/A', translatedNumber: 'N/A', conflicts: [], quarterConflicts: [], yearConflicts: [] },
      ]
    });
  }
}
