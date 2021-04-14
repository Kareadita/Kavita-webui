import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from 'src/environments/environment';

@Injectable({
  providedIn: 'root'
})
export class BookService {

  baseUrl = environment.apiUrl;

  constructor(private http: HttpClient) { }

  getEpubUrl(chapterId: number, filename: string) {
    return this.baseUrl + 'book/' + chapterId + '/' + encodeURIComponent(filename);
  }

  getEpubFile(chapterId: number, filename: string) {
    return this.http.get(this.getEpubUrl(chapterId, filename), {responseType: 'blob' as 'text'});
  }

  getBookPageUrl(chapterId: number, page: number) {
    return this.baseUrl + 'book/' + chapterId + '/book-page?page=' + page;
  }
}
