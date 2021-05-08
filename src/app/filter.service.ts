import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from 'src/environments/environment';
import { FilterQuery, WhereClause } from './complex-filter/_models/filter-query';
import { PaginatedResult } from './_models/pagination';
import { Series } from './_models/series';

@Injectable({
  providedIn: 'root'
})
export class FilterService {

  baseUrl = environment.apiUrl;
  paginatedResults: PaginatedResult<Series[]> = new PaginatedResult<Series[]>();

  constructor(private httpClient: HttpClient) { }

  getFilteredSeries(filter: FilterQuery) {
    return this.httpClient.post<Series[]>(this.baseUrl + 'filter/results', filter);
  }

  getWhereCauses() {
    return this.httpClient.get<string[]>(this.baseUrl + 'filter/conditionals');
  }
}
