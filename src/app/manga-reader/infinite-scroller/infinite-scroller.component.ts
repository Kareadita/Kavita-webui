import { Component, EventEmitter, Input, OnChanges, OnDestroy, OnInit, Output, SimpleChanges } from '@angular/core';
import { BehaviorSubject, fromEvent, Subject } from 'rxjs';
import { debounceTime, takeUntil, take } from 'rxjs/operators';
import { CircularArray } from 'src/app/shared/data-structures/circular-array';
import { READER_MODE } from 'src/app/_models/preferences/reader-mode';
import { ReaderService } from 'src/app/_services/reader.service';
import { PAGING_DIRECTION } from '../_models/reader-enums';
import { WebtoonImage } from '../_models/webtoon-image';

@Component({
  selector: 'app-infinite-scroller',
  templateUrl: './infinite-scroller.component.html',
  styleUrls: ['./infinite-scroller.component.scss']
})
export class InfiniteScrollerComponent implements OnInit, OnChanges, OnDestroy {

  /**
   * Current page number aka what's recorded on screen
   */
  @Input() pageNum: number = 0;
  /**
   * Number of pages to prefetch ahead of position
   */
  @Input() buffferPages: number = 5;
  /**
   * Total number of pages
   */
  @Input() totalPages: number = 0;
  /**
   * Method to generate the src for Image loading
   */
  @Input() urlProvider!: (page: number) => string;
  @Output() pageNumberChange: EventEmitter<number> = new EventEmitter<number>();
  
  /**
   * Stores and emits all the src urls
   */
  webtoonImages: BehaviorSubject<WebtoonImage[]> = new BehaviorSubject<WebtoonImage[]>([]);
  
  images: CircularArray<HTMLImageElement> = new CircularArray<HTMLImageElement>([], 0);

  intersectionObserver: IntersectionObserver = new IntersectionObserver((entries) => this.handleIntersection(entries), { threshold: [0.25] });
  scrollingDirection: PAGING_DIRECTION = PAGING_DIRECTION.FORWARD;
  prevScrollPosition: number = 0;

  
  minPrefetchedWebtoonImage: number = Number.MAX_SAFE_INTEGER;
  maxPrefetchedWebtoonImage: number = Number.MIN_SAFE_INTEGER;
  webtoonImageWidth: number = window.innerWidth || document.documentElement.clientWidth || document.body.clientWidth;

  private readonly onDestroy = new Subject<void>();

  constructor(private readerService: ReaderService) { }

  ngOnChanges(changes: SimpleChanges): void {
     // ! BUG: This gets called multiple times and makes first load unstable
    console.log('changes: ', changes);
    if (changes.hasOwnProperty('pageNum') && changes['pageNum'].previousValue != changes['pageNum'].currentValue) {
      // Manually update pageNum as we are getting notified from a parent component, hence we shouldn't invoke update
      this.setPageNum(changes['pageNum'].currentValue);
      if (Math.abs(changes['pageNum'].currentValue - changes['pageNum'].previousValue) > 2) {
        // Go to page has occured
        this.initWebtoonReader();
      }

    }
    if (changes.hasOwnProperty('totalPages') && changes['totalPages'].previousValue != changes['totalPages'].currentValue) {
      // ! This needs work. On first load, totalpages needs time to be set for prefetching to work.
      this.totalPages = changes['totalPages'].currentValue;
      this.initWebtoonReader();
    }
  }

  ngOnDestroy(): void {
    this.onDestroy.next();
    this.onDestroy.complete();
  }

  ngOnInit(): void {
    fromEvent(window, 'scroll').pipe(debounceTime(20), takeUntil(this.onDestroy)).subscribe((event) => {
      const verticalOffset = (window.pageYOffset 
        || document.documentElement.scrollTop 
        || document.body.scrollTop || 0);
      if (verticalOffset > this.prevScrollPosition) {
        this.scrollingDirection = PAGING_DIRECTION.FORWARD;
      } else {
        this.scrollingDirection = PAGING_DIRECTION.BACKWARDS;
      }
      this.prevScrollPosition = verticalOffset;
    });
  }



  initWebtoonReader() {

    this.minPrefetchedWebtoonImage = this.pageNum;
    this.maxPrefetchedWebtoonImage = Number.MIN_SAFE_INTEGER;
    this.webtoonImages.next([]);
    // Disconnect all the observers until we re-render everything
    this.intersectionObserver.disconnect();


    const prefetchStart = Math.max(this.pageNum - this.buffferPages, 0);
    const prefetchMax =  Math.min(this.pageNum + this.buffferPages, this.totalPages); 
    console.log('[INIT] Prefetching pages ' + prefetchStart + ' to ' + prefetchMax + '. Current page: ', this.pageNum);
    for(let i = prefetchStart; i < prefetchMax; i++) {
      this.prefetchWebtoonImage(i);
    }
    
    this.minPrefetchedWebtoonImage = prefetchStart;
    this.maxPrefetchedWebtoonImage = prefetchMax;
  }

  /**
   * Callback for an image onLoad. At this point the image is already rendered in DOM (may not be visible)
   * This will be used to scroll to current page for intial load
   * @param event 
   */
  onImageLoad(event: any) {
    const imagePage = this.readerService.imageUrlToPageNum(event.target.src);
    console.log('Image loaded: ', imagePage);

    if (imagePage === this.pageNum) {
      console.log('! Loaded current page !');
      this.scrollToCurrentPage();
    }

  }

  handleIntersection(entries: IntersectionObserverEntry[]) {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const imagePage = parseInt(entry.target.attributes.getNamedItem('page')?.value + '', 10);
        console.log('[Intersection] ! Page ' + imagePage + ' just entered screen');
        console.log('[Intersection] ! Scrolling ' + (this.isScrollingForwards() ? 'Forward': 'Backwards'));
        
        // The problem here is that if we jump really quick, we get out of sync and these conditions don't apply
        if (this.pageNum + 1 === imagePage && this.isScrollingForwards()) {
          this.setPageNum(this.pageNum + 1);
        } else if (this.pageNum - 1 === imagePage && !this.isScrollingForwards()) {
          this.setPageNum(this.pageNum - 1);
        } else if ((imagePage >= this.pageNum + 2 && this.isScrollingForwards()) 
                  || (imagePage <= this.pageNum - 2 && !this.isScrollingForwards())) {
          //console.log('[Intersection] Scroll position got out of sync due to quick scrolling. Forcing page update');
        } else {
          return;
        }
        this.prefetchWebtoonImages();
      }
    });
  }

  setPageNum(pageNum: number) {
    this.pageNum = pageNum;
    this.pageNumberChange.emit(this.pageNum);
  }

  isScrollingForwards() {
    return this.scrollingDirection === PAGING_DIRECTION.FORWARD;
  }


  scrollToCurrentPage() {
    setTimeout(() => {
      const elem = document.querySelector('img#page-' + this.pageNum);
      if (elem) {
        console.log('[Scroll] Scrolling to Page: ', this.pageNum);
        window.scroll({
          top: elem.getBoundingClientRect().top,
          behavior: 'smooth'
        });
        // Update prevScrollPosition, so the next scroll event properly calculates direction
        this.prevScrollPosition = elem.getBoundingClientRect().top;
      }
    }, 600);
  }

  prefetchWebtoonImage(page: number) {
    let data = this.webtoonImages.value;

    data = data.concat({src: this.urlProvider(page), page});

    data.sort((a: WebtoonImage, b: WebtoonImage) => {
      if (a.page < b.page) { return -1; }
      else if (a.page > b.page) { return 1; }
      else return 0;
    });

    if (page < this.minPrefetchedWebtoonImage) {
      this.minPrefetchedWebtoonImage = page;
    }
    if (page > this.maxPrefetchedWebtoonImage) {
      this.maxPrefetchedWebtoonImage = page;
    }

    this.webtoonImages.next(data);
    this.attachIntersectionObserver(page);
  }

  attachIntersectionObserver(page: number) {
    setTimeout(() => {
      const image = document.querySelector('img#page-' + page);
      if (image !== null) {
        this.intersectionObserver.observe(image);
      }
    }, 10);
  }

  // If I scroll too fast, we don't prefetch enough
  prefetchWebtoonImages() {
    // ! Bug: This doesn't properly ensure we load pages around us. Some pages might be skipped

    let startingIndex = 0;
    let endingIndex = 0;
    if (this.isScrollingForwards()) {
      startingIndex = Math.min(this.maxPrefetchedWebtoonImage + 1, this.totalPages);
      endingIndex = Math.min(this.maxPrefetchedWebtoonImage + 1 + this.buffferPages, this.totalPages); 

      console.log('[Prefetch] moving foward, request to prefetch: ' + startingIndex + ' to ' + endingIndex);
      console.log('     [Prefetch] page num: ', this.pageNum);
      console.log('     [Prefetch] max page preloaded: ', this.maxPrefetchedWebtoonImage);

      if (startingIndex === this.totalPages) {
        console.log('    [Prefetch] DENIED');
        return;
      }
    } else {
      startingIndex = Math.max(this.minPrefetchedWebtoonImage - 1, 0) ;
      endingIndex = Math.max(this.minPrefetchedWebtoonImage - 1 - this.buffferPages, 0);

      console.log('[Prefetch] moving backwards, request to prefetch: ' + startingIndex + ' to ' + endingIndex);
      console.log('    [Prefetch] page num: ', this.pageNum);
      console.log('    [Prefetch] min page preloaded: ', this.minPrefetchedWebtoonImage);

      if (startingIndex <= 0) {
        console.log('   [Prefetch] DENIED');
        return;
      }
    }


    if (startingIndex > endingIndex) {
      const temp = startingIndex;
      startingIndex = endingIndex;
      endingIndex = temp;
    }
    console.log('[Prefetch] prefetching pages: ' + startingIndex + ' to ' + endingIndex);
    // If a request comes in to prefetch over current page +/- bufferPages (+ 1 due to requesting from next/prev page), then deny it
    if (startingIndex < this.pageNum - (this.buffferPages + 1) || endingIndex > this.pageNum + (this.buffferPages + 1)) {
      console.log('[Prefetch] A request that is too far outside buffer range has been declined', this.pageNum);
      return;
    }
    for(let i = startingIndex; i < endingIndex; i++) {
      this.prefetchWebtoonImage(i);
    }

    // if (this.isScrollingForwards()) {
    //   for(let i = startingIndex; i < endingIndex; i++) {
    //     this.prefetchWebtoonImage(i);
    //   }
    // } else {
    //   for(let i = endingIndex; i > startingIndex; i--) {
    //     this.prefetchWebtoonImage(i);
    //   }
    // }

    
    console.log('    [Prefetch] min page preloaded: ', this.minPrefetchedWebtoonImage);
    console.log('    [Prefetch] max page preloaded: ', this.maxPrefetchedWebtoonImage);
  }

}
