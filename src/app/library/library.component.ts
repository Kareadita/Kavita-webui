import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { take } from 'rxjs/operators';
import { CollectionTag } from '../_models/collection-tag';
import { InProgressChapter } from '../_models/in-progress-chapter';
import { Library } from '../_models/library';
import { Series } from '../_models/series';
import { User } from '../_models/user';
import { AccountService } from '../_services/account.service';
import { CollectionTagService } from '../_services/collection-tag.service';
import { ImageService } from '../_services/image.service';
import { LibraryService } from '../_services/library.service';
import { SeriesService } from '../_services/series.service';
@Component({
  selector: 'app-library',
  templateUrl: './library.component.html',
  styleUrls: ['./library.component.scss']
})
export class LibraryComponent implements OnInit {

  user: User | undefined;
  libraries: Library[] = [];
  isLoading = false;
  isAdmin = false;

  recentlyAdded: Series[] = [];
  inProgress: Series[] = [];
  continueReading: InProgressChapter[] = [];
  collectionTags: CollectionTag[] = [];

  constructor(public accountService: AccountService, private libraryService: LibraryService, 
    private seriesService: SeriesService, private imageService: ImageService,
    private collectionService: CollectionTagService, private router: Router) { }

  ngOnInit(): void {
    this.isLoading = true;
    this.accountService.currentUser$.pipe(take(1)).subscribe(user => {
      this.user = user;
      this.isAdmin = this.accountService.hasAdminRole(this.user);
      this.libraryService.getLibrariesForMember().subscribe(libraries => {
        this.libraries = libraries;
        this.isLoading = false;
      });
    });

    this.reloadSeries();
  }

  reloadSeries() {
    this.seriesService.getRecentlyAdded().subscribe((series) => {
      this.recentlyAdded = series;
    });

    this.seriesService.getInProgress().subscribe((series) => {
      this.inProgress = series;
    });

    this.collectionService.allTags().subscribe(tags => {
      this.collectionTags = tags;
    });
  }

  handleSectionClick(sectionTitle: string) {
    if (sectionTitle.toLowerCase() === 'collections') {
      this.router.navigate(['collections']);
    } else if (sectionTitle.toLowerCase() === 'recently added') {
      this.router.navigate(['recently-added']);
    } else if (sectionTitle.toLowerCase() === 'in progress') {
      this.router.navigate(['in-progress']);
    }
  }

  loadCollection(item: CollectionTag) {
    this.router.navigate(['collections', item.id]);
  }

}
