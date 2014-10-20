$(function() {"use strict";

var xErrorDialog = $("div.formdialog form div.error");

function showErrorDialog(message) {
    xErrorDialog.html("<p>ERROR: " + message + "</p>");
}

if (window.File && window.FileReader && window.FileList && window.Blob) {
    // File APIs are supported
    (function(){
        
        function MyImage(width, height) {
            this.width = width;
            this.height = height;
        }

        function Colour(red, green, blue, alpha) {
            if (this.alpha === undefined) this.alpha = 255;
            this.red = red;
            this.green = green;
            this.blue = blue;
        }

        function uint32BEtoASCII(uint32) {
            return  String.fromCharCode((uint32 & (255 << 24)) >> 24) +
                    String.fromCharCode((uint32 & (255 << 16)) >> 16) +
                    String.fromCharCode((uint32 & (255 << 8)) >> 8) +
                    String.fromCharCode((uint32 & (255 << 0)) >> 0);
        }

        $("#matinput").on("change", loadMats);

        function loadMats(e) {
            var numFilesLoaded = 0;
            var files = e.target.files;
            var reader = new FileReader();
            reader.onload = readMat;
            $("div#matviews").empty();
            function nextFile() {
                if (files[numFilesLoaded]) {
                    reader.readAsArrayBuffer(files[numFilesLoaded]);
                    numFilesLoaded++;
                }
            }
            function readMat(e) {
                try {
                    xErrorDialog.html("");
                    var offset = 0;
                    var dv = new DataView(e.target.result);
                    var rootForm = isForm(dv, offset);
                    if (rootForm) {
                        if (rootForm.name == "BITM") {
                            offset = rootForm.offset + 12;
                        } else {
                            throw new TypeError("Unable to read file! It's probably a different type of IFF file. (BITM form not found)");
                        }
                    } else {
                        throw new TypeError("Unable to read file! It's not a MAT file. (No root form found)");
                    }
                    
                    if (isForm(dv, offset).name != "FRAM") {
                        throw new TypeError("Unable to read file! It's probably not a MAT file. (FRAM Form not found)");
                    } else {
                        offset += 12;
                    }
                    var imageDimensions = readInfoChunk(dv, offset);
                    offset += imageDimensions.bytelength + 8; // Take the bytes of the CHUNK name and CHUNK byte length into account.
                    var palette = readPalette(dv, offset);
                    offset += palette.length * 3 + 8 + 12; // Take into account the bytes that make up the "PAL " FORM and the CMAP CHUNK
                    var pixels = readPxls(dv, offset);
                    matImageToCanvas({
                        dimensions: imageDimensions,
                        "palette": palette,
                        "palrefs": pixels
                    });
                    nextFile();
                } catch (err) {
                    xErrorDialog.html("<p>ERROR: " + err.message + "</p>");
                }
            }
            nextFile();
        }

        

        function readInfoChunk(dv, idx) {
            if (idx === undefined) {
                console.log("WARNING: This may cause the program to function incorrectly!");
                idx = 0;
            }
            while (dv.getUint32(idx) != 1229866575) {
                ++idx;
            }
            return {
                bytelength: dv.getUint32(idx+4),
                width: dv.getUint32(idx+8, true),
                height: dv.getUint32(idx+12, true)
            };
        }

        function readPalette(dv, idx) {
            var palette;
            if (idx === undefined) {
                console.log("WARNING: This may cause the program to function incorrectly!");
                idx = 0;
            }
            var palForm = {
                name: undefined
            };
            while (palForm.name != "PAL ") {
                palForm = nextForm(dv, idx);
            }
            idx = palForm.offset;
            idx += 12;
            if (dv.getUint32(idx) == 1129136464) {
                idx += 4;
                var bytelength = dv.getUint32(idx);
                // console.log("CMAP chunk byte length: " + bytelength);
                var numColours = bytelength / 3;
                // console.log("Number of colours: " + numColours);
                palette = new Array(numColours);
                idx += 4;
                for (var i = 0; i < numColours; ++i) {
                    palette[i] = new Colour(
                        dv.getUint8(idx),
                        dv.getUint8(idx+1),
                        dv.getUint8(idx+2)
                    );
                    idx += 3;
                }
                return palette;
            } else {
                return false;
            }
        }

        function readPxls(dv, idx) {
            if (idx === undefined) {
                console.log("WARNING: This may cause the program to function incorrectly!");
                idx = 0;
            }
            while (dv.getUint32(idx) != 1347963987) {
                idx++;
            }
            idx += 4;
            var bytelength = dv.getUint32(idx);
            var pixels = [];
            idx += 4;
            for(var i = 0; i < bytelength; i++) {
                pixels.push(dv.getUint8(idx++));
            }
            return pixels;
        }
        
        function matImageToCanvas(matimg) {
            // MAT is indexed, so each byte in the PXLS chunk contains a reference to a colour index in the palette (at least AFAIK). Also, 4 bytes are needed for red, green, blue, and alpha.
            var matImageArray = new Uint8ClampedArray(matimg.palrefs.length * 4);
            // dereference each palette reference and put it in the matImageArray Uint8ClampedArray
            for (var i = 0; i < matimg.palrefs.length; i++) {
                matImageArray[i * 4] = matimg.palette[matimg.palrefs[i]].red;
                matImageArray[i * 4 + 1] = matimg.palette[matimg.palrefs[i]].green;
                matImageArray[i * 4 + 2] = matimg.palette[matimg.palrefs[i]].blue;
                matImageArray[i * 4 + 3] = matimg.palette[matimg.palrefs[i]].alpha; // alpha
            }
            var matImageData = new ImageData(matImageArray, matimg.dimensions.width, matimg.dimensions.height);

            var canvasParent = document.getElementById("matviews");
            var canvas = document.createElement("canvas");
            canvas.width = matimg.dimensions.width;
            canvas.height = matimg.dimensions.height;
            canvasParent.appendChild(canvas);
            var context = canvas.getContext("2d");
            context.putImageData(matImageData, 0, 0);
        }

        function isForm(dv, idx) {
            if (idx === undefined) idx = 0;
            if (dv.getUint32(idx) == 1179603533) {
                return {
                    name: uint32BEtoASCII(dv.getUint32(idx + 8)),
                    bytelength: dv.getUint32(idx + 4),
                    offset: idx
                };
            } else {
                return false;
            }
        }

        function nextForm(dv, idx) {
            if (idx === undefined) idx = 0;
            while (dv.getUint32(idx) != 1179603533) ++idx;
            return {
                name: uint32BEtoASCII(dv.getUint32(idx + 8)),
                bytelength: dv.getUint32(idx + 4),
                offset: idx
            };
        }
    }());
} else {
    // Sorry, File APIs not supported
    xErrorDialog.html("<p>ERROR: HTML5 File APIs unsupported. Please upgrade your browser.</p>");
}


});