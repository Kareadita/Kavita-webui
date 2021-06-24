import { Component, ContentChild, ElementRef, EventEmitter, Input, OnChanges, OnDestroy, OnInit, Output, Renderer2, SimpleChanges } from '@angular/core';
import { BehaviorSubject, fromEvent, Subject } from 'rxjs';
import { debounceTime, takeUntil } from 'rxjs/operators';
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

  /**
   * Responsible for calculating current page on screen and uses hooks to trigger prefetching
   */
  intersectionObserver: IntersectionObserver = new IntersectionObserver((entries) => this.handleIntersection(entries), { threshold: [0.25] });
  /**
   * Direction we are scrolling. Controls calculations for prefetching
   */
  scrollingDirection: PAGING_DIRECTION = PAGING_DIRECTION.FORWARD;
  /**
   * Temp variable to keep track of scrolling position between scrolls to caclulate direction
   */
  prevScrollPosition: number = 0;

  /**
   * The min page number that has been prefetched
   */
  minPrefetchedWebtoonImage: number = Number.MAX_SAFE_INTEGER;
  /**
   * The max page number that has been prefetched
   */
  maxPrefetchedWebtoonImage: number = Number.MIN_SAFE_INTEGER;
  /**
   * The minimum width of images in webtoon. On image loading, this is checked and updated. All images will get this assigned to them for rendering.
   */
  webtoonImageWidth: number = window.innerWidth || document.documentElement.clientWidth || document.body.clientWidth;

  /**
   * Used to tell if a scrollTo() operation is in progress
   */
  isScrolling: boolean = false;
  /**
   * Whether all prefetched images have loaded on the screen (not neccesarily in viewport)
   */
  allImagesLoaded: boolean = false;

  /**
   * Debug mode. Will show extra information
   */
  debug: boolean = false;

  private readonly onDestroy = new Subject<void>();

  constructor(private readerService: ReaderService, private renderer: Renderer2) { }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes.hasOwnProperty('pageNum') && changes['pageNum'].previousValue != changes['pageNum'].currentValue) {
      // Manually update pageNum as we are getting notified from a parent component, hence we shouldn't invoke update
      this.setPageNum(changes['pageNum'].currentValue);
      if (Math.abs(changes['pageNum'].currentValue - changes['pageNum'].previousValue) > 2) {
        // Go to page has occured
        this.initWebtoonReader();
      }

    }
    if (changes.hasOwnProperty('totalPages') && changes['totalPages'].previousValue != changes['totalPages'].currentValue) {
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
      
        if (this.prevScrollPosition === verticalOffset) {
          this.isScrolling = false;
        }
      
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
    //console.log('[INIT] Prefetching pages ' + prefetchStart + ' to ' + prefetchMax + '. Current page: ', this.pageNum);
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
    //console.log('Image loaded: ', imagePage);


    if (event.target.width < this.webtoonImageWidth) {
      this.webtoonImageWidth = event.target.width;
    }

    this.renderer.setAttribute(event.target, 'width', this.webtoonImageWidth + '');

    if (imagePage === this.pageNum) {
      //console.log('! Loaded current page !');
      Promise.all(Array.from(document.querySelectorAll('img'))
        .filter((img: any) => !img.complete)
        .map((img: any) => new Promise(resolve => { img.onload = img.onerror = resolve; })))
        .then(() => {
          this.allImagesLoaded = true;
          this.scrollToCurrentPage();
      });
    }

  }

  handleIntersection(entries: IntersectionObserverEntry[]) {

    if (!this.allImagesLoaded || this.isScrolling) {
      //console.log('Images are not loaded (or performing scrolling action), skipping any scroll calculations');
      return;
    }

    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const imagePage = parseInt(entry.target.attributes.getNamedItem('page')?.value + '', 10);
        //console.log('[Intersection] ! Page ' + imagePage + ' just entered screen');
        
        // The problem here is that if we jump really quick, we get out of sync and these conditions don't apply, hence the forcing of page number
        if (this.pageNum + 1 === imagePage && this.isScrollingForwards()) {
          this.setPageNum(this.pageNum + 1);
        } else if (this.pageNum - 1 === imagePage && !this.isScrollingForwards()) {
          this.setPageNum(this.pageNum - 1);
        } else if ((imagePage >= this.pageNum + 2 && this.isScrollingForwards()) 
                  || (imagePage <= this.pageNum - 2 && !this.isScrollingForwards())) {
          //console.log('[Intersection] Scroll position got out of sync due to quick scrolling. Forcing page update');
          this.setPageNum(imagePage);
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
        // Update prevScrollPosition, so the next scroll event properly calculates direction
        this.prevScrollPosition = elem.getBoundingClientRect().top;
        this.isScrolling = true;
        elem.scrollIntoView({behavior: 'smooth'});
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
    this.allImagesLoaded = false;

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

  prefetchWebtoonImages() {
    let startingIndex = 0;
    let endingIndex = 0;
    if (this.isScrollingForwards()) {
      startingIndex = Math.min(this.maxPrefetchedWebtoonImage + 1, this.totalPages);
      endingIndex = Math.min(this.maxPrefetchedWebtoonImage + 1 + this.buffferPages, this.totalPages); 

      if (startingIndex === this.totalPages) {
        return;
      }
    } else {
      startingIndex = Math.max(this.minPrefetchedWebtoonImage - 1, 0) ;
      endingIndex = Math.max(this.minPrefetchedWebtoonImage - 1 - this.buffferPages, 0);

      if (startingIndex <= 0) {
        return;
      }
    }


    if (startingIndex > endingIndex) {
      const temp = startingIndex;
      startingIndex = endingIndex;
      endingIndex = temp;
    }
    // console.log('[Prefetch] prefetching pages: ' + startingIndex + ' to ' + endingIndex);
    // console.log('     [Prefetch] page num: ', this.pageNum);
    // If a request comes in to prefetch over current page +/- bufferPages (+ 1 due to requesting from next/prev page), then deny it
    // console.log('     [Prefetch] Caps: ' + (this.pageNum - (this.buffferPages + 1)) + ' - ' + (this.pageNum + (this.buffferPages + 1)));
    if (this.isScrollingForwards() && startingIndex > this.pageNum + (this.buffferPages + 1)) {
      // console.log('[Prefetch] A request that is too far outside buffer range has been declined', this.pageNum);
      return;
    }
    if (!this.isScrollingForwards() && endingIndex < (this.pageNum - (this.buffferPages + 1))) {
      // console.log('[Prefetch] A request that is too far outside buffer range has been declined', this.pageNum);
      return;
    }
    for(let i = startingIndex; i < endingIndex; i++) {
      this.prefetchWebtoonImage(i);
    }

    Promise.all(Array.from(document.querySelectorAll('img'))
      .filter((img: any) => !img.complete)
      .map((img: any) => new Promise(resolve => { img.onload = img.onerror = resolve; })))
      .then(() => {
        this.allImagesLoaded = true;
    });
  }

}
