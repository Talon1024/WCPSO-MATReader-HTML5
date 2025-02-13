/*global jQuery: false, $: false, extPalettes: false*/

window.addEventListener("load", function () {"use strict";

var xErrorDialog = document.body.querySelector("div.formdialog > form > div.error");

function addError(errMessage) {
    const errorElement = document.createElement("p");
    errorElement.appendChild(document.createTextNode("ERROR: " + errMessage));
    xErrorDialog.appendChild(errorElement);
}

if (window.File && window.FileReader && window.FileList && window.DataView) {
    // File APIs are supported
    (function(){

        var palCache = {};

        // For things that are not yet implemented.
        function UnsupportedError(message) {
            this.name = 'UnsupportedError';
            this.message = message || 'Operation not supported!';
        }
        UnsupportedError.prototype = new Error();
        UnsupportedError.prototype.constructor = UnsupportedError;

        // For palette colours
        function Colour(red, green, blue) {
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

        // Automatically load selected files when the user selects them
        document.getElementById("matinput").addEventListener("change", loadMats);
        // Initialize the tooltip
        const tooltip = document.getElementById("tooltip");
        tooltip.style.visibility = "hidden";
        window.onmousemove = function(e) {
            // When the user moves the mouse, move the tooltip.
            tooltip.style.left = e.clientX + 4 + "px";
            tooltip.style.top = e.clientY + 4 + "px";
        };
        const matviews = document.getElementById("matviews");
        matviews.addEventListener("mouseenter", showTooltip, {capture: true});
        matviews.addEventListener("mouseleave", hideTooltip, {capture: true});

        function showTooltip(e) {
            if (e.target.matches("canvas")) {
                // tooltip.show().text(e.target.getAttribute("data-filename"));
                const fileName = e.target.getAttribute("data-filename");
                tooltip.style.visibility = "visible";
                if (tooltip.childNodes.length > 0) {
                    tooltip.removeChild(tooltip.childNodes[0]);
                }
                tooltip.appendChild(document.createTextNode(fileName));
            }
        }

        function hideTooltip(e) {
            if (e.target.matches("canvas")) {
                tooltip.style.visibility = "hidden";
            }
        }

        function loadMats(e) {
            var curFileName;
            var useAlpha = document.getElementById("alphachannel").checked;
            console.log("useAlpha", useAlpha);
            var numFilesLoaded = 0;
            var files = e.target.files;
            var reader = new FileReader();
            reader.onload = readMat;
            for (const mat of matviews.childNodes) {
                matviews.removeChild(mat);
            }
            // Recursively called function that loads the next file
            function nextFile() {
                if (numFilesLoaded < files.length && files[numFilesLoaded]) {
                    // Load and display all MAT files
                    curFileName = files[numFilesLoaded].name;
                    reader.readAsArrayBuffer(files[numFilesLoaded]);
                    numFilesLoaded++;
                }
            }
            function readMat(e) {
                try {
                    var xCurFileName = curFileName; // needed to get correct filename on AJAX request
                    var offset = 0;
                    var dv = new DataView(e.target.result);
                    var rootForm = isForm(dv, offset);
                    var getExtPal = false;
                    if (rootForm) {
                        if (rootForm.name == "BITM") {
                            offset = rootForm.offset + 12;
                        } else {
                            throw new TypeError("Unable to read file " + curFileName + "! It's probably a different type of IFF file. (BITM form not found)");
                        }
                    } else {
                        throw new TypeError("Unable to read file " + curFileName + "! It's not a MAT file. (No root form found)");
                    }
                    if (isForm(dv, offset).name != "FRAM") {
                        throw new TypeError("Unable to read file " + curFileName + "! It's probably not a MAT file. (FRAM Form not found)");
                    } else {
                        offset += 12;
                    }
                    var imageDimensions = readInfoChunk(dv, offset);
                    offset += imageDimensions.bytelength + 8; // Take the bytes of the CHUNK name and CHUNK byte length into account.
                    var palette = readPalette(dv, offset);
                    if (palette.type === "embedded") {
                        console.log("embedded palette");
                        offset += palette.length * 3 + 8 + 12; // Take into account the bytes that make up the "PAL " FORM and the CMAP CHUNK
                    } else if (palette.type === "external") {
                        console.log("external palette: " + palette.name + ".pal");
                        if (palette.name in palCache) {
                            palette.data = palCache[palette.name];
                            console.log("Palette " + palette.name + " found in palette cache.");
                        } else {
                            getExtPal = true;
                        }
                        offset += 8 + 12 + palette.name.length + (palette.name.length % 2 === 0) ? 2 : 1;
                    }
                    var pixels = readPxls(dv, offset);
                    var alphas;
                    if (useAlpha) {
                        try {
                            alphas = readAlpha(dv, offset);
                        } catch (err) {
                            console.log("Image " + curFileName + " has no alpha channel!");
                        }
                    } else {
                        alphas = false;
                    }
                    // determine whether to use an AJAX request to load the palette.
                    if (!getExtPal) {
                        matImageToCanvas({
                            dimensions: imageDimensions,
                            "palette": palette,
                            "palrefs": pixels,
                            "alphas": alphas,
                            "filename": curFileName
                        });
                    } else {
                        var palName = palette.name;
                        var palxhr = new XMLHttpRequest();
                        palxhr.open("GET", "pal/" + palette.name + ".pal", true);
                        palxhr.responseType = "arraybuffer";
                        palxhr.onreadystatechange = function(e) {
                            try {
                                if (e.target.readyState == 4) {
                                    if (e.target.status == 200) {
                                        dv = new DataView(e.target.response);
                                        palette = readPalette(dv, 0);
                                        palCache[palName] = palette.data;
                                        matImageToCanvas({
                                            dimensions: imageDimensions,
                                            "palette": palette,
                                            "palrefs": pixels,
                                            "alphas": alphas,
                                            "filename": xCurFileName
                                        });
                                    } else if (e.target.status == 404) {
                                        throw new ReferenceError(palette.name + ".pal not found on the server! Please contact the server administrator.");
                                    } else {
                                        throw new ReferenceError("Unable to load " + palette.name + ".pal!");
                                    }
                                }
                            } catch (err) {
                                addError(err.message);
                            }
                        };
                        palxhr.send();
                    }
                    nextFile();
                } catch (err) {
                    addError(err.message);
                    nextFile();
                }
            }
            // Begin reading the files.
            nextFile();
        }

        function readInfoChunk(dv, idx) {
            if (idx === undefined) {
                console.log("WARNING: This may cause the program to function incorrectly!");
                idx = 0;
            }
            while (dv.getUint32(idx) != 1229866575) { // INFO
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
            var i;
            if (idx === undefined) {
                console.log("WARNING: This may cause the program to function incorrectly!");
                idx = 0;
            }
            var palForm = {
                name: undefined
            };
            var bytelength;
            while (palForm.name != "PAL ") {
                palForm = nextForm(dv, idx);
            }
            idx = palForm.offset;
            idx += 12;
            if (dv.getUint32(idx) == 1129136464) { // CMAP
                idx += 4;
                bytelength = dv.getUint32(idx);
                // console.log("CMAP chunk byte length: " + bytelength);
                var numColours = bytelength / 3;
                if (numColours != 256) {
                    console.log("Palette may not be embedded!");
                }
                // console.log("Number of colours: " + numColours);
                palette = new Array(numColours);
                idx += 4;
                for (i = 0; i < numColours; ++i) {
                    palette[i] = new Colour(
                        dv.getUint8(idx),
                        dv.getUint8(idx+1),
                        dv.getUint8(idx+2)
                    );
                    idx += 3;
                }
                return {
                    type: "embedded",
                    data: palette,
                    length: palette.length
                };
            } else if (dv.getUint32(idx) == 1312902469) { // NAME
                idx += 4; bytelength = dv.getUint32(idx);
                idx += 4; var extPalName = "";
                for (i = 0; i < bytelength; i++) {
                    var byte = dv.getUint8(idx++);
                    if (byte >= 32) extPalName += String.fromCharCode(byte);
                }
                return {
                    type: "external",
                    name: extPalName.toLowerCase()
                };
            } else {
                throw new TypeError("MAT file contains neither a CMAP nor NAME chunk to embed/identify the palette!");
            }
        }

        function readPxls(dv, idx) {
            if (idx === undefined) {
                console.log("WARNING: This may cause the program to function incorrectly!");
                idx = 0;
            }
            while (dv.getUint32(idx) != 1347963987) { // PXLS
                idx++;
            }
            idx += 4;
            var bytelength = dv.getUint32(idx);
            var pixels = new Uint8ClampedArray(bytelength);
            idx += 4;
            for(var i = 0; i < bytelength; i++) {
                pixels[i] = dv.getUint8(idx++);
            }
            return pixels;
        }

        function readAlpha(dv, idx) {
            if (idx === undefined) {
                console.log("WARNING: This may cause the program to function incorrectly!");
                idx = 0;
            }
            while (dv.getUint32(idx) != 1095520328) { // ALPH
                idx++;
            }
            idx += 4;
            var bytelength = dv.getUint32(idx);
            var alphaBytes = new Uint8ClampedArray(bytelength);
            idx += 4;
            for(var i = 0; i < bytelength; i++) {
                alphaBytes[i] = 255 - dv.getUint8(idx++); // WCSO uses an inverted alpha channel
            }
            return alphaBytes;
        }

        function matImageToCanvas(matimg) {
            // MAT is indexed, so each byte in the PXLS chunk contains a reference to a colour index in the palette (at least AFAIK). Also, 4 bytes are needed for red, green, blue, and alpha.
            var matImageArray = new Uint8ClampedArray(matimg.palrefs.length * 4);
            // dereference each palette reference and put it in the matImageArray Uint8ClampedArray
            for (var i = 0; i < matimg.palrefs.length; i++) {
                matImageArray[i * 4] = matimg.palette.data[matimg.palrefs[i]].red;
                matImageArray[i * 4 + 1] = matimg.palette.data[matimg.palrefs[i]].green;
                matImageArray[i * 4 + 2] = matimg.palette.data[matimg.palrefs[i]].blue;
                if (matimg.alphas === undefined) {
                    matImageArray[i * 4 + 3] = (matimg.palrefs[i] === 0) ? 0 : 255;
                } else if (matimg.alphas === false) {
                    matImageArray[i * 4 + 3] = 255;
                } else {
                    matImageArray[i * 4 + 3] = matimg.alphas[i]; // alpha
                }
            }
            var matImageData = new ImageData(matImageArray, matimg.dimensions.width, matimg.dimensions.height);

            var canvas = document.createElement("canvas");
            canvas.width = matimg.dimensions.width;
            canvas.height = matimg.dimensions.height;
            canvas.setAttribute("data-filename", matimg.filename);
            matviews.appendChild(canvas);
            var context = canvas.getContext("2d");
            context.putImageData(matImageData, 0, 0);
        }

        function isForm(dv, idx) {
            if (idx === undefined) idx = 0;
            if (dv.getUint32(idx) == 1179603533) { // FORM
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
            while (dv.getUint32(idx) != 1179603533) ++idx; // FORM
            return {
                name: uint32BEtoASCII(dv.getUint32(idx + 8)),
                bytelength: dv.getUint32(idx + 4),
                offset: idx
            };
        }
    }());
} else {
    // Sorry, File APIs not supported
    addError("HTML5 File APIs unsupported. Please upgrade your browser.");
}


});
