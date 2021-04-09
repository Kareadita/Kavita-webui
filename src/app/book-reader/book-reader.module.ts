import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BookReaderComponent } from './book-reader/book-reader.component';
import { BookReaderRoutingModule } from './book-reader.router.module';
import { SharedModule } from '../shared/shared.module';
import { RequestParamInterceptor } from './request-param.interceptor';
import { HTTP_INTERCEPTORS } from '@angular/common/http';



@NgModule({
  declarations: [BookReaderComponent],
  imports: [
    CommonModule,
    BookReaderRoutingModule,
    SharedModule
  ], exports: [
    BookReaderComponent
  ]
})
export class BookReaderModule { }
