import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from 'src/environments/environment';
import { CollectionTag } from '../_models/collection-tag';
import { PaginatedResult } from '../_models/pagination';

@Injectable({
  providedIn: 'root'
})
export class CollectionTagService {

  baseUrl = environment.apiUrl;
  //paginatedResults: PaginatedResult<CollectionTag[]> = new PaginatedResult<CollectionTag[]>();

  constructor(private httpClient: HttpClient) { }

  allTags() {
    // TODO: Pipe then tags.forEach(s => s.coverImage = this.imageService.getSeriesCoverImage(s.id));
    return this.httpClient.get<CollectionTag[]>(this.baseUrl + 'collection/');
  }

  search(query: string) {
    return this.httpClient.get<CollectionTag[]>(this.baseUrl + 'collection/search?queryString=' + encodeURIComponent(query));
  }

  exists() {
    // TODO
  }

  addTag() {
    // TODO
  }

  removeTagFromSeries(seriesId: number) {

  }

  getTagsForSeries(seriesId: number, seriesMetadataId: number) {

  }




}
