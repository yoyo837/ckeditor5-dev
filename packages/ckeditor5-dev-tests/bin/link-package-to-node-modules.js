#!/usr/bin/env node

/**
 * @license Copyright (c) 2003-2022, CKSource Holding sp. z o.o. All rights reserved.
 * For licensing, see LICENSE.md.
 */

'use strict';

const path = require( 'path' );
const cwd = process.cwd();
const { tools } = require( '@ckeditor/ckeditor5-dev-utils' );

const packageName = require( path.join( cwd, 'package.json' ) ).name;

tools.linkDirectories( '../..', `node_modules/${ packageName }` );
