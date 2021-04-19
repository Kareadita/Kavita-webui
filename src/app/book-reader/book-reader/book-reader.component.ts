import { Component, ElementRef, HostListener, OnDestroy, OnInit, ViewChild } from '@angular/core';
import {Location} from '@angular/common';
import { FormBuilder, FormGroup } from '@angular/forms';
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
import { animate, state, style, transition, trigger } from '@angular/animations';
import { Stack } from 'src/app/shared/data-structures/stack';
import { Preferences } from 'src/app/_models/preferences/preferences';


interface PageStyle {
  'font-family': string;
  'font-size': string; 
  'line-height': string;
  'margin-left': string;
  'margin-right': string;
}

interface HistoryPoint {
  page: number;
  scrollOffset: number;
}

const TOP_OFFSET = -50 * 1.5; // px the sticky header takes up

@Component({
  selector: 'app-book-reader',
  templateUrl: './book-reader.component.html',
  styleUrls: ['./book-reader.component.scss'],
  animations: [
    trigger(
      'isLoading', [
        state('1' , style({ opacity: 0 })),
        state('0', style({ opacity: 1  })),
        transition('1 => 0', animate('300ms')),
        transition('0 => 1', animate('500ms'))
        ])
  ]
})
export class BookReaderComponent implements OnInit, OnDestroy {

  libraryId!: number;
  seriesId!: number;
  volumeId!: number;
  chapterId!: number;
  chapter!: Chapter;

  chapters: Array<BookChapterItem> = [];

  pageNum = 0;
  maxPages = 1;
  adhocPageHistory: Stack<HistoryPoint> = new Stack<HistoryPoint>();
  
  user!: User;

  drawerOpen = false;
  isLoading = true; 
  bookTitle: string = '';
  settingsForm: FormGroup = new FormGroup({});

  page: SafeHtml | undefined = undefined; // This is the html we get from the server

  @ViewChild('iframeObj', {static: false}) iframeObj!: ElementRef<HTMLIFrameElement>;
  @ViewChild('readingSection', {static: false}) readingSectionElemRef!: ElementRef<HTMLDivElement>;

  pageStyles!: PageStyle;


  
  darkMode = false;
  backgroundColor: string = 'white';
  readerStyles: string = '';


  // Temp hack: Override background color for reader and restore it onDestroy
  originalBodyColor: string | undefined;
  originalTextColor: string | undefined;

  constructor(private route: ActivatedRoute, private router: Router, private accountService: AccountService,
    private seriesService: SeriesService, private readerService: ReaderService, private location: Location,
    private formBuilder: FormBuilder, private navService: NavService, private toastr: ToastrService, 
    private domSanitizer: DomSanitizer, private bookService: BookService) {
      this.navService.hideNavBar();
      this.resetSettings();
  }
  ngOnDestroy(): void {
    const bodyNode = document.querySelector('body');
    if (bodyNode !== undefined && bodyNode !== null && this.originalBodyColor !== undefined) {
      bodyNode.style.background = this.originalBodyColor;
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
        //user.preferences.
        //this.settingsForm.addControl('readingDirection', new FormControl(user.preferences.readingDirection, []));
      }
    });

    this.libraryId = parseInt(libraryId, 10);
    this.seriesId = parseInt(seriesId, 10);
    this.chapterId = parseInt(chapterId, 10);

    

    forkJoin({
      chapter: this.seriesService.getChapter(this.chapterId),
      pageNum: this.readerService.getBookmark(this.chapterId),
      chapters: this.bookService.getBookChapters(this.chapterId),
      info: this.bookService.getBookInfo(this.chapterId)
    }).subscribe(results => {
      this.chapter = results.chapter;
      this.volumeId = results.chapter.volumeId;
      this.maxPages = results.chapter.pages;
      this.chapters = results.chapters;
      this.pageNum = results.pageNum;
      this.bookTitle = results.info;

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

  @HostListener('window:keydown', ['$event'])
  handleKeyPress(event: KeyboardEvent) {
    if (event.key === KEY_CODES.RIGHT_ARROW) {
      this.nextPage();
    } else if (event.key === KEY_CODES.LEFT_ARROW) {
      this.prevPage();
    } else if (event.key === KEY_CODES.ESC_KEY) {
      this.closeReader();
    } else if (event.key === KEY_CODES.SPACE) {
      this.drawerOpen = !this.drawerOpen;
      event.stopPropagation();
      event.preventDefault(); 
    }
  }

  loadChapter(pageNum: number, part: string) {
    this.setPageNum(pageNum);
    this.loadPage(part);
  }

  closeReader() {
    this.location.back();
  }

  resetSettings() {
    const windowWidth = window.innerWidth
      || document.documentElement.clientWidth
      || document.body.clientWidth;

    let margin = '15%';
    if (windowWidth <= 700) {
      margin = '0%';
    }
    if (this.user) {
      if (windowWidth > 700) {
        margin = this.user.preferences.bookReaderMargin + '%';
      }
//      margin = this.user.preferences.bookReaderMargin ? this.user.preferences.bookReaderMargin + '%' :  margin;
      this.pageStyles = {'font-family': 'default', 'font-size': this.user.preferences.bookReaderFontSize + '%', 'margin-left': margin, 'margin-right': margin, 'line-height': '100%'};
    } else {
      this.pageStyles = {'font-family': 'default', 'font-size': '100%', 'margin-left': margin, 'margin-right': margin, 'line-height': '100%'};
    }
    this.toggleDarkMode(false);
    this.updateReaderStyles();
  }

  addLinkClickHandlers() {
    var links = this.readingSectionElemRef.nativeElement.querySelectorAll('a');
      links.forEach(link => {
        link.addEventListener('click', (e: any) => {
          if (!e.target.attributes.hasOwnProperty('kavita-page')) { return; }
          var page = parseInt(e.target.attributes['kavita-page'].value, 10);
          if (this.adhocPageHistory.peek()?.page !== this.pageNum) {
            this.adhocPageHistory.push({page: this.pageNum, scrollOffset: window.pageYOffset});
          }
          
          this.setPageNum(page);
          var partValue = e.target.attributes.hasOwnProperty('kavita-part') ? e.target.attributes['kavita-part'].value : undefined;
          if (partValue && page === this.pageNum) {
            this.scrollTo(e.target.attributes['kavita-part'].value);
            return;
          }
          this.loadPage(partValue);
        });
      });
  }

  loadPage(part?: string | undefined, scrollTop?: number | undefined) {

    this.isLoading = true;
    window.scroll({
      top: 0,
      behavior: 'smooth'
    });


    this.readerService.bookmark(this.seriesId, this.volumeId, this.chapterId, this.pageNum).subscribe(() => {});

    this.bookService.getBookPage(this.chapterId, this.pageNum).subscribe(content => {
      console.log('current page: ', this.pageNum);
      this.page = this.domSanitizer.bypassSecurityTrustHtml(content);
      setTimeout(() => {
        this.addLinkClickHandlers();

        Promise.all(Array.from(this.readingSectionElemRef.nativeElement.querySelectorAll('img')).filter(img => !img.complete).map(img => new Promise(resolve => { img.onload = img.onerror = resolve; }))).then(() => {
          this.isLoading = false;

          if (part !== undefined && part !== '') {
            this.scrollTo(part);
          } else if (scrollTop !== undefined && scrollTop !== 0) {
            window.scroll({
              top: scrollTop,
              behavior: 'smooth'
            });
          }
        });
      }, 10);
    });
  }

  setPageNum(pageNum: number) {
    if (pageNum < 0) {
      this.pageNum = 0;
    } else if (pageNum >= this.maxPages) {
      this.pageNum = this.maxPages;
    } else {
      this.pageNum = pageNum;
    }
  }

  goBack() {
    if (!this.adhocPageHistory.isEmpty()) {
      const page = this.adhocPageHistory.pop();
      console.log('Going to page: ', page);
      if (page !== undefined) {
        this.setPageNum(page.page);
        this.loadPage(undefined, page.scrollOffset);
      }
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
    this.updateReaderStyles();
  }

  updateMargin(amount: number) {
    let cleanedValue = this.pageStyles['margin-left'].replace('%', '').replace('!important', '').trim();
    let val = parseInt(cleanedValue, 10);
    this.pageStyles['margin-left'] = (val + amount) + '% !important';

    cleanedValue = this.pageStyles['margin-right'].replace('%', '').replace('!important', '').trim();
    val = parseInt(cleanedValue, 10);
    this.pageStyles['margin-right'] = (val + amount) + '% !important';

    this.updateReaderStyles();
  }

  updateLineSpacing(amount: number) {
    let val = 1.2;
    const cleanedValue = this.pageStyles['line-height'].replace('!important', '').trim();
    if (cleanedValue === 'normal') {
      val = 1.2
    } else {
      val = parseInt(cleanedValue);
    }
    this.pageStyles['line-height'] = (val + amount) + '% !important';

    this.updateReaderStyles();
  }

  updateReaderStyles() {
    this.readerStyles = Object.entries(this.pageStyles).map(item => {
      return item[0] + ': ' + item[1] + ';';
    }).join('');
  }



  toggleDarkMode(force?: boolean) {
    if (force !== undefined) {
      this.darkMode = force;
    } else {
      this.darkMode = !this.darkMode;
    }

    this.setOverrideStyles();
  }

  getDarkModeBackgroundColor() {
    return this.darkMode ? '#292929' : '#fff';
  }

  setOverrideStyles() {
    const bodyNode = document.querySelector('body');
    if (bodyNode !== undefined && bodyNode !== null) {
      this.originalBodyColor = bodyNode.style.background;
      bodyNode.style.background = this.getDarkModeBackgroundColor();
    }
    this.backgroundColor = this.getDarkModeBackgroundColor();
  }

  saveSettings() {
    if (this.user === undefined) return;
    const modelSettings = this.settingsForm.value;
    const data: Preferences = {
      readingDirection: this.user.preferences.readingDirection, 
      scalingOption: this.user.preferences.scalingOption, 
      pageSplitOption: this.user.preferences.pageSplitOption, 
      bookReaderDarkMode: this.darkMode,
      bookReaderFontFamily: modelSettings.bookReaderFontFamily,
      bookReaderFontSize: parseInt(this.pageStyles['font-size'].substr(0, this.pageStyles['font-size'].length - 1), 10),
      bookReaderLineSpacing: parseInt(this.pageStyles['line-height'].replace('!important', '').trim(), 10),
      bookReaderMargin: parseInt(this.pageStyles['margin-left'].replace('%', '').replace('!important', '').trim(), 10)
    };
    this.accountService.updatePreferences(data).subscribe((updatedPrefs) => {
      this.toastr.success('Server settings updated');
      if (this.user) {
        this.user.preferences = updatedPrefs;
      }
      this.resetSettings();
    });
  }

  closeDrawer() {
    this.drawerOpen = false;
  }


  scrollTo(partSelector: string) {
    if (partSelector.startsWith('#')) {
      partSelector = partSelector.substr(1, partSelector.length);
    }

    const element = document.querySelector('*[id="' + partSelector + '"]');
    if (element === null) return;

    window.scroll({
      top: element.getBoundingClientRect().top + window.pageYOffset + TOP_OFFSET,
      behavior: 'smooth' 
    });
  }

}
