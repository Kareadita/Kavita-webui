import { Component, OnInit } from '@angular/core';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';
import { ActivatedRoute, Router } from '@angular/router';
import { NgbModal, NgbRatingConfig } from '@ng-bootstrap/ng-bootstrap';
import { ToastrService } from 'ngx-toastr';
import { forkJoin } from 'rxjs';
import { CardItemAction } from '../shared/card-item/card-item.component';
import { CardDetailsModalComponent } from '../shared/_modals/card-details-modal/card-details-modal.component';
import { UtilityService } from '../shared/_services/utility.service';
import { Chapter } from '../_models/chapter';
import { Series } from '../_models/series';
import { Volume } from '../_models/volume';
import { ReaderService } from '../_services/reader.service';
import { SeriesService } from '../_services/series.service';


@Component({
  selector: 'app-series-detail',
  templateUrl: './series-detail.component.html',
  styleUrls: ['./series-detail.component.scss']
})
export class SeriesDetailComponent implements OnInit {

  series: Series | undefined;
  volumes: Volume[] = [];
  chapters: Chapter[] = [];
  libraryId = 0;

  currentlyReadingVolume: Volume | undefined = undefined;
  currentlyReadingChapter: Chapter | undefined = undefined;
  safeImage!: SafeUrl;
  placeholderImage = 'assets/images/image-placeholder.jpg';

  testMap: any;
  showBook = false;
  isLoading = true;

  volumeActions: CardItemAction[] = [];
  chapterActions: CardItemAction[] = [];


  constructor(private route: ActivatedRoute, private seriesService: SeriesService,
              ratingConfig: NgbRatingConfig, private router: Router,
              private sanitizer: DomSanitizer, private modalService: NgbModal,
              private readerService: ReaderService, private utilityService: UtilityService, private toastr: ToastrService) {
    ratingConfig.max = 5;
    this.router.routeReuseStrategy.shouldReuseRoute = () => false;
  }

  ngOnInit(): void {
    const routeId = this.route.snapshot.paramMap.get('seriesId');
    const libraryId = this.route.snapshot.paramMap.get('libraryId');
    if (routeId === null || libraryId == null) {
      this.router.navigateByUrl('/home');
      return;
    }

    this.volumeActions = [
      {title: 'Mark Read', callback: (data: Volume) => this.markAsRead(data)},
      {title: 'Mark Unread', callback: (data: Volume) => this.markAsUnread(data)},
      {
      title: 'Info',
      callback: (data: Volume) => {
        this.openViewInfo(data);
      }
    }];

    this.chapterActions = [
      {title: 'Mark Read', callback: (data: Chapter) => this.markChapterAsRead(data)},
      {title: 'Mark Unread', callback: (data: Chapter) => this.markChapterAsUnread(data)},
      {
      title: 'Info',
      callback: (data: Volume) => {
        this.openViewInfo(data);
      }
    }];


    const seriesId = parseInt(routeId, 10);
    this.libraryId = parseInt(libraryId, 10);
    this.seriesService.getSeries(seriesId).subscribe(series => {
      this.series = series;
      this.safeImage = this.sanitizer.bypassSecurityTrustUrl('data:image/jpeg;base64,' + series.coverImage);

      this.seriesService.getVolumes(this.series.id).subscribe(volumes => {
        this.chapters = volumes.filter(v => !v.isSpecial && v.number === 0).map(v => v.chapters || []).flat().sort(this.utilityService.sortChapters);
        this.volumes = volumes.sort(this.utilityService.sortVolumes);

        this.setContinuePoint();
        this.isLoading = false;
      });
    });
  }

  setContinuePoint() {
    this.currentlyReadingVolume = undefined;
    this.currentlyReadingChapter = undefined;

    this.volumes.forEach(v => {
      if (v.number === 0) {
        return;
      } else if (v.pagesRead >= v.pages) {
        return;
      } else if (this.currentlyReadingVolume === undefined) {
        this.currentlyReadingVolume = v;
      }
    });

    if (this.currentlyReadingVolume === undefined) {
      // We need to check against chapters
      this.chapters.forEach(c => {
        if (c.pagesRead >= c.pages) {
          return;
        } else if (this.currentlyReadingChapter === undefined) {
          this.currentlyReadingChapter = c;
        }
      });
      if (this.currentlyReadingChapter === undefined) {
        // Default to first chapter
        this.currentlyReadingChapter = this.chapters[0];
      }
    }
  }

  hasReadingProgress() {
    return ((this.currentlyReadingVolume !== undefined && this.currentlyReadingVolume.pagesRead > 0) || (this.currentlyReadingChapter !== this.chapters[0] && this.currentlyReadingChapter !== undefined));
    //return false;
  }

  markAsRead(vol: Volume) {
    if (this.series === undefined) {
      return;
    }
    const seriesId = this.series.id;

    forkJoin(vol.chapters?.map(chapter => this.readerService.bookmark(seriesId, vol.id, chapter.id, chapter.pages - 1))).subscribe(results => {
      vol.pagesRead = vol.pages;
      this.setContinuePoint();
      this.toastr.success('Marked as Read');
    });
  }

  markAsUnread(vol: Volume) {
    if (this.series === undefined) {
      return;
    }
    const seriesId = this.series.id;

    forkJoin(vol.chapters?.map(chapter => this.readerService.bookmark(seriesId, vol.id, chapter.id, 0))).subscribe(results => {
      vol.pagesRead = 0;
      this.setContinuePoint();
      this.toastr.success('Marked as Unread');
    });
  }

  markChapterAsRead(chapter: Chapter) {
    if (this.series === undefined) {
      return;
    }
    const seriesId = this.series.id;

    this.readerService.bookmark(seriesId, chapter.volumeId, chapter.id, chapter.pages).subscribe(results => {
      this.toastr.success('Marked as Read');
      this.setContinuePoint();
      chapter.pagesRead = chapter.pages;
    });
  }

  markChapterAsUnread(chapter: Chapter) {
    if (this.series === undefined) {
      return;
    }
    const seriesId = this.series.id;

    this.readerService.bookmark(seriesId, chapter.volumeId, chapter.id, 0).subscribe(results => {
      chapter.pagesRead = 0;
      this.setContinuePoint();
      this.toastr.success('Marked as Unread');
    });
  }

  read() {
    if (this.currentlyReadingVolume !== undefined) { this.openVolume(this.currentlyReadingVolume); }
    if (this.currentlyReadingChapter !== undefined) { this.openChapter(this.currentlyReadingChapter); }
    else { this.openVolume(this.volumes[0]); }
  }

  updateRating(rating: any) {
    if (this.series === undefined) {
      return;
    }

    console.log('Rating is: ', this.series?.userRating);
    this.seriesService.updateRating(this.series?.id, this.series?.userRating, this.series?.userReview).subscribe(() => {});
  }

  openChapter(chapter: Chapter) {
    this.router.navigate(['library', this.libraryId, 'series', this.series?.id, 'manga', chapter.id]);
  }

  openVolume(volume: Volume) {
    if (volume.chapters === undefined) {
      console.error('openVolume not implemented. Need to fetch chapter information.');
      return;
    }
    this.openChapter(volume.chapters[0]);
  }

  isNullOrEmpty(val: string) {
    return val === null || val === undefined || val === '';
  }

  openViewInfo(data: Volume | Chapter) {
    const modalRef = this.modalService.open(CardDetailsModalComponent, { size: 'lg' });
    modalRef.componentInstance.data = data;
    modalRef.componentInstance.parentName = this.series?.name;
  }

}
