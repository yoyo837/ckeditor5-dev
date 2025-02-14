/**
 * @license Copyright (c) 2003-2022, CKSource Holding sp. z o.o. All rights reserved.
 * For licensing, see LICENSE.md.
 */

'use strict';

const tools = require( './tools' );
const defaultOrigin = 'origin';

module.exports = {
	/**
	 * Parses GitHub URL. Extracts used server, repository and branch.
	 *
	 * @param {String} url GitHub URL from package.json file.
	 * @returns {Object} urlInfo
	 * @returns {String} urlInfo.server
	 * @returns {String} urlInfo.repository
	 * @returns {String} urlInfo.user
	 * @returns {String} urlInfo.name
	 * @returns {String} urlInfo.branch
	 */
	parseRepositoryUrl( url ) {
		const regexp = /^((?:git@|(?:https?|git):\/\/)github\.com(?:\/|:))?(([\w-]+)\/([\w-]+(?:\.git)?))(?:#([\w-/.]+))?$/;
		const match = url.match( regexp );

		if ( !match ) {
			return null;
		}

		const server = match[ 1 ] || 'git@github.com:';
		const repository = match[ 2 ];
		const user = match[ 3 ];
		const branch = match[ 5 ] || 'master';
		let name = match[ 4 ];

		name = /\.git$/.test( name ) ? name.slice( 0, -4 ) : name;

		return {
			server,
			repository,
			branch,
			user,
			name
		};
	},

	/**
	 * Clones repository to workspace.
	 *
	 * @param {Object} urlInfo Parsed URL object from {@link #parseRepositoryUrl}.
	 * @param {String} workspacePath Path to the workspace location where repository will be cloned.
	 */
	cloneRepository( urlInfo, workspacePath ) {
		const cloneCommands = [
			`cd ${ workspacePath }`,
			`git clone ${ urlInfo.server + urlInfo.repository }`
		];

		tools.shExec( cloneCommands.join( ' && ' ) );
	},

	/**
	 * Checks out branch on selected repository.
	 *
	 * @param {String} repositoryLocation Absolute path to repository.
	 * @param {String} branchName Name of the branch to checkout.
	 */
	checkout( repositoryLocation, branchName ) {
		const checkoutCommands = [
			`cd ${ repositoryLocation }`,
			`git checkout ${ branchName }`
		];

		tools.shExec( checkoutCommands.join( ' && ' ) );
	},

	/**
	 * Pulls specified branch from origin.
	 *
	 * @param {String} repositoryLocation Absolute path to repository.
	 * @param {String} branchName Branch name to pull.
	 */
	pull( repositoryLocation, branchName ) {
		const pullCommands = [
			`cd ${ repositoryLocation }`,
			`git pull ${ defaultOrigin } ${ branchName }`
		];

		tools.shExec( pullCommands.join( ' && ' ) );
	},

	/**
	 * Fetch all branches from each origin on selected repository.
	 *
	 * @param {String} repositoryLocation
	 */
	fetchAll( repositoryLocation ) {
		const fetchCommands = [
			`cd ${ repositoryLocation }`,
			'git fetch --all'
		];

		tools.shExec( fetchCommands.join( ' && ' ) );
	},

	/**
	 * Initializes new repository, adds and merges CKEditor5 boilerplate project.
	 *
	 * @param {String} repositoryPath Absolute path where repository should be created.
	 */
	initializeRepository( repositoryPath ) {
		tools.shExec( `git init ${ repositoryPath }` );
	},

	/**
	 * Returns Git status of repository stored under specified path. It runs `git status --porcelain -sb` command.
	 *
	 * @param {String} repositoryPath Absolute path to repository.
	 * @returns {String} Executed command's result.
	 */
	getStatus( repositoryPath ) {
		return tools.shExec( `cd ${ repositoryPath } && git status --porcelain -sb`, { verbosity: 'error' } );
	},

	/**
	 * Creates initial commit on repository under specified path.
	 *
	 * @param {String} pluginName
	 * @param {String} repositoryPath
	 */
	initialCommit( pluginName, repositoryPath ) {
		const commitCommands = [
			`cd ${ repositoryPath }`,
			'git add .',
			`git commit -m "Initial commit for ${ pluginName }."`
		];

		tools.shExec( commitCommands.join( ' && ' ) );
	},

	/**
	 * Adds remote to repository under specified path.
	 *
	 * @param {String} repositoryPath
	 * @param {String} gitHubPath
	 */
	addRemote( repositoryPath, gitHubPath ) {
		const addRemoteCommands = [
			`cd ${ repositoryPath }`,
			`git remote add ${ defaultOrigin } git@github.com:${ gitHubPath }.git`
		];

		tools.shExec( addRemoteCommands.join( ' && ' ) );
	},

	/*
	 * Creates commit on repository under specified path.
	 *
	 * @param {String} message
	 * @param {String} repositoryPath
	 */
	commit( message, repositoryPath ) {
		const commitCommands = [
			`cd ${ repositoryPath }`,
			`git commit --all --message "${ message }"`
		];

		tools.shExec( commitCommands.join( ' && ' ) );
	},

	/**
	 * Pushes changes to repository's default location.
	 *
	 * @param {String} repositoryPath
	 */
	push( repositoryPath ) {
		const pushCommands = [
			`cd ${ repositoryPath }`,
			'git push'
		];

		tools.shExec( pushCommands.join( ' && ' ) );
	}
};
