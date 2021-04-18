import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BookReaderComponent } from './book-reader/book-reader.component';
import { BookReaderRoutingModule } from './book-reader.router.module';
import { SharedModule } from '../shared/shared.module';
import { StyleControlComponent } from './style-control/style-control.component';


@NgModule({
  declarations: [BookReaderComponent, StyleControlComponent],
  imports: [
    CommonModule,
    BookReaderRoutingModule,
    SharedModule
  ], exports: [
    BookReaderComponent
  ]
})
export class BookReaderModule { }
