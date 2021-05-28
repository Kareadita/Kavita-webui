import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CollectionTag } from '../_models/collection-tag';
import { Pagination } from '../_models/pagination';
import { Series } from '../_models/series';
import { CollectionTagService } from '../_services/collection-tag.service';
import { SeriesService } from '../_services/series.service';

/**
 * This component is used as a standard layout for any card detail. ie) series, in-progress, collections, etc. 
 */
@Component({
  selector: 'app-all-collections',
  templateUrl: './all-collections.component.html',
  styleUrls: ['./all-collections.component.scss']
})
export class AllCollectionsComponent implements OnInit {

  isLoading: boolean = true;
  collections: CollectionTag[] = [];
  collectionTagId: number = 0; // 0 is not a valid id, if 0, we will load all tags
  collectionTagName: string = '';
  series: Array<Series> = [];
  seriesPagination!: Pagination;

  constructor(private collectionService: CollectionTagService, private router: Router, 
    private route: ActivatedRoute, private seriesService: SeriesService) {
    this.router.routeReuseStrategy.shouldReuseRoute = () => false;

    const routeId = this.route.snapshot.paramMap.get('id');
    if (routeId != null) {
      this.collectionTagId = parseInt(routeId, 10);
      this.collectionService.allTags().subscribe(tags => {
        this.collections = tags;
        this.collectionTagName = tags.filter(item => item.id === this.collectionTagId)[0].title;
      });
    }
  }

  ngOnInit() {
    this.loadPage();
  }


  loadCollection(item: CollectionTag) {
    this.collectionTagId = item.id;
    this.collectionTagName = item.title;
    this.router.navigate(['collections', this.collectionTagId], {replaceUrl: true, queryParamsHandling: 'merge', queryParams: {} });
    this.loadPage();
  }

  loadPage() {
    // Reload page after a series is updated or first load
    if (this.collectionTagId === 0) {
      this.collectionService.allTags().subscribe(tags => {
        this.collections = tags;
        this.isLoading = false;
      });
    } else {
      this.seriesService.getSeriesForTag(this.collectionTagId).subscribe(tags => {
        this.series = tags.result;
        this.seriesPagination = tags.pagination;
        this.isLoading = false;
      });
    }
  }

}
