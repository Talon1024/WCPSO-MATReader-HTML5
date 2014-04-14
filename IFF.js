// Minimal Implementation of EA IFF 85
// Most files used by the Wing Commander games are in this format.
"use strict";

function IffFile(rootForm, filename) {
    if (rootForm instanceof IffForm)
        this.root = rootForm;
    else if (rootForm instanceof String)
        this.root = new IffForm(rootForm);
    else
        throw new TypeError(
            "Root FORM must be a string (which will be made " +
            "into a FORM object with the given name) or a FORM object."
        );
    if (filename instanceof String) {
        if (filename === undefined) filename = "iff.iff";
        else this.filename = filename;
    } else {
        throw new TypeError("Filename must be a string!");
    }
    var members = [];
}

function IffForm(name, members) {
    if (members instanceof Array) {
        this.members = members;
    } else if (members === undefined) {
        this.members = [];
    } else {
        throw new TypeError("members must be an array");
    }
    if (name instanceof String) {
        if (name.length > 4) { // Use the first four characters of the name, truncate the rest
            name = name.slice(0, 4);
        } else if (name.length < 4) { // Add spaces at end of string
            var numSpacesToAdd = 4 - name.length;
            // var spaces = " ".repeat(numSpacesToAdd);
            // // NOTE: String.repeat(x) is an ECMAScript 6 "Harmony" feature.
            // // You need Firefox 24 or a Chrome(ium) continuous to use this feature!
            // name += spaces;
            for (var x = 0; x < numSpacesToAdd; x++)
                name += " ";
        }
        // Validate the name
        if (name.replace(/[0-9A-Za-z]/g) !== "")
            throw new RangeError("All characters in the string must be letters or numbers.");
        // Capitalize the name
        name = name.toUpperCase();
    } else {
        throw new TypeError("Name of FORM must be an ASCII string!");
    }
}

IffForm.prototype.is_member_valid = function(member) {
    if (member instanceof IffForm
    || member instanceof IffChunk)
    return true;
    else return false;
};

IffForm.prototype.toXmf = function() {
    
};

IffForm.prototype.toBinArray = function() {
    
};

function IffChunk(name) {
    
}