export class Rendition {

    renderElemId: string = '';
    
    constructor(id: string) {
        this.renderElemId = id;
    }

    /**
     * Renders to the screen
     */
    display() {

    }
}

export class Epub {

    contentOpf: string = '';
    parser = new DOMParser();
    rendition: Rendition | undefined;

    

    constructor(url: string) {
        this.contentOpf = url;

    }


    load() {}

    /**
     * 
     * @param id Id of element to render into
     */
    createRendition(id: string) {
        this.rendition = new Rendition(id);
        return this.rendition;
    }

    parseOpf(content: string) {
        const xmlDoc = this.parser.parseFromString(content,"text/xml");
        // x = xmlDoc.getElementsByTagName("ARTIST");
        // for (i = 0; i < x.length; i++) {
        //     txt += x[i].childNodes[0].nodeValue + "<br>";
        // }

    }
}