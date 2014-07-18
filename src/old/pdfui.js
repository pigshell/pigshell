function PdfDoc(pdf, pagenum, width) {
    var self = this;
    this.pdf = pdf;
    this.pagenum = pagenum;
    this.scale = "fit";
    this.div = $(this.template);
    this.canvas = this.div.find("canvas")[0];
    this.width = width;
    this.canvas.width = width;
    this.canvas.height = width * 2 / 3;
    this.pgnum = this.div.find(".pdfui-pagenum");
    this.pgcount = this.div.find(".pdfui-pagecount");
    this.scalebox = this.div.find(".pdfui-scale");

    this.div.find(".pdfui-prev").on("click", function() {
        self.prev_page();
    });
    this.div.find(".pdfui-next").on("click", function() {
        self.next_page();
    });
    this.div.find(".pdfui-close").on("click", function() {
        self.pdf = undefined;
        self.div.remove();
    });
    this.scalebox.on("blur", function() {
        var scaleval = self.scalebox.val().toLowerCase(),
            scale = parseFloat(scaleval, 10);
        if (scaleval === "fit" || (isnumber(scaleval) && scale > 10.0 &&
            scale < 6400.0)) {
            self.scale = scaleval;
        }
        self.render_page();
    });
    this.pgnum.on("blur", function() {
        var pgnum = self.pgnum.val();
        if (isnumber(pgnum)) {
            self.pagenum = parseInt(pgnum, 10);
        }
        self.render_page();
    });
}

PdfDoc.prototype.render_page = function() {
    var self = this;
    self.pdf.getPage(self.pagenum).then(function(page) {
        var scale;
        if (self.scale === "fit") {
            scale = self.width / page.getViewport(1.0).width;
        } else if (isnumber(self.scale)) {
            scale = parseFloat(self.scale, 10) / 100.0;
        }
        var viewport = page.getViewport(scale);
        self.canvas.height = viewport.height;
        self.canvas.width = viewport.width;
        var renderContext = {
            canvasContext: self.canvas.getContext('2d'),
            viewport: viewport
        };
        page.render(renderContext);
        self.pgnum.val(self.pagenum.toString());
        self.pgcount.text(self.pdf.numPages.toString());
        self.scalebox.val(self.scale);
    });
};

PdfDoc.prototype.template = '<div class="pdfui-browser"><div class="pt2">' + 
    '<button class="pdfui-close pt2">Close</button>' +
    '<button class="pdfui-prev pt2">Previous</button>' +
    '<button class="pdfui-next pt2">Next</button>&nbsp; &nbsp;' +
    'Page: <input class="pdfui-pagenum pt2" size="3"></input> / <span class="pdfui-pagecount"></span>&nbsp; &nbsp; Scale <input class="pdfui-scale pt2" size="3"></input>%</div>' +
    '<div><canvas class="pdfui-canvas" style="border:1px solid black"></canvas></div></div>';

PdfDoc.prototype.prev_page = function() {
    var self = this;

    if (self.pagenum <= 1) {
        return;
    }
    self.pagenum--;
    return self.render_page();
};

PdfDoc.prototype.next_page = function() {
    var self = this;

    if (self.pagenum >= self.pdf.numPages) {
        return;
    }
    self.pagenum++;
    return self.render_page();
};

var PdfUI = {
    scripts: ["js/extra/pdf.js"],
    display: loadscripts(function(item, pterm, cb) {
        var self = this;
        to('arraybuffer', item, {}, ef(cb, function(res) {
            var bytes = new Uint8Array(res);

            PDFJS.workerSrc = 'js/extra/pdf.worker.js';
            PDFJS.getDocument(bytes).then(function(p) {
                var pdfdoc = new PdfDoc(p, 1, pterm.div.width());
                pterm.div.append(pdfdoc.div);
                pdfdoc.render_page();
                return cb(null, null);
            });
        }));
    })
};

VFS.register_media_ui('application/pdf', PdfUI, {}, 100);
