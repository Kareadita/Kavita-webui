import { AfterViewInit, Component, ElementRef, HostListener, OnDestroy, OnInit, Renderer2, ViewChild } from '@angular/core';
import {Location} from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { debounceTime, take, takeUntil } from 'rxjs/operators';
import { User } from '../_models/user';
import { AccountService } from '../_services/account.service';
import { ReaderService } from '../_services/reader.service';
import { SeriesService } from '../_services/series.service';
import { FormBuilder, FormGroup } from '@angular/forms';
import { NavService } from '../_services/nav.service';
import { Chapter } from '../_models/chapter';
import { ReadingDirection } from '../_models/preferences/reading-direction';
import { ScalingOption } from '../_models/preferences/scaling-option';
import { PageSplitOption } from '../_models/preferences/page-split-option';
import { BehaviorSubject, forkJoin, fromEvent, Subject } from 'rxjs';
import { ToastrService } from 'ngx-toastr';
import { KEY_CODES } from '../shared/_services/utility.service';
import { CircularArray } from '../shared/data-structures/circular-array';
import { MemberService } from '../_services/member.service';
import { Stack } from '../shared/data-structures/stack';
import { ChangeContext, LabelType, Options } from '@angular-slider/ngx-slider';
import { trigger, state, style, transition, animate } from '@angular/animations';
import { ChpaterInfo } from './_models/chapter-info';
import { IInfiniteScrollEvent } from 'ngx-infinite-scroll';

const PREFETCH_PAGES = 3;

enum FITTING_OPTION {
  HEIGHT = 'full-height',
  WIDTH = 'full-width',
  ORIGINAL = 'original'
}

enum SPLIT_PAGE_PART {
  NO_SPLIT = 'none',
  LEFT_PART = 'left',
  RIGHT_PART = 'right'
}

enum PAGING_DIRECTION {
  FORWARD = 1,
  BACKWARDS = -1,
}

enum COLOR_FILTER {
  NONE = '',
  SEPIA = 'filter-sepia',
  DARK = 'filter-dark'
}

enum READER_MODE {
  /**
   * Manga default left/right to page
   */
  MANGA_LR = 0,
  /**
   * Manga up and down to page
   */
  MANGA_UD = 1,
  /**
   * Webtoon reading (scroll) with optional areas to tap
   */
  WEBTOON = 2
}

const CHAPTER_ID_NOT_FETCHED = -2;
const CHAPTER_ID_DOESNT_EXIST = -1;

const ANIMATION_SPEED = 200;
const OVERLAY_AUTO_CLOSE_TIME = 6000;

interface WebtoonImage {
  src: string;
  page: number;
}


@Component({
  selector: 'app-manga-reader',
  templateUrl: './manga-reader.component.html',
  styleUrls: ['./manga-reader.component.scss'],
  animations: [
    trigger('slideFromTop', [
      state('in', style({ transform: 'translateY(0)'})),
      transition('void => *', [
        style({ transform: 'translateY(-100%)' }),
        animate(ANIMATION_SPEED)
      ]),
      transition('* => void', [
        animate(ANIMATION_SPEED, style({ transform: 'translateY(-100%)' })),
      ])
    ]),
    trigger('slideFromBottom', [
      state('in', style({ transform: 'translateY(0)'})),
      transition('void => *', [
        style({ transform: 'translateY(100%)' }),
        animate(ANIMATION_SPEED)
      ]),
      transition('* => void', [
        animate(ANIMATION_SPEED, style({ transform: 'translateY(100%)' })),
      ])
    ])
  ]
})
export class MangaReaderComponent implements OnInit, AfterViewInit, OnDestroy {
  libraryId!: number;
  seriesId!: number;
  volumeId!: number;
  chapterId!: number;
  chapter!: Chapter;

  pageNum = 0;
  maxPages = 1;
  user!: User;
  fittingForm: FormGroup | undefined;
  splitForm: FormGroup | undefined;

  readingDirection = ReadingDirection.LeftToRight;
  scalingOption = ScalingOption.FitToHeight;
  pageSplitOption = PageSplitOption.SplitRightToLeft;

  currentImageSplitPart: SPLIT_PAGE_PART = SPLIT_PAGE_PART.NO_SPLIT;
  pagingDirection: PAGING_DIRECTION = PAGING_DIRECTION.FORWARD;

  menuOpen = false;
  isLoading = true; 

  @ViewChild('content') canvas: ElementRef | undefined;
  private ctx!: CanvasRenderingContext2D;
  private canvasImage = new Image();

  cachedImages!: CircularArray<HTMLImageElement>; // This is a circular array of size PREFETCH_PAGES + 2
  continuousChaptersStack: Stack<number> = new Stack();
  /**
   * Stores and emits all the src urls
   */
  webtoonImages: BehaviorSubject<WebtoonImage[]> = new BehaviorSubject<WebtoonImage[]>([]);

  // Temp hack: Override background color for reader and restore it onDestroy
  originalBodyColor: string | undefined;

  prevPageDisabled = false;
  nextPageDisabled = false;

  pageOptions: Options = {
    floor: 1,
    ceil: 0,
    step: 1,
    showSelectionBar: true,
    translate: (value: number, label: LabelType) => {
      if (value === 1 || value === this.maxPages) {
        return value + '';
      }
      return (value + 1) + '';
    },
    animate: false
  };

  chapterInfo!: ChpaterInfo;
  title: string = '';
  subtitle: string = '';

  colorMode: COLOR_FILTER = COLOR_FILTER.NONE; // TODO: Move this into User Preferences

  // These are not garunteed to be valid ChapterIds. Prefetch them on page load (non-blocking). -1 means doesn't exist, -2 means not yet fetched.
  nextChapterId: number = CHAPTER_ID_NOT_FETCHED;
  prevChapterId: number = CHAPTER_ID_NOT_FETCHED;
  // Used to keep track of if you can move to the next/prev chapter
  nextChapterDisabled: boolean = false;
  prevChapterDisabled: boolean = false;
  nextChapterPrefetched: boolean = false;

  // Whether extended settings area is showing
  settingsOpen: boolean = false;

  readerMode: READER_MODE = READER_MODE.WEBTOON; // TODO: Revert this
  minPrefetchedWebtoonImage: number = -1;
  maxPrefetchedWebtoonImage: number = -1;

  /**
   * Timeout id for auto-closing menu overlay
   */
  menuTimeout: any;

  /**
   * Whether the click areas show
   */
  showClickOverlay: boolean = false;

  private readonly onDestroy = new Subject<void>();



  get splitIconClass() {
    if (this.isSplitLeftToRight()) {
      return 'left-side';
    } else if (this.isNoSplit()) {
      return 'none';  
    }
    return 'right-side';
  }

  get ReadingDirection(): typeof ReadingDirection {
    return ReadingDirection;
  };

  get colorOptionName() {
    switch(this.colorMode) {
      case COLOR_FILTER.NONE:
        return 'None';
      case COLOR_FILTER.DARK:
        return 'Dark';
      case COLOR_FILTER.SEPIA:
        return 'Sepia';
    }
  }

  get READER_MODE(): typeof READER_MODE {
    return READER_MODE;
  }


  constructor(private route: ActivatedRoute, private router: Router, private accountService: AccountService,
              private seriesService: SeriesService, public readerService: ReaderService, private location: Location,
              private formBuilder: FormBuilder, private navService: NavService, private toastr: ToastrService,
              private memberService: MemberService, private renderer: Renderer2) {
                this.navService.hideNavBar();
  }

  ngOnInit(): void {
    const libraryId = this.route.snapshot.paramMap.get('libraryId');
    const seriesId = this.route.snapshot.paramMap.get('seriesId');
    const chapterId = this.route.snapshot.paramMap.get('chapterId');

    if (libraryId === null || seriesId === null || chapterId === null) {
      this.router.navigateByUrl('/home');
      return;
    }

    this.libraryId = parseInt(libraryId, 10);
    this.seriesId = parseInt(seriesId, 10);
    this.chapterId = parseInt(chapterId, 10);

    this.continuousChaptersStack.push(this.chapterId);

    this.setOverrideStyles();

    this.accountService.currentUser$.pipe(take(1)).subscribe(user => {
      if (user) {
        this.user = user;
        this.readingDirection = this.user.preferences.readingDirection;
        this.scalingOption = this.user.preferences.scalingOption;
        this.pageSplitOption = this.user.preferences.pageSplitOption;
        this.fittingForm = this.formBuilder.group({
          fittingOption: this.translateScalingOption(this.scalingOption)
        });
        this.splitForm = this.formBuilder.group({
          pageSplitOption: this.pageSplitOption + ''
        });
        // On change of splitting, re-render the page if the page is already split
        this.splitForm.valueChanges.subscribe(changes => {
          const needsSplitting = this.canvasImage.width > this.canvasImage.height;
          if (needsSplitting) {
            this.loadPage();
          }
        });
        this.memberService.hasReadingProgress(this.libraryId).subscribe(progress => {
          if (!progress) {
            this.toggleMenu();
            this.toastr.info('Tap the image at any time to open the menu. You can configure different settings or go to page by clicking progress bar. Tap sides of image move to next/prev page.');
          }
        });
      }
    });


    this.init();
  }

  ngAfterViewInit() {
    if (!this.canvas) {
      return;
    }
    this.ctx = this.canvas.nativeElement.getContext('2d', { alpha: false });
    this.canvasImage.onload = () => this.renderPage();
  }

  ngOnDestroy() {
    const bodyNode = document.querySelector('body');
    if (bodyNode !== undefined && bodyNode !== null && this.originalBodyColor !== undefined) {
      bodyNode.style.background = this.originalBodyColor;
    }
    this.navService.showNavBar();
    this.onDestroy.next();
  }

  @HostListener('window:keyup', ['$event'])
  handleKeyPress(event: KeyboardEvent) {
    if (event.key === KEY_CODES.RIGHT_ARROW || event.key === KEY_CODES.DOWN_ARROW) {
      this.readingDirection === ReadingDirection.LeftToRight ? this.nextPage() : this.prevPage();
    } else if (event.key === KEY_CODES.LEFT_ARROW || event.key === KEY_CODES.UP_ARROW) {
      this.readingDirection === ReadingDirection.LeftToRight ? this.prevPage() : this.nextPage();
    } else if (event.key === KEY_CODES.ESC_KEY) {
      if (this.menuOpen) {
        this.toggleMenu();
        event.stopPropagation();
        event.preventDefault();
        return;
      }
      this.closeReader();
    } else if (event.key === KEY_CODES.SPACE) {
      this.toggleMenu();
    } else if (event.key === KEY_CODES.G) {
      const goToPageNum = this.promptForPage();
      if (goToPageNum === null) { return; }
      this.goToPage(parseInt(goToPageNum.trim(), 10));
    }
  }

  init() {
    this.nextChapterId = CHAPTER_ID_NOT_FETCHED;
    this.prevChapterId = CHAPTER_ID_NOT_FETCHED;
    this.nextChapterDisabled = false;
    this.prevChapterDisabled = false;
    this.nextChapterPrefetched = false;
    this.pageNum = 1;

    forkJoin({
      chapter: this.seriesService.getChapter(this.chapterId),
      bookmark: this.readerService.getBookmark(this.chapterId),
      chapterInfo: this.readerService.getChapterInfo(this.chapterId)
    }).subscribe(results => {
      this.chapter = results.chapter;
      this.volumeId = results.chapter.volumeId;
      this.maxPages = results.chapter.pages;
      this.pageOptions.ceil = this.maxPages;

      let page = results.bookmark.pageNum;
      if (page >= this.maxPages) {
        page = this.maxPages - 1;
      }
      this.setPageNum(page);

      // Due to change detection rules in Angular, we need to re-create the options object to apply the change
      const newOptions: Options = Object.assign({}, this.pageOptions);
      newOptions.ceil = this.maxPages;
      this.pageOptions = newOptions;

      this.updateTitle(results.chapterInfo);

      this.readerService.getNextChapter(this.seriesId, this.volumeId, this.chapterId).subscribe(chapterId => {
        this.nextChapterId = chapterId;
        if (chapterId === CHAPTER_ID_DOESNT_EXIST) {
          this.nextChapterDisabled = true;
        }
      });
      this.readerService.getPrevChapter(this.seriesId, this.volumeId, this.chapterId).subscribe(chapterId => {
        this.prevChapterId = chapterId;
        if (chapterId === CHAPTER_ID_DOESNT_EXIST) {
          this.prevChapterDisabled = true;
        }
      });

      // ! Should I move the prefetching code if we start in webtoon reader mode? 
      const images = [];
      for (let i = 0; i < PREFETCH_PAGES + 2; i++) {
        images.push(new Image());
      }

      this.cachedImages = new CircularArray<HTMLImageElement>(images, 0);



      if (this.readerMode === READER_MODE.WEBTOON) {
        this.initWebtoonReader();
        this.isLoading = false;
      } else {
        this.loadPage();
      }
    }, () => {
      setTimeout(() => {
        this.closeReader();
      }, 200);
    });
  }

  closeReader() {
    this.location.back();
  }

  setOverrideStyles() {
    const bodyNode = document.querySelector('body');
    if (bodyNode !== undefined && bodyNode !== null) {
      this.originalBodyColor = bodyNode.style.background;
      bodyNode.setAttribute('style', 'background-color: black !important');
    }
  }

  updateTitle(chapterInfo: ChpaterInfo) {
    this.chapterInfo = chapterInfo;
      this.title = chapterInfo.seriesName;
      if (this.chapterInfo.chapterTitle.length > 0) {
        this.title + ' - ' + this.chapterInfo.chapterTitle;
      }

      this.subtitle = '';
      if (this.chapterInfo.isSpecial && this.chapterInfo.volumeNumber === '0') {
        this.subtitle = this.chapterInfo.fileName;
      } else if (!this.chapterInfo.isSpecial && this.chapterInfo.volumeNumber === '0') {
        this.subtitle = 'Chapter ' + this.chapterInfo.chapterNumber;
      } else {
        this.subtitle = 'Volume ' + this.chapterInfo.volumeNumber;

        if (this.chapterInfo.chapterNumber !== '0') {
          this.subtitle += ' Chapter ' + this.chapterInfo.chapterNumber;
        }
      }
  }

  translateScalingOption(option: ScalingOption) {
    switch (option) {
      case (ScalingOption.Automatic):
      {
        const windowWidth = window.innerWidth
                  || document.documentElement.clientWidth
                  || document.body.clientWidth;
        const windowHeight = window.innerHeight
                  || document.documentElement.clientHeight
                  || document.body.clientHeight;

        const ratio = windowWidth / windowHeight;
        if (windowHeight > windowWidth) {
          return FITTING_OPTION.WIDTH;
        }

        if (windowWidth >= windowHeight || ratio > 1.0) {
          return FITTING_OPTION.HEIGHT;
        }
        return FITTING_OPTION.WIDTH;
      }
      case (ScalingOption.FitToHeight):
        return FITTING_OPTION.HEIGHT;
      case (ScalingOption.FitToWidth):
        return FITTING_OPTION.WIDTH;
      default:
        return FITTING_OPTION.ORIGINAL;
    }
  }

  getFittingOptionClass() {
    if (this.fittingForm === undefined) {
      return FITTING_OPTION.HEIGHT;
    }
    return this.fittingForm.value.fittingOption;
  }

  getFittingIcon() {
    let value = FITTING_OPTION.HEIGHT;
    if (this.fittingForm !== undefined) {
      value = this.fittingForm.value.fittingOption
    }
    
    switch(value) {
      case FITTING_OPTION.HEIGHT:
        return 'fa-arrows-alt-v';
      case FITTING_OPTION.WIDTH:
        return 'fa-arrows-alt-h';
      case FITTING_OPTION.ORIGINAL:
        return 'fa-expand-arrows-alt';
    }
  }

  /**
   * Whenever the menu is interacted with, restart the timer. However if the settings menu is open, don't restart, just cancel the timeout.
   */
  resetMenuCloseTimer() {
    if (this.menuTimeout) {
      clearTimeout(this.menuTimeout);
      if (!this.settingsOpen) {
        this.startMenuCloseTimer();
      }
    }
  }

  startMenuCloseTimer() {
    this.menuTimeout = setTimeout(() => {
      this.toggleMenu();
    }, OVERLAY_AUTO_CLOSE_TIME);
  }

  
  
  toggleMenu() {
    this.menuOpen = !this.menuOpen;
    if (this.menuTimeout) {
      clearTimeout(this.menuTimeout);
    }

    if (this.menuOpen && !this.settingsOpen) {
      this.startMenuCloseTimer();
    } else {
      this.showClickOverlay = false;
      this.settingsOpen = false;
    }
  }

  isSplitLeftToRight() {
    return (this.splitForm?.get('pageSplitOption')?.value + '') === (PageSplitOption.SplitLeftToRight + '');
  }

  isNoSplit() {
    return (this.splitForm?.get('pageSplitOption')?.value + '') === (PageSplitOption.NoSplit + '');
  }

  updateSplitPage() {
    const needsSplitting = this.canvasImage.width > this.canvasImage.height;
    if (!needsSplitting || this.isNoSplit()) {
      this.currentImageSplitPart = SPLIT_PAGE_PART.NO_SPLIT;
      return;
    }

    if (this.pagingDirection === PAGING_DIRECTION.FORWARD) {
      switch (this.currentImageSplitPart) {
        case SPLIT_PAGE_PART.NO_SPLIT:
          this.currentImageSplitPart = this.isSplitLeftToRight() ? SPLIT_PAGE_PART.LEFT_PART : SPLIT_PAGE_PART.RIGHT_PART;
          break;
        case SPLIT_PAGE_PART.LEFT_PART:
          const r2lSplittingPart = (needsSplitting ? SPLIT_PAGE_PART.RIGHT_PART : SPLIT_PAGE_PART.NO_SPLIT);
          this.currentImageSplitPart = this.isSplitLeftToRight() ? SPLIT_PAGE_PART.RIGHT_PART : r2lSplittingPart;
          break;
        case SPLIT_PAGE_PART.RIGHT_PART:
          const l2rSplittingPart = (needsSplitting ? SPLIT_PAGE_PART.LEFT_PART : SPLIT_PAGE_PART.NO_SPLIT);
          this.currentImageSplitPart = this.isSplitLeftToRight() ? l2rSplittingPart : SPLIT_PAGE_PART.LEFT_PART;
          break;
      }
    } else if (this.pagingDirection === PAGING_DIRECTION.BACKWARDS) {
      switch (this.currentImageSplitPart) {
        case SPLIT_PAGE_PART.NO_SPLIT:
          this.currentImageSplitPart = this.isSplitLeftToRight() ? SPLIT_PAGE_PART.RIGHT_PART : SPLIT_PAGE_PART.LEFT_PART;
          break;
        case SPLIT_PAGE_PART.LEFT_PART:
          const l2rSplittingPart = (needsSplitting ? SPLIT_PAGE_PART.RIGHT_PART : SPLIT_PAGE_PART.NO_SPLIT);
          this.currentImageSplitPart = this.isSplitLeftToRight() ? l2rSplittingPart : SPLIT_PAGE_PART.RIGHT_PART;
          break;
        case SPLIT_PAGE_PART.RIGHT_PART:
          this.currentImageSplitPart = this.isSplitLeftToRight() ? SPLIT_PAGE_PART.LEFT_PART : (needsSplitting ? SPLIT_PAGE_PART.LEFT_PART : SPLIT_PAGE_PART.NO_SPLIT);
          break;
      }
    }
  }

  handlePageChange(event: any, direction: string) {
    if (this.readerMode === READER_MODE.WEBTOON) {
      if (direction === 'right') {
        this.nextPage(event);
      } else {
        this.prevPage(event);
      }
      return;
    }
    if (direction === 'right') {
      this.readingDirection === ReadingDirection.LeftToRight ? this.nextPage(event) : this.prevPage(event);
    } else if (direction === 'left') {
      this.readingDirection === ReadingDirection.LeftToRight ? this.prevPage(event) : this.nextPage(event);
    }
  }

  nextPage(event?: any) {
    if (event) {
      event.stopPropagation();
      event.preventDefault();
    }

    const notInSplit = this.currentImageSplitPart !== (this.isSplitLeftToRight() ? SPLIT_PAGE_PART.LEFT_PART : SPLIT_PAGE_PART.RIGHT_PART);

    if ((this.pageNum + 1 >= this.maxPages && notInSplit) || this.isLoading) {

      if (this.isLoading) { return; }

      // Move to next volume/chapter automatically
      if (!this.nextPageDisabled) {
        this.isLoading = true;
        if (this.nextChapterId === CHAPTER_ID_NOT_FETCHED) {
          this.readerService.getNextChapter(this.seriesId, this.volumeId, this.chapterId).subscribe(chapterId => {
            this.nextChapterId = chapterId;
            this.loadChapter(chapterId, 'next');
          });
        } else {
          this.loadChapter(this.nextChapterId, 'next');
        }
        
      }
      return;
    }

    this.pagingDirection = PAGING_DIRECTION.FORWARD;
    if (this.isNoSplit() || notInSplit) {
      this.setPageNum(this.pageNum + 1);
      if (this.readerMode !== READER_MODE.WEBTOON) {
        this.canvasImage = this.cachedImages.next();
      }
    }

    if (this.readerMode !== READER_MODE.WEBTOON) {
      this.loadPage();
    }    
  }

  prevPage(event?: any) {
    if (event) {
      event.stopPropagation();
      event.preventDefault();
    }

    const notInSplit = this.currentImageSplitPart !== (this.isSplitLeftToRight() ? SPLIT_PAGE_PART.RIGHT_PART : SPLIT_PAGE_PART.LEFT_PART);

    if ((this.pageNum - 1 < 0 && notInSplit) || this.isLoading) {

      if (this.isLoading) { return; }

      // Move to next volume/chapter automatically
      if (!this.prevPageDisabled) {
        this.isLoading = true;
        this.continuousChaptersStack.pop();
        const prevChapter = this.continuousChaptersStack.peek();
        if (prevChapter != this.chapterId) {
          if (prevChapter !== undefined) {
            this.chapterId = prevChapter;
            this.init();
            return;
          }
        }

        if (this.prevChapterId === CHAPTER_ID_NOT_FETCHED) {
          this.readerService.getPrevChapter(this.seriesId, this.volumeId, this.chapterId).subscribe(chapterId => {
            this.prevChapterId = chapterId;
            this.loadChapter(chapterId, 'prev');
          });
        } else {
          this.loadChapter(this.prevChapterId, 'prev');
        }
      }
      return;
    }

    this.pagingDirection = PAGING_DIRECTION.BACKWARDS;
    if (this.isNoSplit() || notInSplit) {
      this.setPageNum(this.pageNum - 1);
      this.canvasImage = this.cachedImages.prev();
    }

    this.loadPage();
  }

  loadChapter(chapterId: number, direction: 'next' | 'prev') {
    if (chapterId >= 0) {
      this.chapterId = chapterId;
      this.continuousChaptersStack.push(chapterId);
      // Load chapter Id onto route but don't reload
      const lastSlashIndex = this.router.url.lastIndexOf('/');
      const newRoute = this.router.url.substring(0, lastSlashIndex + 1) + this.chapterId + '';
      window.history.replaceState({}, '', newRoute);
      this.init();
    } else {
      // This should never happen since we prefetch chapter ids
      this.toastr.warning('Could not find ' + direction + ' chapter')
      this.isLoading = false;
      if (direction === 'prev') {
        this.prevPageDisabled = true;
      } else {
        this.nextPageDisabled = true;
      }
      
    }
  }

  renderPage() {
    if (this.ctx && this.canvas) {
      this.canvasImage.onload = null;
      this.canvas.nativeElement.width = this.canvasImage.width;
      this.canvas.nativeElement.height = this.canvasImage.height;
      const needsSplitting = this.canvasImage.width > this.canvasImage.height;
      this.updateSplitPage();

      if (needsSplitting && this.currentImageSplitPart === SPLIT_PAGE_PART.LEFT_PART) {
        this.canvas.nativeElement.width = this.canvasImage.width / 2;
        this.ctx.drawImage(this.canvasImage, 0, 0, this.canvasImage.width, this.canvasImage.height, 0, 0, this.canvasImage.width, this.canvasImage.height);
      } else if (needsSplitting && this.currentImageSplitPart === SPLIT_PAGE_PART.RIGHT_PART) {
        this.canvas.nativeElement.width = this.canvasImage.width / 2;
        this.ctx.drawImage(this.canvasImage, 0, 0, this.canvasImage.width, this.canvasImage.height, -this.canvasImage.width / 2, 0, this.canvasImage.width, this.canvasImage.height);
      } else {
        this.ctx.drawImage(this.canvasImage, 0, 0);
      }
    }
    this.isLoading = false;
  }

  imageUrlToPageNum(imageSrc: string) {
    if (imageSrc === undefined || imageSrc === '') { return -1; }
    return parseInt(imageSrc.split('&page=')[1], 10);
  }

  prefetch() {
    let index = 1;

    this.cachedImages.applyFor((item, i) => {
      const offsetIndex = this.pageNum + index;
      const urlPageNum = this.imageUrlToPageNum(item.src);
      if (urlPageNum === offsetIndex) {
        index += 1;
        return;
      }
      if (offsetIndex < this.maxPages - 1) {
        item.src = this.readerService.getPageUrl(this.chapterId, offsetIndex);
        index += 1;
      }
    }, this.cachedImages.size() - 3);
  }

  loadPage() {
    if (!this.canvas || !this.ctx) { return; }

    // Due to the fact that we start at image 0, but page 1, we need the last page to be bookmarked as page + 1 to be completed
    let pageNum = this.pageNum;
    if (this.pageNum == this.maxPages - 1) {
      pageNum = this.pageNum + 1;
    }


    this.readerService.bookmark(this.seriesId, this.volumeId, this.chapterId, pageNum).subscribe(() => {/* No operation */});

    this.isLoading = true;
    this.canvasImage = this.cachedImages.current();
    if (this.imageUrlToPageNum(this.canvasImage.src) !== this.pageNum || this.canvasImage.src === '' || !this.canvasImage.complete) {
      this.canvasImage.src = this.readerService.getPageUrl(this.chapterId, this.pageNum);
      this.canvasImage.onload = () => this.renderPage();
    } else {
      this.renderPage();
    }
    this.prefetch();
  }

  setReadingDirection() {
    if (this.readingDirection === ReadingDirection.LeftToRight) {
      this.readingDirection = ReadingDirection.RightToLeft;
    } else {
      this.readingDirection = ReadingDirection.LeftToRight;
    }

    // TODO: Apply an overlay for a fixed amount of time showing click areas
    if (this.menuOpen) {
      this.showClickOverlay = true;
      // setTimeout(() => {
      //   this.showClickOverlay = false;
      // }, 3000);
    }
  }

  

  sliderPageUpdate(context: ChangeContext) {
    const page = context.value;
    
    if (page > this.pageNum) {
      this.pagingDirection = PAGING_DIRECTION.FORWARD;
    } else {
      this.pagingDirection = PAGING_DIRECTION.BACKWARDS;
    }

    this.setPageNum(page);
    if (this.readerMode === READER_MODE.WEBTOON) {
      this.initWebtoonReader();
    } else {
      this.loadPage();
    }
  }

  setPageNum(pageNum: number) {
    this.pageNum = pageNum;

    if (this.pageNum >= this.maxPages - 10) {
      // Tell server to cache the next chapter
      if (this.nextChapterId > 0 && !this.nextChapterPrefetched) {
        this.readerService.getChapterInfo(this.nextChapterId).subscribe(res => {
          this.nextChapterPrefetched = true;
        });
      }
    }
  }

  goToPage(pageNum: number) {
    let page = pageNum;
    
    if (page === undefined || this.pageNum === page) { return; }

    if (page > this.maxPages) {
      page = this.maxPages;
    } else if (page < 0) {
      page = 0;
    }

    if (!(page === 0 || page === this.maxPages - 1)) {
      page -= 1;
    }

    if (page > this.pageNum) {
      this.pagingDirection = PAGING_DIRECTION.FORWARD;
    } else {
      this.pagingDirection = PAGING_DIRECTION.BACKWARDS;
    }

    this.setPageNum(page);
    if (this.readerMode === READER_MODE.WEBTOON) {
      this.initWebtoonReader();
    } else {
      this.loadPage();
    }
  }

  promptForPage() {
    const goToPageNum = window.prompt('There are ' + this.maxPages + ' pages. What page would you like to go to?', '');
    if (goToPageNum === null || goToPageNum.trim().length === 0) { return null; }
    return goToPageNum;
  }


  closeDrawer() {
    this.menuOpen = false;
  }

  toggleColorMode() {
    switch(this.colorMode) {
      case COLOR_FILTER.NONE:
        this.colorMode = COLOR_FILTER.DARK;
        break;
      case COLOR_FILTER.DARK:
        this.colorMode = COLOR_FILTER.SEPIA;
        break;
      case COLOR_FILTER.SEPIA:
        this.colorMode = COLOR_FILTER.NONE;
        break;
    }
  }

  toggleReaderMode() {
    switch(this.readerMode) {
      case READER_MODE.MANGA_LR:
        this.readerMode = READER_MODE.MANGA_UD;
        this.loadPage();
        break;
      case READER_MODE.MANGA_UD:
        this.readerMode = READER_MODE.WEBTOON;
        this.initWebtoonReader();
        break;
      case READER_MODE.WEBTOON:
        this.readerMode = READER_MODE.MANGA_LR;
        this.loadPage();
        break;
    }
  }

  getReaderModeIcon() {
    // TODO: Refactor to a getter
    switch(this.readerMode) {
      case READER_MODE.MANGA_LR:
        return 'fa-exchange-alt';
      case READER_MODE.MANGA_UD:
        return 'fa-exchange-alt fa-rotate-90';
      case READER_MODE.WEBTOON:
        return 'fa-arrows-alt-v';
    }
  }

  intersectionObserver: IntersectionObserver = new IntersectionObserver((entries) => this.handleIntersection(entries), { threshold: [0, 0.25, 0.5, 0.75, 1] });
  scrollingDirection: PAGING_DIRECTION = PAGING_DIRECTION.FORWARD;
  prevScrollPosition: number = 0;

  initWebtoonReader() {
    // ? If page is already prefetched, just scroll to it and don't reset the array

    fromEvent(window, 'scroll').pipe(debounceTime(20), takeUntil(this.onDestroy)).subscribe((event) => {
      const verticalOffset = (window.pageYOffset 
        || document.documentElement.scrollTop 
        || document.body.scrollTop || 0);
      // TODO: capture scroll direction
      if (verticalOffset > this.prevScrollPosition) {
        this.scrollingDirection = PAGING_DIRECTION.FORWARD;
      } else {
        this.scrollingDirection = PAGING_DIRECTION.BACKWARDS;
      }
      //console.log('offset check: ', verticalOffset + ' vs ' + this.prevScrollPosition + ' => ' + (this.scrollingDirection === PAGING_DIRECTION.FORWARD ? 'Forward' : 'Backward'));
      this.prevScrollPosition = verticalOffset;
    });

    this.minPrefetchedWebtoonImage = this.pageNum;
    this.maxPrefetchedWebtoonImage = -1;
    this.webtoonImages.next([]);
    const prefetchStart = Math.max(this.pageNum - PREFETCH_PAGES, 0);
    const prefetchMax =  Math.min(this.pageNum + PREFETCH_PAGES, this.maxPages); 
    console.log('[INIT] Prefetching pages ' + prefetchStart + ' to ' + prefetchMax + '. Current page: ', this.pageNum);
    for(let i = prefetchStart; i < prefetchMax; i++) {
      this.prefetchWebtoonImage(i);
    }

    this.scrollToCurrentPage();
  }

  handleIntersection(entries: IntersectionObserverEntry[]) {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const imagePage = parseInt(entry.target.attributes.getNamedItem('page')?.value + '', 10);
        if (entry.intersectionRatio <= 0.5) {
          console.log(imagePage + ' is partially on screen');
          //console.log('Scrolling direction: ', this.scrollingDirection === PAGING_DIRECTION.FORWARD ? 'Forward' : 'Backward');

          if (this.pageNum + 1 === imagePage && this.scrollingDirection === PAGING_DIRECTION.FORWARD) {
            this.nextPage();
            this.readerService.bookmark(this.seriesId, this.volumeId, this.chapterId, this.pageNum).subscribe(() => {/* No operation */});
          } else if (this.pageNum - 1 === imagePage && this.scrollingDirection === PAGING_DIRECTION.BACKWARDS) {
            this.prevPage();
            this.readerService.bookmark(this.seriesId, this.volumeId, this.chapterId, this.pageNum).subscribe(() => {/* No operation */});
          } else {
            return;
          }
          
          this.prefetchWebtoonImages();
        }
      }
    });
  }

  loadWebtoonPage(scrollTo: boolean = false) {

    this.readerService.bookmark(this.seriesId, this.volumeId, this.chapterId, this.pageNum).subscribe(() => {/* No operation */});
    if (scrollTo) {
      this.scrollToCurrentPage();
    }
  }

  scrollToCurrentPage() {
    if (this.readerMode !== READER_MODE.WEBTOON) { return }
    setTimeout(() => {
      const elem = document.querySelector('img#page-' + this.pageNum);
      if (elem) {
        window.scroll({
          // ! This needs some adjustment to make sure the page loads at the top of the viewport
          top: elem.getBoundingClientRect().top, // 
          behavior: 'smooth'
        });
      }
    }, 400);
  }

  prefetchWebtoonImage(page: number, concat: boolean = true) {
    let data = this.webtoonImages.value;
    if (concat) {
      data = data.concat({src: this.readerService.getPageUrl(this.chapterId, page), page});
      this.maxPrefetchedWebtoonImage++;
    } else {
      data = [{src: this.readerService.getPageUrl(this.chapterId, page), page}].concat(data);
      this.minPrefetchedWebtoonImage--;
    }

    this.webtoonImages.next(data);
    setTimeout(() => {
      const image = document.querySelector("img#page-" + page);
      if (image === null) {
        return;
      }
      this.intersectionObserver.observe(image);
    }, 10);
  }


  onScrollUp(event: IInfiniteScrollEvent) {
    this.scrollingDirection = PAGING_DIRECTION.BACKWARDS;
  }

  onScrollDown(event: IInfiniteScrollEvent) {
    this.scrollingDirection = PAGING_DIRECTION.FORWARD;
  }

  prefetchWebtoonImages() {

    let startingIndex = this.pageNum;
    let endingIndex = this.pageNum + 1;
    if (this.scrollingDirection === PAGING_DIRECTION.FORWARD) {
      startingIndex = (this.pageNum + this.maxPrefetchedWebtoonImage + 1) ;
      endingIndex = Math.min(this.pageNum + this.maxPrefetchedWebtoonImage + PREFETCH_PAGES, this.maxPages);

      if (this.pageNum + PREFETCH_PAGES <= this.maxPrefetchedWebtoonImage) {
        return;
      }
    } else {
      startingIndex = (this.pageNum - 1) ;
      endingIndex = Math.max(this.pageNum - PREFETCH_PAGES, 0);

      if (this.pageNum - PREFETCH_PAGES >= this.minPrefetchedWebtoonImage) {
        return;
      }
    }


    if (startingIndex > endingIndex) {
      const temp = startingIndex;
      startingIndex = endingIndex;
      endingIndex = temp;
    }
    console.log('prefetching pages: ' + startingIndex + ' to ' + endingIndex);
    for(let i = startingIndex; i < endingIndex; i++) {
      this.prefetchWebtoonImage(i, this.scrollingDirection === PAGING_DIRECTION.FORWARD);
    }
  }

  saveSettings() {

  }

  resetSettings() {

  }

}
