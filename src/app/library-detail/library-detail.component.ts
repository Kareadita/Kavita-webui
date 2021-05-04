import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { Library, LibraryType } from '../_models/library';
import { Pagination } from '../_models/pagination';
import { Series } from '../_models/series';
import { Action, ActionFactoryService, ActionItem } from '../_services/action-factory.service';
import { LibraryService } from '../_services/library.service';
import { SeriesService } from '../_services/series.service';

@Component({
  selector: 'app-library-detail',
  templateUrl: './library-detail.component.html',
  styleUrls: ['./library-detail.component.scss']
})
export class LibraryDetailComponent implements OnInit, OnDestroy {

  libraryId!: number;
  title = '';
  series: Series[] = [];
  loadingSeries = false;

  pagination!: Pagination;
  pageNumber = 1;
  pageSize = 30; // TODO: Refactor this into UserPreference or ServerSetting

  private readonly onDestroy = new Subject<void>();
  libraryName: string = '';
  actions: ActionItem<Library>[] = [];
  showFilter = false;
  sortingOptions: Array<{active: boolean, name: string}> = [{active: true, name: 'Name'}, {active: false, name: 'Localized Name'}, 
  {active: false, name: 'Date Added'}, {active: false, name: 'Date Modified'}, {active: false, name: 'User Rating'}, {active: false, name: 'Unread'}];
  

  constructor(private route: ActivatedRoute, private router: Router, private seriesService: SeriesService, 
    private libraryService: LibraryService, private toastr: ToastrService, private actionFactoryService: ActionFactoryService) {
    const routeId = this.route.snapshot.paramMap.get('id');
    if (routeId === null) {
      this.router.navigateByUrl('/home');
      return;
    }
    this.router.routeReuseStrategy.shouldReuseRoute = () => false;
    this.libraryId = parseInt(routeId, 10);
    this.loadPage();
    this.libraryService.getLibraryNames().pipe(takeUntil(this.onDestroy)).subscribe(names => {
      this.libraryName = names[this.libraryId];
    });
    this.actions = this.actionFactoryService.getLibraryActions(this.handleAction.bind(this));
  }

  ngOnDestroy() {
    this.onDestroy.next();
  }

  ngOnInit(): void {
  }

  loadPage() {
    const page = this.route.snapshot.queryParamMap.get('page');
    if (page != null) {
      this.pageNumber = parseInt(page, 10);
    }
    this.loadingSeries = true;
    // TODO: Add sorting by a param to this (SortingOptionDto)
    this.seriesService.getSeriesForLibrary(this.libraryId, this.pageNumber, this.pageSize).subscribe(series => {
      this.series = series.result;
      this.pagination = series.pagination;
      this.loadingSeries = false;
      window.scrollTo(0, 0);
    });
  }

  performAction(action: ActionItem<Library>) {
    if (typeof action.callback === 'function') {
      action.callback(action.action, {id: this.libraryId, name: this.libraryName, coverImage: '', type: LibraryType.Manga, folders: []});
    }
  }

  handleAction(action: Action, library: Library) {
    switch (action) {
      case(Action.ScanLibrary):
        this.scanLibrary();
        break;
      case(Action.RefreshMetadata):
        this.refreshMetadata();
        break;
      default:
        break;
    }
  }

  scanLibrary() {
    // TODO: Refactor this into a common service since all actions for the most part are the same
    this.libraryService.scan(this.libraryId).subscribe((res: any) => {
      this.toastr.success('Scan started for ' + this.libraryName);
    });
  }

  refreshMetadata() {
    // TODO: Refactor this into a common service since all actions for the most part are the same
    this.libraryService.refreshMetadata(this.libraryId).subscribe((res: any) => {
      this.toastr.success('Scan started for ' + this.libraryName);
    });
  }

  onPageChange(page: number) {
    this.router.navigate(['library', this.libraryId], {replaceUrl: true, queryParamsHandling: 'merge', queryParams: {page} });
  }

  seriesClicked(series: Series) {
    this.router.navigate(['library', this.libraryId, 'series', series.id]);
  }

  mangaTrackBy(index: number, manga: Series) {
    return manga.name;
  }

  trackByIdentity = (index: number, item: Series) => `${item.name}_${item.originalName}_${item.localizedName}`;

}
