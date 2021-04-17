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


interface PageStyle {
  'font-family': string;
  'font-size': string; 
  'line-height': string;
  'margin-left': string;
  'margin-right': string;
  'background-color'?: string;
  'color'?: string;
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

  chapters: any = {};
  chapterLinks: Array<{title: string, page: number}> = [];

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

  pageStyles: PageStyle = {'font-family': 'serif', 'font-size': '100%', 'line-height': 'normal', 'margin-left': '15%', 'margin-right': '15%'};


  // Temp hack: Override background color for reader and restore it onDestroy
  originalBodyColor: string | undefined;

  constructor(private route: ActivatedRoute, private router: Router, private accountService: AccountService,
    private seriesService: SeriesService, private readerService: ReaderService, private location: Location,
    private formBuilder: FormBuilder, private navService: NavService, private toastr: ToastrService, 
    private domSanitizer: DomSanitizer, private bookService: BookService) {
      this.navService.hideNavBar();
  }
  ngOnDestroy(): void {
    const bodyNode = document.querySelector('body');
    if (bodyNode !== undefined && bodyNode !== null && this.originalBodyColor !== undefined) {
      bodyNode.style.background = this.originalBodyColor;
      bodyNode.style.height = '100%';
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

    //this.setOverrideStyles();

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
      Object.keys(this.chapters).forEach(key => {
        if (this.chapters.hasOwnProperty(key)) {
          this.chapterLinks.push({title: key, page: this.chapters[key]});
        }
      });

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

  loadChapter(pageNum: number) {
    this.setPageNum(pageNum);
    this.loadPage();
  }

  setOverrideStyles() {
    const bodyNode = document.querySelector('body');
    if (bodyNode !== undefined && bodyNode !== null) {
      this.originalBodyColor = bodyNode.style.background;
      bodyNode.style.background = 'black';
      bodyNode.style.height = '0%';
    }
  }

  closeReader() {
    this.location.back();
  }

  loadPage() {

    this.isLoading = true;
    this.readerService.bookmark(this.seriesId, this.volumeId, this.chapterId, this.pageNum).subscribe(() => {});

    this.bookService.getBookPage(this.chapterId, this.pageNum).subscribe(content => {
      this.page = this.domSanitizer.bypassSecurityTrustHtml(content);
      setTimeout(() => {
        var links = this.readingSectionElemRef.nativeElement.querySelectorAll('a');
        links.forEach(link => {
          link.addEventListener('click', (e: any) => {
            if (!e.target.attributes.hasOwnProperty('kavita-page')) { return; }
            var page = e.target.attributes['kavita-page'].value;
            this.setPageNum(parseInt(page, 10));
            this.loadPage();
          });
        });
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
    // this.pageNum--;
    // if (this.pageNum < 0) {
    //   this.pageNum = 0;
    // }
    this.setPageNum(this.pageNum - 1);

    this.loadPage();
  }

  nextPage(event?: any) {
    if (event) {
      event.stopPropagation();
      event.preventDefault();
    }

    // if ((this.pageNum + 1 >= this.maxPages) || this.isLoading) {
    //   return;
    // }

    // this.pageNum++;
    this.setPageNum(this.pageNum + 1);
    this.loadPage();
  }

  injectStyles() {
    if (!this.iframeObj) { return; }
    console.log(this.iframeObj.nativeElement.contentWindow?.document.body);
    this.iframeObj.nativeElement.contentDocument?.documentElement.getElementsByClassName('body').item(0)?.setAttribute('style', 'font-size: 140%');
    // Font-Size: font-size: 100% (+/- 10%)
  }

}
