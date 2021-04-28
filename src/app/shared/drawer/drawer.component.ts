import { Component, EventEmitter, Input, OnChanges, OnInit, Output, SimpleChanges } from '@angular/core';

export class DrawerOptions {
  topOffset: number = 0; // pixels, only applies when position left/right
}

@Component({
  selector: 'app-drawer',
  templateUrl: './drawer.component.html',
  styleUrls: ['./drawer.component.scss'],
  exportAs: "drawer"
})
export class DrawerComponent implements OnInit, OnChanges {

  @Input() isOpen = false;
  @Input() width: number = 400;
  @Input() position: 'left' | 'right' = 'left';
  @Input() options: Partial<DrawerOptions> = new DrawerOptions();
  @Output() drawerClosed = new EventEmitter();


  constructor() { }

  ngOnInit(): void {
  }

  ngOnChanges(changes: SimpleChanges) {
    console.log(this.options);
  }

  close() {
    this.drawerClosed.emit();
  }
}
