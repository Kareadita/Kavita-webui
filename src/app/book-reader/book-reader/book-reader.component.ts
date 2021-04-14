import { Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
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

// import Epub from 'epubjs';
// import Book from 'epubjs/types/book';
// import Rendition from 'epubjs/types/rendition';
import { BookService } from '../book.service';


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

  pageNum = 0;
  maxPages = 1;
  user!: User;

  menuOpen = false;
  isLoading = true; 

  pageUrl: SafeUrl | undefined = undefined;
  page: SafeHtml | undefined = undefined;

  @ViewChild('iframeObj', {static: false}) iframeObj!: ElementRef<HTMLIFrameElement>;

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

    // this.book = Epub(this.bookService.getEpubUrl(this.chapterId, 'content.opf'), {requestMethod: this.request.bind(this)});
    // this.rendition = this.book.renderTo("area", {width: 600, height: 400});
    // this.rendition.display();
    

    forkJoin({
      chapter: this.seriesService.getChapter(this.chapterId),
      pageNum: this.readerService.getBookmark(this.chapterId)
    }).subscribe(results => {
      this.chapter = results.chapter;
      this.volumeId = results.chapter.volumeId;
      this.maxPages = results.chapter.pages;

      this.pageNum = results.pageNum;

      if (this.pageNum > this.maxPages) {
        this.pageNum = this.maxPages;
      }

      // this.bookService.getEpubFile(this.chapterId, 'content.opf').toPromise().then(xml => {
      //   console.log('i got: ', xml);
      // });

      this.loadPage();

    }, () => {
      setTimeout(() => {
        this.location.back();
      }, 200);
    });
  }

  setOverrideStyles() {
    const bodyNode = document.querySelector('body');
    if (bodyNode !== undefined && bodyNode !== null) {
      this.originalBodyColor = bodyNode.style.background;
      bodyNode.style.background = 'black';
      bodyNode.style.height = '0%';
    }
  }

  loadPage() {

    this.isLoading = true;
    this.readerService.bookmark(this.seriesId, this.volumeId, this.chapterId, this.pageNum).subscribe(() => {});

    //this.pageUrl = this.domSanitizer.bypassSecurityTrustResourceUrl(this.bookService.getBookPageUrl(this.chapterId, this.pageNum));

    this.bookService.getBookPage(this.chapterId, this.pageNum).subscribe(content => {
      console.log('content: ', content);
      this.page = this.domSanitizer.bypassSecurityTrustHtml(content);
      
    });
    this.isLoading = false;
  }

  prevPage() {
    this.pageNum--;
    if (this.pageNum < 0) {
      this.pageNum = 0;
    }

    this.loadPage();
  }

  nextPage(event?: any) {
    if (event) {
      event.stopPropagation();
      event.preventDefault();
    }

    if ((this.pageNum + 1 >= this.maxPages) || this.isLoading) {
      return;
    }

    this.pageNum++;
    this.loadPage();
  }

  injectStyles() {
    if (!this.iframeObj) { return; }
    console.log(this.iframeObj.nativeElement.contentWindow?.document.body);
    this.iframeObj.nativeElement.contentDocument?.documentElement.getElementsByClassName('body').item(0)?.setAttribute('style', 'font-size: 140%');
    // Font-Size: font-size: 100% (+/- 10%)
  }

  // request(url: string, type: string, withCredentials: object, headers: object) {
  //   console.log('Requesting ', url);
  //   console.log('type: ', type);

  //   const filePath = url.split('/' + this.chapterId + '/')[1];

  //   return this.bookService.getEpubFile(this.chapterId, filePath).pipe(map(res => {
  //     console.log('got res: ', res);
  //     return new Blob([res]);
  //   })).toPromise();
  // }

}
