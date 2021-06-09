import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MangaReaderComponent } from './manga-reader.component';
import { ReactiveFormsModule } from '@angular/forms';
import { NgbModalModule, NgbButtonsModule, NgbDropdownModule, NgbTooltipModule, NgbRatingModule, NgbProgressbarModule } from '@ng-bootstrap/ng-bootstrap';
import { MangaReaderRoutingModule } from './manga-reader.router.module';
import { SharedModule } from '../shared/shared.module';



@NgModule({
  declarations: [
    MangaReaderComponent
  ],
  imports: [
    CommonModule,
    MangaReaderRoutingModule,
    ReactiveFormsModule,
    NgbModalModule,
    NgbButtonsModule,
    NgbDropdownModule,
    NgbTooltipModule,
    NgbRatingModule,
    NgbProgressbarModule,
    SharedModule
  ],
  exports: [
    MangaReaderComponent
  ]
})
export class MangaReaderModule { }
