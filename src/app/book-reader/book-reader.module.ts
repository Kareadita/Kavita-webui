import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BookReaderComponent } from './book-reader/book-reader.component';
import { BookReaderRoutingModule } from './book-reader.router.module';



@NgModule({
  declarations: [BookReaderComponent],
  imports: [
    CommonModule,
    BookReaderRoutingModule
  ], exports: [
    BookReaderComponent
  ]
})
export class BookReaderModule { }
