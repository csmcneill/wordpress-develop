/**
 * WordPress dependencies
 */
import { test, expect } from '@wordpress/e2e-test-utils-playwright';

/**
 * The permalink settings screen (options-permalink.php) and its effect on
 * front-end URL resolution. There is no REST endpoint for the permalink
 * structure, so the screen itself is both the surface under test and the
 * only way to change the setting.
 */
test.describe( 'Permalink Settings', () => {
	/** The structure found before the tests ran, restored afterwards. */
	let originalStructure;

	test.beforeAll( async ( { browser } ) => {
		const page = await browser.newPage();
		await page.goto( '/wp-admin/options-permalink.php' );
		originalStructure = await page
			.locator( '#permalink_structure' )
			.inputValue();
		await page.close();
	} );

	test.afterAll( async ( { browser } ) => {
		const page = await browser.newPage();
		await page.goto( '/wp-admin/options-permalink.php' );
		await page.locator( '#permalink_structure' ).fill( originalStructure );
		await page.getByRole( 'button', { name: 'Save Changes' } ).click();
		await page.close();
	} );

	test.beforeEach( async ( { requestUtils } ) => {
		await requestUtils.deleteAllPosts();
	} );

	test( 'saves the post name structure and serves posts at the new URLs', async ( {
		admin,
		page,
		requestUtils,
	} ) => {
		const post = await requestUtils.createPost( {
			title: 'Permalink Probe',
			content: '<p>URL resolution target.</p>',
			status: 'publish',
		} );

		await admin.visitAdminPage( '/options-permalink.php' );
		await page.getByRole( 'radio', { name: 'Post name' } ).check();
		await page.getByRole( 'button', { name: 'Save Changes' } ).click();

		await expect(
			page.getByText( 'Permalink structure updated.' )
		).toBeVisible();

		// The post resolves at its pretty URL.
		const response = await page.goto( `/${ post.slug }/` );
		expect( response.status() ).toBe( 200 );
		await expect(
			page.getByRole( 'heading', { name: 'Permalink Probe' } )
		).toBeVisible();
	} );

	test( 'serves posts with query parameters when the structure is plain', async ( {
		admin,
		page,
		requestUtils,
	} ) => {
		const post = await requestUtils.createPost( {
			title: 'Plain Permalink Probe',
			content: '<p>Query string target.</p>',
			status: 'publish',
		} );

		await admin.visitAdminPage( '/options-permalink.php' );
		await page.getByRole( 'radio', { name: 'Plain' } ).check();
		await page.getByRole( 'button', { name: 'Save Changes' } ).click();

		await expect(
			page.getByText( 'Permalink structure updated.' )
		).toBeVisible();

		// The post resolves via the plain query-string URL.
		const response = await page.goto( `/?p=${ post.id }` );
		expect( response.status() ).toBe( 200 );
		await expect(
			page.getByRole( 'heading', { name: 'Plain Permalink Probe' } )
		).toBeVisible();

		// WordPress now reports the plain form as the post's permalink.
		// Whether the old pretty URL 404s or guess-redirects depends on the
		// server's rewrite handling, so it is deliberately not asserted.
		// The query-form REST route is used directly: the REST root
		// discovered earlier in this file may be the pretty /wp-json/ form,
		// which stops resolving once the structure is plain.
		const refreshedResponse = await requestUtils.request.get(
			new URL(
				`/?rest_route=/wp/v2/posts/${ post.id }`,
				requestUtils.baseURL
			).toString()
		);
		const refreshed = await refreshedResponse.json();
		expect( refreshed.link ).toContain( `?p=${ post.id }` );

		// Restore a pretty structure so the plain setting does not leak into
		// specs that run after this one.
		await admin.visitAdminPage( '/options-permalink.php' );
		await page.getByRole( 'radio', { name: 'Post name' } ).check();
		await page.getByRole( 'button', { name: 'Save Changes' } ).click();
		await expect(
			page.getByText( 'Permalink structure updated.' )
		).toBeVisible();
	} );
} );
