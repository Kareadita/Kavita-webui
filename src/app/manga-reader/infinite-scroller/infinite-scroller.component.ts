import { Component, EventEmitter, Input, OnChanges, OnDestroy, OnInit, Output, SimpleChanges } from '@angular/core';
import { BehaviorSubject, fromEvent, Subject } from 'rxjs';
import { debounceTime, takeUntil, take } from 'rxjs/operators';
import { CircularArray } from 'src/app/shared/data-structures/circular-array';
import { READER_MODE } from 'src/app/_models/preferences/reader-mode';
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

  
  webtoonImagesLoaded: boolean = false;
  minPrefetchedWebtoonImage: number = -1;
  maxPrefetchedWebtoonImage: number = -1;
  webtoonImageWidth: number = window.innerWidth || document.documentElement.clientWidth || document.body.clientWidth;

  private readonly onDestroy = new Subject<void>();

  constructor() { }

  ngOnChanges(changes: SimpleChanges): void {
    console.log('changes: ', changes);
    if (changes.hasOwnProperty('pageNum') && changes['pageNum'].previousValue != changes['pageNum'].currentValue) {
      // Manually update pageNum as we are getting notified from a parent component, hence we shouldn't invoke update
      this.setPageNum(changes['pageNum'].currentValue);
      this.scrollToCurrentPage();
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
    // ? If page is already prefetched, just scroll to it and don't reset the array

    this.minPrefetchedWebtoonImage = this.pageNum;
    this.maxPrefetchedWebtoonImage = -1;
    this.webtoonImages.next([]);

    //this.images = new CircularArray<HTMLImageElement>([], 0);
    const images = [];
    for (let i = 0; i < this.buffferPages * 2; i++) {
      const img = new Image();
      img.onload = (ev: Event) => {
        this.onImageLoad(ev);
      }
      images.push(img);
    }

    this.images = new CircularArray<HTMLImageElement>(images, 0);

    const prefetchStart = Math.max(this.pageNum - this.buffferPages, 0);
    const prefetchMax =  Math.min(this.pageNum + this.buffferPages, this.totalPages); 
    // console.log('[INIT] Prefetching pages ' + prefetchStart + ' to ' + prefetchMax + '. Current page: ', this.pageNum);
    // for(let i = prefetchStart; i < prefetchMax; i++) {
    //   this.prefetchWebtoonImage(i);
    // }
    let index = - 3 ;
    this.images.applyFor((item, i) => {
      const offsetIndex = Math.min(Math.max(this.pageNum + index, 0), this.totalPages);
      const urlPageNum = this.imageUrlToPageNum(item.src);
      if (urlPageNum === offsetIndex) {
        index += 1;
        return;
      }
      if (offsetIndex < this.totalPages - 1) {
        item.src = this.urlProvider(offsetIndex);
        index += 1;
      }
    }, this.images.size() - 3);
    console.log('images: ', this.images.arr.map((item: any) => this.imageUrlToPageNum(item.src)));
    this.minPrefetchedWebtoonImage = prefetchStart;
    this.maxPrefetchedWebtoonImage = prefetchMax;

    this.webtoonImagesLoaded = false;


    this.scrollToCurrentPage();
  }

  imageUrlToPageNum(imageSrc: string) {
    // TODO: Move this to reader service
    if (imageSrc === undefined || imageSrc === '') { return -1; }
    return parseInt(imageSrc.split('&page=')[1], 10);
  }

  onImageLoad(event: any) {
    const imagePage = this.imageUrlToPageNum(event.target.src);
    console.log('Image loaded: ', imagePage);
    // Problem with this is that we cannot control the order in which we insert
    this.prefetchWebtoonImage(imagePage, imagePage >= this.pageNum);

  }

  handleIntersection(entries: IntersectionObserverEntry[]) {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const imagePage = parseInt(entry.target.attributes.getNamedItem('page')?.value + '', 10);
        console.log('[Intersection] Page ' + imagePage + ' just entered screen');
        
        // The problem here is that if we jump really quick, we get out of sync and these conditions don't apply
        if (this.pageNum + 1 === imagePage && this.isScrollingForwards()) {
          this.setPageNum(this.pageNum + 1);
        } else if (this.pageNum - 1 === imagePage && !this.isScrollingForwards()) {
          this.setPageNum(this.pageNum - 1);
        } else if ((imagePage >= this.pageNum + 2 && this.isScrollingForwards()) 
                  || (imagePage <= this.pageNum - 2 && !this.isScrollingForwards())) {
          console.log('[Intersection] Scroll position got out of sync due to quick scrolling. Forcing page update');
          // This almost works. When we use gotopage it causes issues
          // if (!this.webtoonImagesLoaded) { 
          //   console.log('[Intersection] returned early');
          //   return;
          // }
          //console.log('[Intersection] not returned early');
          //this.setPageNum(imagePage);
          
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
    return;
    setTimeout(() => {


      // this.webtoonImagesLoaded = false;
      // Array.from(document.querySelectorAll('.webtoon-images img')).forEach(elem => this.intersectionObserver.unobserve(elem));
      // Promise.all(Array.from(document.querySelectorAll('.webtoon-images img')).filter((img: any) => !img.complete)
      //   .map((img: any) => new Promise(resolve => { img.onload = img.onerror = resolve; }))).then(() => {
      //     Array.from(document.querySelectorAll('.webtoon-images img')).forEach(elem => this.intersectionObserver.observe(elem));
      //     this.webtoonImagesLoaded = true;
      // });

      const elem = document.querySelector('img#page-' + this.pageNum);
      if (elem) {
        console.log('[Scroll] Scrolling to Page: ', this.pageNum);
        window.scroll({
          top: elem.getBoundingClientRect().top,
          behavior: 'smooth'
        });
      } else {
        //console.log('[Scroll] Trying to Scroll to Page: ' + this.pageNum + ', element not found. Rescheduling in 3 seconds');
        //this.scrollToCurrentPage();
      }
    }, 400);
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
    if (this.isScrollingForwards()) {
      for(let i = startingIndex; i < endingIndex; i++) {
        this.prefetchWebtoonImage(i);
      }
    } else {
      for(let i = endingIndex; i > startingIndex; i--) {
        this.prefetchWebtoonImage(i);
      }
    }

    
    console.log('    [Prefetch] min page preloaded: ', this.minPrefetchedWebtoonImage);
    console.log('    [Prefetch] max page preloaded: ', this.maxPrefetchedWebtoonImage);
  }

}
