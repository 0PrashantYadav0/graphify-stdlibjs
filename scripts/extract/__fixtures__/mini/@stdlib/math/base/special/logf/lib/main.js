var lnf = require( '@stdlib/math/base/special/lnf/lib/main.js' );
module.exports = function logf( x, b ) { return lnf( x ) / lnf( b ); };
