/**
 * @license Copyright (c) 2003-2022, CKSource - Frederico Knabben. All rights reserved.
 * Licensed under the terms of the MIT License (see LICENSE.md).
 */

'use strict';

const fsExtra = require( 'fs-extra' );
const path = require( 'path' );

/**
 * Created for testing purpose.
 * You can add / remove this plugin in src/tasks/build-api-docs.js
 */
exports.handlers = {
	processingComplete( e ) {
		const outputPath = process.env.JSDOC_OUTPUT_PATH;

		fsExtra.outputFileSync( path.resolve( outputPath ), JSON.stringify( e, null, 4 ) );
	}
};
