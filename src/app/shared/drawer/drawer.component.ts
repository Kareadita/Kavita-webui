import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';

@Component({
  selector: 'app-drawer',
  templateUrl: './drawer.component.html',
  styleUrls: ['./drawer.component.scss'],
  exportAs: "drawer"
})
export class DrawerComponent implements OnInit {

  @Input() isOpen = false;
  @Input() width: number = 400;
  @Input() position: 'left' | 'right' = 'left';
  @Output() drawerClosed = new EventEmitter();


  constructor() { }

  ngOnInit(): void {
  }

  close() {
    this.drawerClosed.emit();
  }

  // get drawerStyles() {
  //   const commonStyles = { width: `${this.width}px` };
  //   if (this.position == 'right') {
  //     return {
  //       ...commonStyles,
  //       right: `${this.isOpen ? 0 : -1 * this.width}px`,
  //     };
  //   } else {
  //     return {
  //       ...commonStyles,
  //       left: `${this.isOpen ? 0 : -1 * this.width}px`,
  //     };
  //   }
  // }

}
