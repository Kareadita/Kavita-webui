import { Component, Input, OnInit } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { ToastrService } from 'ngx-toastr';
import { SelectionModel } from 'src/app/typeahead/typeahead.component';
import { CollectionTag } from 'src/app/_models/collection-tag';
import { Series } from 'src/app/_models/series';
import { CollectionTagService } from 'src/app/_services/collection-tag.service';
import { SeriesService } from 'src/app/_services/series.service';

@Component({
  selector: 'app-edit-collection-tags',
  templateUrl: './edit-collection-tags.component.html',
  styleUrls: ['./edit-collection-tags.component.scss']
})
export class EditCollectionTagsComponent implements OnInit {

  @Input() tag!: CollectionTag;
  series: Array<Series> = [];
  selections!: SelectionModel<Series>;
  isLoading: boolean = true;


  constructor(public modal: NgbActiveModal, private seriesService: SeriesService, private collectionService: CollectionTagService, private toastr: ToastrService) { }

  ngOnInit(): void {
    // TODO: Figure out pagination here
    this.seriesService.getSeriesForTag(this.tag.id, 0, 200).subscribe(series => {
      this.series = series.result;
      this.selections = new SelectionModel<Series>(true, this.series);
      this.isLoading = false;
    });
  }

  togglePromotion() {
    this.tag.promoted = !this.tag.promoted;
    this.collectionService.updatePromotion(this.tag).subscribe(res => {
      this.toastr.success(res);
    });
  }

  reset() {

  }

  close() {
    this.modal.close({success: false, tag: undefined});
  }

  save() {
    console.log('selected: ', this.selections._data);
    //this.modal.close({success: true, tag: this.tag});
    // if (this.member?.username === undefined) {
    //   return;
    // }

    // const selectedLibraries = this.selectedLibraries.filter(item => item.selected).map(item => item.data);
    // this.libraryService.updateLibrariesForMember(this.member?.username, selectedLibraries).subscribe(() => {
    //   this.modal.close(true);
    // });
  }

}
