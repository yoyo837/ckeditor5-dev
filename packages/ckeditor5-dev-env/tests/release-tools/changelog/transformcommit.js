/**
 * @license Copyright (c) 2003-2017, CKSource - Frederico Knabben. All rights reserved.
 * For licensing, see LICENSE.md.
 */

/* jshint mocha:true */

'use strict';

const expect = require( 'chai' ).expect;
const sinon = require( 'sinon' );
const mockery = require( 'mockery' );
const proxyquire = require( 'proxyquire' );

describe( 'dev-env/release-tools/changelog/writer-options', () => {
	describe( 'transform()', () => {
		let transformCommit, sandbox, stubs, loggerVerbosity;

		beforeEach( () => {
			sandbox = sinon.sandbox.create();

			mockery.enable( {
				useCleanCache: true,
				warnOnReplace: false,
				warnOnUnregistered: false
			} );

			stubs = {
				logger: {
					info: sandbox.spy(),
					warning: sandbox.spy(),
					error: sandbox.spy()
				},
				getPackageJson: sandbox.stub()
			};

			stubs.getPackageJson.returns( {
				name: 'ckeditor5-dev',
				bugs: 'https://github.com/ckeditor/ckeditor5-dev/issues'
			} );

			mockery.registerMock( '../utils/getpackagejson', stubs.getPackageJson );

			transformCommit = proxyquire( '../../../lib/release-tools/changelog/writer-options', {
				'@ckeditor/ckeditor5-dev-utils': {
					logger( verbosity ) {
						loggerVerbosity = verbosity;

						return stubs.logger;
					}
				}
			} ).transform;
		} );

		afterEach( () => {
			sandbox.restore();
			mockery.disable();
		} );

		it( 'groups "BREAKING CHANGES" and "BREAKING CHANGE" as a single group', () => {
			const commit = {
				hash: '684997d0eb2eca76b9e058fb1c3fa00b50059cdc',
				header: 'Fix: Simple fix.',
				type: 'Fix',
				subject: 'Simple fix.',
				body: null,
				footer: null,
				notes: [
					{ title: 'BREAKING CHANGE', text: 'Note 1.' },
					{ title: 'BREAKING CHANGES', text: 'Note 2.' }
				],
				references: []
			};

			transformCommit( commit );

			expect( commit.notes[ 0 ].title ).to.equal( 'BREAKING CHANGES' );
			expect( commit.notes[ 1 ].title ).to.equal( 'BREAKING CHANGES' );
		} );

		it( 'attaches valid "external" commit to the changelog', () => {
			const commit = {
				hash: '684997d0eb2eca76b9e058fb1c3fa00b50059cdc',
				header: 'Fix: Simple fix.',
				type: 'Fix',
				subject: 'Simple fix.',
				body: null,
				footer: null,
				notes: [],
				references: []
			};

			transformCommit( commit );

			expect( stubs.logger.info.calledOnce ).to.equal( true );
			expect( stubs.logger.info.firstCall.args[ 0 ] ).to.match( /\* 684997d "Fix: Simple fix\." \u001b\[32mINCLUDED/ );
		} );

		it( 'does not attach valid "internal" commit to the changelog', () => {
			const commit = {
				hash: '684997d0eb2eca76b9e058fb1c3fa00b50059cdc',
				header: 'Docs: README.',
				type: 'Docs',
				subject: 'README.',
				body: null,
				footer: null,
				notes: [],
				references: []
			};

			transformCommit( commit );

			expect( stubs.logger.info.calledOnce ).to.equal( true );
			expect( stubs.logger.info.firstCall.args[ 0 ] ).to.match( /\* 684997d "Docs: README\." \u001b\[90mSKIPPED/ );
		} );

		it( 'does not attach invalid commit to the changelog', () => {
			const commit = {
				hash: '684997d0eb2eca76b9e058fb1c3fa00b50059cdc',
				header: 'Invalid commit.',
				type: null,
				subject: null,
				body: null,
				footer: null,
				notes: [],
				references: []
			};

			transformCommit( commit );

			expect( stubs.logger.info.calledOnce ).to.equal( true );
			expect( stubs.logger.info.firstCall.args[ 0 ] ).to.match( /\* 684997d "Invalid commit\." \u001b\[31mINVALID/ );
		} );

		it( 'makes URLs to issues on GitHub', () => {
			const commit = {
				hash: '76b9e058fb1c3fa00b50059cdc684997d0eb2eca',
				header: 'Fix: Simple fix. Closes #2.',
				type: 'Fix',
				subject: 'Simple fix. Closes #2',
				body: null,
				footer: null,
				notes: [
					{
						title: 'BREAKING CHANGES',
						text: 'Some issue #1.'
					}
				],
				references: []
			};

			transformCommit( commit );

			const expectedSubject = 'Simple fix. Closes [#2](https://github.com/ckeditor/ckeditor5-dev/issues/2)';
			expect( commit.subject ).to.equal( expectedSubject );
			expect( commit.notes[ 0 ].text ).to.equal( 'Some issue [#1](https://github.com/ckeditor/ckeditor5-dev/issues/1).' );
		} );

		it( 'makes URLs to organization on GitHub', () => {
			const commit = {
				hash: '76b9e058fb1c3fa00b50059cdc684997d0eb2eca',
				header: 'Internal: Thanks to @CKEditor',
				type: 'Fix',
				subject: 'Internal: Thanks to @CKEditor',
				body: null,
				footer: null,
				notes: [],
				references: []
			};

			transformCommit( commit );

			const expectedSubject = 'Internal: Thanks to [@CKEditor](https://github.com/CKEditor)';
			expect( commit.subject ).to.equal( expectedSubject );
		} );

		it( 'does not duplicate the commit header in additional description for merge commits', () => {
			const commitDescription = [
				'* Release task - rebuilt module for collecting dependencies to release.',
				'* Release task - a new version to release will be read from CHANGELOG file.',
				'* Changelog task - will not break if changelog does not exist.',
				'* Used `semver` package for bumping the version (instead of a custom module).',
			];

			const commitDescriptionWithIndents = [
				'  * Release task - rebuilt module for collecting dependencies to release.',
				'  * Release task - a new version to release will be read from CHANGELOG file.',
				'  * Changelog task - will not break if changelog does not exist.',
				'  * Used `semver` package for bumping the version (instead of a custom module).',
			].join( '\n' );

			const commit = {
				header: 'Merge pull request #75 from ckeditor/t/64',
				hash: 'dea35014ab610be0c2150343c6a8a68620cfe5ad',
				body: [
					'Feature: Introduced a brand new release tools with a new set of requirements. See #64.',
					'',
					...commitDescription,
					''
				].join( '\n' ),
				footer: [
					'Closes #19.',
					'Closes #57.',
					'Closes #61.',
					'Closes #64.',
					'Closes #65.',
					'',
					'BREAKING CHANGES: Removed the `getoptions` module.',
					'BREAKING CHANGES: CLI parameters are not supported anymore.',
					'BREAKING CHANGES: Simplified options required by `tasks.releaseDependencies()`.'
				].join( '\n' ),
				references: [
					{ action: 'Closes', issue: '19', raw: '#19', prefix: '#' },
					{ action: 'Closes', issue: '57', raw: '#57', prefix: '#' },
					{ action: 'Closes', issue: '61', raw: '#61', prefix: '#' },
					{ action: 'Closes', issue: '64', raw: '#64', prefix: '#' },
					{ action: 'Closes', issue: '65', raw: '#65', prefix: '#' }
				],
				mentions: [],
				type: null,
				subject: null,
				notes: [
					{
						title: 'BREAKING CHANGES',
						text: 'Removed the `getoptions` module.'
					},
					{
						title: 'BREAKING CHANGES',
						text: 'CLI parameters are not supported anymore.'
					},
					{
						title: 'BREAKING CHANGES',
						text: 'Simplified options required by `tasks.releaseDependencies()`.'
					}
				]
			};

			transformCommit( commit );

			expect( commit.type ).to.equal( 'Features' );
			expect( commit.subject ).to.equal( 'Introduced a brand new release tools with a new set of requirements. ' +
				'See [#64](https://github.com/ckeditor/ckeditor5-dev/issues/64).' );
			expect( commit.body ).to.equal( commitDescriptionWithIndents );

			expect( stubs.logger.info.calledOnce ).to.equal( true );

			const commitRegexp = /\* dea3501 "Merge pull request #75 from ckeditor\/t\/64" \u001b\[32mINCLUDED/;
			expect( stubs.logger.info.firstCall.args[ 0 ] ).to.match( commitRegexp );
		} );

		it( 'allows hiding the logs', () => {
			const commit = {
				hash: '684997d0eb2eca76b9e058fb1c3fa00b50059cdc',
				header: 'Fix: Simple fix.',
				type: 'Fix',
				subject: 'Simple fix.',
				body: null,
				footer: null,
				notes: [],
				references: []
			};

			transformCommit( commit, false );

			expect( loggerVerbosity ).to.equal( 'error' );
		} );

		it( 'throws an error when "package.json" does not have valid "bugs" property', () => {
			stubs.getPackageJson.returns( {
				name: 'foo'
			} );

			const commit = {
				hash: '684997d0eb2eca76b9e058fb1c3fa00b50059cdc',
				header: 'Fix: Simple fix. Closes #1.',
				type: 'Fix',
				subject: 'Simple fix. Closes #1.',
				body: null,
				footer: null,
				notes: [],
				references: []
			};

			const error = 'The package.json for "foo" must contain the "bugs" property.';
			expect( () => transformCommit( commit ) ).to.throw( Error, error );
		} );
	} );
} );
