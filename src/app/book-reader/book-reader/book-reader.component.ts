import { Component, ElementRef, HostListener, OnDestroy, OnInit, ViewChild } from '@angular/core';
import {Location} from '@angular/common';
import { FormBuilder } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { forkJoin } from 'rxjs';
import { map, take } from 'rxjs/operators';
import { Chapter } from 'src/app/_models/chapter';
import { User } from 'src/app/_models/user';
import { AccountService } from 'src/app/_services/account.service';
import { NavService } from 'src/app/_services/nav.service';
import { ReaderService } from 'src/app/_services/reader.service';
import { SeriesService } from 'src/app/_services/series.service';
import { DomSanitizer, SafeHtml, SafeUrl } from '@angular/platform-browser';

import { BookService } from '../book.service';
import { KEY_CODES } from 'src/app/shared/_services/utility.service';
import { BookChapterItem } from '../_models/book-chapter-item';


interface PageStyle {
  'font-family': string;
  'font-size': string; 
  'line-height'?: string;
  'margin-left': string;
  'margin-right': string;
  //'background-color'?: string;
  //'color'?: string;
}

@Component({
  selector: 'app-book-reader',
  templateUrl: './book-reader.component.html',
  styleUrls: ['./book-reader.component.scss']
})
export class BookReaderComponent implements OnInit, OnDestroy {

  libraryId!: number;
  seriesId!: number;
  volumeId!: number;
  chapterId!: number;
  chapter!: Chapter;

  chapters: Array<BookChapterItem> = [];

  prevPageNum = 0; // Debug only
  pageNum = 0;
  maxPages = 1;
  user!: User;

  menuOpen = false;
  isLoading = true; 

  pageUrl: SafeUrl | undefined = undefined;
  page: SafeHtml | undefined = undefined;

  @ViewChild('iframeObj', {static: false}) iframeObj!: ElementRef<HTMLIFrameElement>;
  @ViewChild('readingSection', {static: false}) readingSectionElemRef!: ElementRef<HTMLDivElement>;

  pageStyles: PageStyle = {'font-family': 'serif', 'font-size': '100%', 'margin-left': '15%', 'margin-right': '15%'};


  drawerOpen = true;
  darkMode = false;


  // Temp hack: Override background color for reader and restore it onDestroy
  originalBodyColor: string | undefined;
  originalTextColor: string | undefined;

  constructor(private route: ActivatedRoute, private router: Router, private accountService: AccountService,
    private seriesService: SeriesService, private readerService: ReaderService, private location: Location,
    private formBuilder: FormBuilder, private navService: NavService, private toastr: ToastrService, 
    private domSanitizer: DomSanitizer, private bookService: BookService) {
      this.navService.hideNavBar();
  }
  ngOnDestroy(): void {
    const bodyNode = document.querySelector('body');
    if (bodyNode !== undefined && bodyNode !== null && this.originalBodyColor !== undefined && this.originalTextColor != undefined) {
      bodyNode.style.background = this.originalBodyColor;
      //bodyNode.style.color = this.originalTextColor;
      //bodyNode.style.height = '100%';
    }
    this.navService.showNavBar();
  }

  ngOnInit(): void {
    const libraryId = this.route.snapshot.paramMap.get('libraryId');
    const seriesId = this.route.snapshot.paramMap.get('seriesId');
    const chapterId = this.route.snapshot.paramMap.get('chapterId');

    if (libraryId === null || seriesId === null || chapterId === null) {
      this.router.navigateByUrl('/home');
      return;
    }

    this.accountService.currentUser$.pipe(take(1)).subscribe(user => {
      if (user) {
        this.user = user;
      }
    });

    this.libraryId = parseInt(libraryId, 10);
    this.seriesId = parseInt(seriesId, 10);
    this.chapterId = parseInt(chapterId, 10);

    

    forkJoin({
      chapter: this.seriesService.getChapter(this.chapterId),
      pageNum: this.readerService.getBookmark(this.chapterId),
      chapters: this.bookService.getBookChapters(this.chapterId)
    }).subscribe(results => {
      this.chapter = results.chapter;
      this.volumeId = results.chapter.volumeId;
      this.maxPages = results.chapter.pages;
      this.chapters = results.chapters;
      this.pageNum = results.pageNum;

      if (this.pageNum > this.maxPages) {
        this.pageNum = this.maxPages;
      }

      this.loadPage();

    }, () => {
      setTimeout(() => {
        this.closeReader();
      }, 200);
    });
  }

  @HostListener('window:keyup', ['$event'])
  handleKeyPress(event: KeyboardEvent) {
    if (event.key === KEY_CODES.RIGHT_ARROW) {
      this.nextPage();
    } else if (event.key === KEY_CODES.LEFT_ARROW) {
      this.prevPage();
    } else if (event.key === KEY_CODES.ESC_KEY) {
      this.closeReader();
    }
  }

  loadChapter(pageNum: number, part: string) {
    this.setPageNum(pageNum);
    this.loadPage(part);
    // if (part !== null && part !== '') {
    //   // TODO: Scroll to part once page loads
    //   this.scrollTo(part);
    // }
  }

  closeReader() {
    this.location.back();
  }

  resetSettings() {
    this.pageStyles = {'font-family': 'serif', 'font-size': '100%', 'margin-left': '15%', 'margin-right': '15%'};
    this.darkMode = false;
  }

  loadPage(part?: string | undefined) {

    this.isLoading = true;
    window.scrollTo(0, 0);
    this.readerService.bookmark(this.seriesId, this.volumeId, this.chapterId, this.pageNum).subscribe(() => {});

    this.bookService.getBookPage(this.chapterId, this.pageNum).subscribe(content => {
      this.page = this.domSanitizer.bypassSecurityTrustHtml(content);
      setTimeout(() => {
        var links = this.readingSectionElemRef.nativeElement.querySelectorAll('a');
        links.forEach(link => {
          link.addEventListener('click', (e: any) => {
            if (!e.target.attributes.hasOwnProperty('kavita-page')) { return; }
            var page = parseInt(e.target.attributes['kavita-page'].value, 10);;
            this.setPageNum(page);
            // TODO: Keep track of what pages we go to in a stack so we can "go back"
            var partValue = e.target.attributes.hasOwnProperty('kavita-part') ? e.target.attributes['kavita-part'].value : undefined;
            if (partValue && page === this.pageNum) {
              this.scrollTo(e.target.attributes['kavita-part'].value);
              return;
            }
            this.loadPage(partValue);
          });
        });

        if (part !== undefined && part !== '') {
          this.scrollTo(part);
        }
      }, 10);
      
    }, err => {
      this.pageNum = this.prevPageNum;
      this.loadPage();
    });
    this.isLoading = false;
  }

  setPageNum(pageNum: number) {
    this.prevPageNum = this.pageNum;
    if (pageNum < 0) {
      this.pageNum = 0;
    } else if (pageNum >= this.maxPages) {
      this.pageNum = this.maxPages;
    } else {
      this.pageNum = pageNum;
    }

  }

  prevPage() {
    this.setPageNum(this.pageNum - 1);

    this.loadPage();
  }

  nextPage(event?: any) {
    if (event) {
      event.stopPropagation();
      event.preventDefault();
    }

    this.setPageNum(this.pageNum + 1);
    this.loadPage();
  }

  updateFontSize(amount: number) {
    let val = parseInt(this.pageStyles['font-size'].substr(0, this.pageStyles['font-size'].length - 1), 10);
    this.pageStyles['font-size'] = val + amount + '%';
    console.log(this.pageStyles);
  }

  updateMargin(amount: number) {
    // let val = parseInt(this.pageStyles['font-size'].substr(0, this.pageStyles['font-size'].length - 1), 10);
    // this.pageStyles['font-size'] = val + amount + '%';

    console.log(this.pageStyles);
  }

  updateLineSpacing(amount: number) {
    // normal => 1.2

    if (!this.pageStyles.hasOwnProperty('line-height') || this.pageStyles['line-height'] === undefined) {
      this.pageStyles['line-height'] = '1.2 !important';
    }

    let val = 1.2;
    const cleanedValue = this.pageStyles['line-height'].replace('!important', '').trim();
    if (cleanedValue === 'normal') {
      val = 1.2
    } else {
      val = parseFloat(cleanedValue);
    }
    this.pageStyles['line-height'] = (val + amount).toFixed(1) + ' !important';
  }



  toggleDarkMode() {
    this.darkMode = !this.darkMode;
  }

  saveSettings() {
    // TODO: Implement the ability to save overrides to user preferences for default load
  }

  closeDrawer() {
    this.drawerOpen = false;
  }


  scrollTo(partSelector: string) {
    if (!partSelector.startsWith('#')) {
      partSelector = '#' + partSelector;
    }
    
    const element = document.querySelector(partSelector);
    if (element === null) return;

    const rect = element.getBoundingClientRect(); // get rects(width, height, top, etc)
    const viewHeight = Math.max(document.documentElement.clientHeight, window.innerHeight || 0);

    window.scroll({
      top: rect.top + rect.height / 2 - viewHeight / 2,
      behavior: 'smooth' // smooth scroll
    });
  }

}
