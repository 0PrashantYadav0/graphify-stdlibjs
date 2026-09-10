/**
* Compute the natural logarithm of a single-precision number.
*
* @example
* var lnf = require( '@stdlib/math/base/special/lnf' );
* var logf = require( '@stdlib/math/base/special/logf' );
* var y = logf( 4.0, 2.0 );
* // returns 2.0
*/

// var legacy = require( '@stdlib/math/base' );

/*
var removed = require( '@stdlib/assert/is-nan' );
*/

// A `//` inside a string does not start a comment, and a require inside a
// string is not a call.
var docs = 'see http://example.com and require( "@stdlib/math/base/special" )';

// A `/*` inside a regex literal does not open a block comment.
var RE_COMMENT = /\/\*|require\(\s*'@stdlib\/assert'\s*\)/;

// An escaped quote must not end the string early.
var note = 'it\'s require( "@stdlib/math" ), quoted';

// `${}` inside a template returns to code, but a bare require in the template
// text does not.
var msg = `ratio ${docs.length / RE_COMMENT.source.length / 2} require( '@stdlib/math' )`;

var napi = require( '@stdlib/math/base/napi/binary' );

module.exports = { napi: napi, docs: docs, note: note, msg: msg };
