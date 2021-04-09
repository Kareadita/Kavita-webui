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
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';

import Epub from 'epubjs';
import Book from 'epubjs/types/book';
import Rendition from 'epubjs/types/rendition';
import { BookService } from '../book.service';

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
  book: Book | undefined;
  rendition!: Rendition;

  @ViewChild('iframeObj', {static: false}) iframeObj!: ElementRef;


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
    this.pageUrl = this.domSanitizer.bypassSecurityTrustResourceUrl(this.bookService.getBookPageUrl(this.chapterId, this.pageNum));
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

  injectInterceptor() {
    let iframeWindow = (this.iframeObj.nativeElement.contentWindow || this.iframeObj.nativeElement.contentDocument);
    let xhrObj = iframeWindow.XMLHttpRequest.prototype.open;
    var parentObj = this;
    iframeWindow.XMLHttpRequest.prototype.open = function (method: any, url: any, async: any, user: any, password: any) {
      console.log('custom: ', url);  
      this.addEventListener('load', () => {
                console.log('load: ', this);
        });
        xhrObj.apply(this, arguments);
        // const oidcToken = JSON.parse(window.localStorage.getItem(parentObj.localstorageKey));
        // const accessToken  = oidcToken.access_token;
        // this.setRequestHeader('Authorization', "Bearer " + accessToken); 
    }
  }

}
