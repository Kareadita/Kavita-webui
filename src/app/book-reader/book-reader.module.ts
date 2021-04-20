import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BookReaderComponent } from './book-reader/book-reader.component';
import { BookReaderRoutingModule } from './book-reader.router.module';
import { SharedModule } from '../shared/shared.module';
import { StyleControlComponent } from './style-control/style-control.component';
import { SafeStylePipe } from './safe-style.pipe';
import { ReactiveFormsModule } from '@angular/forms';


@NgModule({
  declarations: [BookReaderComponent, StyleControlComponent, SafeStylePipe],
  imports: [
    CommonModule,
    BookReaderRoutingModule,
    ReactiveFormsModule,
    SharedModule
  ], exports: [
    BookReaderComponent,
    SafeStylePipe
  ]
})
export class BookReaderModule { }
