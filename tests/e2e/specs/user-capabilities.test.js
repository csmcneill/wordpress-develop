/**
 * External dependencies
 */
import path from 'node:path';

/**
 * WordPress dependencies
 */
import {
	test,
	expect,
	RequestUtils,
} from '@wordpress/e2e-test-utils-playwright';

/** Password shared by the throwaway users these tests create. */
const TEST_USER_PASSWORD = 'password';

/**
 * Creates a user with the given role (if needed) and persists an
 * authenticated browser session for them, returning the storage state path
 * usable with test.use().
 *
 * @param {RequestUtils} requestUtils The admin-scoped request utils fixture.
 * @param {string}       role         The role slug, e.g. 'editor'.
 * @return {Promise<string>} Path to the user's storage state file.
 */
async function createUserSession( requestUtils, role ) {
	const username = `capability-${ role }`;

	try {
		await requestUtils.createUser( {
			username,
			email: `${ role }@capabilities.test`,
			password: TEST_USER_PASSWORD,
			roles: [ role ],
		} );
	} catch ( error ) {
		// The user may already exist from a previous run.
		if ( error.code !== 'existing_user_login' ) {
			throw error;
		}
	}

	const storageStatePath = storageStatePathFor( role );
	const userRequestUtils = await RequestUtils.setup( {
		user: { username, password: TEST_USER_PASSWORD },
		baseURL: requestUtils.baseURL,
		storageStatePath,
	} );
	await userRequestUtils.setupRest();

	return storageStatePath;
}

/**
 * Storage state file path for a role's session, alongside the admin's.
 *
 * @param {string} role The role slug.
 * @return {string} Absolute storage state path.
 */
function storageStatePathFor( role ) {
	return path.join(
		path.dirname(
			process.env.STORAGE_STATE_PATH ??
				path.join(
					process.cwd(),
					'artifacts/storage-states/admin.json'
				)
		),
		`capability-${ role }.json`
	);
}

test.describe( 'User Capabilities', () => {
	test.describe( 'subscriber', () => {
		test.use( { storageState: storageStatePathFor( 'subscriber' ) } );

		test.beforeAll( async ( { requestUtils } ) => {
			await createUserSession( requestUtils, 'subscriber' );
		} );

		test( 'cannot access the posts list', async ( { page } ) => {
			await page.goto( '/wp-admin/edit.php' );

			await expect(
				page.getByText(
					'Sorry, you are not allowed to access this page.'
				)
			).toBeVisible();
		} );
	} );

	test.describe( 'author', () => {
		test.use( { storageState: storageStatePathFor( 'author' ) } );

		test.beforeAll( async ( { requestUtils } ) => {
			await createUserSession( requestUtils, 'author' );
		} );

		test.beforeEach( async ( { requestUtils } ) => {
			await requestUtils.deleteAllPosts();
		} );

		test( "cannot edit another user's post", async ( {
			page,
			requestUtils,
		} ) => {
			// Created via the admin-scoped fixture, so the admin is the author.
			const post = await requestUtils.createPost( {
				title: "Admin's Post",
				status: 'publish',
			} );

			await page.goto(
				`/wp-admin/post.php?post=${ post.id }&action=edit`
			);

			await expect(
				page.getByText(
					'Sorry, you are not allowed to edit this item.'
				)
			).toBeVisible();
		} );
	} );

	test.describe( 'editor', () => {
		test.use( { storageState: storageStatePathFor( 'editor' ) } );

		test.beforeAll( async ( { requestUtils } ) => {
			await createUserSession( requestUtils, 'editor' );
		} );

		test.beforeEach( async ( { requestUtils } ) => {
			await requestUtils.deleteAllPosts();
		} );

		test( "can edit another user's post", async ( {
			page,
			requestUtils,
		} ) => {
			const post = await requestUtils.createPost( {
				title: "Admin's Post",
				status: 'publish',
			} );

			await page.goto(
				`/wp-admin/post.php?post=${ post.id }&action=edit`
			);

			// The block editor loads with the post title in the canvas.
			await page
				.frameLocator( '[name=editor-canvas]' )
				.locator( 'body > *' )
				.first()
				.waitFor();
			await expect(
				page
					.frameLocator( '[name=editor-canvas]' )
					.getByRole( 'textbox', { name: 'Add title' } )
			).toHaveText( "Admin's Post" );
		} );
	} );

	test.describe( 'contributor', () => {
		test.use( { storageState: storageStatePathFor( 'contributor' ) } );

		test.beforeAll( async ( { requestUtils } ) => {
			await createUserSession( requestUtils, 'contributor' );
		} );

		test( 'cannot manage plugins', async ( { page } ) => {
			await page.goto( '/wp-admin/plugins.php' );

			await expect(
				page.getByText(
					'Sorry, you are not allowed to access this page.'
				)
			).toBeVisible();
		} );
	} );
} );
