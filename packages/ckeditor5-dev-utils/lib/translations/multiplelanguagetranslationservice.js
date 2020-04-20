/**
 * @license Copyright (c) 2003-2020, CKSource - Frederico Knabben. All rights reserved.
 * For licensing, see LICENSE.md.
 */

'use strict';

const path = require( 'path' );
const fs = require( 'fs' );
const findMessages = require( './findmessages' );
const { EventEmitter } = require( 'events' );
const PO = require( 'pofile' );

/**
 * A service that serves translations assets based on the found PO files in the registered packages.
 */
module.exports = class MultipleLanguageTranslationService extends EventEmitter {
	/**
	 * @param {Object} options
	 * @param {String} options.mainLanguage The target language that will be bundled into the main webpack asset.
	 * @param {Array.<String>} [options.additionalLanguages] Additional languages which files will be emitted.
	 * When option is set to 'all', all languages found during the compilation will be added.
	 * @param {Boolean} [options.compileAllLanguages] When set to `true` languages will be found at runtime.
	 * @param {Boolean} [options.allowMultipleJSOutputs] When set to `true` the service will not complain about multiple JS assets and will
	 * output translations for the main language to all found asset.
	 */
	constructor( { mainLanguage, additionalLanguages = [], compileAllLanguages = false, allowMultipleJSOutputs = false } ) {
		super();

		/**
		 * Main language that should be built in to the bundle.
		 *
		 * @private
		 * @type {String}
		 */
		this._mainLanguage = mainLanguage;

		/**
		 * A set of languages that will be used by translator. This set may be expanded by found languages
		 * if the `compileAllLanguages` flag is turned on.
		 *
		 * @private
		 * @type {Set.<String>}
		 */
		this._languages = new Set( [ mainLanguage, ...additionalLanguages ] );

		/**
		 * An option indicating if the languages should be found at runtime.
		 *
		 * @private
		 * @type {Boolean}
		 */
		this._compileAllLanguages = compileAllLanguages;

		/**
		 * A boolean option. When set to `true` this service won't complain about multiple JS assets
		 * and will add translation for the main language to all of them. Useful option for manual tests, etc.
		 *
		 * @private
		 * @type {Boolean}
		 */
		this._allowMultipleJSOutputs = allowMultipleJSOutputs;

		/**
		 * A set of handled packages that speeds up the translation process.
		 *
		 * @private
		 * @type {Set.<String>}
		 */
		this._handledPackages = new Set();

		/**
		 * A map of translation dictionaries in the `language -> messageId -> single & plural forms` format.
		 *
		 * @private
		 * @type {Object.<String, Object.<String,Array.<String>>>}
		 */
		this._translationDictionaries = {};

		/**
		 * Plural form rules that will be added to generated translation assets.
		 *
		 * @private
		 * @type {Object.<String, String>}
		 */
		this._pluralFormsRules = {};

		/**
		 * A set of message ids that are found in parsed JS files. For each message id a translation
		 * (with a single and possible plural forms) should be found for the target languages.
		 *
		 * @private
		 * @type {Set.<String>}
		 */
		this._foundMessageIds = new Set();
	}

	/**
	 * Collects found message ids. Emits a warning when there is a suspicion that the message is created incorrectly
	 * (e.g. an incorrect `t()` call).
	 *
	 * @fires warning
	 * @param {String} source Content of the source file.
	 * @param {String} fileName Source file name
	 * @returns {String}
	 */
	translateSource( source, fileName ) {
		findMessages(
			source,
			fileName,
			message => this._foundMessageIds.add( message.id ),
			error => this.emit( 'warning', error )
		);

		return source;
	}

	/**
	 * Loads PO files from the package if the package was not registered already.
	 * If the `compileAllLanguages` flag is set to `true`, then the language set will be expanded to all found languages.
	 *
	 * @fires warning
	 * @param {String} pathToPackage A path to the package containing translations.
	 */
	loadPackage( pathToPackage ) {
		if ( this._handledPackages.has( pathToPackage ) ) {
			return;
		}

		this._handledPackages.add( pathToPackage );

		const pathToTranslationDirectory = this._getPathToTranslationDirectory( pathToPackage );

		if ( !fs.existsSync( pathToTranslationDirectory ) ) {
			return;
		}

		if ( this._compileAllLanguages ) {
			for ( const fileName of fs.readdirSync( pathToTranslationDirectory ) ) {
				if ( !fileName.endsWith( '.po' ) ) {
					this.emit(
						'error',
						`Translation directory (${ pathToTranslationDirectory }) should contain only translation files.`
					);

					continue;
				}

				const language = fileName.replace( /\.po$/, '' );
				const pathToPoFile = path.join( pathToTranslationDirectory, fileName );

				this._languages.add( language );
				this._loadPoFile( language, pathToPoFile );
			}

			return;
		}

		for ( const language of this._languages ) {
			const pathToPoFile = path.join( pathToTranslationDirectory, language + '.po' );

			this._loadPoFile( language, pathToPoFile );
		}
	}

	/**
	 * Returns an array of partial assets containing translations in the executable JS form.
	 *
	 * @fires warning
	 * @fires error
	 * @param {Object} options
	 * @param {String} options.outputDirectory Output directory for the translation files relative to the output.
	 * @param {String[]} options.compilationAssetNames Original asset names from the compiler (e.g. Webpack).
	 * @returns {Array.<Object>}
	 */
	getAssets( { outputDirectory, compilationAssetNames } ) {
		compilationAssetNames = compilationAssetNames
			.filter( name => name.endsWith( '.js' ) );

		let mainLanguage = this._mainLanguage;

		if ( compilationAssetNames.length == 0 ) {
			this.emit( 'error', [
				'No JS asset has been found during the compilation. ' +
				'You should add translation assets directly to the application from the \'lang\' directory.'
			].join( '\n' ) );

			return [];
		}

		if ( compilationAssetNames.length > 1 && !this._allowMultipleJSOutputs ) {
			this.emit( 'error', [
				'Too many JS assets has been found during the compilation. ' +
				'You should add translation assets directly to the application from the `lang` directory or ' +
				'use the `allowMultipleJSOutputs` option to add translations for the main language to all assets.'
			].join( '\n' ) );

			compilationAssetNames = [];
			mainLanguage = null;
		}

		const otherLanguages = Array.from( this._languages )
			.filter( lang => lang !== mainLanguage );

		return [
			...compilationAssetNames.map( assetName => ( {
				outputBody: this._getTranslationAssets( outputDirectory, [ this._mainLanguage ] )[ 0 ].outputBody,
				outputPath: assetName,
				shouldConcat: true
			} ) ),
			...this._getTranslationAssets( outputDirectory, otherLanguages )
		];
	}

	/**
	 * Returns assets for the given directory and languages.
	 *
	 * @private
	 * @param {String} outputDirectory The output directory for assets.
	 * @param {Array.<String>} languages Languages for assets.
	 */
	_getTranslationAssets( outputDirectory, languages ) {
		return languages.map( language => {
			const outputPath = path.join( outputDirectory, `${ language }.js` );

			if ( !this._translationDictionaries[ language ] ) {
				this.emit( 'error', `No translation has been found for the ${ language } language.` );

				return { outputBody: '', outputPath };
			}

			const translations = this._getTranslations( language );

			// Examples of plural forms:
			// pluralForms="nplurals=3; plural=(n==1 ? 0 : n%10>=2 && n%10<=4 && (n%100<12 || n%100>14) ? 1 : 2)"
			// pluralForms="nplurals=3; plural=n==1 ? 0 : n%10>=2 && n%10<=4 && (n%100<12 || n%100>14) ? 1 : 2"

			/** @type {String} */
			const pluralFormsRule = this._pluralFormsRules[ language ];

			let pluralFormFunction;

			if ( !pluralFormsRule ) {
				// This could be improved in the future by using a 3-rd party library for plural forms.
				this.emit( 'warning', `The plural form function for the '${ language }' language has not been set.` );
			} else {
				const pluralFormFunctionBodyMatch = pluralFormsRule.match( /(?:plural=)(.+)(?:)/ );

				// Add support for ES5 - this function will not be transpiled.
				pluralFormFunction = `function(n){return ${ pluralFormFunctionBodyMatch[ 1 ] };}`;
			}

			// Stringify translations and remove unnecessary `""` around property names.
			const stringifiedTranslations = JSON.stringify( translations )
				.replace( /"([\w_]+)":/g, '$1:' );

			const outputBody = (
				'(function(d){' +
				`	const l = d['${ language }'] = d['${ language }'] || {};` +
				'	l.dictionary=Object.assign(' +
				'		l.dictionary||{},' +
				`		${ stringifiedTranslations }` +
				'	);' +
				( pluralFormFunction ? `l.getPluralForm=${ pluralFormFunction };` : '' ) +
				'})(window.CKEDITOR_TRANSLATIONS||(window.CKEDITOR_TRANSLATIONS={}));'
			);

			return { outputBody, outputPath };
		} );
	}

	/**
	 * Walks through the set of found message ids and collects corresponding strings in the target language dictionary.
	 * Skips messages that lacks their translations.
	 *
	 * @private
	 * @param {String} language The target language.
	 * @returns {Object.<String,String|String[]>}
	 */
	_getTranslations( language ) {
		const langDictionary = this._translationDictionaries[ language ];
		const translatedStrings = {};

		for ( const messageId of this._foundMessageIds ) {
			const translatedMessage = langDictionary[ messageId ];

			if ( !translatedMessage || translatedMessage.length === 0 ) {
				this.emit( 'warning', `A translation is missing for '${ messageId }' in the '${ language }' language.` );

				continue;
			}

			// Register first form as a default form if only one form was provided.
			translatedStrings[ messageId ] = translatedMessage.length > 1 ?
				translatedMessage :
				translatedMessage[ 0 ];
		}

		return translatedStrings;
	}

	/**
	 * Loads translations from the PO file if that file exists.
	 *
	 * @private
	 * @param {String} language PO file's language.
	 * @param {String} pathToPoFile Path to the target PO file.
	 */
	_loadPoFile( language, pathToPoFile ) {
		if ( !fs.existsSync( pathToPoFile ) ) {
			return;
		}

		const parsedTranslationFile = PO.parse( fs.readFileSync( pathToPoFile, 'utf-8' ) );

		this._pluralFormsRules[ language ] = this._pluralFormsRules[ language ] || parsedTranslationFile.headers[ 'Plural-Forms' ];

		if ( !this._translationDictionaries[ language ] ) {
			this._translationDictionaries[ language ] = {};
		}

		const dictionary = this._translationDictionaries[ language ];

		for ( const item of parsedTranslationFile.items ) {
			dictionary[ item.msgid ] = item.msgstr;
		}
	}

	/**
	 * Returns a path to the translation directory depending on the path to the package.
	 *
	 * @protected
	 * @param {String} pathToPackage
	 * @returns {String}
	 */
	_getPathToTranslationDirectory( pathToPackage ) {
		return path.join( pathToPackage, 'lang', 'translations' );
	}
};
