import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { take } from 'rxjs/operators';
import { ToastrService } from 'ngx-toastr';
import { EditCollectionTagsComponent } from '../_modals/edit-collection-tags/edit-collection-tags.component';
import { CollectionTag } from '../_models/collection-tag';
import { Pagination } from '../_models/pagination';
import { Series } from '../_models/series';
import { Library } from '../_models/library';
import { User } from '../_models/user';
import { Action, ActionFactoryService, ActionItem } from '../_services/action-factory.service';
import { SeriesService } from '../_services/series.service';
import { CollectionTagService } from '../_services/collection-tag.service';
import { AccountService } from '../_services/account.service';

/**
 * This component is used as a standard layout for any card detail. ie) series, in-progress, collections, etc. 
 */
@Component({
  selector: 'app-recently-added',
  templateUrl: './recently-added.component.html',
  styleUrls: ['./recently-added.component.scss']
})
export class RecentlyAddedComponent implements OnInit {

  isLoading: boolean = true;
  collections: CollectionTag[] = [];
  recentlyAdded: Series[] = [];
  series: Array<Series> = [];
  collectionTagActions: ActionItem<CollectionTag>[] = [];
  user: User | undefined;
  libraries: Library[] = [];
  isAdmin = false;
  pagination!: Pagination;
  libraryId!: number;

  constructor(public accountService: AccountService, private router: Router, 
    private route: ActivatedRoute, private seriesService: SeriesService, private toastr: ToastrService, 
    private collectionService: CollectionTagService, private actionFactoryService: ActionFactoryService, private modalService: NgbModal) {
    this.router.routeReuseStrategy.shouldReuseRoute = () => false;

    const routeId = this.route.snapshot.paramMap.get('id');
  }

  ngOnInit() {
    this.loadPage();
  }

  seriesClicked(series: Series) {
    this.router.navigate(['library', this.libraryId, 'series', series.id]);
  }

  onPageChange(pagination: Pagination) {
    this.router.navigate(['recently-added'], {replaceUrl: true, queryParamsHandling: 'merge', queryParams: {page: this.pagination.currentPage} });
  }

  loadPage() {
    // TODO: See if we can move this pagination code into layout code
    const page = this.route.snapshot.queryParamMap.get('page');
    if (page != null) {
      if (this.pagination == undefined || this.pagination == null) {
        this.pagination = {currentPage: 0, itemsPerPage: 30, totalItems: 0, totalPages: 1};
      }
      this.pagination.currentPage = parseInt(page, 10);
    } else {
      this.pagination = {currentPage: 0, itemsPerPage: 30, totalItems: 0, totalPages: 1};
    }
    // Reload page after a series is updated or first load
      this.seriesService.getSeriesForRecent(this.pagination?.currentPage, this.pagination?.itemsPerPage).subscribe(series => {
        this.recentlyAdded = series.result;
        this.pagination = series.pagination;
        this.isLoading = false;
        window.scrollTo(0, 0);
        console.log(series);
      });
    }
}
